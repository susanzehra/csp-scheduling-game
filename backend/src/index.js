const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const encoder = new TextEncoder();
const PASSWORD_ITERATIONS = 100000;
const SESSION_MAX_SECONDS = 12 * 60 * 60;

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = env.ALLOWED_ORIGIN || "";
  return {
    "Access-Control-Allow-Origin": origin === allowed ? origin : allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin"
  };
}

function json(request, env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(request, env), "Cache-Control": "no-store" }
  });
}

function validId(value) {
  return typeof value === "string" && /^[a-f0-9-]{20,80}$/i.test(value);
}

function bytesToBase64Url(bytes) {
  let binary = "";
  new Uint8Array(bytes).forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function safeEqual(first, second) {
  if (first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) difference |= first[index] ^ second[index];
  return difference === 0;
}

async function derivePasswordHash(password, salt) {
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

async function signSession(payloadPart, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(payloadPart)));
}

async function createSessionToken(env, config) {
  if (!env.SESSION_SECRET) throw new Error("SESSION_SECRET is not configured.");
  const nowSeconds = Math.floor(Date.now() / 1000);
  const passwordExpirySeconds = Math.floor(new Date(config.expires_at).getTime() / 1000);
  const payload = {
    exp: Math.min(nowSeconds + SESSION_MAX_SECONDS, passwordExpirySeconds),
    configVersion: config.updated_at
  };
  const payloadPart = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${payloadPart}.${await signSession(payloadPart, env.SESSION_SECRET)}`;
}

async function getAccessConfig(env) {
  return env.DB.prepare(
    "SELECT password_salt, password_hash, expires_at, updated_at FROM access_config WHERE id = 1"
  ).first();
}

async function verifySession(request, env) {
  if (!env.SESSION_SECRET) return false;
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return false;
  const token = authorization.slice(7);
  const [payloadPart, suppliedSignature, extra] = token.split(".");
  if (!payloadPart || !suppliedSignature || extra) return false;
  const expectedSignature = await signSession(payloadPart, env.SESSION_SECRET);
  if (!safeEqual(encoder.encode(suppliedSignature), encoder.encode(expectedSignature))) return false;

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadPart)));
  } catch {
    return false;
  }

  const config = await getAccessConfig(env);
  const now = Date.now();
  return Boolean(
    config &&
    payload.configVersion === config.updated_at &&
    Number(payload.exp) * 1000 > now &&
    new Date(config.expires_at).getTime() > now
  );
}

function adminAuthorized(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  return Boolean(env.ADMIN_TOKEN && authorization === `Bearer ${env.ADMIN_TOKEN}`);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });

    const origin = request.headers.get("Origin");
    if (origin && origin !== env.ALLOWED_ORIGIN) return json(request, env, { error: "Origin not allowed" }, 403);

    try {
      if (request.method === "GET" && url.pathname === "/stats") {
        const [visitors, completions] = await env.DB.batch([
          env.DB.prepare("SELECT COUNT(*) AS count FROM visitors"),
          env.DB.prepare("SELECT COUNT(*) AS count FROM completions")
        ]);
        return json(request, env, {
          visitors: visitors.results[0].count,
          completions: completions.results[0].count
        });
      }

      if (request.method === "POST" && url.pathname === "/visit") {
        const body = await request.json();
        if (!validId(body.visitorId)) return json(request, env, { error: "Invalid visitor ID" }, 400);
        await env.DB.prepare(
          "INSERT OR IGNORE INTO visitors (visitor_id, first_seen) VALUES (?, ?)"
        ).bind(body.visitorId, new Date().toISOString()).run();
        return json(request, env, { saved: true });
      }

      if (request.method === "POST" && url.pathname === "/auth") {
        const body = await request.json();
        if (typeof body.password !== "string" || body.password.length < 1 || body.password.length > 128) {
          return json(request, env, { error: "Invalid password" }, 400);
        }
        const config = await getAccessConfig(env);
        if (!config) return json(request, env, { error: "Activity password is not configured. Contact the instructor." }, 503);
        if (new Date(config.expires_at).getTime() <= Date.now()) {
          return json(request, env, { error: "The activity password has expired. Contact the instructor." }, 403);
        }
        const calculatedHash = await derivePasswordHash(body.password, base64UrlToBytes(config.password_salt));
        const storedHash = base64UrlToBytes(config.password_hash);
        if (!safeEqual(calculatedHash, storedHash)) return json(request, env, { error: "Incorrect activity password." }, 401);
        return json(request, env, {
          authenticated: true,
          token: await createSessionToken(env, config),
          passwordExpiresAt: config.expires_at,
          inactivityMinutes: 20
        });
      }

      if (request.method === "POST" && url.pathname === "/admin/access") {
        if (!adminAuthorized(request, env)) return json(request, env, { error: "Unauthorized" }, 401);
        const body = await request.json();
        if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128) {
          return json(request, env, { error: "Password must contain 8–128 characters." }, 400);
        }
        const expiresAt = new Date(body.expiresAt);
        if (!body.expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
          return json(request, env, { error: "expiresAt must be a valid future date/time." }, 400);
        }
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const passwordHash = await derivePasswordHash(body.password, salt);
        const updatedAt = new Date().toISOString();
        await env.DB.prepare(
          `INSERT INTO access_config (id, password_salt, password_hash, expires_at, updated_at)
           VALUES (1, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             password_salt = excluded.password_salt,
             password_hash = excluded.password_hash,
             expires_at = excluded.expires_at,
             updated_at = excluded.updated_at`
        ).bind(bytesToBase64Url(salt), bytesToBase64Url(passwordHash), expiresAt.toISOString(), updatedAt).run();
        return json(request, env, { saved: true, expiresAt: expiresAt.toISOString(), updatedAt });
      }

      if (request.method === "POST" && url.pathname === "/complete") {
        if (!(await verifySession(request, env))) return json(request, env, { error: "Session expired or unauthorized" }, 401);
        const body = await request.json();
        if (!validId(body.completionId) || typeof body.encryptedRecord !== "string" || body.encryptedRecord.length < 100 || body.encryptedRecord.length > 2000) {
          return json(request, env, { error: "Invalid encrypted completion" }, 400);
        }
        await env.DB.prepare(
          "INSERT OR IGNORE INTO completions (completion_id, encrypted_record, received_at) VALUES (?, ?, ?)"
        ).bind(body.completionId, body.encryptedRecord, new Date().toISOString()).run();
        return json(request, env, { saved: true });
      }

      if (request.method === "GET" && url.pathname === "/admin/export") {
        if (!adminAuthorized(request, env)) return json(request, env, { error: "Unauthorized" }, 401);
        const rows = await env.DB.prepare(
          "SELECT completion_id, encrypted_record, received_at FROM completions ORDER BY received_at"
        ).all();
        return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), records: rows.results }, null, 2), {
          headers: {
            ...JSON_HEADERS,
            ...corsHeaders(request, env),
            "Content-Disposition": `attachment; filename="csp-completions-${new Date().toISOString().slice(0, 10)}.json"`,
            "Cache-Control": "no-store"
          }
        });
      }

      return json(request, env, { error: "Not found" }, 404);
    } catch (error) {
      return json(request, env, { error: "Server error" }, 500);
    }
  }
};

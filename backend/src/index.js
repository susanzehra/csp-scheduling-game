const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

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

      if (request.method === "POST" && url.pathname === "/complete") {
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
        const authorization = request.headers.get("Authorization") || "";
        if (!env.ADMIN_TOKEN || authorization !== `Bearer ${env.ADMIN_TOKEN}`) {
          return json(request, env, { error: "Unauthorized" }, 401);
        }
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

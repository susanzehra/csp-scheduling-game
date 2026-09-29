/*
 * Public configuration. It is safe for this file to be visible on GitHub.
 * Never place the private key or the Cloudflare ADMIN_TOKEN here.
 */
window.CSP_GAME_CONFIG = {
  API_BASE_URL: "PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE",
  PUBLIC_KEY_PEM: `-----BEGIN PUBLIC KEY-----
PASTE_YOUR_PUBLIC_KEY_HERE
-----END PUBLIC KEY-----`
};

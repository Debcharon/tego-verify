# tego-verify

An optional Telegram Mini App for [tego](https://github.com/Debcharon/tego). It runs as a static page and two Vercel Node.js Functions. The browser displays Cloudflare Turnstile; the server validates the Turnstile token and Telegram's signed Mini App data, then gives the bot a short-lived signed proof. The bot remains on long polling and needs no public HTTP endpoint.

## Deploy

1. Create a Cloudflare Turnstile widget for the exact Vercel production hostname. Use a widget mode that works in Telegram's WebView.
2. Import this repository into Vercel. Set these environment variables for Production:
   - `TELEGRAM_BOT_ID`: numeric ID from Telegram getMe, not the username or bot token.
   - `TURNSTILE_SITE_KEY`: public widget site key.
   - `TURNSTILE_SECRET_KEY`: private server-side secret.
   - `VERIFY_HOSTNAME`: exact production hostname, without scheme or path.
   - `VERIFY_SIGNING_KEY`: 64 hexadecimal characters from `openssl rand -hex 32`.
3. Deploy and open the production URL. Then set `VERIFY_URL` to that HTTPS URL and `VERIFY_SIGNING_KEY` to the same value in the tego bot environment. Restart the bot.

The bot token is **not** needed in Vercel. Keep `VERIFY_SIGNING_KEY` and `TURNSTILE_SECRET_KEY` private. Vercel Preview URLs require their own matching Turnstile hostname/configuration; use the Production URL for the bot.

The bot sends a ten-minute challenge tied to a user and a random nonce. The API checks its HMAC, Telegram's Ed25519 Mini App signature and user ID, and Turnstile's one-time token, action, and hostname. The resulting proof expires after five minutes and is accepted once by the bot against its local SQLite challenge. A successful verification does not forward the user's earlier message; the user sends it again. If verification is not configured in the bot, it stays disabled.

Run tests with `npm test` (Node.js 20 or newer). No npm dependencies are required.

# tego-verify

An optional Telegram Mini App for [tego](https://github.com/Debcharon/tego). It runs as a Next.js App Router page and two Node.js Route Handlers on Vercel. The frameless browser page displays either Cloudflare Turnstile or hCaptcha; the server verifies that provider's token and the bot's signed challenge, then returns a short-lived signed proof. The bot remains on long polling and needs no public HTTP endpoint.

## Configure

1. Choose one CAPTCHA provider for this deployment:
   - **Turnstile** (existing default): set `CAPTCHA_PROVIDER=turnstile`, `TURNSTILE_SITE_KEY`, and `TURNSTILE_SECRET_KEY`. If `CAPTCHA_PROVIDER` is absent, Turnstile is selected.
   - **hCaptcha**: set `CAPTCHA_PROVIDER=hcaptcha`, `HCAPTCHA_SITE_KEY`, and `HCAPTCHA_SECRET_KEY`. Create the sitekey for the production domain. The inactive provider's keys are ignored.
2. Set `VERIFY_HOSTNAME` to the exact production hostname, without scheme or path. Set `VERIFY_SIGNING_KEY` to 64 hexadecimal characters from `openssl rand -hex 32`. Use the same signing key in the tego bot. Keep both the signing key and the selected provider's secret private.
3. Deploy on Vercel and open the production URL. Set the bot's `VERIFY_URL` to that HTTPS URL and `VERIFY_SIGNING_KEY` to the matching value. Restart the bot. Switching CAPTCHA providers only changes this web service's configuration; the bot's verification protocol and database stay the same.

Copy `.env.example` for the variable names. Vercel environment settings provide the runtime variables; only the selected provider and public sitekey are returned by `/api/config`. The secret and signing key remain server-side. For local development, put values in an ignored `.env.local` file. Vercel Preview URLs need their own matching hostname and CAPTCHA sitekey configuration. The bot token and bot ID are not needed in Vercel.

The bot sends a ten-minute challenge tied to a user and a random nonce. The API verifies its HMAC and the selected provider's one-time token. Turnstile responses must match the configured hostname and `tego_verify` action. For hCaptcha, the API submits the expected sitekey to its siteverify endpoint; hCaptcha documents the returned hostname as diagnostic rather than an authentication field. Keyboard-button Mini Apps do not receive Telegram initData, so the page cannot authenticate the Telegram user directly. Instead, the bot checks that the proof's user ID matches the sender of Telegram's web_app_data service message and atomically consumes the matching local challenge. The proof expires after five minutes. A successful verification does not forward the user's earlier message; the user sends it again. If the selected provider is misconfigured or unavailable, verification fails closed.

Install with `pnpm install`, then run `pnpm dev` locally, `pnpm test` for protocol, Route Handler, and CAPTCHA widget checks, and `pnpm build` for a production build. The root page is statically prerendered, and `vercel.json` selects the Next.js framework for the existing Vercel project; `/api/config` and `/api/verify` remain dynamic Node.js handlers. Live CAPTCHA credentials and a Telegram WebView are still needed for an end-to-end production check.

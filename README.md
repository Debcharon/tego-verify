# tego-verify

[English](README.md) | [简体中文](README.zh-CN.md)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FDebcharon%2Ftego-verify)

An optional Telegram Mini App for [tego](https://github.com/Debcharon/tego). It runs as a Next.js App Router page and two Node.js Route Handlers on Vercel. The frameless browser page displays either Cloudflare Turnstile or hCaptcha; the server verifies that provider's token and the bot's signed challenge, then returns a short-lived signed proof. The bot remains on long polling and needs no public HTTP endpoint.

## Deploy

The button above clones this repository into a **new** Vercel project; it does not redeploy an existing project. After creation, set the environment variables below for the chosen CAPTCHA provider and production hostname, then deploy again so the runtime can use them. Existing Git-connected projects deploy updates when their production branch is updated.

## Configure

### Vercel environment variables

Add these to the Vercel project's **Production** environment. Choose one CAPTCHA provider; credentials for the other provider are ignored.

| Variable | Required when | Value |
| --- | --- | --- |
| `CAPTCHA_PROVIDER` | Optional | `turnstile` or `hcaptcha`. Defaults to `turnstile` when unset. |
| `TURNSTILE_SITE_KEY` | Using Turnstile | Public site key for the deployment hostname. |
| `TURNSTILE_SECRET_KEY` | Using Turnstile | Private Turnstile secret key. |
| `HCAPTCHA_SITE_KEY` | Using hCaptcha | Public sitekey configured for the deployment hostname. |
| `HCAPTCHA_SECRET_KEY` | Using hCaptcha | Private hCaptcha secret key. |
| `VERIFY_HOSTNAME` | Always | Exact deployment hostname, such as `verify.example.com`; no `https://`, port, or path. |
| `VERIFY_SIGNING_KEY` | Always | 64 hexadecimal characters. Generate once with `openssl rand -hex 32` and use the same value in the bot. |

The selected provider and public site key are returned by `/api/config`. Provider secrets and the signing key stay on the server; do not put them in `NEXT_PUBLIC_*` variables or commit them. An incomplete or invalid configuration makes the verification API return 503.

### tego bot variables

Set these in the bot's environment after the Vercel deployment has a public URL. Both values are needed to enable verification.

| Variable | Value |
| --- | --- |
| `VERIFY_URL` | Public HTTPS URL of this Mini App, such as `https://verify.example.com`; no query string or fragment. |
| `VERIFY_SIGNING_KEY` | Exactly the same 64-character hexadecimal key used in Vercel. |

Deploy or redeploy the Vercel project after setting its variables, then restart the bot after setting its variables. The bot does not need a CAPTCHA provider setting, and Vercel does not need the bot token or bot ID. Switching providers only changes this web service's configuration; the bot's verification protocol and database stay the same.

For local development, copy the names from `.env.example` into an ignored `.env.local` file. A Vercel Preview deployment needs a `VERIFY_HOSTNAME` that matches its preview hostname and a CAPTCHA site key configured for that hostname.

## How verification works

1. The bot issues a signed challenge bound to the user and a random nonce (10 minutes).
2. The API checks the challenge HMAC and CAPTCHA, then returns a signed proof (5 minutes). Turnstile checks the hostname and `tego_verify` action; hCaptcha submits the expected sitekey, while its reported hostname is diagnostic.
3. The bot matches the proof's user ID to the `web_app_data` sender and atomically consumes the challenge. The user then sends the original message again.

Keyboard-button Mini Apps have no Telegram initData, so the page cannot identify the sender directly. Missing configuration or provider failure rejects verification.

## Local development

Install dependencies and start the TypeScript app:

```sh
pnpm install
pnpm dev
```

Check changes with `pnpm typecheck`, `pnpm test`, and `pnpm build`. A full verification check needs real CAPTCHA credentials and a Telegram WebView.

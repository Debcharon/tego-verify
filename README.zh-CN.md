# tego-verify

[English](README.md) | [简体中文](README.zh-CN.md)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FDebcharon%2Ftego-verify)

[tego](https://github.com/Debcharon/tego) 的可选 Telegram Mini App 验证页面，使用 Next.js App Router 和两个 Node.js Route Handler 部署在 Vercel。无外框的页面可显示 Cloudflare Turnstile 或 hCaptcha。服务端验证 CAPTCHA 响应及机器人签发的挑战，再返回短期有效的签名凭证。机器人继续通过长轮询运行，不需要公开 HTTP 接口。

## 部署

上方按钮会从本仓库创建**新的** Vercel 项目，不会重新部署已有项目。创建项目后，按下文配置所选 CAPTCHA 服务及生产域名所需的环境变量，再部署一次，使运行时读取这些配置。已连接 Git 的项目在生产分支更新后会自动部署。

## 配置

1. 为此次部署选择一种 CAPTCHA：
   - **Turnstile**（默认）：设置 `CAPTCHA_PROVIDER=turnstile`、`TURNSTILE_SITE_KEY` 和 `TURNSTILE_SECRET_KEY`。未设置 `CAPTCHA_PROVIDER` 时也会使用 Turnstile。
   - **hCaptcha**：设置 `CAPTCHA_PROVIDER=hcaptcha`、`HCAPTCHA_SITE_KEY` 和 `HCAPTCHA_SECRET_KEY`，并为生产域名创建 sitekey。未选中的服务密钥不会使用。
2. 将 `VERIFY_HOSTNAME` 设为准确的生产域名，不含协议和路径。用 `openssl rand -hex 32` 生成 64 位十六进制 `VERIFY_SIGNING_KEY`，并在 tego 机器人中使用同一个签名密钥。签名密钥及所选服务的 secret 必须保密。
3. 创建 Vercel 项目后，配置环境变量并部署或重新部署。把机器人的 `VERIFY_URL` 设为生产环境的 HTTPS 地址，`VERIFY_SIGNING_KEY` 设为相同的签名密钥。修改机器人配置后重启机器人。切换 CAPTCHA 服务只需修改此网页服务的配置；机器人验证协议和数据库不变。

环境变量名称见 `.env.example`。Vercel 的环境设置向服务端提供运行时变量；`/api/config` 只返回所选 CAPTCHA 服务及其公开 sitekey，secret 和签名密钥始终留在服务端。本地开发可将变量写入被忽略的 `.env.local`。若要测试 Vercel 预览地址，需要为该地址另外配置匹配的域名和 CAPTCHA sitekey。Vercel 无需配置机器人 token 或机器人 ID。

机器人会发出与用户及随机 nonce 绑定、有效期十分钟的挑战。API 验证挑战的 HMAC 和所选服务的一次性 CAPTCHA token。Turnstile 响应必须匹配配置的域名及 `tego_verify` action。对于 hCaptcha，API 会在 siteverify 请求中提交预期的 sitekey；hCaptcha 返回的 hostname 是诊断信息，不作为身份认证依据。通过键盘按钮打开的 Mini App 不会收到 Telegram initData，因此页面无法直接验证 Telegram 用户身份；机器人会检查签名凭证中的用户 ID 是否与 Telegram `web_app_data` 服务消息的发送者一致，并在本地原子地消费对应挑战。签名凭证有效期为五分钟。验证成功不会自动转发用户之前的消息，用户需要重新发送。所选 CAPTCHA 服务配置不完整或不可用时，验证会拒绝通过。

本地运行：先执行 `pnpm install`，然后运行 `pnpm dev`；`pnpm test` 检查协议、Route Handler 和 CAPTCHA 组件，`pnpm build` 构建生产版本。根页面会静态预渲染，`vercel.json` 为现有 Vercel 项目指定 Next.js 框架；`/api/config` 和 `/api/verify` 仍是动态 Node.js 接口。完整的生产端到端验证还需要真实的 CAPTCHA 凭据和 Telegram WebView。

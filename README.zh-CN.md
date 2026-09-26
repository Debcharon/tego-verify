# tego-verify

[English](README.md) | [简体中文](README.zh-CN.md)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FDebcharon%2Ftego-verify)

[tego](https://github.com/Debcharon/tego) 的可选 Telegram Mini App 验证页面，使用 Next.js App Router 和两个 Node.js Route Handler 部署在 Vercel。无外框的页面可显示 Cloudflare Turnstile 或 hCaptcha。服务端验证 CAPTCHA 响应及机器人签发的挑战，再返回短期有效的签名凭证。机器人继续通过长轮询运行，不需要公开 HTTP 接口。

## 部署

上方按钮会从本仓库创建**新的** Vercel 项目，不会重新部署已有项目。创建项目后，按下文配置所选 CAPTCHA 服务及生产域名所需的环境变量，再部署一次，使运行时读取这些配置。已连接 Git 的项目在生产分支更新后会自动部署。

## 配置

### Vercel 环境变量

在 Vercel 项目的 **Production** 环境中设置以下变量。选择一种 CAPTCHA 服务；未选中服务的密钥不会使用。

| 变量 | 何时必填 | 填写内容 |
| --- | --- | --- |
| `CAPTCHA_PROVIDER` | 可选 | `turnstile` 或 `hcaptcha`；未设置时默认使用 `turnstile`。 |
| `TURNSTILE_SITE_KEY` | 使用 Turnstile | 为部署域名配置的公开 site key。 |
| `TURNSTILE_SECRET_KEY` | 使用 Turnstile | Turnstile 私有 secret key。 |
| `HCAPTCHA_SITE_KEY` | 使用 hCaptcha | 为部署域名配置的公开 sitekey。 |
| `HCAPTCHA_SECRET_KEY` | 使用 hCaptcha | hCaptcha 私有 secret key。 |
| `VERIFY_HOSTNAME` | 始终必填 | 准确的部署域名，例如 `verify.example.com`；不含 `https://`、端口或路径。 |
| `VERIFY_SIGNING_KEY` | 始终必填 | 64 位十六进制字符串。用 `openssl rand -hex 32` 生成一次，并在机器人中使用相同的值。 |

`/api/config` 只返回所选服务及其公开 site key。服务的 secret 和签名密钥留在服务端；不要将它们放入 `NEXT_PUBLIC_*` 变量，也不要提交到仓库。配置缺失或无效时，验证 API 会返回 503。

### tego 机器人环境变量

Vercel 部署获得公开地址后，在机器人运行环境中设置以下变量。两个变量必须同时设置，才会启用验证。

| 变量 | 填写内容 |
| --- | --- |
| `VERIFY_URL` | 此 Mini App 的公开 HTTPS 地址，例如 `https://verify.example.com`；不含查询参数或片段。 |
| `VERIFY_SIGNING_KEY` | 与 Vercel 完全相同的 64 位十六进制密钥。 |

设置 Vercel 变量后部署或重新部署网页服务；设置机器人变量后重启机器人。机器人不需要 CAPTCHA 服务设置，Vercel 也不需要机器人 token 或机器人 ID。切换 CAPTCHA 服务只修改此网页服务的配置；机器人验证协议和数据库不变。

本地开发可参照 `.env.example`，将变量写入被忽略的 `.env.local`。Vercel Preview 部署的 `VERIFY_HOSTNAME` 应与预览域名一致，CAPTCHA site key 也需支持该域名。

## 验证流程

机器人会发出与用户及随机 nonce 绑定、有效期十分钟的挑战。API 验证挑战的 HMAC 和所选服务的一次性 CAPTCHA token。Turnstile 响应必须匹配配置的域名及 `tego_verify` action。对于 hCaptcha，API 会在 siteverify 请求中提交预期的 sitekey；hCaptcha 返回的 hostname 是诊断信息，不作为身份认证依据。

通过键盘按钮打开的 Mini App 不会收到 Telegram initData，因此页面无法直接验证 Telegram 用户身份；机器人会检查签名凭证中的用户 ID 是否与 Telegram `web_app_data` 服务消息的发送者一致，并在本地原子地消费对应挑战。签名凭证有效期为五分钟。验证成功不会自动转发用户之前的消息，用户需要重新发送。所选 CAPTCHA 服务配置不完整或不可用时，验证会拒绝通过。

## 本地开发

应用及测试使用 TypeScript。本地运行：先执行 `pnpm install`，然后运行 `pnpm dev`；`pnpm typecheck` 检查类型，`pnpm test` 检查协议、Route Handler 和 CAPTCHA 组件，`pnpm build` 构建生产版本。根页面会静态预渲染，`vercel.json` 为现有 Vercel 项目指定 Next.js 框架；`/api/config` 和 `/api/verify` 仍是动态 Node.js 接口。完整的生产端到端验证还需要真实的 CAPTCHA 凭据和 Telegram WebView。

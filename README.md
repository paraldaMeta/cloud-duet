# Cloud Duet

开源的主动式 AI 工作助手：每天给你简报，在后台替你干活，发邮件、付款、提交表单之前一定先问你。界面默认简体中文，可在「资料 → 语言」切换为 English。

支持 QQ、微信、飞书、钉钉登录；可直连 QQ 邮箱 / 163 等邮箱、飞书、钉钉、企业微信、语雀与微信通知（Server酱 / PushPlus）；模型一键切换 DeepSeek、通义千问、Kimi、智谱、豆包、硅基流动、MiniMax，联网搜索可用博查。

涵盖引导页、聊天 / 任务 / 制作、审批、频道、连接器与设置，动效与交互均为手工打磨。未配置密钥时可完全离线运行内置**演示引擎**（虚构样例工作区 Northfield Studio）。填入模型密钥后由真实模型接管并自行调用工具；配置 Composio 后可操作真实 Gmail、日历、Drive、Slack 等；内置浏览器与手机通知无需额外密钥。

项目不内置任何密钥，均在应用内或 `.env.local` 中自行填写。

<p align="center">
  <img src="docs/screenshots/chat.png" alt="聊天：简报、卡片与后台任务" width="360" />
</p>

<p align="center">
  <img src="docs/screenshots/onboarding-proactive.png" alt="引导：主动简报" width="280" />
  <img src="docs/screenshots/onboarding-browser.png" alt="引导：浏览器代操作" width="280" />
  <img src="docs/screenshots/onboarding-integrations.png" alt="引导：应用连接" width="280" />
</p>

## 快速开始

```bash
npm install
npm run dev
```

终端会打印访问地址；端口、域名与部署方式由你自行决定，本地、反代或任意可运行 Node 的平台均可。

可选密钥写在 `.env.local`（见 `.env.example`），或在应用内「资料 → 密钥与服务」填写。

使用前需登录。邮箱 + 密码开箱即用（新邮箱即注册）；配置 OAuth 客户端后出现 Google、Apple 登录。每个账号在 `data/users/<id>/`（已 git 忽略）拥有独立工作区：状态、模型密钥、服务密钥与推送订阅。首个账号会继承迁移前的 `data/state.json`。在「资料 → **重置演示工作区**」可清空重来；长按右上角头像缩写可重播引导页。

## 给他人使用

首个登录的账号视为服务器所有者。`.env.local` 中的密钥仅对所有者（及 `SHARED_KEYS_FOR` 中的账号）生效，其他人须在应用内填写自己的密钥。用 `ALLOW_SIGNUP=false` 或 `ALLOWED_EMAILS` 控制注册；用 `PUBLIC_URL` 填写用户实际访问的地址；仅在自有反代后设置 `TRUST_PROXY=1`。会话可撤销（登出会在服务端结束会话），登录有频率限制；内置浏览器默认不能访问内网地址，除非 `BROWSER_ALLOW_PRIVATE=1`。

## 密钥与服务

| 服务 | 开启什么 | 去哪拿 | 填到哪 |
| --- | --- | --- | --- |
| 模型 | 真实回复与工具循环 | [Anthropic](https://console.anthropic.com/settings/keys) 或 [OpenAI](https://platform.openai.com/api-keys) / 任意兼容端点 | 「资料 → 模型与 API 密钥」，或 `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` |
| Composio | 真实 Gmail、日历、Drive、Slack、Stripe、GitHub、HubSpot… | [platform.composio.dev](https://platform.composio.dev) | 「资料 → 密钥与服务」，或 `COMPOSIO_API_KEY` |
| 博查 / Tavily | 为无自带搜索的模型提供 `search_web`（DeepSeek、通义、Kimi…） | [open.bochaai.com](https://open.bochaai.com/) · [app.tavily.com](https://app.tavily.com/) | 「密钥与服务」，或 `BOCHA_API_KEY` / `TAVILY_API_KEY` |
| Browserbase | 带实时观看链接的云端浏览器 | [browserbase.com/settings](https://www.browserbase.com/settings) | 「密钥与服务」，或 `BROWSERBASE_API_KEY` + `BROWSERBASE_PROJECT_ID` |
| Google 登录 | 「使用 Google 继续」 | [Google Cloud 凭据](https://console.cloud.google.com/apis/credentials)（Web 应用，重定向 `<origin>/api/auth/google/callback`） | `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` |
| Apple 登录 | 「使用 Apple 继续」 | [Services ID](https://developer.apple.com/account/resources/identifiers/list/serviceId) + [密钥](https://developer.apple.com/account/resources/authkeys/list)（付费开发者账号，回调 `<origin>/api/auth/apple/callback`） | `APPLE_CLIENT_ID`、`APPLE_TEAM_ID`、`APPLE_KEY_ID`、`APPLE_PRIVATE_KEY` |
| QQ 登录 | 登录页 QQ 按钮 | [QQ 互联](https://connect.qq.com/manage.html) 网站应用（需备案域名，回调 `<origin>/api/auth/qq/callback`） | `QQ_APP_ID`、`QQ_APP_KEY` |
| 微信登录 | 微信扫码登录 | [微信开放平台](https://open.weixin.qq.com/) 已认证网站应用（授权域名为你的主机） | `WECHAT_APP_ID`、`WECHAT_APP_SECRET` |
| 飞书登录 | 登录页飞书按钮 | [飞书开放平台](https://open.feishu.cn/app) 自建应用，重定向 `<origin>/api/auth/feishu/callback` | `FEISHU_APP_ID`、`FEISHU_APP_SECRET` |
| 钉钉登录 | 登录页钉钉按钮 | [钉钉开放平台](https://open-dev.dingtalk.com/) 应用，回调 `<origin>/api/auth/dingtalk/callback` | `DINGTALK_CLIENT_ID`、`DINGTALK_CLIENT_SECRET` |
| 推送通知 | 桌面与手机系统通知 | 无需申请：VAPID 密钥写入 `data/vapid.json` | 「资料 → 通知」 |

- **连接器。** 配置 Composio 后，在应用上点「连接」会打开真实 OAuth 页，回调 `/api/connectors/<id>/callback`。已连接应用显示「你的真实账号」；模型对其使用 `app_find_actions` / `app_run_action`，该应用的样例工具让位。一切写入操作（发送、创建、删除…）须先过审批卡片。未配置 Composio 时，「连接」仅绑定样例数据。
- **国内常用。** 无需 Composio 与服务器侧配置：在连接器页填写表单（点吉祥物 → 国内常用）。保存前会先测连通性；凭据存在 `data/users/<id>/direct.json`（权限 600），界面只显示末四位。
  - **QQ 邮箱 / 163 等**：邮箱地址 + 邮箱设置里的*授权码*（不是登录密码）。已预填 QQ 邮箱、网易 163/126/yeah、腾讯企业邮、网易企业邮、阿里云、新浪、搜狐、139、iCloud、Gmail 应用专用密码等服务器；其它可手填。模型可用 `mailbox_list`、`mailbox_read`、`mailbox_folders`；`draft_email` 从此邮箱发信。
  - **飞书**：自建应用的 App ID、App Secret（机器人 + `im:message`、`im:chat` 权限）可列会话、读消息、发消息；群机器人 Webhook（可选签名校验）可向指定群发消息。
  - **钉钉**与**企业微信**：群机器人 Webhook（钉钉可选加签密钥），用于推送更新与提醒。
  - **微信通知**：Server酱 SendKey 或 PushPlus Token。模型可用 `wechat_notify`；应用内提醒、任务完成、审批等也可推到微信。
  - **语雀**：个人或团队 Token，可搜索、列表、阅读文档并新建文档。
  - 每次发送默认弹出审批，除非将该工具设为「始终允许」（发给自己的微信通知默认为始终允许）。
- **内置浏览器。** 浏览器任务通过 Playwright 驱动真实 Chrome：有 Browserbase 密钥则用云端，否则用本机 Chrome（`CHROME_PATH`）。模型把页面读成带编号的控件，向任务推送截图；登录用登录卡片（密码只输入到页面，不存、不给模型看）；最终提交须审批后才点击。空闲 15 分钟关闭浏览器。
- **文件。** 「+」菜单或粘贴可上传最多 15 MB 到 `data/users/<id>/files/`。图片与 PDF 以真实内容给模型；文本文件以文本注入。完整内容最多带最近四个附件。
- **分享链接。** 在仪表盘分享会生成只读公开链 `/s/<token>`（无需登录、不收录、严格 CSP 沙箱）。Token 在 `data/shares.json`；取消分享即撤销。
- **推送。** 开启通知会注册 `public/sw.js` 并订阅设备。iPhone 需先「添加到主屏幕」；应用自带 Web Manifest 与图标。OAuth 与推送需 HTTPS；若经隧道访问且回调地址不对，请设置 `PUBLIC_URL` 为对外地址。

## 功能概览

- **六页引导后登录**：24 小时表盘与拖尾、应用沿虚线飞入 Duet、代理在浏览器里填表、安全说明、Slack、通知，再到橙色对勾庆祝动画；下一屏为登录。
- **吉祥物**：72 点单路径按帧变形（待机挥手、工作中、任务之字形、书写、思考、搜索、启动、聆听等），圆形容器会轻微弹跳与挤压。
- **聊天**：实时状态胶囊、输入中动画、快捷回复、长按表情、左滑时间戳、「新消息」分隔线、衍生任务芯片，以及邮件/付款/签署/删除审批、建议、可滑动主动卡片、制品与技能等卡片。
- **任务**：进行中 / 待办、状态分组、例行任务与运行历史、「立即运行」、侧滑详情（步骤、更新、资源、独立线程）。
- **制作**：打字机式主提示、扇形 FAB、带描边进度的构建视图、制品查看（仪表盘、文档、幻灯片、网页、设计）与固定到标签栏。
- **侧栏、频道与面板**：侧栏推开主界面；频道可选图标与颜色；权限、连接器工具策略（询问 / 始终）、资料、用量、记忆、通知、付款、模型与 API 密钥。
- **语音模式**（Web Speech API）与应用内横幅（标签页隐藏时可走系统通知）。

## 语言

代码中文案以英文为键，经 `src/lib/i18n/`（`zh/*.ts` 词典）翻译；缺词条时回退英文。浏览器用 `localStorage` 记选择；服务端在账号设置中同步，以便系统回复、笔记与模型回复语言一致。新增语言：增加词典并在 `Lang` 中注册。

## 模型与 API 密钥

模型接口已预留，非必须。

- 应用内：「资料 → **模型与 API 密钥**」。选 Anthropic 或任意 OpenAI 兼容端点，粘贴密钥，可选填模型与 Base URL。**快捷配置**可填 DeepSeek、通义（百炼）、Kimi、智谱 GLM、豆包（方舟）、硅基流动、MiniMax 或 OpenAI。**测试**会发单 Token 往返。
- 或设环境变量：`ANTHROPIC_API_KEY`，或 `OPENAI_API_KEY`（及 `OPENAI_BASE_URL`）。

密钥存于服务端 `data/users/<id>/model.json`（权限 600），不下发浏览器。模型调用失败时，该条回复回退演示引擎并附灰色提示。

### 模型能做什么

配置密钥后，聊天、任务线程与发起的建议走工具循环（`src/lib/server/agent/`）。模型决定调用哪些工具，应用显示对应 live 状态（如「正在搜索邮件」「正在查记忆」…），结果回传模型直至结束（最多 12 轮）。

| 工具 | 作用 |
| --- | --- |
| `search_email`, `read_calendar`, `search_files`, `list_invoices` | 读取样例工作区；须先连接对应连接器。 |
| `check_memory`, `search_past_chats`, `remember` | 记忆、技能、未完成任务、待审批、历史消息。 |
| `set_reminder` | 在指定时间发布并通知。 |
| `draft_email`, `revise_draft` | 审批卡片；或 Gmail「发邮件」设为**始终允许**时直接发送。 |
| `request_payment` | Link 付款审批（默认测试模式）。 |
| `use_browser` | 启动浏览器任务，含 `browser_open`、`browser_look`、`browser_click`、`browser_type`、`browser_scroll`、`browser_request_login`、`browser_submit`。 |
| `app_find_actions`, `app_run_action` | 经 Composio 操作真实已连接应用；写入须审批。 |
| `mailbox_list`, `mailbox_read`, `mailbox_folders` | 已连接的 QQ / 163 / IMAP 邮箱。 |
| `wechat_notify`, `yuque_search`, `yuque_list`, `yuque_read`, `yuque_create_doc` | 微信通知与语雀。 |
| `search_web` | 博查或 Tavily 联网搜索（非 Anthropic 官方 API 的模型）。 |
| `feishu_list_chats`, `feishu_read_messages`, `feishu_send_message`, `dingtalk_send_message`, `wecom_send_message` | 飞书、钉钉、企业微信；发送须审批。 |
| `start_task` | 后台任务循环：`set_steps`、`update_progress`、`add_link`、`finish_task`。 |
| `make_artifact` | 模型写 Markdown 文档，或生成仪表盘、幻灯片、页面、设计稿。 |
| `propose_task`, `suggest_tasks`, `quick_replies` | 任务卡片与可点回复。 |
| `web_search` | Anthropic 服务端联网搜索，仅 api.anthropic.com。 |

每次调用先过护栏（禁止交易、转账、卡号/SSN 外泄等）。发送、付款、提交默认须用户确认，除非该工具设为始终允许。在模型运行的任务里批准草稿会恢复任务以便收尾。未经 Composio 连接的应用仍用虚构样例数据。Gmail 为真实账号时，批准邮件草稿会从用户 Gmail 发出。

HTTP 接口：

| 方法 | 路径 | 请求体 |
| --- | --- | --- |
| `GET` | `/api/model` | → `{ provider, model, baseURL, hasKey, keyHint }` |
| `PUT` | `/api/model` | `{ provider?: "anthropic" \| "openai", apiKey?, model?, baseURL? }` |
| `DELETE` | `/api/model` | 清除已保存密钥 |
| `POST` | `/api/model/test` | → `{ ok, error?, ms }` |

接入其它模型后端：在 `src/lib/server/agent/loop.ts` 中于 `anthropic()`、`openai()` 旁增加适配器。

## 目录结构

```
src/app/api/[...path]/route.ts   各操作 API（类 REST，按登录账号隔离）
src/app/api/auth/[...path]/      邮箱、Google、Apple 登录与登出
src/app/api/events/route.ts      SSE 事件流
src/lib/server/                  存储、事件总线、护栏、演示引擎、模型提供者
src/lib/server/{auth,context}.ts 账号、会话、按用户数据
src/lib/server/composio.ts       真实第三方应用
src/lib/server/browser.ts        代理浏览器（Playwright）
src/lib/server/push.ts           Web Push
src/lib/server/agent/            模型工具循环与各工具
src/lib/client/store.ts          由 SSE 驱动的 zustand store
src/components/duet/             UI：聊天、任务、制作、引导、面板、吉祥物
```

## 致谢

基于 Next.js、Tailwind、shadcn/ui、motion、zustand。架构与护栏参考 [Studio1-OSS/OpenDuet](https://github.com/Studio1-OSS/OpenDuet) 与 [hmody1m/covo](https://github.com/hmody1m/covo)（均为 MIT）。

## 许可证

MIT，见 [LICENSE](LICENSE)。

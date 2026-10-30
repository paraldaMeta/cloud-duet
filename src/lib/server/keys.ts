// Keys for outside services, per account, with environment variables as the
// fallback. Saved in data/users/<id>/keys.json; the browser only ever sees
// whether a key is set and its last four characters.
import { readUserJson, writeUserJson } from "./context";
import { mayUseEnvKeys, providers } from "./auth";
import { readConfig } from "./engine/provider";
import { pushCount } from "./push";
import { tr } from "./i18n";
import { CN_PROVIDERS, cnEnv, cnName, type CnProvider } from "./oauth-cn";

export type ServiceKey = "composio" | "browserbase" | "browserbaseProject" | "bocha" | "tavily";

const ENV: Record<ServiceKey, string> = {
  composio: "COMPOSIO_API_KEY",
  browserbase: "BROWSERBASE_API_KEY",
  browserbaseProject: "BROWSERBASE_PROJECT_ID",
  bocha: "BOCHA_API_KEY",
  tavily: "TAVILY_API_KEY",
};

export function getKey(k: ServiceKey): string {
  return readUserJson<Partial<Record<ServiceKey, string>>>("keys.json", {})[k] || (mayUseEnvKeys() ? process.env[ENV[k]] || "" : "");
}

export function setKeys(next: Partial<Record<ServiceKey, string>>) {
  const cur = readUserJson<Partial<Record<ServiceKey, string>>>("keys.json", {});
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined) continue;
    if (v) cur[k as ServiceKey] = v.trim();
    else delete cur[k as ServiceKey];
  }
  writeUserJson("keys.json", cur);
}

const hint = (v: string) => (v ? `…${v.slice(-4)}` : "");

const CN_WHAT: Record<CnProvider, string> = {
  qq: "Server setting. Needs a website app on QQ Connect, which asks for an ICP-registered domain.",
  wechat: "Server setting. Needs a verified website app on the WeChat Open Platform; people scan a QR code.",
  feishu: "Server setting. Needs a custom app on the Feishu Open Platform with web sign-in turned on.",
  dingtalk: "Server setting. Needs an app on the DingTalk Open Platform with sign-in turned on.",
};

const CN_LINKS: Record<CnProvider, { label: string; url: string }[]> = {
  qq: [{ label: "QQ Connect", url: "https://connect.qq.com/manage.html" }],
  wechat: [{ label: "WeChat Open Platform", url: "https://open.weixin.qq.com/" }],
  feishu: [{ label: "Feishu Open Platform", url: "https://open.feishu.cn/app" }],
  dingtalk: [{ label: "DingTalk Open Platform", url: "https://open-dev.dingtalk.com/" }],
};

/** Every outside service, whether it's set up, and where to get its key. */
export function services() {
  const p = providers();
  const model = readConfig();
  return [
    {
      id: "model", name: tr("Cloud Duet or another model"), what: tr("Makes Cloud Duet actually think, call tools and do the work."),
      ready: !!model.apiKey, hint: hint(model.apiKey), editable: "sheet" as const,
      links: [
        { label: tr("Anthropic API keys"), url: "https://console.anthropic.com/settings/keys" },
        { label: tr("OpenAI API keys"), url: "https://platform.openai.com/api-keys" },
      ],
    },
    {
      id: "composio", name: "Composio", what: tr("Connects your real Gmail, Calendar, Drive, Slack, GitHub and 1,000+ more apps."),
      ready: !!getKey("composio"), hint: hint(getKey("composio")), editable: "inline" as const, env: "COMPOSIO_API_KEY",
      links: [{ label: tr("Get a Composio API key"), url: "https://platform.composio.dev" }],
    },
    {
      id: "browserbase", name: "Browserbase", what: tr("Cloud Duet's own cloud browser. Without it, Cloud Duet uses a browser on this server."),
      ready: !!getKey("browserbase"), hint: hint(getKey("browserbase")), editable: "inline" as const, env: "BROWSERBASE_API_KEY",
      links: [{ label: tr("Get a Browserbase API key"), url: "https://www.browserbase.com/settings" }],
    },
    {
      id: "bocha", name: tr("Bocha web search"), what: tr("Web search for models other than Anthropic's own API (DeepSeek, Qwen, Kimi…). Good for Chinese sources."),
      ready: !!getKey("bocha"), hint: hint(getKey("bocha")), editable: "inline" as const, env: "BOCHA_API_KEY",
      links: [{ label: tr("Get a Bocha API key"), url: "https://open.bochaai.com/" }],
    },
    {
      id: "tavily", name: tr("Tavily web search"), what: tr("Web search for models other than Anthropic's own API. Used when Bocha isn't set."),
      ready: !!getKey("tavily"), hint: hint(getKey("tavily")), editable: "inline" as const, env: "TAVILY_API_KEY",
      links: [{ label: tr("Get a Tavily API key"), url: "https://app.tavily.com/" }],
    },
    {
      id: "google", name: tr("Sign in with Google"), what: tr("Server setting. Needs an OAuth client (Web application)."),
      ready: p.google, editable: "env" as const, env: "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET",
      links: [{ label: tr("Create a Google OAuth client"), url: "https://console.cloud.google.com/apis/credentials" }],
    },
    {
      id: "apple", name: tr("Sign in with Apple"), what: tr("Server setting. Needs a paid Apple Developer account, a Services ID and a key."),
      ready: p.apple, editable: "env" as const, env: "APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY",
      links: [
        { label: tr("Create a Services ID"), url: "https://developer.apple.com/account/resources/identifiers/list/serviceId" },
        { label: tr("Create a Sign in with Apple key"), url: "https://developer.apple.com/account/resources/authkeys/list" },
      ],
    },
    ...CN_PROVIDERS.map((id) => ({
      id, name: tr("Sign in with {provider}", { provider: cnName(id) }), what: tr(CN_WHAT[id]),
      ready: p[id], editable: "env" as const, env: cnEnv(id), links: CN_LINKS[id].map((l) => ({ ...l, label: tr(l.label) })),
    })),
    {
      id: "push", name: tr("Push notifications"), what: tr("Built in, no key needed. On iPhone, add Duet to your Home Screen first."),
      ready: pushCount() > 0, editable: "none" as const, detail: pushCount() ? tr(pushCount() > 1 ? "{n} devices" : "{n} device", { n: pushCount() }) : tr("Not turned on"),
      links: [],
    },
  ];
}

// Types shared by the server and the browser. Everything here is plain JSON.
import type { Lang } from "@/lib/i18n";

export type AgentStatus =
  | "Thinking it through"
  | "Checking memory"
  | "Searching your email"
  | "Checking recent files"
  | "Checking your calendar"
  | "Searching the web"
  | "Looking something up"
  | "Writing a draft"
  | "Starting a task"
  | "Working on your tasks"
  | "Working on it"
  | "Working in your browser"
  | "Waking Cloud Duet's workspace"
  | "Checking"
  | "Reading now";

export interface User {
  name: string;
  firstName: string;
  email: string;
  initials: string;
  signedIn: boolean;
  onboarded: boolean;
  /** Set once the first-day scan has run. */
  scanned: boolean;
  timezone: string;
}

export interface Settings {
  /** "HH:MM", local time. */
  briefTime: string;
  /** Minute past the hour the check-ins run at. */
  checkinMinute: number;
  /** Hours of the day the check-ins run at. */
  checkinHours: number[];
  weekendsOn: boolean;
  notifications: boolean;
  paymentsTestMode: boolean;
  /** UI and reply language. Missing on older workspaces, which read as the default. */
  language?: Lang;
}

export interface Channel {
  id: string;
  /** "main" is the main thread. */
  name: string;
  icon: ChannelIcon;
  color: string;
  purpose: string;
  archived: boolean;
  /** Sidebar group, for channels dragged into one. */
  group?: string;
  createdAt: string;
  lastReadAt: string;
}

export type ChannelIcon =
  | "checkbox" | "calendar" | "mail" | "dollar" | "chart" | "globe" | "pin" | "house"
  | "cube" | "play" | "folder" | "pencil" | "search" | "heart" | "people" | "briefcase"
  | "book" | "plane" | "car" | "scissors" | "bag" | "gift" | "sprout" | "music";

export type Reaction = "👍" | "❤️" | "⭐";

export interface SuggestionItem {
  title: string;
  prompt: string;
  icon: "mail" | "calendar" | "doc" | "chart" | "dollar" | "people" | "globe" | "slides";
  started?: boolean;
  taskId?: string;
}

export interface PlateItem {
  title: string;
  detail: string;
  action: "Draft" | "Book" | "Start" | "Review";
  prompt: string;
  done?: boolean;
}

export type Card =
  | { kind: "approval"; approvalId: string }
  | { kind: "suggestions"; items: SuggestionItem[] }
  | { kind: "proactive"; suggestionId: string }
  | { kind: "artifact"; artifactId: string }
  | { kind: "confirmation"; title: string; lines: string[]; icon: "calendar" | "check" | "mail" }
  | { kind: "alert"; title: string; body: string; action: string; href?: string }
  | { kind: "plate"; items: PlateItem[] }
  | { kind: "skill"; name: string; description: string; instructions: string; state: "pending" | "saved" | "dismissed" }
  | { kind: "usage_limit"; resumesAt: string; lifted?: boolean }
  /** Cloud Duet's own browser needs the user's login; the password goes to the browser, never to the model or the store. */
  | { kind: "signin"; site: string; domain: string; state: "pending" | "sent" | "dismissed"; email?: string; taskId?: string }
  /** A capture of Cloud Duet's own browser. `image` is a self-contained SVG data URL. */
  | { kind: "screenshot"; url: string; caption: string; image: string };

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
}

export interface Message {
  id: string;
  channelId: string;
  /** Messages inside a task's own session carry the task id. */
  taskId?: string;
  role: "user" | "claude" | "system";
  /** system messages: "date" separators, "note" grey lines, "new" divider. */
  systemKind?: "date" | "note";
  text: string;
  attachments?: Attachment[];
  card?: Card;
  quickReplies?: { label: string; used?: boolean }[];
  /** For a user message that spawned a background task. */
  spawnedTaskId?: string;
  reactions: Reaction[];
  /** Cloud Duet's reaction to a user message. */
  claudeReaction?: Reaction;
  feedback?: "good" | "bad";
  status: "sent" | "delivered" | "seen";
  createdAt: string;
}

export type ApprovalKind = "email" | "payment" | "sign" | "delete" | "action";

export interface EmailPayload {
  /** "mailbox" is a mailbox connected over IMAP/SMTP (QQ Mail, 163 and the like). */
  app: "gmail" | "slack" | "mailbox";
  /** The address it's sent from, when known. */
  from?: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
}
export interface PaymentPayload {
  amount: number;
  currency: string;
  merchant: string;
  description: string;
  item: string;
  wallet: "link" | "shop";
  expiresAt: string;
}
export interface SignPayload {
  document: string;
  recipients: string[];
  via: string;
}
export interface DeletePayload {
  what: string;
  items: string[];
}
export interface ActionPayload {
  tool: string;
  args: { name: string; value: string }[];
  /** What runs on approval. Kept server-side in meaning; the card only shows tool and args. */
  exec?:
    | { kind: "composio"; slug: string; arguments: Record<string, unknown> }
    | { kind: "browser"; ref: string }
    | { kind: "direct"; app: DirectApp; op: string; arguments: Record<string, unknown> };
}

/** Apps Cloud Duet talks to directly with credentials the person enters, no Composio. */
export type DirectApp = "mailbox" | "feishu" | "dingtalk" | "wecom" | "wxpush" | "yuque";

export interface DirectField {
  key: string;
  label: string;
  type: "text" | "email" | "password" | "url" | "number" | "select";
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
  optional?: boolean;
  /** Only shown when another field has this value. */
  showIf?: { key: string; value: string };
}

/** The setup form for a direct app. Secrets come back as hints, never values. */
export interface DirectForm {
  id: DirectApp;
  intro: string;
  fields: DirectField[];
  links: { label: string; url: string }[];
  values: Record<string, string>;
  /** Secret fields that are saved, with their last four characters. */
  saved: Record<string, string>;
  configured: boolean;
}

export interface Approval {
  id: string;
  kind: ApprovalKind;
  channelId: string;
  taskId?: string;
  messageId?: string;
  status: "pending" | "approved" | "declined" | "expired";
  email?: EmailPayload;
  payment?: PaymentPayload;
  sign?: SignPayload;
  delete?: DeletePayload;
  action?: ActionPayload;
  /** Text that changed in the last edit-by-chat, glowed orange for a few seconds. */
  highlight?: { text: string; at: string };
  createdAt: string;
  resolvedAt?: string;
}

export type TaskStatus = "working" | "needs_input" | "ready_for_review" | "scheduled" | "resolved";

export interface TaskStep {
  text: string;
  state: "pending" | "current" | "done";
}

export interface TaskUpdate {
  text: string;
  source: string;
  at: string;
}

export interface TaskResource {
  title: string;
  type: "Doc" | "Sheet" | "Slides" | "Dashboard" | "Web page" | "Email" | "Link" | "Design";
  artifactId?: string;
  href?: string;
}

export interface Task {
  id: string;
  channelId: string;
  title: string;
  prompt: string;
  description: string;
  status: TaskStatus;
  source: "user" | "proactive";
  noticedAt?: string;
  steps: TaskStep[];
  updates: TaskUpdate[];
  resources: TaskResource[];
  /** A short latest-update line shown under the title in the list. */
  latest: string;
  updateCount: number;
  archived: boolean;
  /** Run by the model's tool loop rather than the scripted demo. */
  agent?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineRun {
  at: string;
  outcome: "Resolved" | "Posted" | "Skipped";
}

export interface Routine {
  id: "brief" | "checkin";
  title: string;
  nextRunAt: string;
  runs: RoutineRun[];
}

export interface UpNextItem {
  id: string;
  title: string;
  body: string;
  source: string;
  prompt: string;
  channelId: string;
  createdAt: string;
}

export interface ProactiveSuggestion {
  id: string;
  title: string;
  body: string;
  prompt: string;
  channelId: string;
  state: "open" | "started" | "hidden";
  taskId?: string;
}

export type ArtifactType = "dashboard" | "docs" | "slides" | "webpage" | "design" | "designsystem";

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  html: string;
  channelId: string;
  taskId?: string;
  sources: string[];
  refresh?: string;
  metrics?: { label: string; value: number; prefix?: string; suffix?: string }[];
  inTabBar: boolean;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Build {
  id: string;
  type: ArtifactType;
  prompt: string;
  title: string;
  status: string;
  startedAt: string;
  artifactId?: string;
  done: boolean;
}

export interface ToolPolicy {
  slug: string;
  name: string;
  write: boolean;
  mode: "ask" | "always";
}

export interface Connector {
  id: string;
  name: string;
  category: "files" | "mail" | "calendar" | "chat" | "payments" | "other";
  description: string;
  connected: boolean;
  /** Connected to the person's real account through Composio, not the sample workspace. */
  real?: boolean;
  /** Set up with a form in the app (address and auth code, app credentials, a webhook) instead of Composio. */
  direct?: boolean;
  accounts: string[];
  tools: ToolPolicy[];
}

export interface Skill {
  name: string;
  description: string;
  instructions: string;
}

export interface Usage {
  sessionUsed: number;
  sessionLimit: number;
  sessionStartedAt?: string;
  weeklyUsed: number;
  weeklyLimit: number;
  weekResetsAt: string;
  resetAvailable: boolean;
  resetExpires: string;
}

export interface Reminder {
  id: string;
  at: string;
  text: string;
  channelId: string;
  fired: boolean;
}

export interface AppNotice {
  id: string;
  title: string;
  body: string;
  channelId?: string;
  taskId?: string;
  at: string;
}

export interface AppState {
  user: User;
  settings: Settings;
  channels: Channel[];
  messages: Message[];
  approvals: Approval[];
  tasks: Task[];
  routines: Routine[];
  upNext: UpNextItem[];
  suggestions: ProactiveSuggestion[];
  artifacts: Artifact[];
  builds: Build[];
  connectors: Connector[];
  skills: Skill[];
  memory: string;
  usage: Usage;
  reminders: Reminder[];
  /** Live status per channel id (or task id), null when idle. */
  status: Record<string, AgentStatus | null>;
  typing: Record<string, boolean>;
  engine: { mode: "demo" | "anthropic" | "openai"; model: string };
}

export type Collection =
  | "channels" | "messages" | "approvals" | "tasks" | "routines" | "upNext"
  | "suggestions" | "artifacts" | "builds" | "connectors" | "skills" | "reminders";

export type ServerEvent =
  | { type: "upsert"; collection: Collection; item: { id?: string; name?: string } & Record<string, unknown> }
  | { type: "remove"; collection: Collection; id: string }
  | { type: "set"; key: "user" | "settings" | "memory" | "usage" | "engine"; value: unknown }
  | { type: "status"; key: string; status: AgentStatus | null }
  | { type: "typing"; key: string; typing: boolean }
  | { type: "notify"; notice: AppNotice }
  | { type: "reset" };

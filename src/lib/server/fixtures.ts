// The starting state for a fresh install, and the sample workspace the demo
// engine reads from when no model key or real connectors are configured.
import { DEFAULT_LANG, translate } from "@/lib/i18n";
import type { AppState, Connector, ToolPolicy } from "@/lib/shared/types";
import { tr } from "./i18n";

type Tr = (text: string) => string;

export function defaultConnectors(email: string): Connector[] {
  return connectors(email, tr);
}

// A fresh workspace is built while the store is loading, so it can't ask the
// store for the person's language; it has none yet and reads as the default.
const trDefault: Tr = (text) => translate(DEFAULT_LANG, text);

function connectors(email: string, t: Tr): Connector[] {
  const read = (slug: string, name: string): ToolPolicy => ({ slug, name: t(name), write: false, mode: "always" });
  const write = (slug: string, name: string): ToolPolicy => ({ slug, name: t(name), write: true, mode: "ask" });
  const acct = email ? [email] : [];
  return [
    {
      id: "gmail", name: "Gmail", category: "mail", description: t("Read, search, draft and send email."),
      connected: true, accounts: acct,
      tools: [read("GMAIL_FETCH_EMAILS", "Fetch emails"), read("GMAIL_SEARCH", "Search email"), read("GMAIL_GET_THREAD", "Get thread"),
        write("GMAIL_SEND_EMAIL", "Send email"), write("GMAIL_CREATE_DRAFT", "Create draft"), write("GMAIL_DELETE_MESSAGE", "Delete message"),
        write("GMAIL_MODIFY_LABELS", "Archive or label")],
    },
    {
      id: "gcal", name: "Google Calendar", category: "calendar", description: t("See your schedule and book meetings."),
      connected: true, accounts: acct,
      tools: [read("GCAL_LIST_EVENTS", "List events"), read("GCAL_FIND_FREE_SLOTS", "Find free time"),
        write("GCAL_CREATE_EVENT", "Create event"), write("GCAL_UPDATE_EVENT", "Update event"), write("GCAL_DELETE_EVENT", "Delete event")],
    },
    {
      id: "gdrive", name: "Google Drive", category: "files", description: t("Find, read and create docs, sheets and slides."),
      connected: true, accounts: acct,
      tools: [read("GDRIVE_SEARCH", "Search files"), read("GDRIVE_READ", "Read file"), write("GDRIVE_CREATE", "Create file"), write("GDRIVE_SHARE", "Share file")],
    },
    {
      id: "slack", name: "Slack", category: "chat", description: t("Catch up on channels and DMs, and reply."),
      connected: false, accounts: [],
      tools: [read("SLACK_SEARCH", "Search messages"), read("SLACK_LIST_UNREADS", "List unreads"), write("SLACK_SEND_MESSAGE", "Send message")],
    },
    {
      id: "stripe", name: "Stripe", category: "payments", description: t("Invoices, customers and payments."),
      connected: false, accounts: [],
      tools: [read("STRIPE_LIST_INVOICES", "List invoices"), read("STRIPE_GET_CUSTOMER", "Get customer"), write("STRIPE_SEND_INVOICE_REMINDER", "Send invoice reminder")],
    },
    {
      id: "link", name: "Link", category: "payments", description: t("Pay for purchases you approve with a one-time card."),
      connected: false, accounts: [],
      tools: [write("LINK_SPEND_REQUEST", "Request to spend")],
    },
    {
      id: "quickbooks", name: "QuickBooks", category: "other", description: t("Books, invoices and reports."),
      connected: false, accounts: [],
      tools: [read("QB_LIST_INVOICES", "List invoices"), read("QB_PROFIT_LOSS", "Profit and loss"), write("QB_CREATE_INVOICE", "Create invoice")],
    },
    {
      id: "gusto", name: "Gusto", category: "other", description: t("Payroll, hours and reimbursements."),
      connected: false, accounts: [],
      tools: [read("GUSTO_LIST_EMPLOYEES", "List employees"), write("GUSTO_RUN_PAYROLL", "Run payroll")],
    },
    {
      id: "docusign", name: "Docusign", category: "other", description: t("Send agreements for signature."),
      connected: false, accounts: [],
      tools: [read("DOCUSIGN_LIST_ENVELOPES", "List envelopes"), write("DOCUSIGN_SEND_ENVELOPE", "Send for signature")],
    },
    {
      id: "hubspot", name: "HubSpot", category: "other", description: t("Contacts, deals and pipeline."),
      connected: false, accounts: [],
      tools: [read("HUBSPOT_LIST_DEALS", "List deals"), write("HUBSPOT_UPDATE_DEAL", "Update deal")],
    },
    {
      id: "github", name: "GitHub", category: "other", description: t("Issues, pull requests and reviews."),
      connected: false, accounts: [],
      tools: [read("GITHUB_LIST_PRS", "List pull requests"), write("GITHUB_COMMENT", "Comment")],
    },
    {
      id: "linkedin", name: "LinkedIn", category: "other", description: t("Post updates and job listings."),
      connected: false, accounts: [],
      tools: [write("LINKEDIN_CREATE_POST", "Create post")],
    },
  ];
}

function at(h: number, m: number, dayOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export function nextBriefAt(briefTime: string): string {
  const [h, m] = briefTime.split(":").map(Number);
  const now = new Date();
  const t = new Date();
  t.setHours(h, m, 0, 0);
  if (t <= now) t.setDate(t.getDate() + 1);
  return t.toISOString();
}

export function nextCheckinAt(hours: number[], minute: number): string {
  const now = new Date();
  for (let day = 0; day < 2; day++) {
    for (const h of hours) {
      const t = new Date();
      t.setDate(t.getDate() + day);
      t.setHours(h, minute, 0, 0);
      if (t > now) return t.toISOString();
    }
  }
  return at(hours[0], minute, 1);
}

export function initialState(): AppState {
  const now = new Date().toISOString();
  const briefMinute = 1 + 2 * Math.floor(Math.random() * 29);
  const briefTime = `0${7 + Math.floor(Math.random() * 2)}:${String(briefMinute).padStart(2, "0")}`;
  const checkinMinute = briefMinute;
  const checkinHours = [10, 13, 16, 19, 22];
  const week = new Date();
  week.setDate(week.getDate() + ((8 - week.getDay()) % 7 || 7));
  week.setHours(11, 0, 0, 0);
  return {
    user: { name: "", firstName: "", email: "", initials: "", signedIn: false, onboarded: false, scanned: false, timezone: "UTC" },
    settings: { briefTime, checkinMinute, checkinHours, weekendsOn: false, notifications: false, paymentsTestMode: true },
    channels: [
      { id: "main", name: "main", icon: "checkbox", color: "#C7604A", purpose: trDefault("Your main thread with Cloud Duet."), archived: false, createdAt: now, lastReadAt: now },
    ],
    messages: [],
    approvals: [],
    tasks: [],
    routines: [
      { id: "brief", title: trDefault("Morning brief"), nextRunAt: nextBriefAt(briefTime), runs: [] },
      { id: "checkin", title: trDefault("Check-in"), nextRunAt: nextCheckinAt(checkinHours, checkinMinute), runs: [] },
    ],
    upNext: [],
    suggestions: [],
    artifacts: [],
    builds: [],
    connectors: connectors("", trDefault),
    skills: [],
    memory: "",
    usage: {
      sessionUsed: 0,
      sessionLimit: 3_000_000,
      weeklyUsed: 0,
      weeklyLimit: 30_000_000,
      weekResetsAt: week.toISOString(),
      resetAvailable: true,
      resetExpires: new Date("2026-11-30T23:59:00").toISOString(),
    },
    reminders: [],
    status: {},
    typing: {},
    engine: { mode: "demo", model: "demo" },
  };
}

/**
 * The sample workspace the demo engine reads from. Fictional people and numbers.
 * The lists are getters so their copy is translated for whoever is reading.
 */
export const SAMPLE = {
  company: "Northfield Studio",
  get inbox() {
    return [
      { from: "Maya Chen", email: "maya@harborvc.example", subject: tr("Series A deck — Friday?"), snippet: tr("Could you send the updated deck before Friday's partner meeting? Happy to give notes first."), daysAgo: 3, needsReply: true },
      { from: "Diana Ortiz", email: "diana@mercurylabs.example", subject: tr("Launch review moved to 2 PM"), snippet: tr("We moved launch review to 2 PM today. Can you bring the final QA list?"), daysAgo: 0, needsReply: true },
      { from: "Lena Brooks", email: "lena@northwind.example", subject: tr("Renewal for Q1"), snippet: tr("Before we renew for Q1, can we get a quick read on what shipped this quarter?"), daysAgo: 2, needsReply: true },
      { from: "Stripe", email: "receipts@stripe.com", subject: tr("Invoice #2041 is 12 days overdue"), snippet: tr("Kestrel Coffee — $4,800.00 — due Oct 18."), daysAgo: 1, needsReply: false },
      { from: "Product Hunt Weekly", email: "hello@producthunt.com", subject: tr("This week's top launches"), snippet: tr("Newsletter"), daysAgo: 0, needsReply: false },
      { from: "Figma", email: "no-reply@figma.com", subject: tr("Sam commented on Onboarding v4"), snippet: tr("Comment on frame 'Welcome'"), daysAgo: 0, needsReply: false },
      { from: "LinkedIn", email: "jobs@linkedin.com", subject: tr("12 new applicants for Product Designer"), snippet: tr("Notifications"), daysAgo: 1, needsReply: false },
      { from: "Notion", email: "notify@notion.so", subject: tr("Weekly digest"), snippet: tr("Notifications"), daysAgo: 2, needsReply: false },
    ];
  },
  get calendar() {
    return [
      { title: tr("Launch review — Mercury Labs"), time: tr("2:00 PM"), with: "Diana Ortiz" },
      { title: tr("Design crit"), time: tr("4:30 PM"), with: "Sam Patel" },
      { title: tr("Newsletter goes out"), time: tr("Thu 9:00 AM"), with: "" },
    ];
  },
  invoices: [
    { customer: "Kestrel Coffee", amount: 4800, daysOverdue: 12, email: "ap@kestrelcoffee.example" },
    { customer: "Bright Lane Dental", amount: 1250, daysOverdue: 5, email: "office@brightlane.example" },
    { customer: "Oak & Iron", amount: 2300, daysOverdue: 21, email: "billing@oakandiron.example" },
  ],
};

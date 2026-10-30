// Small app marks drawn inline so nothing loads from a third party.
import type { ReactNode } from "react";

type P = { size?: number; className?: string };

export function GmailLogo({ size = 18, className }: P) {
  return (
    <svg viewBox="0 0 48 36" width={size} height={(size * 36) / 48} className={className} aria-hidden>
      <path fill="#4285F4" d="M3 36h7V18L0 10.5V33a3 3 0 0 0 3 3z" />
      <path fill="#34A853" d="M38 36h7a3 3 0 0 0 3-3V10.5L38 18z" />
      <path fill="#FBBC04" d="M38 5v13l10-7.5V6.5c0-3.7-4.2-5.8-7.2-3.6z" />
      <path fill="#EA4335" d="M10 18V5l14 10.5L38 5v13L24 28.5z" />
      <path fill="#C5221F" d="M0 6.5v4L10 18V5L7.2 2.9C4.2.7 0 2.8 0 6.5z" />
    </svg>
  );
}

export function CalendarLogo({ size = 18, className }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#fff" stroke="#DADCE0" />
      <path d="M2 7h20V6a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4z" fill="#4285F4" />
      <text x="12" y="18.5" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#4285F4" fontFamily="Arial, sans-serif">31</text>
    </svg>
  );
}

export function DriveLogo({ size = 18, className }: P) {
  return (
    <svg viewBox="0 0 87 78" width={size} height={(size * 78) / 87} className={className} aria-hidden>
      <path fill="#0066DA" d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" />
      <path fill="#00AC47" d="M43.65 25 29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.5A9 9 0 0 0 0 53h27.5z" />
      <path fill="#EA4335" d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" />
      <path fill="#00832D" d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" />
      <path fill="#2684FC" d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" />
      <path fill="#FFBA00" d="M73.4 26.5 60.7 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.45c0-1.55-.4-3.1-1.2-4.5z" />
    </svg>
  );
}

export function SlackLogo({ size = 18, className }: P) {
  return (
    <svg viewBox="0 0 54 54" width={size} height={size} className={className} aria-hidden>
      <path fill="#E01E5A" d="M11.3 34a5.6 5.6 0 1 1-5.6-5.6h5.6zm2.9 0a5.6 5.6 0 0 1 11.2 0v14a5.6 5.6 0 1 1-11.2 0z" />
      <path fill="#36C5F0" d="M19.8 11.3a5.6 5.6 0 1 1 5.6-5.6v5.6zm0 2.9a5.6 5.6 0 0 1 0 11.2h-14a5.6 5.6 0 1 1 0-11.2z" />
      <path fill="#2EB67D" d="M42.5 19.8a5.6 5.6 0 1 1 5.6 5.6h-5.6zm-2.9 0a5.6 5.6 0 0 1-11.2 0v-14a5.6 5.6 0 1 1 11.2 0z" />
      <path fill="#ECB22E" d="M34 42.5a5.6 5.6 0 1 1-5.6 5.6v-5.6zm0-2.9a5.6 5.6 0 0 1 0-11.2h14a5.6 5.6 0 1 1 0 11.2z" />
    </svg>
  );
}

export function GitHubLogo({ size = 18, className }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#141413" />
      <path fill="#fff" d="M12 5.2a6.9 6.9 0 0 0-2.2 13.4c.35.07.47-.15.47-.33v-1.2c-1.92.42-2.32-.82-2.32-.82-.32-.8-.77-1.02-.77-1.02-.63-.43.05-.42.05-.42.7.05 1.06.71 1.06.71.62 1.06 1.62.75 2.02.58.06-.45.24-.75.44-.93-1.53-.17-3.14-.77-3.14-3.4 0-.75.27-1.37.71-1.85-.07-.17-.31-.87.07-1.82 0 0 .58-.19 1.9.71a6.5 6.5 0 0 1 3.46 0c1.32-.9 1.9-.71 1.9-.71.38.95.14 1.65.07 1.82.44.48.71 1.1.71 1.85 0 2.64-1.61 3.22-3.15 3.39.25.21.47.63.47 1.27v1.88c0 .18.12.4.48.33A6.9 6.9 0 0 0 12 5.2z" />
    </svg>
  );
}

function Tile({ bg, fg = "#fff", children, size = 18 }: { bg: string; fg?: string; children: ReactNode; size?: number }) {
  return (
    <span className="inline-grid place-items-center rounded-[5px] font-bold" style={{ background: bg, color: fg, width: size, height: size, fontSize: size * 0.58 }}>
      {children}
    </span>
  );
}

export function AppLogo({ id, size = 18 }: { id: string; size?: number }) {
  switch (id) {
    case "gmail":
      return <GmailLogo size={size} />;
    case "gcal":
      return <CalendarLogo size={size} />;
    case "gdrive":
      return <DriveLogo size={size} />;
    case "slack":
      return <SlackLogo size={size} />;
    case "github":
      return <GitHubLogo size={size} />;
    case "stripe":
      return <Tile bg="#635BFF" size={size}>S</Tile>;
    case "link":
      return <Tile bg="#00D66F" fg="#011E0F" size={size}>L</Tile>;
    case "quickbooks":
      return <Tile bg="#2CA01C" size={size}>qb</Tile>;
    case "gusto":
      return <Tile bg="#F45D48" size={size}>g</Tile>;
    case "docusign":
      return <Tile bg="#FFCC22" fg="#1A1A1A" size={size}>D</Tile>;
    case "hubspot":
      return <Tile bg="#FF7A59" size={size}>H</Tile>;
    case "linkedin":
      return <Tile bg="#0A66C2" size={size}>in</Tile>;
    case "figma":
      return <Tile bg="#1E1E1E" size={size}>F</Tile>;
    default:
      return <Tile bg="#8A8883" size={size}>{id.slice(0, 1).toUpperCase()}</Tile>;
  }
}

/** Cloud Duet's cloud mark, for the onboarding's "Already knows your setup" page. */
export function CloudMark({ size = 30, className }: P) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      <path
        d="M30 74h42a18 18 0 0 0 1.5-35.9A24 24 0 0 0 28.4 44 15 15 0 0 0 30 74Z"
        fill="#fff"
      />
    </svg>
  );
}

# Design system

Styled to fit the design language of an established online Islamic academy: dark midnight navy, warm amber accents, soft glows and glassy cards. **Dark mode only.**

## Never use (hard rule)
- Another organisation's name, logo, logo mark or favicon. The brand here is **"Demo Academy"** with a plain text logo.
- Downloaded images from any real academy's site: backgrounds, calligraphy art, teacher photos, video thumbnails.
- Their marketing copy word for word.

Our background is our own SVG pattern (see "Background"). Lesson thumbnails are plain gradient tiles with an icon.

## Tokens (`src/app/globals.css`)
```css
@theme inline {
  --color-midnight: #0F1829;   /* page background */
  --color-midnight-2: #16213A; /* raised surfaces (cards) */
  --color-teal: #12303F;       /* secondary buttons, subtle fills */
  --color-amber: #ED8C44;      /* primary, links, progress, focus */
  --color-dusk: #7FB7D9;       /* gradient start on headline words */
  --font-sans: var(--font-inter);
  --font-arabic: var(--font-naskh);
}
```
Map them onto shadcn's variables in `:root` so shadcn components pick them up:
`--background: #0F1829` · `--foreground: #FFFFFF` · `--card: #16213A` · `--card-foreground: #FFFFFF` · `--primary: #ED8C44` · `--primary-foreground: #0F1829` · `--secondary: #12303F` · `--secondary-foreground: #FFFFFF` · `--muted: #16213A` · `--muted-foreground: #94A3B8` (slate-400) · `--accent: #12303F` · `--border: rgb(255 255 255 / 0.10)` · `--input: rgb(255 255 255 / 0.12)` · `--ring: #ED8C44` · `--destructive: #EF4444` · `--radius: 1rem`.
Add `className="dark"` on `<html>` and remove any light theme.

Text colours: headings `text-white`, body `text-slate-200`, secondary `text-slate-400`, tiny captions `text-slate-500`.

## Type
- **Inter** (`next/font/google`, variable `--font-inter`) for all Latin text. Headings `font-bold tracking-tight`; h1 `text-4xl sm:text-5xl md:text-6xl leading-[1.1]`; section h2 `text-2xl sm:text-3xl`.
- **Noto Naskh Arabic** (`--font-naskh`) for Arabic. Always `<span dir="rtl" lang="ar" className="font-arabic">…</span>`, a little larger than the English next to it (`text-[1.1em]`).
- Eyebrow labels: `text-xs font-black uppercase tracking-[0.18em] text-amber`.
- Headline accent word: `bg-gradient-to-r from-dusk to-white bg-clip-text text-transparent`.

## Components (recipes)
| Element | Classes |
|---|---|
| **Primary button** | `bg-amber text-midnight font-bold rounded-2xl px-6 py-3 shadow-[0_0_30px_rgba(237,140,68,0.2)] hover:shadow-[0_0_50px_rgba(237,140,68,0.4)] hover:-translate-y-0.5 transition-all` (a trailing `ArrowRight` icon for main CTAs) |
| **Secondary button** | `bg-teal text-white rounded-full px-5 py-2.5 ring-1 ring-white/10 hover:bg-teal/80` |
| **Card** | `rounded-2xl bg-midnight-2/80 ring-1 ring-white/10 p-5 sm:p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)]` |
| **Highlight card** (free programme, lifetime plan, success) | `rounded-3xl border border-amber/30 bg-amber/[0.08] backdrop-blur-xl shadow-[0_0_70px_-24px_rgba(237,140,68,0.55)]`, with an icon tile `h-10 w-10 rounded-2xl bg-amber/15 border border-amber/30 text-amber` |
| **Top nav** | a centred pill: `rounded-full bg-midnight/70 backdrop-blur ring-1 ring-white/10 px-2 py-1.5`; links `text-slate-300 hover:text-white px-4 py-2`; the active/CTA item is a dark pill with an amber ring (`ring-1 ring-amber/60`) |
| **Badge** | `rounded-full px-2.5 py-0.5 text-xs font-semibold`. Active: `bg-amber/15 text-amber`; Included free: `bg-dusk/15 text-dusk`; Locked: `bg-white/5 text-slate-400` |
| **Progress bar** | track `bg-white/10 h-1.5 rounded-full`, fill `bg-amber` |
| **Play button** (thumbnails, continue watching) | `h-14 w-14 rounded-full bg-amber text-midnight shadow-[0_20px_50px_-10px_rgba(237,140,68,0.65)]` with lucide `Play` (filled) |
| **Warning banner** (payment failed) | `rounded-2xl border border-amber/40 bg-amber/10 text-amber-100 p-4` with lucide `AlertTriangle` in amber |
| **Lesson thumbnail tile** | `aspect-video rounded-xl bg-gradient-to-br from-teal to-midnight ring-1 ring-white/10` + the programme icon centred |
| **Inputs** | `bg-white/5 ring-1 ring-white/10 rounded-xl focus:ring-amber` |

Clerk components: pass `appearance={{ baseTheme: dark, variables: { colorPrimary: "#ED8C44", colorBackground: "#16213A" } }}` (`dark` from `@clerk/themes`).

## Layout
- Base spacing unit 4 px (Tailwind default). Page container `max-w-6xl mx-auto px-4 sm:px-6`. Sections `py-12 sm:py-16`.
- Soft background glows: two absolutely positioned blurred circles (`bg-dusk/5 blur-[120px]`, `bg-teal/10 blur-[100px]`) behind the content.
- **Background:** `src/components/background-pattern.tsx` is a full-screen fixed inline SVG of a simple 8-point star (khatam) tile pattern, white stroke at `opacity-[0.04]`, under everything (`-z-10`, `pointer-events-none`).
- Mobile first: everything must work at 375 px. Cards stack; the pill nav collapses to logo + menu button.

## Tone
Calm and respectful. No confetti, emojis or gamified streaks. Greetings: "Assalāmu ʿalaykum, {name}". Success copy may use "Bārak Allāhu fīk".

## App shell (signed-in students)
- Signed-in students never see the marketing pages: `/` → `/dashboard`, `/pricing` → `/dashboard/plans` (in `src/proxy.ts`, with a client-side backup in `SignedInRedirect`).
- `/dashboard/*` and `/admin/*` render inside `AppShell`: the shadcn `Sidebar` (`collapsible="icon"`, ⌘B, cookie-persisted, a drawer from the left below 768 px), a sticky top bar with breadcrumbs and search, and a ⌘K command palette.
- Sidebar: glassy midnight (`--sidebar` at 72% + backdrop blur), uppercase section labels, an amber inset bar and glow on the active item, programme tree with lesson states (✓ done, ◉ in progress, ▶ open, 🔒 locked), a red dot on Billing during grace, and the Admin section for admins only.

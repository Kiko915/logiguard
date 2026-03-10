# LogiGuard — Brand & Design System Reference

> **For AI agents (Claude, Codex, Copilot, etc.):**
> Read this file in full before making any UI/UX changes to this codebase.
> Every design decision must conform to the rules defined here.
> When in doubt, refer back to this document — do not invent new patterns.

---

## 1. Project Identity

| Field        | Value                                                              |
|--------------|--------------------------------------------------------------------|
| Product name | **LogiGuard**                                                      |
| Tagline      | Intelligent Package Inspection, Secured by Blockchain.             |
| Type         | Enterprise SaaS — Logistics Quality Assurance System               |
| Course       | CSEL 303 · LSPU · 2026                                             |
| Stack        | React 19 + TypeScript + Vite · Tailwind CSS v4 · shadcn/ui        |

---

## 2. Design Philosophy

LogiGuard is an **enterprise tool**, not a consumer app. Every decision must reflect:

- **Minimalist** — remove anything decorative that doesn't serve function
- **Information-dense** — pack data clearly without clutter
- **Professional** — corporate, structured, trustworthy
- **Functional over decorative** — no gradients, illustrations, or playful elements
- **Consistent** — same patterns everywhere, no one-off styles

### Strict Rules
- **No rounded corners — ever.** All `border-radius` is `0px`. This is enforced globally via `* { border-radius: 0 !important }` in `index.css`. Never override this.
- **No heavy shadows.** Use `var(--shadow-xs)` or `var(--shadow-sm)` only. Prefer borders for structure.
- **No color for decoration.** Color is only used for semantic meaning (success, error, warning) or data visualization (charts).
- **No playful typography.** No oversized marketing headings. Max heading size is `text-lg` (1rem at 15px root).
- **No inline styles** unless absolutely necessary (e.g., `clamp()` for fluid type). Always use Tailwind utilities.

---

## 3. Logo & Branding Assets

All assets live in `frontend/public/branding/`.

| File                        | Usage                                                   |
|-----------------------------|---------------------------------------------------------|
| `logiguard_wordmark.png`    | Primary logo — used in sidebar, login page, 404 page    |
| `logiguard_wordmark.svg`    | SVG version of wordmark — prefer for scalable contexts  |
| `logiguard_symbol.png`      | Icon-only mark — used where space is limited            |
| `logiguard_symbol.svg`      | SVG icon mark — used as the browser favicon             |

### Logo Usage Rules
- Always use `logiguard_wordmark.png` (or `.svg`) when both the icon and name must appear.
- Never recreate the logo using text or icons (e.g., don't use a Lucide icon + "LogiGuard" text as a substitute).
- The favicon is always `logiguard_symbol.svg` — set in `index.html`.
- Maintain aspect ratio — always use `object-contain` and set only `h-*` (not `w-*`).
- **Sidebar logo:** `h-5` · **Login page logo:** `h-10` · **404/auth pages top bar:** `h-5`
- Do not apply filters, shadows, or color overlays to the logo.

---

## 4. Color System

Defined in `frontend/src/index.css` as CSS custom properties.
The palette is **neutral monochrome** — black, white, and grays only for brand colors.
Color is reserved for semantic states (success, destructive, warning) and charts.

### 4.1 Light Mode (`:root`)

| Token                    | Value                      | Usage                              |
|--------------------------|----------------------------|------------------------------------|
| `--background`           | `oklch(0.985 0 0)`         | Page background (near-white)        |
| `--foreground`           | `oklch(0.13 0 0)`          | Primary text (near-black)           |
| `--card`                 | `oklch(1 0 0)`             | Card surface (pure white)           |
| `--card-foreground`      | `oklch(0.13 0 0)`          | Card text                           |
| `--primary`              | `oklch(0.14 0 0)`          | Primary actions (near-black)        |
| `--primary-foreground`   | `oklch(0.98 0 0)`          | Text on primary (white)             |
| `--secondary`            | `oklch(0.94 0 0)`          | Secondary buttons, light fills      |
| `--secondary-foreground` | `oklch(0.20 0 0)`          | Text on secondary                   |
| `--muted`                | `oklch(0.96 0 0)`          | Subtle backgrounds, table headers   |
| `--muted-foreground`     | `oklch(0.50 0 0)`          | Labels, metadata, placeholders      |
| `--accent`               | `oklch(0.93 0 0)`          | Hover fills                         |
| `--accent-foreground`    | `oklch(0.14 0 0)`          | Text on accent                      |
| `--border`               | `oklch(0.88 0 0)`          | All borders and dividers            |
| `--input`                | `oklch(0.88 0 0)`          | Input border color                  |
| `--ring`                 | `oklch(0.14 0 0)`          | Focus ring color                    |
| `--destructive`          | `oklch(0.50 0.190 25)`     | Errors, damaged status, danger      |
| `--success`              | `oklch(0.50 0.130 150)`    | Good status, connected, stable      |
| `--warning`              | `oklch(0.66 0.155 75)`     | Warnings, high utilization          |
| `--sidebar`              | `oklch(0.97 0 0)`          | Sidebar background                  |
| `--sidebar-border`       | `oklch(0.88 0 0)`          | Sidebar border                      |

### 4.2 Dark Mode (`.dark`)

| Token                  | Value                       |
|------------------------|-----------------------------|
| `--background`         | `oklch(0.11 0 0)`           |
| `--foreground`         | `oklch(0.93 0 0)`           |
| `--card`               | `oklch(0.16 0 0)`           |
| `--primary`            | `oklch(0.93 0 0)`           |
| `--primary-foreground` | `oklch(0.11 0 0)`           |
| `--muted`              | `oklch(0.20 0 0)`           |
| `--muted-foreground`   | `oklch(0.60 0 0)`           |
| `--border`             | `oklch(1 0 0 / 0.10)`       |
| `--ring`               | `oklch(0.70 0 0)`           |
| `--sidebar`            | `oklch(0.085 0 0)`          |

### 4.3 Semantic Color Usage

| Status / State  | Token           | Example usage                          |
|-----------------|-----------------|----------------------------------------|
| Good / Success  | `--success`     | "Good" package badge, connected status |
| Damaged / Error | `--destructive` | "Damaged" badge, error messages        |
| Warning         | `--warning`     | Queue overflow, high utilization (ρ>0.7)|
| Empty / Neutral | `--muted`       | "Empty" package badge                  |

### 4.4 Color Rules
- **Never use arbitrary hex colors** in components except: `bg-[#FFFFFF]` for surfaces that must be pure white (login left panel, 404 page).
- **Never introduce new colors** outside the defined token set.
- Use `text-success`, `text-destructive`, `text-warning` — never hardcode color values in JSX.

---

## 5. Typography

### Fonts
| Font             | Variable        | Usage                                        |
|------------------|-----------------|----------------------------------------------|
| Inter            | `--font-sans`   | All UI text — labels, body, headings, buttons |
| JetBrains Mono   | `--font-mono`   | Data values — IDs, hashes, timestamps, code  |

Loaded via Google Fonts in `index.css`. Do not swap or add other fonts.

### Scale (root = 15px)
| Token          | Size     | px   | Usage                                  |
|----------------|----------|------|----------------------------------------|
| `text-2xs`     | 0.625rem | ~9px | Metadata, version tags, status labels  |
| `text-xs`      | 0.6875rem| ~10px| Table cells, badges, secondary labels  |
| `text-sm`      | 0.75rem  | ~11px| Body text, inputs, descriptions        |
| `text-base`    | 0.8125rem| ~12px| Default UI text                        |
| `text-md`      | 0.875rem | ~13px| Section headers                        |
| `text-lg`      | 1rem     | 15px | Page titles — **maximum heading size** |

### Typography Rules
- **No text larger than `text-lg`** in the application UI.
- Use `font-semibold` (600) for headings, `font-medium` (500) for labels, `font-normal` (400) for body.
- Use `tracking-tight` on headings, `tracking-wider uppercase` on section labels.
- Use `tabular-nums` on all numeric data — scan times, counts, metrics.
- Use `font-mono` (JetBrains Mono) for: package IDs, blockchain tx hashes, timestamps, ISO dates.

---

## 6. Spacing

The system uses a compact spacing scale. All values are in `rem` relative to the 15px root.

| Scale | rem      | px   |
|-------|----------|------|
| 0.5   | 0.125rem | 2px  |
| 1     | 0.25rem  | 4px  |
| 1.5   | 0.375rem | 6px  |
| 2     | 0.5rem   | 8px  |
| 2.5   | 0.625rem | 10px |
| 3     | 0.75rem  | 12px |
| 4     | 1rem     | 15px |

Standard component paddings:
- **Table cells:** `px-3 py-2`
- **Card content:** `p-4`
- **Card header/footer:** `px-4 py-2.5`
- **Sidebar items:** `px-2.5 py-2`
- **Top bars / headers:** `h-12 px-4` (48px height)
- **Buttons (default):** `h-8 px-3`

---

## 7. Shape Language

- **Zero border radius — everywhere.** No exceptions.
- The global rule `* { border-radius: 0 !important }` in `index.css` enforces this.
- Never use `rounded-*` Tailwind classes. They will be visually overridden but generate dead CSS.
- Borders define structure. Use `border border-border` to separate sections.

---

## 8. Elevation & Shadows

| Token          | Value                                                                 | Usage              |
|----------------|-----------------------------------------------------------------------|--------------------|
| `--shadow-xs`  | `0 1px 2px 0 rgb(0 0 0 / 0.04)`                                      | Cards, stat boxes  |
| `--shadow-sm`  | `0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)`   | Dropdowns          |
| `--shadow-md`  | `0 2px 6px 0 rgb(0 0 0 / 0.07)`                                       | Modals             |
| `--shadow-none`| `none`                                                                | Default            |

**Rule:** Always prefer `border border-border` over shadows for visual separation.

---

## 9. Component Standards

### Button
File: `frontend/src/components/ui/button.tsx`

| Variant       | Usage                                      |
|---------------|--------------------------------------------|
| `default`     | Primary actions — near-black fill          |
| `secondary`   | Secondary actions — light gray fill        |
| `outline`     | Tertiary — border only, no fill            |
| `ghost`       | Navigation, icon buttons — no border       |
| `destructive` | Delete, danger actions                     |

Sizes: `xs` (24px) · `sm` (28px) · `md` (32px, default) · `lg` (36px) · `icon` (28×28px square)

### Card
File: `frontend/src/components/ui/card.tsx`
- Always has `border border-border`
- `CardHeader`: `bg-muted/30` tinted, `border-b`
- `CardFooter`: `bg-muted/20` tinted, `border-t`

### Badge
File: `frontend/src/components/ui/badge.tsx`

Domain-specific variants (map to LogiGuard package statuses):
- `good` — success green
- `damaged` — destructive red
- `empty` — muted gray
- `warning` — amber
- `stable` — success green (queue/system status)
- `unstable` — destructive red
- `degraded` — warning amber

### Table
File: `frontend/src/components/ui/table.tsx`
- Header: `bg-muted/60`, uppercase, `text-xs font-semibold text-muted-foreground`
- Rows: `hover:bg-accent/40`, `divide-y divide-border`
- Cells: `px-3 py-2 text-sm`

### Input
File: `frontend/src/components/ui/input.tsx`
- Height: `h-8` (32px)
- Always `border border-input`, focus shows `border-ring ring-ring/30`

---

## 10. Layout System

### App Shell
```
page-root (h-screen, flex, overflow-hidden)
├── Sidebar (w-[220px], fixed height)
└── page-main (flex-1, flex-col)
    ├── Header (h-12, border-b)
    └── page-content (flex-1, overflow-auto, p-4)
```

### Sidebar
File: `frontend/src/components/layout/Sidebar.tsx`
- Width: `220px` fixed
- Logo area: `h-12`, wordmark `h-5`
- Nav items: icon (16px) + label, active = `bg-primary text-primary-foreground`
- Bottom: system status rows (Ganache, Supabase, Queue)

### Header
File: `frontend/src/components/layout/Header.tsx`
- Height: `h-12` (48px)
- Left: page title
- Right: date/time · refresh · notifications · user avatar

### Page Content
- Max content width: `max-w-[1400px]`
- Grid gaps: `gap-3` or `gap-4`
- Stat cards: 2-col mobile, 4-col desktop

---

## 11. Page-Specific Guidelines

### Login Page (`/auth/login`)
File: `frontend/src/pages/LoginPage.tsx`
- 2-column layout: left 55% branding, right 45% form
- Left background: `#FFFFFF` (pure white, hardcoded)
- Right background: `bg-muted`
- Left text: center-aligned
- Feature bullets: horizontal row, not vertical stack
- GIF (`/Checking-boxes.gif`): fades in 900ms after mount via `opacity` transition
- Wordmark on right panel: `h-10`
- "Forgot password?" links to `/auth/forgot-password` via React Router `<Link>`

### Forgot Password Page (`/auth/forgot-password`)
File: `frontend/src/pages/ForgotPasswordPage.tsx`
- Single centered card, `bg-[#FFFFFF] border border-border`
- Page background: `bg-muted`
- Has success state (MailCheck icon + confirmation message)

### 404 Page
File: `frontend/src/pages/NotFoundPage.tsx`
- Full-screen, `bg-[#FFFFFF]`
- Top bar: wordmark left, `"404"` mono label right
- Centered: fluid `404` number (`clamp(6rem, 18vw, 14rem)`), thin divider, message, 2 action buttons
- Footer: project info centered

### Dashboard (`/dashboard`)
File: `frontend/src/pages/HomePage.tsx`
- 4 KPI stat cards
- 2 mode cards (Live Scanner, Simulation) + M/M/1 metrics panel
- Recent scan activity table
- System info tiles

---

## 12. Routing

Defined in `frontend/src/App.tsx`.

| Route                    | Component           | Auth required |
|--------------------------|---------------------|---------------|
| `/`                      | Redirect            | —             |
| `/auth`                  | Redirect            | —             |
| `/auth/login`            | `LoginPage`         | No            |
| `/auth/forgot-password`  | `ForgotPasswordPage`| No            |
| `/dashboard`             | `DashboardLayout`   | Yes           |
| `/*`                     | `NotFoundPage`      | No            |

Auth logic: unauthenticated users are redirected to `/auth/login`. Authenticated users hitting auth routes are redirected to `/dashboard`. Auth state is currently a local `useState` stub — will be replaced with Supabase session.

---

## 13. CSS Utility Classes (Custom)

Defined in `@layer components` and `@layer utilities` in `index.css`.

| Class             | Description                                          |
|-------------------|------------------------------------------------------|
| `page-root`       | Full-screen flex container for the app shell         |
| `page-main`       | Flex-col container for header + content              |
| `page-content`    | Scrollable main content area with padding            |
| `stat-card`       | KPI card: border, shadow-xs, flex-col, gap-1         |
| `stat-card-label` | Uppercase xs muted label                             |
| `stat-card-value` | Large semibold tabular number                        |
| `data-table`      | Full-width borderless table with hover rows          |
| `section-header`  | Bordered section title bar                           |
| `mono-value`      | JetBrains Mono xs for hashes/IDs                     |
| `tabular-nums`    | `font-variant-numeric: tabular-nums`                 |
| `text-2xs`        | 0.625rem — smallest text size                        |

---

## 14. Do's and Don'ts

### Do
- Use CSS tokens (`var(--primary)`, `text-primary`, `bg-muted`) — never hardcode colors in components
- Use `<Link>` from `react-router-dom` for all internal navigation
- Use `font-mono` / `.mono-value` for IDs, hashes, timestamps
- Use `tabular-nums` on all numeric displays
- Use semantic badge variants (`good`, `damaged`, `empty`) for package status
- Keep components in `frontend/src/components/ui/` for reusable primitives
- Keep page components in `frontend/src/pages/`
- Keep layout components in `frontend/src/components/layout/`

### Don't
- Don't add `rounded-*` classes — border radius is globally zeroed
- Don't use colors outside the token system for UI elements
- Don't create headings larger than `text-lg`
- Don't add decorative illustrations, gradients, or background patterns
- Don't use `<a href>` for internal links — always use React Router `<Link>`
- Don't add new fonts — Inter and JetBrains Mono are the only permitted fonts
- Don't use `shadow-md` or larger on cards — only `shadow-xs` / `shadow-sm`
- Don't recreate the logo with text/icons — always use the image assets from `/branding/`
- Don't add `border-radius` via inline styles to work around the global reset

---

## 15. Asset Paths

| Asset                               | Public path                          |
|-------------------------------------|--------------------------------------|
| Wordmark (PNG)                      | `/branding/logiguard_wordmark.png`   |
| Wordmark (SVG)                      | `/branding/logiguard_wordmark.svg`   |
| Symbol / Icon (PNG)                 | `/branding/logiguard_symbol.png`     |
| Symbol / Icon (SVG) — favicon       | `/branding/logiguard_symbol.svg`     |
| Checking boxes GIF (login page)     | `/Checking-boxes.gif`                |

All assets are in `frontend/public/`. Reference them with root-relative paths (e.g., `/branding/...`), not relative paths.

---

*Last updated: 2026-03-10 — LogiGuard v2.0*

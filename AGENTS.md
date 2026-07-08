---
description: 
alwaysApply: true
---

# EDT Design System and Agent Instructions

This file is the source of truth for AI-assisted development on the English Diagnostic Test. Follow these rules when creating or editing UI in this repository.

## Product Identity

The client templates define the canonical EDT visual identity. Use the dark academic design language from:

- `Client_Feedback/Template_landing_page_index.html`
- `Client_Feedback/Template_landing_page_index_zh_hk.html`
- `Client_Feedback/Template_report.html`

Do not infer design from the legacy `index.html` Inter/sky theme for marketing pages. The legacy theme is only acceptable inside dense assessment workflows where light surfaces improve readability.

## Test Bank and Scoring

Before adding, removing, or remapping MCQs, read [`TEST_BANK_GUIDE.md`](TEST_BANK_GUIDE.md) and [`DATABASE_README.md`](DATABASE_README.md).

- **The question bank lives in Cloudflare D1** (unified multi-test schema, migration `0006_unified_test_bank.sql`): `tests` → `test_parts` → `dimensions` / `shared_resources` → `question_groups` → `questions` (variants). Content ships as seed migrations (`0007_seed_test1.sql`, `0008_seed_test2.sql`).
- Every variant has a unique **question code `TT-PP-SS-GGG-QQ`** (test-part-dimension-group-variant, e.g. `01-01-01-007-01`). Codes are immutable once attempts exist.
- **Randomization engine:** each exam slot is a question group holding up to 10 variants; the Worker serves exactly one random variant per group per attempt, records the served configuration in `test_attempt_answers`, and scores server-side. Currently 1 variant per group (`QQ='01'`).
- Current tests: **Test 1** (`01`, active) — 90 groups: 60 Part A grammar (12 dimensions × 5) + 30 Part B vocabulary, overall CEFR grid 0–90. **Test 2** (`02`, active) — 45 groups: 20 Part A listening (R2 audio, once-only playback) + 25 Part B reading (6 shared passages), B2 / C1-C2 difficulty dimensions, per-part conversion grids (/20 and /25).
- Always score by stable `question_code` / group identity, never by shuffled display index (see Forbidden Patterns).
- **Test 2 runs on the attempts API** (`worker/src/attempts.ts`): random variant per group, served config in `test_attempt_answers`, server-side scoring, `attempt_reports` variables. Candidates pick their paper on the info screen; voucher usage is tracked **per test** in `voucher_test_usage` (`uses_allowed` applies to each paper separately, consumed at submit).
- **Transition:** the live Test 1 quiz flow still reads `frontend/src/data/` and scores client-side into `submissions` until Test 1 moves to the attempts API. Until then, Test 1 content changes must be mirrored in both `frontend/src/data/` (+ worker constants `DIMENSION_KEYS`, `SCORE_BUCKETS`, `ALL_QIDS_ORDERED`) and a D1 migration.
- Conversion grids are data (`score_conversion_bands`); do not hardcode totals or bands in UI without updating the bands, the worker score buckets, and both EN / zh-HK i18n strings.

## Design Tokens

Use these values exactly.

| Token | Hex | Tailwind Alias | Purpose |
| --- | --- | --- | --- |
| `--accent-neon` | `#CEFF1A` | `edt.neon` | Logo, primary outlines, CTA hover fills, active accents |
| `--muted-gold` | `#AAA95A` | `edt.gold` | Secondary CTAs, section headings, dividers |
| `--olive-drab` | `#82816D` | `edt.olive` | Muted navigation text, borders, footer links |
| `--deep-indigo` | `#414066` | `edt.indigo` | Report previews, secondary dark panels |
| `--forest-black` | `#1B2D2A` | `edt.forest` | Primary page background and fixed nav |
| `--soft-white` | `#F4F4F4` | `edt.soft` | Body copy on dark backgrounds |

Tailwind configuration must expose the same tokens:

```js
colors: {
  edt: {
    neon: '#CEFF1A',
    gold: '#AAA95A',
    olive: '#82816D',
    indigo: '#414066',
    forest: '#1B2D2A',
    soft: '#F4F4F4',
  },
}
```

## Typography

- English UI: `Montserrat`, weights `300`, `400`, and `600`.
- English display/logo: `Bodoni Moda`, weight `700`.
- Traditional Chinese display headings: `Noto Serif TC`, weight `700`.
- Traditional Chinese body/UI: `Montserrat`, `Noto Serif TC`, serif fallback.
- Letter-spaced uppercase labels should use `text-xs` or `text-sm`, `tracking-[0.18em]`, and `uppercase`.

Load fonts with:

```html
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:wght@700&family=Montserrat:wght@300;400;600&family=Noto+Serif+TC:wght@400;700&display=swap" rel="stylesheet">
```

## Layout

- Global marketing background: `bg-edt-forest text-edt-soft`.
- Main container: `max-w-content mx-auto px-6 md:px-10`.
- Fixed nav: `bg-[rgba(27,45,42,0.95)]`, `backdrop-blur-md`, bottom border `border-[rgba(130,129,109,0.2)]`.
- Hero height: `min-h-screen`, with content vertically centered and top padding to clear fixed nav.
- Section spacing: `py-20 md:py-24` for major marketing/report sections.
- Grid collapse breakpoint: 1024px. Two- and three-column sections must become one column at or below `lg`.
- Mobile hero heading: reduce from `text-6xl`/`4rem` to around `text-5xl`/`3rem`.

## Interaction Rules

- Primary CTA default: transparent background, `border border-edt-neon`, text `edt.neon`.
- Primary CTA hover: filled `bg-edt-neon text-edt-forest` with glow `shadow-[0_0_30px_rgba(206,255,26,0.3)]`.
- Login CTA default: `bg-edt-gold text-edt-forest`.
- Login CTA hover: `bg-edt-neon`, translate up by 2px, optional lime glow.
- Locale switcher: transparent background, `border border-edt-olive`, text `edt.olive`, uppercase language codes.
- Visual cards: dark image card with border `rgba(170,169,90,0.2)`, gradient overlay, hover `-translate-y-2.5`, hover border `edt.neon`.
- Inputs in assessment/auth flows: light cards are allowed, but focus rings should use EDT neon or the assessment accent consistently.

## Component Snippets

### LocaleSwitcher

```tsx
export function LocaleSwitcher({ value, onChange }: {
  value: 'en' | 'zh-HK';
  onChange: (next: 'en' | 'zh-HK') => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as 'en' | 'zh-HK')}
      className="border border-edt-olive bg-transparent px-2.5 py-1 text-xs uppercase text-edt-olive outline-none transition-colors hover:text-edt-soft"
      aria-label="Select language"
    >
      <option value="en">EN</option>
      <option value="zh-HK">繁</option>
    </select>
  );
}
```

### NavBar

```tsx
export function NavBar({ children }: { children: React.ReactNode }) {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-[rgba(130,129,109,0.2)] bg-[rgba(27,45,42,0.95)] py-4 backdrop-blur-md">
      <div className="mx-auto flex max-w-content items-center justify-between px-6 md:px-10">
        <a className="font-display text-3xl font-bold tracking-[0.12em] text-edt-neon" href="/">
          EDT
        </a>
        {children}
      </div>
    </nav>
  );
}
```

### PrimaryCTA

```tsx
export function PrimaryCTA(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="inline-flex items-center justify-center border border-edt-neon px-10 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-edt-neon transition-all hover:bg-edt-neon hover:text-edt-forest hover:shadow-[0_0_30px_rgba(206,255,26,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}
```

### VisualCard

```tsx
export function VisualCard({ image, step, title, children }: {
  image: string;
  step: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article
      className="group relative min-h-80 overflow-hidden border border-[rgba(170,169,90,0.2)] bg-cover bg-center px-9 pb-10 pt-14 transition-all duration-300 hover:-translate-y-2.5 hover:border-edt-neon"
      style={{ backgroundImage: `url(${image})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[rgba(27,45,42,0.85)] to-[rgba(27,45,42,0.95)]" />
      <span className="relative z-10 float-right font-display text-6xl text-[rgba(206,255,26,0.15)]">
        {step}
      </span>
      <h3 className="relative z-10 mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-edt-neon">
        {title}
      </h3>
      <div className="relative z-10 mt-5 text-sm leading-7 text-edt-soft/85">{children}</div>
    </article>
  );
}
```

### Light Assessment Card

```tsx
export function AssessmentCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      {children}
    </section>
  );
}
```

## Report Rules

- Results pages may use light report cards for readability, but the header and export frame should reference the EDT palette.
- Dimension scoring layout, overall-only questions, and CEFR breakpoints are defined in [`TEST_BANK_GUIDE.md`](TEST_BANK_GUIDE.md). Current values: 12 Part A grammar dimensions, max raw score 5 per dimension, 90 total MCQs (Test 1); per-part CEFR bands for Test 2.
- Feedback is stored as **layout-free variables** in `attempt_reports.variables` (schema `rv1`, `worker/src/reportVariables.ts`): scores, level keys, band keys — never HTML, layout, or locale-rendered text.
- The report renders twice from the same variables: HTML in the frontend (student/teacher view, i18n at render time) and **PDF server-side** (`GET /api/reports/:attemptId/pdf`, pdf-lib in `worker/src/reports.ts`, EDT-branded, Montserrat + Noto Serif TC from R2, latest 20 PDFs cached in R2 with FIFO eviction via `pdf_cache_index`).
- Report re-access credentials: attempt ID + original voucher code (student), owning session token, or teacher key scoped by `user_group`.
- All report labels, narratives, buttons, and chart labels must read from the i18n dictionaries — frontend `messages.ts` **and** `worker/src/reportI18n.ts` (EN + zh-HK, keyed by `levelKey` / `band_key`).

## Forbidden Patterns

- Do not introduce a new brand palette.
- Do not use the legacy Google Apps Script URL.
- Do not hardcode the old `PASSCODE` flow.
- Do not score shuffled questions by display index; always score by stable `question_code` / question group identity.
- Do not hardcode variant selection; the engine picks one random variant per group at attempt start and records it in `test_attempt_answers`.
- Do not rename `dimensions.key` or `score_conversion_bands.band_key` values — stored history and narrative i18n key off them.
- Do not renumber or delete question codes/variants that have been served in any attempt.
- Do not edit applied D1 migrations; ship content changes as new migrations.
- Do not store layout, HTML, or locale-rendered narrative text in `attempt_reports.variables`.
- Do not expose R2 audio (or any test asset) via public URLs; serve only through the authenticated `/api/assets/...` route.
- Do not put secrets, voucher batches, Cloudflare tokens, or database IDs in source files.

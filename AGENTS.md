# Repository Guidelines

## Project

CiteOps marketing site and playground for `llm-citeops`. This is a Next.js 15 App Router app using React 19, TypeScript, Tailwind CSS, `next-intl`, Supabase, and Vitest.

## Commands

- `npm install` - install dependencies from `package-lock.json`.
- `npm run dev` - start the local Next.js dev server at `http://localhost:3000`.
- `npm run build` - create a production build.
- `npm start` - serve the production build.
- `npm run typecheck` - run `tsc --noEmit`.
- `npm test` - run the Vitest suite once.
- `npm run test:coverage` - run Vitest with V8 coverage. Coverage thresholds are configured in `vitest.config.ts`.
- `npm run lint` - run Next lint. This currently passes, but `next lint` prints a deprecation warning under Next.js 15.

## Architecture And Routing

- App routes live under `app/`.
- Locale routes live under `app/[locale]/`; the root `app/layout.tsx` is only a pass-through because `<html>` and `<body>` are defined in `app/[locale]/layout.tsx`.
- `next-intl` routing is configured in `i18n/routing.ts` with `locales: ["en"]`, `defaultLocale: "en"`, and `localePrefix: "as-needed"`.
- Middleware in `middleware.ts` applies locale handling while excluding API, auth, Next internals, Vercel internals, static files, `robots.txt`, `sitemap.xml`, and `favicon.ico`.
- In App Router pages/layouts, route `params` are typed as promises, for example `params: Promise<{ locale: string }>`.
- API routes under `app/api/**/route.ts` use `NextResponse.json(...)`. Playground audit routes explicitly set `export const runtime = "nodejs"`.

## Content And Configuration

- Marketing copy is centralized in `messages/en.json`. Prefer editing copy there instead of hard-coding text in components.
- Reviews live in `content/reviews.en.json`; loader logic is in `lib/reviews.ts`.
- Branding, logo source, external links, install command, and overview/explainer image URLs live in `config/branding.ts`. Use `NEXT_PUBLIC_*` overrides there rather than editing UI components.
- Site URL handling lives in `config/site-url.ts`.
- Published/modified dates for metadata and structured data live in `config/content-freshness.ts`.
- Supabase schema for audit reports lives in `supabase/audit-reports.sql`.

## Code Style

- Use TypeScript with strict mode. Prefer explicit exported types for shared shapes.
- Use the `@/*` path alias for internal imports.
- Keep server components as the default. Add `"use client"` only when React state, effects, transitions, or browser APIs are needed.
- Keep report/business logic in `lib/**`; keep UI rendering in `components/**` and route handlers/pages in `app/**`.
- Use environment-reading helpers from `lib/supabase/config.ts` and report access helpers from `lib/reports/access.ts` instead of reading related env vars throughout the app.
- For report storage, preserve the existing modes: `disabled`, `best_effort`, and `required`. `best_effort` should not block the user journey when storage fails.
- Analytics/event writes should remain non-blocking where the current code treats them that way.

## UI And Styling

- Tailwind is configured in `tailwind.config.ts`; custom colors map to CSS variables in `app/globals.css`.
- Prefer existing theme tokens such as `paper`, `paper-muted`, `ink`, `ink-muted`, `border`, `accent`, `accent-hover`, `accent-fg`, `wash`, and `card`.
- Use existing layout utilities such as `safe-pad`, `max-w-content`, `text-balance`, and `enterprise-grid`.
- The visual style is restrained and product-focused: dense sections, strong typography, token-based colors, and accessible focus states.
- Keep localized display copy in messages unless the existing component already intentionally uses static demo/sample text.

## Tests

- Tests live in `tests/**/*.test.ts` and run in the Node environment.
- Vitest aliases `@` to the repository root.
- Existing tests cover report access flags, report previews, redirects, tokens, and Supabase config.
- When changing `lib/reports/**` or `lib/supabase/config.ts`, add or update focused Vitest tests.
- Coverage currently includes:
  - `lib/reports/access.ts`
  - `lib/reports/preview.ts`
  - `lib/reports/redirects.ts`
  - `lib/reports/tokens.ts`
  - `lib/supabase/config.ts`
- Coverage thresholds are 90% lines/functions/statements and 80% branches.

## Environment

Optional public branding variables:

- `NEXT_PUBLIC_LOGO_SRC`
- `NEXT_PUBLIC_GITHUB_URL`
- `NEXT_PUBLIC_NPM_URL`
- `NEXT_PUBLIC_INSTALL_CMD`
- `NEXT_PUBLIC_OVERVIEW_IMAGE_URL`
- `NEXT_PUBLIC_EXPLAINER_IMAGE_URL`

Supabase/report variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` as a legacy fallback
- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` as a legacy fallback
- `NEXT_PUBLIC_REPORT_ACCESS_MODE`: `open`, `email_capture`, `google_login`, or `magic_link`
- `REPORT_STORAGE_MODE`: `disabled`, `best_effort`, or `required`
- `REPORT_CAPTURE_FAIL_MODE`: `open` or `closed`
- `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH`
- `NEXT_PUBLIC_SITE_URL`

Recommended local/demo fallback from the README: set `REPORT_STORAGE_MODE=disabled` when local work should not touch Supabase.

## Before Finishing Changes

- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run lint` when touching app, component, or route code.
- Run `npm run test:coverage` when changing the covered report/Supabase modules or their tests.

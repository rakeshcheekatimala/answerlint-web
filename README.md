# CiteOps marketing site

Next.js (App Router) landing page for [llm-citeops](https://github.com/rakeshcheekatimala/llm-citeops). All marketing copy lives in `messages/`; branding and links live in `config/branding.ts` (with optional `NEXT_PUBLIC_*` overrides).

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production

```bash
npm run build
npm start
```

Deploy on [Vercel](https://vercel.com) or any Node host. For static export, add `output: 'export'` to `next.config.ts` if you do not need server features.

## Editing content

- **Strings**: [`messages/en.json`](messages/en.json). Add locales by creating `messages/<locale>.json`, registering the locale in [`i18n/routing.ts`](i18n/routing.ts), and extending [`lib/reviews.ts`](lib/reviews.ts) if you add localized review files.
- **Logo**: Replace [`public/brand/logo.svg`](public/brand/logo.svg) or set `NEXT_PUBLIC_LOGO_SRC` to an absolute URL (then add the host to `images.remotePatterns` in `next.config.ts`).
- **Reviews**: Edit [`content/reviews.en.json`](content/reviews.en.json). Each item supports:

  ```json
  {
    "quote": "Short testimonial text.",
    "author": "Name",
    "role": "Optional role or company",
    "source": "Optional link label or URL note"
  }
  ```

  With an empty `items` array, the Reviews section shows a “coming soon” state defined in `messages/en.json` under `Reviews`.

## Environment variables (optional)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_LOGO_SRC` | Logo image URL or path |
| `NEXT_PUBLIC_GITHUB_URL` | Repository URL |
| `NEXT_PUBLIC_NPM_URL` | npm package URL |
| `NEXT_PUBLIC_INSTALL_CMD` | Install command shown in hero and CTA |
| `NEXT_PUBLIC_OVERVIEW_IMAGE_URL` | Terminal screenshot URL |

## Report unlocks

The AI visibility audit flow returns a focused preview first, then unlocks the
full report based on feature flags. The MVP mode captures email and unlocks
downloads immediately without sending magic-link email.

1. Create a Supabase Cloud project.
2. Run [`supabase/audit-reports.sql`](supabase/audit-reports.sql) in the SQL editor.
3. Add environment variables:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key |
| `SUPABASE_SECRET_KEY` | Supabase service role key for trusted server routes |
| `NEXT_PUBLIC_REPORT_ACCESS_MODE` | `open`, `email_capture`, `google_login`, or `magic_link` |
| `REPORT_STORAGE_MODE` | `disabled`, `best_effort`, or `required` |
| `REPORT_CAPTURE_FAIL_MODE` | `open` or `closed` |
| `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH` | Set to `true` after Google OAuth is configured |
| `NEXT_PUBLIC_SITE_URL` | Production origin used by optional magic-link redirects |

Recommended MVP settings:

```text
NEXT_PUBLIC_REPORT_ACCESS_MODE=email_capture
REPORT_STORAGE_MODE=best_effort
REPORT_CAPTURE_FAIL_MODE=open
NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=false
```

Use `NEXT_PUBLIC_REPORT_ACCESS_MODE=open` as the emergency fallback when you want
reports to download without email capture. Use `REPORT_STORAGE_MODE=disabled`
for demos or local work that should not touch Supabase.

## Business-Aware Scan storage

Business-Aware Scan stores saved projects, curated page sets, latest scores, and
scan history in Supabase. If you see this message:

```text
Could not find the table 'public.business_scan_projects' in the schema cache
```

run [`supabase/business-scan-projects.sql`](supabase/business-scan-projects.sql)
in the Supabase SQL editor. The combined
[`supabase/audit-reports.sql`](supabase/audit-reports.sql) file also includes
this table for fresh installs.

After running the SQL, the final verification query should return:

```text
public.business_scan_projects
```

Magic-link mode is optional. If you enable `NEXT_PUBLIC_REPORT_ACCESS_MODE=magic_link`,
enable Email magic links in Supabase Auth and add redirect URLs for local
development:

```text
http://localhost:3000/auth/confirm
http://localhost:3000/tools/geo-audit/report
```

For production, set Supabase Auth's Site URL and redirect allowlist to the live
domain before sending magic links:

```text
https://your-production-domain.com
https://your-production-domain.com/auth/confirm
https://your-production-domain.com/tools/geo-audit/report
```

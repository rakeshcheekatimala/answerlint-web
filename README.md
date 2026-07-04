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

## Supabase report unlocks

The AI visibility audit flow stores completed reports in Supabase and returns a
limited preview until the visitor unlocks the report with email or Google.

1. Create a Supabase Cloud project.
2. Run [`supabase/audit-reports.sql`](supabase/audit-reports.sql) in the SQL editor.
3. Enable Email magic links and, optionally, Google OAuth in Supabase Auth.
4. Add redirect URLs for local development:

```text
http://localhost:3000/auth/confirm
http://localhost:3000/tools/geo-audit/report
```

5. Add environment variables:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key |
| `SUPABASE_SECRET_KEY` | Supabase service role key for trusted server routes |
| `NEXT_PUBLIC_SITE_URL` | Local or production origin used in magic-link redirects |
| `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH` | Set to `true` after Google OAuth is configured |

# AnswerLint

AnswerLint is the site at [useanswerlint.com](https://useanswerlint.com). The tool on `/tools/ai-visibility` is the AI visibility report.

You type a company domain and click Read the site. The page reads the public site and lists buyer questions. You can add or remove questions. Six is the limit. Empty questions are dropped. You can add a competitor with a name and a site. Four is the limit. Competitors are optional, and you can remove one the site found. Then click Build the report.

ChatGPT is the only answer engine. The report is one page.

**Citation share vs competitors.** The numbers come from saved ChatGPT answers. Blank means there is no saved answer to measure. 0% means ChatGPT answered and that name was not cited.

**Prompts you are missing.** Buyer questions where the saved answers do not mention the brand. If someone else was cited, that name is listed. A question that did not run says Not scored.

**Technical check.** Page opens, Heading, Direct answer, Canonical, Structured data, Citation readiness. A competitor site you added is checked too.

**Five prioritized fixes.** At most five. A fix is listed only when a missing question or a failed check supports it.

The same question, for the same domain and ChatGPT model, reuses the saved answer. A new question is the only new ChatGPT call.

With no `OPENAI_API_KEY`, the page still loads and the technical check still runs. Citation share stays Blank. The report says ChatGPT needs an API key.

## Run locally

```bash
npm install
NEXT_PUBLIC_ENABLE_AI_VISIBILITY=true npm run dev
```

Open [http://localhost:3000/tools/ai-visibility](http://localhost:3000/tools/ai-visibility).

The page is hidden until `NEXT_PUBLIC_ENABLE_AI_VISIBILITY` is `true`.

## Deploy

Deploy this Next.js app on Vercel.

- `NEXT_PUBLIC_ENABLE_AI_VISIBILITY=true` shows the page.
- `OPENAI_API_KEY` is required for ChatGPT answers.
- `OPENAI_VISIBILITY_MODEL` is optional. The default is `gpt-5.6-terra`.

This page does not need Inngest, Supabase, or Redis.

## Other pages

- `/playground` and `/tools/geo-audit`: website audit, preview first, then the full report.
- `/tools/business-aware-scan`: which pages matter to the business, plus a visibility score.
- `/tools/llms-txt`: `llms.txt` and `llms-full.txt` from a public site.
- `/docs`: documentation.

# AI Visibility: Evidence-to-Action Product Plan

Revision: 2026-09-04. This supersedes the previous draft in this file.

## Recommendation

Build **Answer Evidence Loop**, not a generic AI-visibility dashboard.

The market already sells prompt tracking, mention scores, share of voice,
competitor charts, source lists, and generic recommendations. AnswerLint should
make one narrower promise:

> For the buyer questions that matter, show what was observed, why it is
> trustworthy, which owned page or external source can change it, and whether
> that change improved the next comparable run.

That is a real fit. The uncommitted visibility work already models evidence,
approvals, and actions. The Business-Aware Scan already weights revenue and
trust pages. The job is to constrain this into an honest measurement product,
not to rebuild Amplitude/Profound/Peec inside AnswerLint.

Ship the first version as a **closed beta with one controlled surface**. Do not
call it a paid AI-visibility suite until accounts, budgets, and native Google
import exist.

## Verdict

The strategy is good. Keep it.

What is already strong, and should not be diluted:

- A single defensible promise instead of a blended visibility percentage.
- Four measurement lanes with allowed language. Never mix them into one score.
- The answer as the unit of analysis, with drill-down to artifacts.
- Connecting actions to owned pages and SiteOps findings. That is the moat.
- Treating Google as native evidence, not a third-party imitation.
- Cost discipline: a locked 24-run baseline, weekly monitoring, cached
  verification, no embedding-driven topic expansion.
- An honest Phase 0: the current workspace is a foundation, not a live meter.

What still needs a decision before more product surface is built is listed
under [Decisions](#decisions). Until those are locked, keep Phase 0 narrow.

## Decisions

Accept the recommended default unless there is a reason not to.

| # | Decision | Recommended default | Why it matters |
| --- | --- | --- | --- |
| 1 | OpenAI measurement path | Stay on the Responses API `web_search` tool. Set `tool_choice` so search actually runs. Relabel the surface to **OpenAI web-search controlled run**. Do not market it as ChatGPT Search. | OpenAI’s current docs recommend Responses for new search integrations and say Chat Completions search models do not return complete source lists. This product needs sources more than it needs the ChatGPT brand. |
| 2 | First commercial shape | Closed beta behind `NEXT_PUBLIC_ENABLE_AI_VISIBILITY`, reuse the existing anonymous project token, optional email capture later. Not paid in Phase 1. | The worker is still anonymous (`ownerMode: "anonymous"`). Charging before auth, budgets, and deletion paths creates support and trust debt. |
| 3 | Buyer | SEO / content lead who already uses SiteOps or Business-Aware Scan. | Action cards need a page owner. Product-marketing and PR actions can wait. |
| 4 | Google AI Overviews | Remove from the live surface picker. Native GSC import only, CSV first. | The Search Console Generative AI report is the measurement source Google documents. Third-party imitation is exactly what Google warns against. As of September 2026 the public Search Analytics API still does not expose those dimensions; CSV is the path, not a fallback. |
| 5 | Product name in UI | Keep **AI Visibility (beta)** in the UI. Use Answer Evidence Loop as the internal principle and changelog language. | An earlier PRD used “Cited Answer Share.” Two names in flight will leak into the UI. |
| 6 | Prompt generation | Keep deterministic templates from intake + scan. No LLM topic expansion in MVP. User can add/edit prompts. | The current planner already templates three prompts from category, use case, and competitor. Expanding with a model would raise cost without raising measurement quality. |

Also confirm these operating facts before calling the beta live:

- Inngest Cloud (or equivalent) is provisioned; `/api/inngest` is not enough on its own.
- `OPENAI_API_KEY` and an explicit `OPENAI_VISIBILITY_MODEL` are set.
- Supabase tables from `supabase/visibility.sql` plus the private artifact bucket exist.
- Upstash Redis is optional in dev (local limiter exists) and required in production if visibility traffic is public.

## What Is Already Here

The uncommitted work is a credible foundation:

- `lib/visibility/*` defines projects, human approval gates, prompt plans, run
  manifests, answer observations, citations, evidence confidence, actions, and a
  normalized Supabase schema.
- `lib/inngest/functions/visibility-benchmark.ts` is a durable
  prompt × surface × repetition worker with raw-answer artifacts and an Action
  Queue.
- `components/visibility/VisibilityWorkspaceClient.tsx` already has a Brand
  Intelligence Card, Topic Map, Prompt Lab, and evidence workspace.
- Business-Aware Scan already identifies and weights revenue, trust, developer,
  support, and content pages. Action cards should point at those pages.

Code-accurate gaps the previous draft understated:

- The planner currently creates **three** templated topics/prompts, not 8–12.
- The default intake selects `chatgpt_search` **and** `perplexity`, even though
  only OpenAI is a real adapter.
- Brand Card health fields are always `pending`; they are not a crawl.
- The Action Queue has two templates (missing comparison page; missing owned
  citation). It does not yet link to SiteOps findings.
- A failed provider call marks the **whole project** `failed`. There is no
  per-run `partial` / `not_configured` state in the UI.
- Per-run observations store `completedRepeatCount: 1`. Repeat confidence is
  recovered later in `aggregateEvidence`, which is easy to misread in the UI.
- There is no visibility feature flag yet. Business-Aware Scan already has
  `NEXT_PUBLIC_ENABLE_BUSINESS_SCAN`; copy that pattern.

## Ship blockers before this is a live meter

1. **Declare dependencies.** `zod`, `react-hook-form`, `@hookform/resolvers`,
   `inngest`, `@upstash/ratelimit`, and `@upstash/redis` are imported by the new
   feature and are not in `package.json`. A clean install will not build.
2. **Hide unconfigured surfaces.** Perplexity, Google AI Overviews, and Claude
   are `UnconfiguredSurfaceAdapter` stubs. The live picker must not present them
   as measured products. Do not render “0% visibility” for a surface that never
   ran.
3. **Label the OpenAI adapter accurately.**
   `lib/visibility/adapters/openai-search.ts` calls the Responses API, attaches
   `web_search` when `searchMode === "search_enabled"`, and does **not** set
   `tool_choice`. OpenAI’s default is auto: the model may skip search, return
   no citations, and produce a false zero. For search-enabled tests, require
   the web-search tool. Persist the provider’s source list where the API
   returns one, not only `url_citation` annotations.
4. **Stop over-claiming extraction.** Mention detection is a case-insensitive
   brand substring. Every positive hit is stored as `mentioned`. That cannot
   support rank, recommendation, sentiment, or narrative-fidelity headlines.
5. **Fix citation verification.** `verifyCitationSource` treats “the fetched
   HTML contains the brand name” as claim support. That fails a valid
   competitor citation and is not a proposition check. Verify against an
   expected entity or claim and readable source text. Keep a distinct
   `citation_resolved` state when the URL resolved but semantic support was
   not established.
6. **Remove inert controls or mark them planned.** `testFrequency`, `device`,
   and Brand Card health do not change provider execution, schedule work, or
   crawl the site.
7. **Cap verification and keep partial evidence.** The worker fetches every
   cited URL in parallel, does not persist the full consulted-source list, and
   has no budget/cancellation/idempotent run key beyond Inngest step retries.
   Cap and prioritize verification. If a source is skipped, the run is
   `partial`, not silently complete.

## Product principle: four measurement lanes

Every chart and export shows a measurement badge. A convenient proxy is not
ground truth.

| Lane | What it proves | Examples | Allowed language |
| --- | --- | --- | --- |
| **Native observed** | A platform reports that the customer’s URL appeared. | Search Console Generative AI CSV. | “Observed on Google.” |
| **Controlled reproduction** | An official provider API answered a locked prompt under a recorded policy. | OpenAI Responses `web_search` with required search. | “Observed in AnswerLint’s controlled run.” |
| **Site readiness** | A crawl checked whether an owned page is technically and semantically ready. | SiteOps / Business-Aware Scan. | “Readiness signal; not answer visibility.” |
| **Hypothesis** | A proposed action has not passed the re-test gate. | Content brief, comparison page task. | “Hypothesis to validate.” |

No data, a failed run, and a genuine zero are different states. Never blend
these lanes into one score.

## Non-goals for the beta

Do not build these until the evidence loop works on one surface:

- Multi-engine share of voice or a blended visibility score.
- Imitation of ChatGPT, Claude, Perplexity, or Google AI Overviews consumer UIs.
- Sentiment as a top-level nav item or headline KPI.
- Average rank inferred from prose.
- One-click mass AI rewrite of the customer’s site.
- LLM topic expansion, embeddings, or vector prompt clustering.
- OAuth to Search Console before Google exposes the generative-AI dimensions.
- Daily re-runs of the full prompt set.
- Org SSO, credential vaults, or regulated-team deletion workflows (Phase 2).

## Clean feature set

Must / later is the cut. Later is still the right product; it is not the beta.

### 1. Brand and page intelligence

Replace form-only baselining with a short review step that draws from an
existing Business-Aware Scan.

**Must**

- Confirm canonical brand, aliases, products, markets, competitors, and goal.
- Let the user approve 3–10 **focus pages** from high-impact revenue and trust
  pages. Show why each page was chosen and the SiteOps issues that already
  exist (direct answer, freshness, author, entity, canonical, citation
  readiness).
- Require an explicit alias / negative-alias rule when the brand name is
  ambiguous.
- Version the brand and focus-page snapshot. Edits create a new version.

**Later:** people, pricing signals, regulated-claim libraries, automatic
ambiguity detection beyond a confirmation checkbox.

### 2. Demand-aware Prompt Portfolio

The prompt set is the instrument. It needs more rigor than a generated list.

**Must**

- Four prompt classes: discovery, evaluation, comparison, trust/risk. Branded
  diagnostics stay in a separate section and are excluded from the headline
  discovery metric.
- Start with 8–12 approved prompts, not the current three templates. Each has
  persona, intent, language, market, weight, and reason.
- User add / edit / pause. Lock a **benchmark cohort** so new prompts join the
  next cohort instead of rewriting history.
- Preflight: planned run count, provider, repeats, search policy, estimated
  spend.

**Later:** bulk CSV import, multi-language cohorts, automatic prompt mining
from GSC queries (GSC’s generative-AI report does not include queries anyway).

### 3. Evidence Explorer — central dashboard

The answer is the primary unit of analysis.

**Must**

- One row per prompt × surface × market with status: measured, partial, failed,
  blocked, or not configured.
- Expand to raw answer, model, run time, policy, citations, source snapshot,
  parser decision, and verification result.
- Clickable citations. Retain the provider payload or a normalized immutable
  artifact with a retention policy.
- Classify citations as owned, independent/earned, competitor, or unresolved,
  with a user correction path.

**Later:** marketplace / directory / social subtypes, source graph UI,
inline claim-to-URL mapping beyond the table.

### 4. Honest scorecard

Show only measurements that drill down in one click.

**Must**

- **Measurement coverage:** completed eligible runs / planned eligible runs.
- **Verified mention rate:** weighted share of eligible controlled runs that
  mention the confirmed entity. Show `insufficient sample` when repeats are
  below the locked threshold.
- **Owned citation share:** resolved owned citations / all resolved citations.

**Later, and never as a blended score**

- Explicit recommendation rate, once the parser can detect a real
  recommendation or ordered list. Do not infer average rank from prose.
- Citation authority gap on the same prompt, surface, market, and cohort.
- Narrative alignment with a reviewed claim taxonomy.
- Win/loss only when both brands were tested under the same locked conditions.

Sentiment stays a diagnostic inside Evidence. A positive sentence can still be
commercially irrelevant.

### 5. Action Queue connected to the website

This is where AnswerLint can beat tracking-only products.

**Must**

- One action card per verified gap: affected prompts, source evidence, linked
  focus page, owner, effort, acceptance criteria, re-test rule.
- Link the card to the existing SiteOps finding when one exists.
- Compact change checklist, not generated long-form copy. Google’s AI
  optimization guide still warns against scaled content that adds no value.
- States: hypothesis → planned → published → awaiting re-test → improved /
  unchanged.

**Later:** holdout prompts, site-release fingerprinting, PR/outreach owners,
and language that says “associated change,” not “caused.”

### 6. Native Google evidence

**Must for Phase 2, not the beta.** The beta copy should already say Google
visibility is native-only, so customers do not expect an AI-Overview scraper.

- Verified owner uploads the Search Console Generative AI CSV.
- Show impressions and pages by country, device, and date beside controlled
  runs, never combined with them.
- Do not build OAuth against `searchanalytics.query` until Google documents a
  generative-AI type. Independent checks in 2026 still see only
  `web | image | video | news | discover | googleNews`.
- Do not promise clicks or queries from that report. Google’s help page
  documents impressions, pages, countries, devices, and dates.

### 7. Change and anomaly monitoring

**Must**

- Locked core cohort, on-demand re-run, append-only audit of policy, parser
  version, prompt cohort, and entity version.

**Later:** weekly scheduler (the UI frequency control does not schedule today),
source-displacement alerts, holdouts.

## Cost-effective delivery plan

### Phase 0 — make the foundation shippable (about 1 week)

This is the only work that should happen before a customer-facing beta URL.

1. Lock visibility dependencies in `package.json` / `package-lock.json` and
   prove a clean install.
2. Add `NEXT_PUBLIC_ENABLE_AI_VISIBILITY`. Default off. Hide unconfigured
   surfaces. Label the product **beta / controlled-run**.
3. Rename and harden the OpenAI adapter: required search for search-enabled
   tests, persist sources, honest display name.
4. Fix mention extraction, citation verification, partial-evidence status, and
   inert form fields.
5. Add per-project hard budgets, concurrency caps, cancellation, and a
   retry-safe run key. Add tests for configuration, failed/partial runs,
   artifact retention, and the rule that the four lanes never aggregate.

**Exit:** a clean environment can create a project, run the one supported
controlled surface, show the real answer and citations, and export an honest
report. No other surface is selectable.

### Phase 1 — closed-beta MVP (2–3 weeks)

1. Attach focus-page selection to Business-Aware Scan.
2. Prompt Portfolio with 8–12 prompts, four classes, cohort versioning, and
   budget preflight.
3. Replace the broad workspace panels with Evidence Explorer, three headline
   metrics, measurement badges, and artifact drill-down.
4. Deterministic entity and citation parsing. A small model only for ambiguous
   recommendation/narrative cases, with parser version stored.
5. Action cards wired to SiteOps findings and a page-level change checklist.
6. CSV export for evidence, scorecard, sources, and actions.

**Exit:** a marketer can see a verified gap, open the exact page and source,
publish one scoped change, and schedule a comparable re-test. This is still
not a paid multi-engine tracker.

### Phase 2 — defensibility (about 2 weeks)

1. Repeat-run confidence labels (`stable` / `volatile` / `insufficient`).
2. Action lifecycle, change timestamp, small holdout, “associated change”
   language.
3. Search Console CSV import and a separately labelled native view.
4. Account auth, project access, artifact retention choices, export and
   deletion. Then, and only then, a paid SKU.

**Exit:** historical runs are comparable; the customer can tell Google-native
evidence from AnswerLint’s test rig.

### Phase 3 — more surfaces only after a measurement contract

Add a provider only if it has official or licensed access, raw
response/citations, a recorded location/session policy, known terms, budget
observability, and a label for what the result is. Claude and Perplexity APIs
can support controlled web-search experiments. They are not consumer-UI
ranks without an equivalence basis.

## Operating budget

Launch defaults:

- 8 core prompts × 1 supported surface × 3 repeats = **24 runs** for baseline.
- At most 4 extra decision prompts or an on-demand re-test.
- Weekly monitoring once scheduling exists; otherwise on-demand only.
- Cache source verification by canonical URL + content hash for 7 days.
- Compact rows in Postgres; raw artifacts in the private Supabase bucket with
  30/90/365-day retention.
- Monthly project credit cap. Preflight computes
  `provider calls + verification fetches + storage` and requires approval
  above budget.

Avoid embeddings and LLM topic expansion in the MVP.
`visibility_prompt_embeddings` can wait as a deduplication aid. It does not
improve measurement.

## Suggested information architecture

**Beta**

1. **Evidence** — primary workspace: coverage, mention rate, owned citation
   share, answer table, drill-down.
2. **Actions** — page-linked queue, acceptance criteria, re-test state.
3. **Settings** — brand/entity version, focus pages, cohort, budget,
   retention, provider policy.

**After Phase 1**

4. **Portfolio** — prompt cohorts and policy, if Evidence gets crowded.
5. **Sources** — source graph and domain/page changes.
6. **Native data** — Search Console import, labelled separately.
7. **Audit log** — immutable versions.

The visual reference’s Overview / Prompts / Sources / Sentiment / Competitors /
Actions map is useful, but Sentiment is a drill-down, not a pillar, and
Overview should not become a vanity score row.

## Sources

- [OpenAI web-search documentation](https://developers.openai.com/api/docs/guides/tools-web-search)
  recommends the Responses API for new search integrations. Search is optional
  under `tool_choice: auto`. Chat Completions search models always search but
  do not support complete source lists or the newer web-search controls.
- [Google AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
  points site owners at the Search Console Generative AI performance report
  and cautions against treating third-party numbers as Google’s own metrics.
- [Generative AI performance report announcement](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports)
  and [Search Console Help](https://support.google.com/webmasters/answer/16984139)
  describe native dimensions: impressions, pages, countries, devices, dates.
  Independent 2026 checks still find no public Search Analytics API type for
  this report; CSV export is the documented download path.
- [Anthropic pricing](https://docs.anthropic.com/en/docs/about-claude/pricing)
  meters web search separately, which is why each project needs a hard budget.
- [Perplexity Search API](https://docs.perplexity.ai/docs/search/quickstart)
  is a later controlled-search candidate, not an MVP surface.
- [Profound](https://www.tryprofound.com/features/answer-engine-insights/prompt-tracking)
  and [Peec](https://peec.ai/product/ai-visibility) show that prompt tracking,
  competitor metrics, citations, and generic actions are already table stakes.

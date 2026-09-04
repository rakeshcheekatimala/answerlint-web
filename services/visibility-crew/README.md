# AnswerLint Visibility Crew

This private Python service is the only place where agentic interpretation is
allowed. Next.js/Inngest remains the durable measurement orchestrator and
Supabase remains the evidence ledger.

The boundary is intentional:

- deterministic code owns provider calls, counts, URLs, run status, budgets,
  cohort locking, and re-test comparisons;
- CrewAI explains verified evidence, checks brand-voice fidelity, and proposes
  page-linked actions;
- no agent can browse, mutate customer data, publish content, or change a
  measurement result;
- every agent output is schema-validated and must reference supplied evidence.

## Structure

```text
src/answerlint_visibility_crew/
  config/
    agents.yaml       # role, goal, backstory, delegation policy
    tasks.yaml        # task contracts and expected output
    prompts/          # versioned evidence, brand voice, action and safety rules
  api.py              # authenticated private API
  crew.py             # CrewAI agents and sequential crew
  flow.py             # typed, deterministic CrewAI Flow boundary
  guardrails.py       # output and evidence-reference validation
  schemas.py          # strict request/response contracts
  security.py         # HMAC request authentication and replay window
  settings.py         # model/provider/runtime configuration
```

## Local development

```bash
cd services/visibility-crew
cp .env.example .env
uv sync --extra dev
uv run uvicorn answerlint_visibility_crew.api:app --reload --port 8010
uv run pytest
```

Configure the web app with:

```text
VISIBILITY_CREW_MODE=best_effort
VISIBILITY_CREW_URL=http://127.0.0.1:8010
VISIBILITY_CREW_SIGNING_SECRET=<same value as service>
VISIBILITY_CREW_KEY_ID=primary
```

Production should run this service behind a private gateway or service mesh.
Do not expose it as an unauthenticated public endpoint. Rotate the signing
secret, restrict ingress to the Next.js/Inngest deployment, and use the cloud
provider's secret manager for model credentials.

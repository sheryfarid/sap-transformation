# SAP Transformation Intelligence Studio

Assess a legacy SAP ECC landscape, decide the migration approach and plan the move to SAP S/4HANA Cloud Private Edition under RISE with SAP, with an AI guide that proposes and drafts but never approves.

The app ships with synthetic demonstration data for a fictional company, ABC Manufacturing. Every screen says so, and every export is stamped as synthetic.

## What is in the box

| Part | Technology | Purpose |
| --- | --- | --- |
| Web app | React 18, Vite 5 | 15 working screens across the journey: onboarding, discovery, readiness, functional modules, WRICEF, reports, strategy, hyperscalers, BTP designer, Activate plan, risk and cutover, approvals, AI advisor, exports |
| Server | Node 22, Express 4 | Serves the built app, proxies AI requests, stores project state, adds security headers, optional basic auth |
| AI | Anthropic Messages API via `@anthropic-ai/sdk` | Streaming answers for the copilot and drafting features. The API key stays on the server |
| Domain logic | Plain JavaScript (`src/lib/engine.js`, `src/data/model.js`) | Rule engines, scoring, guidance and planning, covered by `node:test` tests |

## How the AI is kept on a leash

- **Key never reaches the browser.** The browser calls `/api/ai` on this server; the server adds the key.
- **Server-side guardrails.** A fixed system prompt forbids invented prices, durations, downtime, SAP note numbers and approval claims, and tells the model to treat data as data. The browser cannot change it.
- **Rules first.** Deterministic rules produce every disposition and target. The AI only reviews or drafts, and its output is labelled "AI proposal" until a person accepts it.
- **Hard limits in code.** Objects without usage evidence are forced to manual review, business-critical objects cannot be auto-retired, a report without usage cannot take an AI target, and a baselined plan only changes through change requests.
- **Abuse limits.** Prompts are size-capped, requests are rate-limited per client and output tokens are capped.

## Run it locally

Requires Node 20 or later (22 recommended, see `.nvmrc`).

```bash
npm ci
cp .env.example .env        # optional: add ANTHROPIC_API_KEY to turn on AI features
npm run dev                 # API on :8080, UI on http://localhost:5173 with /api proxied
```

Without an API key everything works except the AI buttons and chat, which explain that AI is not configured.

Run the tests:

```bash
npm test
```

## Build and run for production

```bash
npm ci
npm run build                          # outputs dist/
NODE_ENV=production node server/index.js   # serves dist/ and /api on PORT (default 8080)
```

On Windows PowerShell, set `$env:NODE_ENV="production"` before `node server/index.js`.

## Deploy with Docker

```bash
cp .env.example .env    # set ANTHROPIC_API_KEY, and APP_USER/APP_PASSWORD if not behind SSO
docker compose up -d --build
# open http://localhost:8080
```

The image runs as the non-root `node` user, keeps state in the `/data` volume and includes a health check on `/api/health`.

## Deploy to Kubernetes

```bash
docker build -t REGISTRY/sap-transformation-studio:0.1.0 .
docker push REGISTRY/sap-transformation-studio:0.1.0
kubectl create secret generic studio-secrets --from-literal=ANTHROPIC_API_KEY=YOUR_KEY
# edit the image name in deploy/kubernetes.yaml, then
kubectl apply -f deploy/kubernetes.yaml
```

Add an Ingress with TLS and your organisation's SSO (for example oauth2-proxy or your cloud's identity-aware proxy) in front of the Service. The manifest runs one replica because state is a file on one volume.

The same container runs on any container platform, such as Azure Container Apps or App Service, AWS ECS or App Runner, or Google Cloud Run. Mount persistent storage at `/data`, set the environment variables below and point the platform's health check at `/api/health`.

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `8080` | HTTP port |
| `DATA_DIR` | `./data` | Where project state is written. Use a persistent volume |
| `ANTHROPIC_API_KEY` | empty | Turns on AI features. Store it in a secret manager |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Model for analysis and chat. Check current model IDs at https://docs.claude.com |
| `ANTHROPIC_MODEL_QUICK` | `claude-haiku-5-5` | Model for quick tasks such as column mapping |
| `ANTHROPIC_BASE_URL` | empty | Send AI traffic through an approved gateway |
| `AI_MAX_TOKENS` | `1500` | Output cap per request (hard ceiling 4096) |
| `AI_RATE_LIMIT_PER_MIN` | `20` | AI requests per client per minute |
| `AI_MAX_PROMPT_CHARS` | `200000` | Largest prompt accepted |
| `APP_USER`, `APP_PASSWORD` | empty | Enables HTTP basic auth when both are set |
| `TRUST_PROXY` | empty | Set to `1` behind one load balancer so rate limits use the real client IP |

## Security notes

- Content Security Policy allows only same-origin scripts, styles, fonts and API calls. Fonts are bundled, so there are no third-party requests.
- HSTS is sent in production; terminate TLS at your load balancer or ingress.
- Basic auth is a stop-gap. For real use, put the app behind SSO and map roles from your identity provider (the role switcher in the header is a demo control, not authorisation).
- What goes to the AI service: the question, the current screen and a JSON project summary (counts, IDs, titles and statuses). Review this against your data-handling policy before loading real customer data.
- `npm audit --omit=dev` reports no known vulnerabilities in runtime dependencies as of this release. Remaining advisories are in the Vite dev server only; do not expose `npm run dev` to a network.

## Known limits of this release

- **Single-instance storage.** State is one JSON file per project with atomic writes. Before running more than one replica or many concurrent users, move it to PostgreSQL. `server/index.js` (state routes) and `src/lib/store.jsx` are the only places to change.
- **Single project, no tenancy.** The UI uses project `default`. The API already accepts other project IDs.
- **Synthetic data only.** CSV usage import works today. Parsers for Readiness Check, ATC and interface exports are the next step.
- **Phase 2 modules.** Custom code remediation, add-on compatibility, interfaces, data migration, security, licensing, business case, control tower and administration appear in the sidebar as disabled items.
- **JavaScript, not TypeScript.** The code is plain modern JavaScript. Adding TypeScript is a mechanical step if your standards require it.

## Project structure

```
server/index.js          Express server: static hosting, /api/ai, /api/state, auth, headers
src/main.jsx             Entry point, fonts, error boundary
src/App.jsx              Shell: header, next-best-action bar, journey sidebar, copilot rail
src/lib/engine.js        Pure logic: derived metrics, guidance, strategy scoring, plan model
src/lib/store.jsx        State store and persistence (server with browser fallback)
src/lib/ai.js            AI client: streaming, JSON parsing, error mapping
src/data/model.js        Synthetic data generators and rule engines
src/components/          Shared UI, chat, error boundary
src/screens/             One file per screen
tests/engine.test.js     Rule and engine tests (node:test)
deploy/kubernetes.yaml   PVC, Deployment and Service
```

## Adding a screen

1. Create `src/screens/MyScreen.jsx` exporting a component that reads `useStore()`.
2. Register it in `SCREENS` and `NAV` in `src/App.jsx`.
3. If it needs guidance, add a rule to `nextActions` in `src/lib/engine.js` and a test for it.

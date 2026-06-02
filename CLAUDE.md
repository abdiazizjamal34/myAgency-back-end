# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Development (file-watching)
npm run dev

# Production
npm start

# Seed data (run once on new environments, in this order)
npm run seed:superadmin        # Creates the SUPER_ADMIN user
npm run seed:plans             # Creates billing plans
npm run seed:tickettemplates   # Initializes ticket templates
npm run assign:defaultplan     # Assigns the default plan to agencies without one

# Syntax check (used by CI)
node --check src/server.js
node --check src/**/*.js
```

No test framework is configured.

## Architecture

**Node.js + Express backend** using ES modules (`"type": "module"`). Entry point: `src/server.js`. Default port: `4000`.

### Module layout

| Directory | Purpose |
|---|---|
| `src/controllers/` | Route handlers — thin, delegate business logic to services |
| `src/services/` | Business logic, external API calls (AI, Twilio, airline normalizers) |
| `src/models/` | Mongoose schemas — 16 collections |
| `src/routes/` | Express routers, one file per domain, `requireRole` middleware applied here |
| `src/middleware/` | JWT auth, RBAC enforcement, billing guard, file upload (Multer) |
| `src/jobs/` | Cron jobs (billing invoice generation) |
| `src/utils/` | DB connection, mailer, error handler, WhatsApp, constants |

### Request lifecycle

```
Request
  → Helmet + CORS + JSON parser + Morgan
  → auth.js (JWT Bearer validation, attaches req.user)
  → billingGuard.js (enforces read-only mode if invoice unpaid on day 17+)
  → Route handler → Controller → Service
  → errorHandler (centralized catch-all)
```

Public routes (`/api/auth/*`) are registered **before** the auth middleware.

### Multi-tenancy and RBAC

Roles (from `src/utils/constants.js`): `SUPER_ADMIN`, `AGENCY_ADMIN`, `PARTNER`, `ACCOUNTANT`.

- JWT payload carries `{ id, role, agency }`.
- All non-SUPER_ADMIN queries are automatically scoped to `req.user.agency` via `scopeQueryToAgency()` in `src/middleware/roles.js`.
- SUPER_ADMIN can pass `?agencyId=` to query across tenants.
- `requireRole(...roles)` middleware in route files enforces access.
- `sameAgencyOrSuper` middleware in `roles.js` blocks cross-agency parameter access.

### Ticket processing pipeline

Tickets flow through these stages (tracked by `processingStatus` on `TicketDocument`):

```
UPLOADED → EXTRACTED → NORMALIZED → NEEDS_REVIEW | READY → RENDERED
```

1. **Upload** (`POST /api/tickets/upload`) — Multer saves file to disk temporarily.
2. **Extract** (`ticketExtraction.service.js`) — `pdf-parse` for PDFs, `tesseract.js` (OCR) for images. File is deleted from disk immediately after extraction.
3. **Normalize** (`ticketNormalizationOrchestrator.service.js`) — preprocesses raw text, calls LLM via `ticketNormalizationBot.service.js`, then validates with `ticketNormalizationValidator.service.js`.
4. **Render** (`POST /api/tickets/:id/render`) — Puppeteer generates a PDF from an HTML template via `ticketRenderHtml.service.js` / `ticketRenderPdf.service.js`. Stored under `uploads/rendered/`.

There is also a legacy rule-based path (`ticketNormalizeRouter.service.js`) that routes to airline-specific parsers (Ethiopian, Travelport) without LLM — not used by the main upload flow.

### AI normalization

The LLM provider is selected at runtime via env vars:

| Variable | Notes |
|---|---|
| `NORMALIZATION_PROVIDER` | `gemini` (default) or `openai` |
| `GEMINI_API_KEY` | Required when provider is `gemini` |
| `GEMINI_NORMALIZATION_MODELS` | Comma-separated fallback list (default: `gemini-2.5-flash`) |
| `OPENAI_API_KEY` | Required when provider is `openai` |
| `OPENAI_NORMALIZATION_MODELS` | Comma-separated fallback list (default: `gpt-4.1-mini`) |

The bot retries across model candidates on 429/5xx errors with exponential back-off.

### Billing system

- Usage tracked per agency per month (`Usage` model, keyed by `periodKey = "YYYY-MM"`).
- Cron runs on the 1st of every month at 08:00 (`src/jobs/billing.cron.js`) to generate `Invoice` documents.
- `billingGuard.js` checks for any unpaid invoice; if `isReadOnlyWindow()` returns true (day ≥ 17), write requests are blocked. `POST /api/billing/payment-requests` is exempted so agencies can still submit payments.
- `BillingSettings` per agency overrides plan-level pricing.
- `BILLING_JOBS_ENABLED=true` env var toggles cron activation.
- `POST /api/billing/test-generate` manually triggers invoice generation for the previous month (useful in dev; has duplicate guard).

### Key environment variables

| Variable | Notes |
|---|---|
| `MONGO_URI` | MongoDB SRV connection string |
| `JWT_SECRET` | JWT signing secret |
| `JWT_EXPIRES_IN` | Token expiry (default: `7d`) |
| `PORT` | Server port (default: `4000`) |
| `BILLING_JOBS_ENABLED` | Set `true` to activate cron jobs |
| `TZ` | Timezone for cron scheduling |
| `PUPPETEER_SKIP_DOWNLOAD` | Set `true` in CI to skip Chromium install |

Email (Nodemailer), SMS/WhatsApp (Twilio), and AI provider credentials are also required via env vars.

### Known issues

- `Invoice` schema does not declare a `breakdown` field; attempts to save a breakdown (e.g. in `POST /api/billing/test-generate`) are silently dropped by Mongoose strict mode.
- `src/services/billing.service.js` is entirely commented out; invoice generation logic lives inline in the routes and cron job.

### CI/CD

GitHub Actions (`.github/workflows/ci-cd.yml`):
- **CI:** syntax-checks all `src/**/*.js` files on every push/PR to `main`
- **CD:** SSH into EC2, `git pull`, `npm install --omit=dev`, restart via PM2

Secrets required: `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`, `EC2_APP_DIR`.

## GStack Skills

Use the /browse skill from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.

Available slash commands:
- /office-hours — product decisions, scope review
- /plan-ceo-review — challenge feature scope before building
- /plan-eng-review — lock architecture and schema before coding
- /review — code review after every feature
- /qa — browser-based end-to-end testing
- /cso — security audit (OWASP Top 10, STRIDE) — run before any deploy touching auth or billing
- /ship — release command, only after /review and /qa pass
- /careful — enable before any destructive operation (migrations, drops, force-push)
- /retro — weekly engineering retrospective
- /investigate — deep debugging for complex issues

If gstack skills aren't working, run:
cd .claude/skills/gstack && ./setup

## Critical Rules (Financial System)
- All money stored as integer cents, never floats
- Use MongoDB withTransaction() for any write touching Invoice + Usage + BillingSettings together
- Never put business logic in routes — it belongs in services
- billing.service.js must be uncommented and used before launch

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

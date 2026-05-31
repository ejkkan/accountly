# Accountly

Upload a Swedish PDF invoice → Accountly AI proposes a balanced double-entry journal entry against the BAS kontoplan → an accountant approves or declines it in the UI.

Built for an engineering take-home assignment.

**Live demo:** **[web-ikuzo-ab.vercel.app](https://web-ikuzo-ab.vercel.app)** — sign up with any email + password, then upload `assignment/simple_invoice.pdf`. (Next.js on Vercel; the API is a Cloudflare Worker reached through a same-origin `/api/*` proxy.)

## Stack

| Layer             | What                                                                                                                  | Why                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`        | Next.js 16 (Turbopack) + shadcn/ui + Tailwind 4 + TanStack Query + better-auth-ui                                     | The interviewer said React + TS. Started from the [shadcnstore dashboard + landing template](https://github.com/shadcnstore/shadcn-dashboard-landing-template). |
| `apps/backend`    | Cloudflare Worker + [Hono](https://hono.dev/) + Kysely + node-pg + better-auth + `ai` v6 + `@ai-sdk/anthropic`        | One Worker, one PG pool, fully typed RPC into the web via `hc<AppType>`.                                                                                        |
| DB                | Postgres 16 — Docker locally, Neon for the deployed demo                                                              | Plain `pg` over TCP. Local dev is self-contained in Docker; the prod URLs live in Cloudflare Worker secrets, not in this repo.                                   |
| Files             | Cloudflare R2 (simulated locally by Miniflare)                                                                        | Cheap, S3-shaped object storage co-located with the Worker.                                                                                                     |
| LLM               | Claude Sonnet 4.6 via `@ai-sdk/anthropic`                                                                             | Reads the PDF directly as a `file` content block — no pdf-parse step.                                                                                           |
| Types DB→frontend | `kysely-codegen` → `apps/backend/src/db.types.ts` → `Kysely<DB>` → Hono `AppType` → `hc<AppType>` → react-query hooks | Schema change ⇒ run codegen ⇒ every call site re-types itself.                                                                                                  |

## Run it

### Prerequisites

- **Node 20+** and **pnpm 9** (the repo pins `pnpm@9.12.3`; `corepack enable` will pick it up).
- **Docker** — local Postgres runs in a container.
- An **Anthropic API key** for the parse step.

### Setup

```bash
pnpm install
cp apps/backend/.dev.vars.example apps/backend/.dev.vars
```

`.dev.vars.example` points at the Dockerised Postgres on `127.0.0.1:5433`. Two values to fill in:

```bash
BETTER_AUTH_SECRET=...     # openssl rand -hex 32
ANTHROPIC_API_KEY=sk-ant-...
```

### Start it

```bash
pnpm dev
```

Boots Postgres in Docker (`--wait` until healthy), applies migrations, regenerates `db.types.ts`, then runs the backend on `:8787` and the web app on `:5001` in parallel. On the next boot just rerun it — the named volume keeps your data. `pnpm db:down` stops the container.

### Try it

Open http://localhost:5001, sign up, you'll land on `/bills`. Click **Upload PDF**, drop `assignment/simple_invoice.pdf`, wait ~10s — the journal entry proposal renders with balanced postings and the LLM's reasoning paragraph.

> The deployed demo runs against Neon; those URLs live in Cloudflare Worker secrets, not in this repo. You don't need them to run locally.

## Project layout

```
apps/
├── web/                            Next.js — landing on /, app shell on /bills
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            Landing
│   │   │   ├── auth/[pathname]     better-auth-ui catch-all
│   │   │   └── (app)/              Session-gated by proxy.ts
│   │   │       ├── bills/          List + new + detail
│   │   │       └── suppliers/      Directory + per-supplier invoices
│   │   ├── components/             Template's sidebar/header reused
│   │   ├── hooks/                  react-query wrappers over the typed RPC client
│   │   ├── lib/
│   │   │   ├── client.ts           hc<AppType>(...) — the only RPC entry point
│   │   │   ├── auth-client.ts      better-auth React client
│   │   │   └── money.ts            BigInt-safe minor-unit formatter
│   │   └── proxy.ts                Edge session gate for /bills/*
│   └── next.config.ts              /api/* → :8787 same-origin proxy
└── backend/
    ├── src/
    │   ├── index.ts                Hono `app` + AppType + Env
    │   ├── auth.ts                 better-auth + organization plugin
    │   ├── db.ts                   pg Pool + Kysely + DATE OID parser
    │   ├── middleware/auth.ts      Session → c.set("userId" | "organizationId" | "db")
    │   ├── routes/
    │   │   ├── bills.ts            upload / list / detail / file / approve / decline / reparse / delete
    │   │   └── suppliers.ts        supplier directory + one vendor's bills
    │   └── lib/
    │       ├── coa.ts              BAS kontoplan as const
    │       ├── journal-schema.ts   Zod discriminated-union schema + inferred types
    │       ├── validate-proposal.ts  accounting rules: balance / XOR / known accounts
    │       ├── suppliers.ts        find-or-create supplier (org.nr → VAT → name)
    │       ├── bill-states.ts      pending → approved/declined state machine
    │       └── parse-bill.ts       generateText + Output.object({ schema }) over the PDF
    ├── migrations/
    │   ├── 0001_auth.ts            better-auth schema (hand-translated)
    │   ├── 0002_bills.ts           bill / lineItem / journalEntry / posting
    │   └── 0003_suppliers.ts       supplier entity + bill.supplierId
    ├── evals/                      scenario regression suite — fixtures.ts + scenarios.ts
    └── scripts/
        ├── migrate.ts              Kysely Migrator runner
        ├── parse-pdf.ts            inspect the agent on one PDF
        └── codegen.ts              kysely-codegen wrapper (--date-parser string)
```

## What the LLM does

`POST /api/bills` reads the PDF bytes once, puts them in R2, then calls the LLM via `generateText` with an `Output.object({ schema })` — passing the PDF as a `file` content block and a system prompt embedding the BAS chart of accounts. The prompt structure (XML-tagged sections, two few-shot examples, normal-register instructions) follows [Anthropic's prompting best practices for Claude 4.6](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) — the rationale lives in a comment above `SYSTEM_PROMPT` in [`parse-bill.ts`](apps/backend/src/lib/parse-bill.ts).

**Two layers — the model proposes, code validates:**

1. **Forced structured output** — `generateText` with `Output.object` turns the Zod schema into a JSON Schema, hands it to Anthropic as a forced tool, and validates the response back against the schema. Claude is _required_ to return data matching the shape, and a malformed reply throws rather than flowing through untyped. The result is a typed discriminated union.
2. **`validateProposal` (`lib/validate-proposal.ts`)** — the accounting rules, in plain code, independent of the prompt and unit-tested. It's the hard gate before persisting:
   - total debits === total credits (in integer öre, so the sum is exact)
   - every posting moves money exactly one direction (debit XOR credit)
   - every `accountCode` is one of the 20 BAS codes

   Keeping the rules out of the schema gives a single, testable source of truth for "is this entry valid," with specific errors; an invalid proposal is rejected with a 422 and never stored.

**Determinism.** `temperature: 0` (greedy decoding) so the same PDF produces the same proposal — same account mappings, same reasoning. Anthropic doesn't expose `seed`, so true bit-exact repeatability is off the table, but in practice the model behaves like a function of the document. For an accounting tool that's the right contract — and it's what makes the regression evals (below) reliable.

**Discriminated rejection.** The output union has a second case — `{ kind: "not_an_invoice", detail }` — so when the PDF is a receipt, a brochure, or an unreadable scan, the model says so instead of hallucinating an entry. The route returns a 422 carrying that one-sentence `detail`, which the UI surfaces. (Foreign-currency invoices are _not_ auto-rejected: the assignment centers the accountant's approve/decline decision, so a non-SEK invoice produces a proposal the accountant can decline rather than being refused for them.)

Bill + line items + journal entry + postings are persisted in a single Kysely transaction.

## Suppliers

The agent extracts the vendor's name + org.nr + VAT from the PDF; deterministic code (`lib/suppliers.ts`) resolves that to a canonical, org-scoped `supplier` row — **find-or-create**, matching on **org.nr → VAT → case-insensitive name**, enriching only the identifiers a supplier is missing (never overwriting a known one). The bill stores just `supplierId`; name / org.nr / VAT load from the entity, so there's a single source of truth for who the vendor is.

Two invoices from the same vendor therefore link to one supplier — surfaced on the **Suppliers** page (each unique vendor + its invoice count) and on the bill detail ("N other bills from this supplier"). It's the same split as the journal entry: the **model perceives** (fuzzy PDF reading), **code decides identity** (deterministic, unit-tested matching) — the LLM never decides whether two bills are the same vendor.

## Testing

An LLM feature has two things that can break — the code around the model, and the model's output — so there are two layers:

1. **Deterministic unit tests** — `pnpm --filter @accountly/backend test`. Cover `validateProposal` (balance, debit/credit XOR, unknown account, too-few-postings) with canned proposals. No network, no API key, instant — this is what guards the booking rules.

2. **Scenario regression evals** — `pnpm --filter @accountly/backend test:evals`. A golden corpus (`evals/scenarios.ts`) that runs the **real model** through `parseBill` and asserts stable accounting properties on the output:

   | Scenario                                | Asserts                                 |
   | --------------------------------------- | --------------------------------------- |
   | `happy-standard` (the provided invoice) | proposes a balanced entry; credits 2440 |
   | `vat-exempt` (0% invoice)               | no 2640 posting                         |
   | `credit-note` (kreditfaktura)           | flipped — debits 2440                   |
   | `account-mapping` (rent)                | maps to 5010; VAT to 2640               |
   | `reject-non-invoice` (meeting notes)    | returns `not_an_invoice`                |

   Fixtures are generated from declarative data with `pdf-lib` (`evals/fixtures.ts`) — reviewable in the repo, with known expected values, so the assertions are exact and temperature-0 runs are stable rather than flaky. Opt-in (reads `ANTHROPIC_API_KEY` from `.dev.vars`) so the unit run stays free.

   **Growing the corpus is the point:** add a fixture + a scenario row → re-run → if a prompt change regresses an existing case it fails. That's how you'd add support for a new invoice format without quietly breaking the others.

To **inspect** the agent on an arbitrary PDF while iterating: `pnpm --filter @accountly/backend parse path/to/invoice.pdf` prints the extraction, the proposed postings, the balance/validation result, and the model's reasoning.

## Scripts

| Command                                        | What                                      |
| ---------------------------------------------- | ----------------------------------------- |
| `pnpm dev`                                     | Docker PG up → migrate → codegen → Worker :8787 + Next :5001 |
| `pnpm db:up` / `pnpm db:down`                  | Start / stop the local Postgres container |
| `pnpm typecheck`                               | Both apps                                 |
| `pnpm --filter @accountly/backend test`        | Deterministic unit tests (no API)         |
| `pnpm --filter @accountly/backend test:evals`  | Scenario regression evals (real model)    |
| `pnpm --filter @accountly/backend parse <pdf>` | Inspect the agent on one PDF              |
| `pnpm format` / `pnpm format:check`            | Prettier write / verify                   |
| `pnpm check`                                   | `typecheck && format:check`               |
| `pnpm --filter @accountly/backend db:migrate`  | Apply all migrations (uses `DATABASE_URL_DIRECT`) |
| `pnpm --filter @accountly/backend db:rollback` | Walk one migration down                   |
| `pnpm --filter @accountly/backend db:reset`    | Down → up (dev only)                      |
| `pnpm --filter @accountly/backend db:codegen`  | Introspect the DB → write `src/db.types.ts` |

## Architecture notes worth a tour

1. **`hc<AppType>` end-to-end typing.** Routes are written as one chained `new Hono().get().post().route(...)` expression so `typeof app` carries the full route tree. The web's `lib/client.ts` is the only place the typed client is constructed; every UI hook reads through it.
2. **Session gating in `proxy.ts`, not in the layout.** Async server layouts in Next 16 + Turbopack start streaming before the layout's `await` resolves, which makes `redirect()` leak into the body instead of issuing a clean 307. The proxy runs before any rendering.
3. **DB DATE as `string`, end-to-end.** `pg.types.setTypeParser(1082, v => v)` plus `kysely-codegen --date-parser string` keeps calendar dates as `YYYY-MM-DD` strings everywhere — no tz drift between Stockholm CET and UTC.
4. **Money is integer minor units (öre).** Stored as `bigint` in PG, formatted via `BigInt(...)` arithmetic on the web. No floats anywhere in the money path.
5. **Auto-create personal org on signup.** better-auth's `user.create.after` hook makes a personal organization + owner member row so every Bill has a workspace to scope to without an org-switcher UI.
6. **One bill state machine, three layers consuming it.** `apps/backend/src/lib/bill-states.ts` is the single source of truth for what a user can do at each state (`pending` / `approved` / `declined`). The backend uses `assertCan(state, action, reason)` on every mutation (throws `Conflict("status_locked")` if the rule says no). `GET /api/bills/:id` surfaces `permissions: { canReparse, canDelete, canDecide }` derived from the same const. The UI shows/hides buttons based on `data.permissions.*` — never re-implements the rules. Adding a 4th state edits one table; layers 1 + 2 + 3 just check the new column.

## What's not built (intentional)

- **Reverse-entry workflow on approved bills.** Real Swedish accounting (Bokföringslagen) doesn't let you delete a booked journal entry — you book a sign-flipped twin that nets to zero, both stay in the ledger forever. The state machine in `lib/bill-states.ts` already has the slot for it (a `reversed` state + a `canReverse` action would slot in cleanly), and the data model just needs `reversedAt` / `reversedByEntryId` / `reversalOfEntryId` columns. Roughly an hour of work; deliberately left as the obvious live-interview feature ask.
- **DB triggers as defense-in-depth.** Today the state machine is enforced at the application layer (UI hint + backend guard). A `BEFORE DELETE` trigger on `bill` and `BEFORE UPDATE` trigger that refused transitions out of `approved` would be the textbook floor — even a future direct-DB-access script or a migration bug couldn't bypass it. Skipped because for the assignment size the application guard is sufficient and migrations of triggers add real maintenance surface.
- **Inline posting editing.** Assignment text only asks for approve/decline. Editing is an obvious live-interview extension hook.
- **Org switcher.** Auto-created personal org is invisible in the UI.
- **Email verification / 2FA / OAuth.** Email + password only.
- **Duplicate detection.** Suppliers _are_ deduplicated (see [Suppliers](#suppliers) — org.nr → VAT → name), but invoices aren't: a real AP tool also dedups on invoice _identity_ — `(supplier, invoice number)` — to catch the same bill re-uploaded as a different file (a naive file-hash would catch the wrong thing). The supplier entity it'd build on now exists; the invoice-level check is the remaining piece, left out as beyond the assignment.
- **General ledger / AP subledger reporting.** We model the supplier directory and the per-invoice journal entry, but not the aggregating layer above them — account balances, a trial balance, supplier-level payables totals. That (and the multi-currency conversion it would force) is a whole feature area the assignment doesn't ask for.
- **Wrangler v4.** Stayed on v3 to avoid an unrelated config churn mid-build.

## What I'd do with more time

### Upload UX: real per-phase progress, reload-safe background parse

**Today.** `POST /api/bills` is one synchronous request: accept multipart → R2 put → LLM parse (~10–15s) → DB transaction → 201 response. The web shows a card-sized loading state during the wait but it can't show _real_ per-phase progress, and a page reload mid-parse loses both the request and the in-flight UI (the worker may or may not finish writing the bill to DB depending on timing). For the take-home this is fine — the assignment grades the end-to-end flow, not durability of the in-flight upload.

**Production path I'd take.** Split the single request into a fast path plus a background job, and front the job with a Durable Object so the UI can subscribe to live status:

1. `POST /api/bills` — validate, put PDF in R2, `INSERT bill` with `status='parsing'`, return `{ billId }` in ~500ms. Frontend redirects to `/bills/[id]` immediately.
2. Spawn the parse via `env.PARSE_JOB.idFromName(billId).get()` (a Durable Object keyed by bill) and `ctx.waitUntil(...)` so the worker keeps running after the response is sent.
3. The DO holds parse state in SQLite (survives hibernation), runs the LLM call, broadcasts phase events (`stored` → `parsing` → `parsed` → `done`/`error`) to any connected hibernatable WebSocket, then writes the final result to Postgres.
4. `/bills/[id]` reads `status` from Postgres on initial mount, then opens a WebSocket to the DO for live updates. On (re)connect the DO sends a state snapshot first so the page picks up wherever the parse currently is.
5. Errors get specific recovery actions in the UI — transient (Claude rate-limit, worker timeout) → "Re-parse" button; LLM-rejected document → "Replace PDF" or "Delete bill"; stuck > 90s → soft warning + "Re-parse".

**Why this is genuinely better, not just shinier.** A page refresh mid-upload still works. The user can navigate away and come back. The parse outcome is durably tied to the bill row, not to the client connection. The interview talking-point — "how would you handle a 30-second parse?" — has a real answer to point at.

**Why I skipped it for the take-home.** Roughly 3 hours of work (DO migration, WS auth bridging better-auth's session cookie through the upgrade, hibernation lifecycle, reconnect/backoff client-side, error UX for each failure class). The synchronous version meets the assignment's product requirements and I'd rather preserve scope headroom for the live-interview feature add. The current code is also low-risk to ship — adding DO + WS this close to submission risks merging a partial refactor.

**Smaller follow-ups I'd also do.**

- **Inline posting editing** on `/bills/[id]` — assignment only asks for approve/decline; editing is the obvious next step and the JournalEntryCard would gain a per-row edit mode.
- **Org switcher** — auto-created personal org is invisible today; a real product needs the switcher in the sidebar.
- **Retry-with-context on Re-parse** — pass the previous attempt's failure reason back to the LLM so it doesn't make the same mistake twice.
- **Route-level integration tests** — stub the model and assert `POST /bills` persists the bill + postings (and that a `not_an_invoice` 422s). The unit tests cover the validator and the evals cover the model's output; route tests would round out the middle.
- **Invoice-identity dedup** — `(supplier, invoice number)` matching to flag a re-submitted invoice (see "what's not built").

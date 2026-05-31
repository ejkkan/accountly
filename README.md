# Accountly

Upload a Swedish PDF invoice → Accountly AI proposes a balanced double-entry journal entry against the BAS kontoplan → an accountant approves or declines it in the UI.

Built for an engineering take-home assignment.

## Stack

| Layer             | What                                                                                                                  | Why                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`        | Next.js 16 (Turbopack) + shadcn/ui + Tailwind 4 + TanStack Query + better-auth-ui                                     | The interviewer said React + TS. Started from the [shadcnstore dashboard + landing template](https://github.com/shadcnstore/shadcn-dashboard-landing-template). |
| `apps/backend`    | Cloudflare Worker + [Hono](https://hono.dev/) + Kysely + node-pg + better-auth + `ai` v6 + `@ai-sdk/anthropic`        | One Worker, one PG pool, fully typed RPC into the web via `hc<AppType>`.                                                                                        |
| DB                | Neon Postgres (pooled at runtime, direct for DDL)                                                                     | Serverless PG; migrations and codegen need the non-pooled endpoint.                                                                                             |
| Files             | Cloudflare R2 (simulated locally by Miniflare)                                                                        | Cheap, S3-shaped object storage co-located with the Worker.                                                                                                     |
| LLM               | Claude Sonnet 4.6 via `@ai-sdk/anthropic`                                                                             | Reads the PDF directly as a `file` content block — no pdf-parse step.                                                                                           |
| Types DB→frontend | `kysely-codegen` → `apps/backend/src/db.types.ts` → `Kysely<DB>` → Hono `AppType` → `hc<AppType>` → react-query hooks | Schema change ⇒ run codegen ⇒ every call site re-types itself.                                                                                                  |

## Run it

```bash
pnpm install

cp apps/backend/.dev.vars.example apps/backend/.dev.vars
#   fill in:
#     DATABASE_URL          (Neon pooled)
#     DATABASE_URL_DIRECT   (Neon non-pooled — same string minus `-pooler`)
#     BETTER_AUTH_SECRET    (`openssl rand -hex 32`)
#     ANTHROPIC_API_KEY     (sk-ant-…)

pnpm --filter @accountly/backend db:migrate   # creates auth + bill tables
pnpm --filter @accountly/backend db:codegen   # writes apps/backend/src/db.types.ts

pnpm dev                                       # backend :8787, web :5001
```

Open http://localhost:5001, sign up, you'll land on `/bills`. Click **Upload PDF**, drop `assignment/simple_invoice.pdf`, wait ~10s — the journal entry proposal renders with balanced postings and the LLM's reasoning paragraph.

## Project layout

```
apps/
├── web/                            Next.js — landing on /, app shell on /bills
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            Landing
│   │   │   ├── auth/[pathname]     better-auth-ui catch-all
│   │   │   └── (app)/              Session-gated by proxy.ts
│   │   │       └── bills/          List + new + detail
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
    │   ├── routes/bills.ts         POST/GET/GET:id/GET:id/file
    │   └── lib/
    │       ├── coa.ts              BAS kontoplan as const
    │       ├── journal-schema.ts   Zod schema + balance refinement
    │       └── parse-bill.ts       generateObject({ model, schema, messages: [...PDF] })
    ├── migrations/
    │   ├── 0001_auth.ts            better-auth schema (hand-translated)
    │   └── 0002_bills.ts           bill / lineItem / journalEntry / posting
    └── scripts/
        ├── migrate.ts              Kysely Migrator runner
        └── codegen.ts              kysely-codegen wrapper (--date-parser string)
```

## What the LLM does

`POST /api/bills` reads the PDF bytes once, puts them in R2, then calls the LLM via `generateObject` with the PDF as a `file` content block and a system prompt embedding the BAS chart of accounts.

**Structured output, two layers:**

1. **Forced tool call** — `generateObject` translates the Zod schema → JSON Schema → Anthropic tool definition with `tool_choice` set to that tool. Claude is _required_ to return output matching the schema; the API rejects invalid tool inputs. No "model returned almost-valid JSON" failure mode.
2. **Zod refinements** validate once more on the way out:
   - every posting moves money exactly one direction (debit XOR credit)
   - total debits === total credits
   - every `accountCode` is one of the 20 BAS codes

**Determinism.** `temperature: 0` (greedy decoding) so the same PDF produces the same proposal — same account mappings, same reasoning prose. Anthropic doesn't expose `seed`, so true bit-exact repeatability is off the table, but for practical purposes the model now behaves like a function of the document. For an accounting tool this is the right contract — the accountant trusts the output is a deterministic projection of the source, not "what mood the model is in."

**Discriminated rejection.** Output is a Zod discriminated union — Claude can return `{ kind: "not_an_invoice", reason, detail }` instead of hallucinating an extraction when the PDF is a receipt, a contract, an unreadable scan, or in the wrong currency. The route handler translates that to a 422 `parse_<reason>` AppError carrying Claude's own one-sentence explanation, which the frontend toasts verbatim.

Bill + line items + journal entry + postings are persisted in a single Kysely transaction.

## Scripts

| Command                                        | What                                      |
| ---------------------------------------------- | ----------------------------------------- |
| `pnpm dev`                                     | Worker :8787 + Next :5001                 |
| `pnpm typecheck`                               | Both apps                                 |
| `pnpm format` / `pnpm format:check`            | Prettier write / verify                   |
| `pnpm check`                                   | `typecheck && format:check`               |
| `pnpm --filter @accountly/backend db:migrate`  | Apply all migrations to Neon (direct URL) |
| `pnpm --filter @accountly/backend db:rollback` | Walk one migration down                   |
| `pnpm --filter @accountly/backend db:reset`    | Down → up (dev only)                      |
| `pnpm --filter @accountly/backend db:codegen`  | Introspect Neon → write `src/db.types.ts` |

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
- **Tests.** Not required; structure is small enough that an interviewer can read the routes top-to-bottom.
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
- **Tests** — small enough surface that a few integration tests on `POST /bills` + `journal-schema` Zod refinements would cover the load-bearing logic without exploding the codebase.

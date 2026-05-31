# Accountly

Upload a Swedish PDF invoice → Claude proposes a balanced double-entry journal entry against the BAS kontoplan → an accountant approves or declines it in the UI.

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

`POST /api/bills` reads the PDF bytes once, puts them in R2, then calls Claude via `generateObject` with the PDF as a `file` content block and a system prompt embedding the BAS chart of accounts. Zod refinements enforce:

- every posting moves money exactly one direction (debit XOR credit)
- total debits === total credits
- every `accountCode` is one of the 20 BAS codes

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

## What's not built (intentional)

- **Inline posting editing.** Assignment text only asks for approve/decline. Editing is an obvious live-interview extension hook.
- **Org switcher.** Auto-created personal org is invisible in the UI.
- **Email verification / 2FA / OAuth.** Email + password only.
- **Tests.** Not required; structure is small enough that an interviewer can read the routes top-to-bottom.
- **Wrangler v4.** Stayed on v3 to avoid an unrelated config churn mid-build.

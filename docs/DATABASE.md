# Database — safe change workflow (2026-08)

## Two env files, two different databases (common trap)

- `.env.local` — read by **Next.js** (`npm run dev`, `npm run build`). This is where your
  **real, working** `DATABASE_URL` (Supabase pooler) lives.
- `.env` — read by the **Prisma CLI** (`npx prisma ...`) and the worker. If this file still
  has the old local-Docker placeholder (`localhost:5433`), every `npx prisma` command will
  fail with `P1001: Can't reach database server`, even though the app itself works fine.

**Fix once:** copy the real `DATABASE_URL` from `.env.local` into `.env` so both files agree.
Until you do that, every command below needs the one-off override shown.

## Never run a blind `prisma db push` on this project

`prisma db push` diffs the **entire** live schema against `packages/db/prisma/schema.prisma` and offers
to **drop any table it doesn't recognize** — including a leftover `users` table from the
quarantined legacy app (`legacy/emergent/`), which still has at least one row. If that
prompt appears, answer **no** and do not re-run with `--accept-data-loss`.

## Use targeted SQL instead

For small additive changes (new enum value, new column with a default, new index), write the
SQL to a file with a **here-string** first — this sidesteps quoting entirely — then run the
script **directly** (not through `npm run ... --`, which invokes cmd.exe on Windows and mangles
single quotes):

```powershell
@'
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'NEW_VALUE';
'@ | Out-File -Encoding ascii change.sql

.\scripts\db-execute.ps1 -File .\change.sql
Remove-Item change.sql
```

Do **not** use `npm run db:exec -- -Sql '...'` — npm's Windows script runner strips/garbles the
quotes before PowerShell ever sees them, producing confusing parser errors that look like
they're inside `db-execute.ps1` itself. If you must pass SQL inline, call the script directly:

```powershell
.\scripts\db-execute.ps1 -Sql 'ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS ''NEW_VALUE'';'
```

`scripts/db-execute.ps1`:
- Reads `DATABASE_URL` from `.env.local` for this one command (works even if `.env` is stale)
- Writes SQL with ASCII encoding to avoid the UTF-8 BOM that `Out-File -Encoding utf8` adds
  (a BOM before `ALTER`/`CREATE` causes `syntax error at or near "ALTER"` in Postgres)
- Calls `prisma db execute`, which runs **only that statement** — no schema diff, no
  drop-table prompt

## When `db push` is actually fine

If you've added a brand-new table with no naming collision, `db push` is safe as long as you
read the plan output carefully and only accept drops you recognize. When in doubt, use
`db:exec` for the specific `CREATE TABLE` / `ALTER TABLE` instead.

## Inspecting the legacy `users` table

Curious what's in it before deciding whether to keep, migrate, or eventually drop it:

```powershell
@'
SELECT * FROM users LIMIT 20;
'@ | Out-File -Encoding ascii check-users.sql

.\scripts\db-execute.ps1 -File .\check-users.sql
Remove-Item check-users.sql
```

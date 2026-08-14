# Supabase setup — Content Studio

**Hobby egress:** local `npm run dev` + worker’ı session pooler’a bağlamak kotayı yer. Günlük iş için Docker `localhost:5434` — [LOCAL_AND_PROD.md](./LOCAL_AND_PROD.md).

Second Supabase project for **Content Studio** (`C:\Users\mb\content-studio`), separate from LearnCon (`byghnzxatojxsmrgfcmq`).

## Current project (2026-07-21)

| Field | Value |
|--------|--------|
| Name | `egitim-content-studio` |
| Project ref | `miihrqlqclyyvmkgkokc` |
| Region | `eu-central-1` |
| Org | `cafffe2` (`oymuzgekwqeesbqpxlzw`) |
| Dashboard | https://supabase.com/dashboard/project/miihrqlqclyyvmkgkokc |

Database password is **not** stored in git. It lives in local `.env` / `.env.local` only (set during CLI/API setup). Rotate via dashboard or Management API if needed.

## CLI on Windows

`supabase` is not on PATH; use npx:

```powershell
npx supabase --version
npx supabase projects list
npx supabase orgs list
```

Authentication uses a token in **Windows Credential Manager** (`Supabase CLI:supabase`), usually from:

```powershell
npx supabase login
```

Or non-interactive:

```powershell
npx supabase login --token sbp_xxxx --no-browser
```

## Create project (CLI)

```powershell
npx supabase orgs list
# pick --org-id

$dbPass = -join ((48..57 + 65..90 + 97..122 | Get-Random -Count 24 | ForEach-Object {[char]$_}))
npx supabase projects create egitim-content-studio `
  --org-id oymuzgekwqeesbqpxlzw `
  --region eu-central-1 `
  --db-password $dbPass `
  --output json
# Save $dbPass securely; CLI does not print it again.
```

## API keys (CLI)

```powershell
npx supabase projects api-keys --project-ref miihrqlqclyyvmkgkokc --output json
```

Content Studio uses **Prisma + Postgres only** (no Supabase Auth in app). Keys are optional unless you add Supabase features later.

## Database URL for Prisma

**Session pooler (recommended from this network):** IPv4 ELB, port 5432.

```text
postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require
```

**Direct host** (dashboard “Direct connection”):

```text
postgresql://postgres:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres?sslmode=require
```

On some Windows networks, `db.*.supabase.co` resolves to IPv6-only and Prisma fails with `P1001`. Use the session pooler URL above or enable IPv6.

### Reset DB password (Management API)

If you lose the password after create:

```powershell
# Requires Supabase personal access token (sbp_...) — same as CLI login token
$headers = @{ Authorization = "Bearer $env:SUPABASE_ACCESS_TOKEN"; "Content-Type" = "application/json" }
$body = '{"password":"YOUR_NEW_STRONG_PASSWORD"}'
Invoke-RestMethod -Method PATCH `
  -Uri "https://api.supabase.com/v1/projects/miihrqlqclyyvmkgkokc/database/password" `
  -Headers $headers -Body $body
```

## App env

In `.env` and `.env.local`:

```env
DATABASE_URL="postgresql://postgres.miihrqlqclyyvmkgkokc:...@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require"
REDIS_URL=""
```

Local Docker Postgres (`localhost:5433`) is replaced when pointing at Supabase.

## Migrations

```powershell
cd C:\Users\mb\content-studio
npx prisma migrate deploy
```

Success (2026-07-21): applied `20260720190000_init`.

## Dashboard-only fallback

If CLI is not logged in:

1. https://supabase.com/dashboard → New project → org **cafffe2**, name **egitim-content-studio**, region **Frankfurt (eu-central-1)**.
2. **Project Settings → Database** → copy **Session pooler** URI (mode Session, port 5432).
3. Paste into `DATABASE_URL`, set `REDIS_URL=""`.
4. Run `npx prisma migrate deploy`.

## LearnCon reference

- LearnCon project ref: `byghnzxatojxsmrgfcmq` (ap-northeast-1).
- `C:\Users\mb\learncon\.env` / `.env.local`: `DATABASE_URL` **not set**; `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are set.
- GitHub `metinbagdat/learncon` secrets include `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_SERVICE_ROLE_KEY` (values not in repo).

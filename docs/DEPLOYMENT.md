# Deploying to Vercel

ScholarSea is a standard Next.js app with a PostgreSQL database. Deployment has
four parts: a database, a GitHub repo, a Vercel project, and environment
variables.

## 1. Provision a PostgreSQL database

Vercel's filesystem is ephemeral, so you need a hosted Postgres. Any of these
work (all have free tiers):

- **Neon** (neon.tech) — serverless Postgres, pairs well with Vercel
- **Vercel Postgres** — provision from the Vercel dashboard
- **Supabase** (supabase.com)

Create a database and copy its **connection string**. It usually looks like:

```
postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
```

Keep it handy — this is your `DATABASE_URL`.

## 2. Push the code to GitHub

From the project directory:

```bash
git add -A
git commit -m "ScholarSea through paper analysis"
# create an empty repo on github.com first (no README), then:
git remote add origin https://github.com/<you>/scholarsea.git
git branch -M main
git push -u origin main
```

`.env` is gitignored, so no secrets are pushed — only `.env.example`.

## 3. Import the repo into Vercel

1. Go to vercel.com → **Add New… → Project**.
2. **Import** your `scholarsea` GitHub repo (authorize GitHub access if asked).
3. Vercel auto-detects **Next.js** — leave the framework preset as is.
4. **Build command:** Vercel runs the `vercel-build` script automatically
   (`prisma generate && prisma migrate deploy && next build`). If your first
   deploy builds but the database has no tables, set the Build Command
   explicitly to `npm run vercel-build` in **Settings → General**.
5. Don't deploy yet — add the environment variables first (next step).

## 4. Set environment variables

In the import screen (or **Settings → Environment Variables**), add these for
**Production** (and Preview, if you use preview deploys):

| Name | Required | Value |
|------|----------|-------|
| `DATABASE_URL` | ✅ | your Postgres connection string from step 1 |
| `AUTH_SECRET` | ✅ | a strong random string — `openssl rand -base64 48` |
| `CREDENTIAL_ENCRYPTION_KEY` | optional | `openssl rand -base64 32` |
| `AI_API_KEY` | optional | your AI provider key (omit to run in demo mode) |
| `AI_BASE_URL` | optional | e.g. `https://api.openai.com/v1` |
| `AI_MODEL` | optional | e.g. `gpt-4o-mini` |
| `NEXT_PUBLIC_APP_URL` | optional | your deployed URL once known |

Notes:
- The app **loads and works without an AI key** — it runs in clearly-labeled
  demo mode. Add `AI_API_KEY` + `AI_BASE_URL` for real analysis.
- `SHADOW_DATABASE_URL` is **not** needed on Vercel (only local `migrate dev`
  uses it).

## 5. Deploy

Click **Deploy**. On build, Vercel will:

1. `npm install`
2. `prisma generate` (regenerates the client — it's gitignored, not in the repo)
3. `prisma migrate deploy` (applies `prisma/migrations/` to your database)
4. `next build`

When it finishes you get a URL like `https://scholarsea-<hash>.vercel.app`.

## 6. Verify

- Open the URL — you should be redirected to `/login`.
- Sign up for an account, then land on the dashboard.
- (The seeded `demo@scholarsea.dev` account only exists if you ran
  `npm run db:seed` against the production database — optional.)

## Migrations on deploy

`prisma migrate deploy` runs on every deploy and applies any new migrations. It
is a no-op when the database is already up to date and never resets data. If you
prefer to run migrations manually, remove `prisma migrate deploy` from the
`vercel-build` script and run it yourself against the production database.

## Platform limitations

- **Upload size:** Vercel serverless requests are limited (~4.5 MB on Hobby),
  so large PDF uploads will fail there. Pasted text, URLs, and smaller PDFs work.
  A direct-to-storage upload path would lift this.
- **Function duration:** the analyze endpoint is set to `maxDuration = 60`
  (Hobby cap). Long real-AI runs may need Vercel Pro (up to 300s); raise the
  value in `src/app/api/papers/[id]/analyze/route.ts`.
- **Object storage:** uploaded PDFs are parsed in memory and only their text is
  stored; the original file is not persisted. Add object storage (e.g. S3/Vercel
  Blob) when you need the source files back.

# Comment Exporter — Private Showcase Site

A registration-gated website that documents the Comment Exporter extension and
hosts two server-side export tools (Reddit, YouTube). Access is invite-code +
admin-approval: you need the invite code to register, and an admin must
approve your account before you can sign in. No email sending involved.

**Stack:** Next.js (App Router) · Neon Postgres (free tier) · deploys to Vercel
(free tier).

---

## How access works

- **Real auth.** Passwords are bcrypt-hashed in Postgres — never stored in
  plaintext, never shipped to the browser. Login is verified server-side.
- **Real sessions.** A signed JWT (`AUTH_SECRET`) in an httpOnly, secure,
  sameSite=lax cookie; page scripts can't read it. Sliding 2-hour idle
  timeout — active users stay signed in, idle ones are logged out.
- **Invite-code registration.** `INVITE_CODE` gates who can even create an
  account. The first account ever created becomes the admin, auto-approved.
  Every account after that is created `pending` and can't sign in until an
  admin approves it from `/admin`.
- **Route protection.** Middleware guards `/`, `/reddit`, `/youtube`, `/admin`
  and redirects unauthenticated or unapproved users to `/login`. It also
  re-checks the account's live status on every request, so a rejected user
  is logged out immediately even if their token hasn't expired.
- **Rate limiting.** Login and register are throttled per-IP (in-memory,
  per-instance — fine for a small private site).
- **Password reset.** Admin-mediated, no email required — see `/admin`.

---

## Local setup

1. **Install**
   ```bash
   npm install
   ```

2. **Create a Neon database** (free): https://neon.tech → new project → copy the
   **pooled** connection string.

3. **Create `.env.local`**:
   ```
   DATABASE_URL="postgresql://...neon.tech/db?sslmode=require"
   AUTH_SECRET="<openssl rand -hex 32>"
   INVITE_CODE="<pick a code you'll share with people you invite>"
   YOUTUBE_API_KEY="<from Google Cloud Console, for the YouTube export tool>"
   ```

4. **Create the table**
   ```bash
   node scripts/init-db.mjs
   ```

5. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 → redirected to `/login` → register with the
   invite code → the first account is auto-approved as admin and can sign in
   immediately; later accounts wait for approval at `/admin`.

---

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. https://vercel.com → **New Project** → import the repo. Framework auto-detects
   as Next.js.
3. **Environment Variables** (Project Settings → Environment Variables) — add:
   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | your Neon pooled connection string |
   | `AUTH_SECRET` | a long random hex (`openssl rand -hex 32`) |
   | `INVITE_CODE` | the code you'll share with people you invite |
   | `YOUTUBE_API_KEY` | from Google Cloud Console, for the YouTube export tool |
4. **Deploy.**
5. **Initialize the database once** (from your machine, pointing at Neon):
   ```bash
   DATABASE_URL="postgresql://...neon.tech/db?sslmode=require" node scripts/init-db.mjs
   ```
6. Visit your Vercel URL and register the first account — it becomes admin.

> **Tip:** the Neon + Vercel integration can inject `DATABASE_URL` for you
> (Vercel → Integrations → Neon). If you use it, skip adding `DATABASE_URL` by hand.

---

## Project structure

```
app/
  layout.tsx              root layout + fonts + global CSS
  globals.css             the "operator console" design system
  page.tsx                PROTECTED showcase (overview/features/output/shots/install)
  Header.tsx               nav bar (desktop row + mobile dropdown)
  LogoutButton.tsx         client logout control
  login/page.tsx           sign-in
  register/page.tsx        sign-up (invite code required)
  admin/page.tsx           PROTECTED admin panel — approve/reject/reset users
  admin/AdminUserList.tsx  admin panel client component
  reddit/page.tsx          PROTECTED Reddit comment export tool (client)
  youtube/page.tsx         PROTECTED YouTube comment export tool (client)
  api/auth/
    register/route.ts     invite-gated signup; first account becomes admin
    login/route.ts        check credentials + approval status, set session cookie
    logout/route.ts       clear session
  api/admin/users/route.ts  list users; approve/reject/reset-password (admin only)
  api/reddit/export/route.ts   fetch + flatten a Reddit thread's comments
  api/youtube/export/route.ts  fetch + flatten a YouTube video's comments
lib/
  db.ts                  lazy Neon client
  auth.ts                edge-safe sessions (jose)
  admin.ts               resolve current admin user from the DB
  password.ts            bcrypt hashing (Node-only, kept out of middleware)
  ratelimit.ts           in-memory per-IP rate limiter
  csv.ts                 shared, formula-injection-safe CSV export helper
middleware.ts            protects "/", "/reddit", "/youtube", "/admin"
scripts/
  init-db.mjs             one-time table creation (fresh installs)
  migrate-admin.mjs        adds status/is_admin + single-admin index (existing DBs)
  remove-email-verification.mjs  drops old email-verification columns (existing DBs)
```

---

## Security notes (honest)

- **Passwords:** bcrypt cost 12, never logged.
- **Sessions:** httpOnly + secure + sameSite=lax, 2-hour sliding idle timeout,
  signed with `AUTH_SECRET` (keep it secret; rotating it invalidates all
  sessions).
- **Enumeration:** register and login return generic messages so the site
  doesn't reveal which emails are registered.
- **Admin race safety:** a partial unique index (`idx_users_single_admin`)
  guarantees at most one admin can be created via the "first account" path,
  even under concurrent registrations.
- The showcase itself only *describes* the Facebook extension — it's never
  hosted or run here. The Reddit/YouTube tools run server-side against each
  platform's own public/official API.
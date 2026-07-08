# Comment Exporter — Private Showcase Site

A public-URL, **registration-gated** website that documents the Comment Exporter
extension. Anyone can sign up with an email + password; they must verify their
email before they can sign in. Once signed in, they see the showcase.

**Stack:** Next.js (App Router) · Neon Postgres (free tier) · Resend (free tier,
email) · deploys to Vercel (free tier).

---

## What's real here (vs. the earlier static version)

- **Real auth.** Passwords are bcrypt-hashed in Postgres — never stored in
  plaintext, never shipped to the browser. Login is verified server-side.
- **Real sessions.** A signed JWT in an httpOnly cookie; page scripts can't read it.
- **Email verification.** New accounts must click a link before they can log in.
- **Route protection.** Middleware guards `/` and redirects strangers to `/login`.

---

## Local setup

1. **Install**
   ```bash
   npm install
   ```

2. **Create a Neon database** (free): https://neon.tech → new project → copy the
   **pooled** connection string.

3. **Create `.env.local`** (copy `.env.example`) and fill in:
   ```
   DATABASE_URL="postgresql://...neon.tech/db?sslmode=require"
   AUTH_SECRET="<openssl rand -hex 32>"
   RESEND_API_KEY="re_..."        # optional locally; see note
   EMAIL_FROM="onboarding@resend.dev"
   APP_URL="http://localhost:3000"
   ```
   > Without `RESEND_API_KEY`, verification links are printed to the server
   > console instead of emailed — fine for local testing.

4. **Create the table**
   ```bash
   DATABASE_URL="postgresql://...neon.tech/db?sslmode=require" node scripts/init-db.mjs
   ```

5. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 → you'll be redirected to `/login` → register →
   (grab the verify link from email or server logs) → verify → sign in.

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
   | `RESEND_API_KEY` | from resend.com |
   | `EMAIL_FROM` | `onboarding@resend.dev` (or your verified domain) |
   | `APP_URL` | `https://<your-project>.vercel.app` |
4. **Deploy.**
5. **Initialize the database once** (from your machine, pointing at Neon):
   ```bash
   DATABASE_URL="postgresql://...neon.tech/db?sslmode=require" node scripts/init-db.mjs
   ```
6. Visit your Vercel URL and register the first account.

> **Tip:** the Neon + Vercel integration can inject `DATABASE_URL` for you
> (Vercel → Integrations → Neon). If you use it, skip adding `DATABASE_URL` by hand.

---

## Email sending (Resend)

- Free tier sends from `onboarding@resend.dev` with no domain setup — good enough
  to start.
- To send from your own domain, verify it in Resend and set `EMAIL_FROM` to an
  address on it. Update `APP_URL` to match your real domain if you use a custom one.

---

## Project structure

```
app/
  layout.tsx            root layout + fonts + global CSS
  globals.css           the "operator console" design system
  page.tsx              PROTECTED showcase (overview/features/output/shots/install)
  LogoutButton.tsx      client logout control
  login/page.tsx        sign-in (shows verify status)
  register/page.tsx     sign-up
  verify/page.tsx       forwards email token to the verify API
  api/auth/
    register/route.ts   create unverified user + send email (Node runtime)
    verify/route.ts      validate token, mark verified
    login/route.ts       check credentials, require verified, set session cookie
    logout/route.ts      clear session
lib/
  db.ts                 lazy Neon client
  auth.ts               edge-safe sessions (jose) + verify-token gen
  password.ts           bcrypt hashing (Node-only, kept out of middleware)
  email.ts              Resend verification email
middleware.ts           protects "/"
scripts/init-db.mjs     one-time table creation
```

---

## Security notes (honest)

- **This is real auth, appropriate for a public site**, but keep it in scope: the
  page holds no sensitive data, just documentation. Don't store scraped data or
  Facebook tokens here.
- **Passwords:** bcrypt cost 12, never logged. **Sessions:** httpOnly + secure +
  sameSite=lax, 7-day expiry, signed with `AUTH_SECRET` (keep it secret; rotating
  it invalidates all sessions).
- **Enumeration:** register and login return generic messages so the site doesn't
  reveal which emails are registered.
- **Rate limiting is NOT included.** For a small private showcase that's usually
  fine, but if it gets abused, add Vercel's rate limiting or a simple per-IP limit
  on the auth routes.
- The showcase itself only *describes* the extension. The extension is never
  hosted or run here — collection stays a local browser tool, by design.

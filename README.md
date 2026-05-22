# Church Management System

Minimal README to run the project locally and DB / env expectations.

Prerequisites
- Node.js 18+ (or compatible)
- MySQL database

Setup
1. Copy `.env.example` to `.env` and update values (or set environment variables):

Required env vars:
- `DB_HOST` (default: localhost)
- `DB_USER` (default: root)
- `DB_PASSWORD`
- `DB_NAME` (default: `church_db`)
- `PORT` (optional, default 3000)
- `JWT_SECRET` (recommended, a fallback default is used if missing)
- `EMAIL_USER` (optional, for sending emails)
- `EMAIL_PASS` (optional, for sending emails)
- `APP_BASE_URL` (recommended for payment return URLs, e.g. `https://yourdomain.com`)
- `MPESA_ENV` (`sandbox` or `production`)
- `MPESA_CONSUMER_KEY` (for Daraja API)
- `MPESA_CONSUMER_SECRET` (for Daraja API)
- `MPESA_SHORTCODE` (paybill/till shortcode)
- `MPESA_PASSKEY` (Daraja STK passkey)
- `MPESA_CALLBACK_URL` (optional explicit public callback URL for STK push responses; if omitted the app will use `APP_BASE_URL + /api/payments/mpesa/callback`)
- `MPESA_TRANSACTION_TYPE` (optional, default: `CustomerPayBillOnline`)
- `BANK_PAYMENT_REDIRECT_URL` (hosted bank/card checkout entry URL)
- `BANK_PAYMENT_SUCCESS_URL` (optional explicit success return URL)
- `BANK_PAYMENT_CANCEL_URL` (optional explicit cancel return URL)

2. Install dependencies and start server from the project root

```bash
npm install
npm run start    # server will automatically find a free port if 3000 is busy
```

> **Tip:** if you previously had the server running, kill that process first or supply a different `PORT` in your `.env`. The app will log which port it actually bound to.

Database schema (expected tables & important columns)
- `users` (id, name, email, password, role)
- `members` (id, name, email, phone, address, created_by, created_at)
- `attendance` (id, member_id, check_in, check_out NULLABLE, created_by)
- `events` (id, title, description, event_date, created_by)
- `donations` (id, donor_name, amount, donation_date, created_by, description)
- `announcements` (id, title, message, created_by, created_at)

Notes
- The server creates an `admin@church.com` user with password `admin123` on startup if missing.
- To seed sample data use the seed scripts in `backend/seeds/`:
  - `node backend/seeds/seed_sample_data.js` (members + attendance)
  - `node backend/seeds/seed_donations_events.js` (donations + events)
- Live payment support now includes:
  - M-Pesa STK push through Safaricom Daraja when the M-Pesa environment variables are configured
  - provider-hosted bank redirect checkout when `BANK_PAYMENT_REDIRECT_URL` is configured
  - automatic recording of successful payments into church contributions

M-Pesa setup
1. Create a Safaricom Daraja app and collect:
   - consumer key
   - consumer secret
   - shortcode
   - passkey
2. Set `MPESA_ENV=sandbox` while testing, then switch to `production` when Daraja live credentials are ready.
3. Set `APP_BASE_URL` to your public app URL, for example `https://yourdomain.com`.
4. Either:
   - leave `MPESA_CALLBACK_URL` empty and let the app use `https://yourdomain.com/api/payments/mpesa/callback`
   - or set `MPESA_CALLBACK_URL` explicitly if your callback is hosted on a different public URL
5. Restart the server, open a contribution page, and confirm the M-Pesa payment card shows that it is ready.
6. Use a Safaricom test number in sandbox, then confirm successful STK payments appear in contribution history automatically.

Frontend
- Start the backend server and open `http://localhost:<port>/` in a browser to access the app.

Deploying From GitHub
- The repo is now deployment-ready from the root directory.
- Important root deployment files:
  - `package.json`
  - `server.js`
  - `Procfile`
  - `railway.json`
  - `Dockerfile`
  - `.env.example`
- The runtime still uses the app code in `backend/`, but deployment platforms can now detect and start the app from the repository root.
- Recommended path:
  1. Push the repo to GitHub.
  2. In Railway, create a new project from the GitHub repo.
  3. Add a MySQL service in Railway or connect an external MySQL database.
  4. Set the environment variables from `.env.example`.
  5. Set `APP_BASE_URL` and any payment callback URLs to the live app URL.
- The container starts the Express app from `backend/server.js` and respects the platform-provided `PORT`.

Known behavior
- JWT tokens default to `JWT_SECRET` or `secretkey` if not set.
- Email sending requires valid `EMAIL_USER`/`EMAIL_PASS`.

If you want, I can add SQL migration files to create all tables automatically.

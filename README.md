# ✈️ Flight Glitch Watch

A personal flight price **glitch detector**: it continuously monitors routes you
configure via the **Amadeus Self-Service API**, builds a price baseline from its own
history, and emails you through **Resend** the moment a fare drops dramatically below
normal — a possible error fare or flash sale.

- **Flight search** — specific origin → destination routes, or origin → *anywhere*
  (Amadeus Flight Inspiration), with date windows, trip length, preferred airlines,
  cabin and currency per route
- **Glitch detection** — two rules per route: *X% below the historical average* and/or
  *below an absolute price you set*; a cooldown prevents alert spam
- **Scheduled monitoring** — a small worker process checks each route on its own
  interval (15 min, hourly, daily — set per route in the dashboard)
- **Email alerts** — price vs. normal range, dates, airline, segments, and a Google
  Flights booking link
- **Web dashboard** — add/remove routes, tune thresholds and frequency, price history
  charts with alert markers, recent alerts, email settings

Stack: Next.js 15 (App Router) + TypeScript · Prisma + SQLite · Resend · Recharts · PM2.

## How detection works

1. Every check stores the cheapest fare found as a snapshot.
2. The **baseline** is the average of each day's cheapest observed price over the last
   30 days (configurable), and the "normal range" is the spread of those daily minimums.
3. **Percent rule**: alert when `price ≤ baseline × (1 − dropPercent/100)`. It stays
   quiet until the route has ≥ 10 snapshots across ≥ 3 distinct days, so a new route
   can't false-alarm.
4. **Absolute rule**: alert when `price ≤ maxPrice` — works from the first check.
5. **Cooldown**: no repeat alert for the same route within 6 h (configurable) unless
   the price drops another ≥ 10%.

Example: JFK → Tokyo usually $900–1200; a $300 fare is ~70% below the average → alert.

## Setup

Requirements: Node 20+, a free [Amadeus Self-Service](https://developers.amadeus.com)
account, and a [Resend](https://resend.com) API key.

```bash
git clone <this repo> && cd Flight-searcher
npm install
cp .env.example .env      # then fill in the values below
npx prisma migrate deploy
```

`.env` essentials:

| Variable | What |
|---|---|
| `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET` | from your Amadeus app ("API key" / "API secret") |
| `AMADEUS_ENV` | `test` (free, limited data) or `production` |
| `RESEND_API_KEY` | from resend.com |
| `ALERT_EMAIL_FROM` | verified sender, or `Flight Alerts <onboarding@resend.dev>` for testing |
| `ALERT_EMAIL_TO` | where alerts go |

> Resend's shared `onboarding@resend.dev` sender can only deliver to the email address
> of your own Resend account — verify a domain for anything else.

### Run it

```bash
npm run dev       # dashboard at http://localhost:3000
npm run worker    # the monitor loop, in a second terminal
```

Useful scripts:

```bash
npm run check-now         # check all enabled routes immediately
npm run check-now -- 3    # check route id 3
npm run seed-demo         # demo route + 30 days of fake history to try the dashboard
```

Add a route in the dashboard, then `npm run check-now` to verify your Amadeus
credentials end to end. Use **Settings → Send test email** to verify Resend.

## Deployment (Linux + PM2)

```bash
npm install
npx prisma migrate deploy
npm run build
npm install -g pm2
pm2 start ecosystem.config.js   # starts "web" (dashboard) + "worker" (monitor)
pm2 save && pm2 startup         # survive reboots
pm2 logs flight-searcher-worker
```

The dashboard listens on `PORT` (default 3000). If something else is already on
3000, pick any port: `npm run dev -- -p 3001` in development, or
`PORT=3001 pm2 start ecosystem.config.js` in production (set it in your shell —
Next.js does not read the listen port from `.env`). Both processes share the SQLite file at
`data/app.db` (WAL mode); back it up by copying that file.

### Other platforms

- **Railway**: works as-is — deploy the repo twice (service commands `npm start` and
  `npm run worker`) with a shared volume mounted at `/app/data`, or run both under PM2
  in one service.
- **Vercel**: not recommended for this design — serverless has no persistent disk for
  SQLite and Hobby cron is once-daily. You'd need a hosted DB (Turso/Neon/Supabase) and
  a Pro-plan cron hitting an API route instead of the worker.

## API usage, rate limits & "anti-ban"

This tool talks to an **official, authenticated API**, so user-agent rotation and
scraping tricks are pointless (and against ToS). What actually keeps you unbanned and
under quota is built in:

- all Amadeus calls run through a **serialized queue** with a 600 ms + jitter gap
  (`REQUEST_DELAY_MS`)
- automatic **exponential backoff** on 429/5xx, honoring `Retry-After`
- a **daily request budget** (`DAILY_REQUEST_BUDGET`, default 500/day) — when it's
  spent, checks pause until tomorrow

Budget math: a fixed route samples up to **3 departure dates per check** (3 API calls);
an *anywhere* route is 1 call. A route checked every 15 min ≈ 288 calls/day — fine for
production tier, but the free **test** tier is capped per month, so start with hourly
checks there. The Amadeus test environment also returns a reduced set of airlines/routes
and cached prices; use `AMADEUS_ENV=production` (free to enable, pay-per-call beyond the
monthly free quota) for real monitoring.

Booking links point to Google Flights for the found dates — Amadeus fares (especially
Inspiration results) are indicative, so always confirm the price before booking.
Error fares vanish fast and airlines may not honor them.

## Project layout

```
src/lib/amadeus/    API client (OAuth cache, offers + inspiration search)
src/lib/rateLimit.ts  politeness queue, backoff, daily budget
src/lib/detection.ts  baseline + glitch rules + cooldown
src/lib/email.ts      Resend alert email
src/worker/           60s scheduler loop + per-route check pipeline
src/app/              dashboard (App Router) + API route handlers
scripts/              check-now, seed-demo
ecosystem.config.js   PM2: web + worker
```

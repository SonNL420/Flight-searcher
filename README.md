# ✈️ Flight Glitch Watch

A personal flight price **glitch detector**: it continuously monitors routes you
configure via the **Travelpayouts / Aviasales Data API**, builds a price baseline from
its own history, and emails you through **Resend** the moment a fare drops dramatically
below normal — a possible error fare or flash sale.

> **Why Travelpayouts?** The tool originally targeted the Amadeus Self-Service API,
> which Amadeus is decommissioning on **July 17, 2026**. The Travelpayouts/Aviasales
> Data API is free, needs only an affiliate-program signup, and serves cached
> real-market prices — a great fit for baseline-vs-anomaly detection.

- **Flight search** — specific origin → destination routes, or origin → *anywhere*
  (cheapest destinations from your origin), with date windows, trip length, preferred
  airlines and currency per route
- **Glitch detection** — two rules per route: *X% below the historical average* and/or
  *below an absolute price you set*; a cooldown prevents alert spam
- **Scheduled monitoring** — a small worker process checks each route on its own
  interval (15 min, hourly, daily — set per route in the dashboard)
- **Email alerts** — price vs. normal range, dates, airline, and a booking link
  (Aviasales when the API provides one, otherwise Google Flights)
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

Requirements: Node 20+, a free [Travelpayouts](https://www.travelpayouts.com) account,
and a [Resend](https://resend.com) API key.

**Getting the flight-data token (free):** sign up at travelpayouts.com, join the
**Aviasales** affiliate program inside the dashboard, then copy the token from
**Profile → API token**.

```bash
git clone https://github.com/SonNL420/Flight-searcher.git
cd Flight-searcher
npm install
cp .env.example .env      # then fill in the values below
npx prisma migrate deploy
```

`.env` essentials:

| Variable | What |
|---|---|
| `TRAVELPAYOUTS_TOKEN` | from Travelpayouts → Profile → API token |
| `TRAVELPAYOUTS_MARKET` | which market's cached prices to use: `us`, `de`, `gb`, … |
| `RESEND_API_KEY` | from resend.com |
| `ALERT_EMAIL_FROM` | verified sender, or `Flight Alerts <onboarding@resend.dev>` for testing |
| `ALERT_EMAIL_TO` | where alerts go |

> Resend's shared `onboarding@resend.dev` sender can only deliver to the email address
> of your own Resend account — verify a domain for anything else.

### Run it

```bash
npm run dev       # dashboard at http://localhost:3000  (or: npm run dev -- -p 3001)
npm run worker    # the monitor loop, in a second terminal
```

Useful scripts:

```bash
npm run check-now         # check all enabled routes immediately
npm run check-now -- 3    # check route id 3
npm run seed-demo         # demo route + 30 days of fake history to try the dashboard
```

Add a route in the dashboard, then `npm run check-now` to verify your token end to end.
Use **Settings → Send test email** to verify Resend.

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
Next.js does not read the listen port from `.env`). Both processes share the SQLite
file at `data/app.db` (WAL mode); back it up by copying that file.

### Other platforms

- **Railway**: works as-is — deploy the repo twice (service commands `npm start` and
  `npm run worker`) with a shared volume mounted at `/app/data`, or run both under PM2
  in one service.
- **Vercel**: not recommended for this design — serverless has no persistent disk for
  SQLite and Hobby cron is once-daily. You'd need a hosted DB (Turso/Neon/Supabase) and
  a Pro-plan cron hitting an API route instead of the worker.

## Data source characteristics & limits

The Aviasales Data API serves **cached prices** from real user searches:

- Prices can lag live fares by minutes to hours. That's fine for spotting anomalies,
  but **always confirm the live price via the booking link before buying** — error
  fares vanish fast and airlines may not honor them.
- Fixed routes query exact sampled dates (up to **3 departure dates per check**, one
  API call each). *Anywhere* routes use the popular-destinations cache (1 call) — the
  route's date window is not applied there; treat results as "cheap somewhere soon."
- Cached data is economy class; the cabin setting from the original design is not used.
- Currencies: `usd`, `eur` and most major codes work; set it per route.

"Anti-ban" is built in even though this is an official, authenticated API:

- all calls run through a **serialized queue** with a 600 ms + jitter gap
  (`REQUEST_DELAY_MS`)
- automatic **exponential backoff** on 429/5xx, honoring `Retry-After`
- a **daily request budget** (`DAILY_REQUEST_BUDGET`, default 500/day) — when it's
  spent, checks pause until tomorrow. A fixed route checked every 15 min ≈ 288
  calls/day; hourly ≈ 72.

## Project layout

```
src/lib/flights/      provider client (Travelpayouts/Aviasales) + fare types
src/lib/rateLimit.ts  politeness queue, backoff, daily budget
src/lib/detection.ts  baseline + glitch rules + cooldown
src/lib/email.ts      Resend alert email
src/worker/           60s scheduler loop + per-route check pipeline
src/app/              dashboard (App Router) + API route handlers
scripts/              check-now, seed-demo
ecosystem.config.js   PM2: web + worker
```

Swapping providers later is contained: implement `searchCheapestOffer` /
`searchAnywhere` returning the `FoundFare` shape in `src/lib/flights/` and update the
two imports in `src/worker/checkRoute.ts`.

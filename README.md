# Salon Queue Management System

**Live demo: Pending — no hosting project or URL has been configured, deployed, or verified.**

## Overview

A single-salon queue application for customers, reception, barbers and the owner. Customers join and follow a token; Reception calls eligible customers and adds walk-ins; barbers start and complete service; a waiting-area TV shows current and upcoming tokens; and Owner Settings manages services, duty and online-joining hours.

The project follows `docs/01-brief.md`, `docs/02-screens.md`, and `docs/03-flows-rules.md`. Demo records are synthetic: Ravi, Amit and Imran; Haircut (30 min, ₹150), Beard trim (15 min, ₹80), Hair spa (45 min, ₹400); 9:00 PM initial editable closing time. Salon time is `Asia/Kolkata`; no opening time is assumed.

## Features

- Customer join with 1–3 active services, barber preference, Indian phone validation, price/duration totals, active-phone duplicate prevention, sequential token and status route.
- My Status position, approximate wait, called/position-two states and Waiting-only cancellation.
- Reception walk-ins, FCFS eligible Call Next, cancellation and manual No-show after the 10-minute grace period.
- Barber Start/Done, timer and availability/break controls.
- TV current/upcoming tokens and called highlight without exposing phone numbers in the snapshot or Realtime event.
- Owner service snapshots, barber duty, online queue controls, closing cutoff and timestamp-derived daily statistics.
- English/Gujarati UI.

## Stack and architecture

- React, Vite, Tailwind CSS and React Router.
- `@supabase/supabase-js` browser client using the project URL and publishable key.
- Supabase PostgreSQL tables for queue entries, services, barbers and salon settings.
- Named Postgres RPCs perform queue mutations transactionally. A settings-row lock serializes token allocation and queue actions; unique indexes protect active phone and assigned-barber invariants.
- Supabase Realtime publishes a phone-free revision signal. Clients fetch an initial canonical snapshot and refetch after each signal; connection status and reconnect handling are shown in the UI.
- Queue mutations no longer use localStorage. Language preference is a noncritical browser preference.

## Configuration and local setup

The cloud backend must be configured before mutations persist. Without valid Supabase settings, the app shows synthetic seed data as a placeholder, displays a setup warning, and does not save queue changes.

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the Dashboard. Never place a secret or service-role key in the frontend.
3. Install dependencies and run the database migration. Full instructions are in [SUPABASE_SETUP.md](SUPABASE_SETUP.md).
4. In PowerShell, from this project directory:

```powershell
npm.cmd install
npm.cmd run dev
```

For production build and automated domain/repository checks:

```powershell
npm.cmd test
npm.cmd run build
```

The production bundle is generated in `dist/`.

## Demo routes and access

No login/PIN is implemented. Staff screens and mutation RPCs are publicly accessible demo operations. Use synthetic data only.

| Route | Purpose |
|---|---|
| `/` | Customer home and queue summary |
| `/join` | Customer queue form |
| `/status/:id` | Status by entry ID returned after joining |
| `/reception` | Reception queue and walk-ins |
| `/barber/ravi` | Ravi's service view; `/barber/amit` and `/barber/imran` are also available |
| `/display` | Waiting-area TV |
| `/admin` | Owner settings and daily statistics |

## Synchronization and limitations

With correct Supabase credentials and the migration applied, PostgreSQL is the shared source of truth for separate devices and browser profiles. Realtime subscription events trigger snapshot refetches. This repository's cloud architecture has **not** been verified against a configured Supabase project or separate devices because project credentials are not present. Do not claim the five-second or offline-reconnect acceptance tests pass until they are actually run.

Before Supabase is configured, there is no persistent local queue fallback. Existing values in an older browser `localStorage` are not imported to the cloud. Language preference may still use browser storage.

This lab demo has no authentication. RLS blocks direct browser access to application tables; the public RPC functions needed for customer and staff workflows are callable without sign-in. This is not production security or authorization. Use synthetic customer information only. Estimated waiting time is approximate, browser chimes may be blocked, and an offline action can fail with an explicit error.

## Deployment

**Deployment is pending.** No Supabase project, hosting account, deployment credential or verified live URL is configured in this workspace.

Manual Vercel deployment after the Supabase setup is complete:

1. Push this project directory to a Git provider and import it into Vercel.
2. Set framework to Vite, build command to `npm run build`, and output directory to `dist`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel's project environment settings for the deployment environment.
4. Apply the pending migration to the intended Supabase project with `npx supabase db push --remote` and verify the configured Dashboard project ref matches the Vercel environment.
5. Configure SPA rewrites to `index.html` if required by the host, then deploy.
6. Open the live URL and directly verify all seven routes. Repeat join → reception call → barber Start/Done across separate profiles/devices, refresh, reconnect and verify the 5-second Realtime requirement before recording deployment complete.

## QA status

See [QA_REPORT.md](QA_REPORT.md) for the actual checks and remaining manual cases. Database functions have not been applied to a live Supabase project, and no separate-device verification or deployment has been performed.

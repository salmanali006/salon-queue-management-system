# Supabase setup

The application uses Supabase PostgreSQL as the queue source of truth when both Vite environment variables below are present. The browser uses only the Supabase publishable key. No service-role or secret key is used in client code.

## 1. Create a Supabase project

1. Create a project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Choose a region close to the salon and save the database password in your password manager.
3. Wait for the database to finish provisioning.
4. Open **Project Settings → API Keys** (or the project's **Connect** panel) and copy the **Project URL** and **publishable key**. Use the current `sb_publishable_...` key. Do not use a secret or service-role key in this React app.

## 2. Configure environment variables

From the project root, copy `.env.example` to `.env.local` and replace both placeholders:

```powershell
Copy-Item .env.example .env.local
```

Set:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<value-from-dashboard>
```

`.env.local` is ignored by Git. Restart Vite after changing it. The publishable key is designed for browser use; database access is constrained by grants, RLS and the RPC surface. Never put a secret/service-role key in a `VITE_` variable.

## 3. Apply the database migration

Install the Supabase CLI using the [official CLI guide](https://supabase.com/docs/guides/local-development/cli/getting-started). On Windows, the official project-scoped npm option is:

```powershell
npm.cmd install --save-dev supabase
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run --remote
npx supabase db push --remote
```

The CLI may ask for the database password created with the project. Use the password prompt; do not put it in the repository. Review the dry-run target and migration list before applying. The migration is `supabase/migrations/20261124120000_shared_queue.sql`.

The migration creates the settings, barbers, services, queue entries and Realtime signal tables. It seeds the three synthetic barbers and three synthetic services using insert-if-missing semantics. It does not import old browser-local queue data. Apply it to a new/demo Supabase project; do not treat its public staff RPCs as production-safe.

If the CLI is not available, open **SQL Editor** in the Dashboard, paste the contents of that migration file and run it once. This manual SQL Editor path does not update Supabase's CLI migration history; use the CLI workflow consistently for future schema changes.

## 4. Realtime setup

The migration enables RLS on every application table and adds only `public.queue_updates` to the `supabase_realtime` publication. The queue, settings, services and barbers are read through `get_salon_snapshot()`; the snapshot intentionally omits customer phone numbers. Realtime sends a revision change, and connected clients refetch the canonical snapshot. This keeps full queue rows and phone values out of Realtime payloads.

In **Database → Publications**, confirm `queue_updates` is included in `supabase_realtime`. In **Database → Tables**, confirm RLS is enabled for `salon_settings`, `barbers`, `services`, `queue_entries`, and `queue_updates`. The only direct `anon`/`authenticated` table read granted is the single-row update signal; other table access is via the defined RPCs.

## 5. Verify database connectivity

After applying the migration and setting `.env.local`:

```powershell
npm.cmd install
npm.cmd run dev
```

Open the Vite URL. The header should move from **Connecting…** to **Shared live queue**. The service and barber lists should show the seeded rows. In the Dashboard SQL Editor, verify the migration's source data and snapshot function:

```sql
select id, name, active from public.services order by sort_order;
select id, name, on_duty from public.barbers order by sort_order;
select public.get_salon_snapshot();
```

The SQL snapshot must not contain a customer phone field. A browser mutation should create/update the corresponding database row and a change to `queue_updates.revision`. If setup has not been completed, the app displays sample data, shows a setup warning and rejects queue changes with a configuration error; the sample data is not saved.

## 6. Demo data and cross-device smoke test

Use fictional customer names and numbers only. No real customer contact data should be entered. The migration seeds only Ravi, Amit, Imran and Haircut, Beard trim, Hair spa; it does not create customer records.

With `.env.local` configured and the app running:

1. Open `/join` in one browser profile and `/reception` in a second profile or device.
2. Add a fictional customer in the first profile; confirm the Reception view updates without refresh.
3. Call the entry from Reception; check `/status/<entry-id>` and `/display` in their connected profiles.
4. Start and complete it from `/barber/ravi` (or the assigned barber route) and confirm the queue and owner statistics refresh.
5. Refresh all profiles and confirm the state comes back from PostgreSQL.
6. Test a brief offline/online cycle and verify the UI shows reconnecting, recovers, and does not create a second active entry for the same phone.

The implementation includes idempotency keys for join requests, a unique active-phone index, a database-serialized token counter and serialized Call Next RPCs. These are code/database protections; do not report the multi-device smoke tests as passed until you run them against the configured project.

## Access and security limits

This is a synthetic-data lab demo with no sign-in. Staff routes are publicly accessible, and the anonymous RPCs include reception/barber/owner mutations. RLS prevents direct table access and the RPCs enforce queue invariants, but public staff operations are **not production authentication or authorization**. Do not use real customers or deploy it as a production salon system without adding authenticated staff roles and customer access controls.

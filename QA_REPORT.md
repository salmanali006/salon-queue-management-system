# QA Report — Supabase migration

Date: 2026-11-24  
Scope: Supabase cloud repository, SQL migration/RPCs, Realtime refresh, setup docs, and regression checks against the existing queue rules. This report does not represent a live Supabase deployment or browser/device verification.

## Automated checks actually executed

| Test case ID | Feature tested | Expected result | Actual result | Result | Bug/fix |
|---|---|---|---|---|---|
| AQ-01 | Join validation | Name, Indian 10-digit phone, service count and active services are validated | Domain unit cases passed | Pass | None |
| AQ-02 | Service totals | Selected durations and INR prices are summed | Totals matched configured service data | Pass | None |
| AQ-03 | Tokens/order | Token numbering is sequential and joining appends at the end | Domain unit cases passed | Pass | None |
| AQ-04 | Duplicate phone | Active duplicate is rejected; ended entry does not block reuse | Domain unit cases passed | Pass | None |
| AQ-05, AQ-31 | Join closure and salon timezone | 30-minute cutoff applies in configured salon timezone; walk-in exception remains | Domain unit cases passed | Pass | None |
| AQ-06–AQ-09 | Call Next eligibility | FCFS eligible entry is chosen; barber preference, Any barber, occupancy, duty and break rules hold | Domain unit cases passed | Pass | None |
| AQ-10–AQ-13 | Queue transitions | Start/Done, manual 10-minute No-show and Waiting-only cancellation rules hold | Domain unit cases passed | Pass | None |
| AQ-14–AQ-16 | Position, estimate, TV list | Ordered position and approximate estimate are correct; zero barbers is safe; TV list is capped/eligible | Domain unit cases passed | Pass | None |
| AQ-17–AQ-19 | Snapshots, statistics, duty | Existing service snapshots persist; timestamp stats and duty behavior are correct | Domain unit cases passed | Pass | None |
| AQ-20 | Repository initial state and subscription | Repository fetches an initial snapshot, reacts to a Realtime event and removes its subscription on cleanup | Mock Supabase client test passed | Pass | None |
| AQ-20b | Realtime event during fetch | A change arriving during a fetch triggers another fetch so a stale result is not left installed | Focused race test passed after repository fix | Pass | Fixed missed follow-up refresh |
| AQ-21–AQ-23 | Routes/navigation/translations | Seven route declarations, expected links and English/Gujarati key coverage remain present | Static checks passed | Pass | None |
| AQ-24 | Missing cloud configuration | No persistent localStorage queue fallback is used | Repository unit test passed | Pass | None |
| AQ-25–AQ-27 | Cloud mutation mapping/failures | Join uses its request key; queue/staff/settings actions map to RPCs; a failed RPC is not reported as success | Mock repository tests passed | Pass | None |
| AQ-28–AQ-29 | SQL security and invariants | Migration text enables RLS, limits direct table access, publishes only the signal row, and defines serialization/uniqueness/RPC protections | Static source assertions passed; SQL was not applied to PostgreSQL | Pass (static only) | None |
| AQ-30 | Frontend secrets | No service-role or secret key is referenced in frontend source | Static source assertion passed | Pass | None |
| AUT-01 | Full automated suite | Available Node tests complete successfully | `npm.cmd test`: 32 tests, 32 passed, 0 failed | Pass | None |
| AUT-02 | Dependency installation | Declared dependencies install | `npm.cmd install`: up to date | Pass | Initial sandbox registry lookup failed; retry with registry access succeeded |
| AUT-03 | Production build | Vite generates production assets | `npm.cmd run build` succeeded; Vite emitted a chunk-size advisory for the ~586 kB JS bundle | Pass (warning) | None |

## Cloud acceptance tests not run

Credentials are not configured (`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are absent), no Supabase project is linked, and no separate device/browser profile was available against a live backend. These cases are blocked, not passed:

| Test case ID | Feature tested | Expected result | Actual result | Result | Bug/fix |
|---|---|---|---|---|---|
| TEST A | Customer join → Reception | Reception receives a new customer from another profile within 5 seconds | Not run; no configured database | Blocked | Requires Supabase project setup |
| TEST B | Reception Call Next → My Status/TV | Status and TV update within 5 seconds | Not run; no configured database | Blocked | Requires Supabase project setup |
| TEST C | Barber Start → Reception/TV | All connected screens show In chair | Not run; no configured database | Blocked | Requires Supabase project setup |
| TEST D | Barber Done → queue/statistics | Queue estimates and actual statistics refresh from shared state | Not run; no configured database | Blocked | Requires Supabase project setup |
| TEST E | Refresh recovery | All profiles restore canonical database state | Not run; no configured database | Blocked | Requires Supabase project setup |
| TEST F | Network interruption/reconnect | Client recovers without creating duplicate entries | Mocked refresh behavior has unit coverage; real offline/reconnect flow not run | Blocked | Requires configured project and browser profiles |
| MAN-01 | Migration execution | SQL applies successfully to Supabase PostgreSQL and constraints behave at runtime | Not run; no database/CLI project credentials | Blocked | Apply migration via `SUPABASE_SETUP.md` |
| MAN-02 | Deployment | Production URL works and is verified | No hosting project/credentials; not deployed | Blocked | Configure a hosting project and deploy |
| MAN-03 | Browser/device/layout/security | Routes, interactions, responsive layouts, console and public-demo access are browser-verified | No browser/device run performed for this migration | Blocked | Requires manual verification after setup |

## Synchronization boundary and limitations

- Current repository source of truth is Supabase PostgreSQL **only after valid project configuration and migration application**. Queue data no longer falls back to browser localStorage.
- The configured architecture performs an initial RPC fetch, subscribes to a phone-free revision row, refetches canonical state, and retries/reconnects. Automated tests use a mocked Supabase client; they do not prove cross-device delivery or the five-second requirement.
- With the current workspace configuration, the app has **no persistent queue store**. It displays synthetic seed records with a warning, and queue mutations are rejected. Language preference remains a noncritical local browser preference.
- Staff RPCs/routes are public demo operations. RLS blocks direct table access, but this is not production authentication/authorization. Use synthetic customer records only.
- Database migration syntax/behavior, RLS runtime behavior, Realtime publication and concurrent RPC behavior remain unverified until applied and exercised against Supabase.
- No live demo URL exists and deployment is pending.

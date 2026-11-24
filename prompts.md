# Prompt log

Prompts are listed in the order they were used. These are the user prompts from the project conversation; Codex intermediate reasoning and tool calls are not prompts. Follow-up requests that asked to run checks are included. Build attempts repeatedly failed because `npm` was not present in the environment PATH; that limitation is recorded rather than represented as a successful check.

## 1. Discovery (completed read-only)

> Read the repository instructions in AGENTS.md and all three requirement documents in docs/. Treat those documents as the source of truth.\
> \
> Do a read-only discovery pass. Do not create or modify application files yet.\
> \
> Return:\
> 1\. A concise summary of the product and its four user roles.\
> 2\. The seven required screens and their purpose.\
> 3\. The important queue rules that must not be broken.\
> 4\. Any genuinely blocking ambiguities. Do not ask about details already specified in the docs; state reasonable assumptions for non-blocking gaps.\
> 5\. The simplest storage and synchronization approach for this three-hour prototype. Be explicit whether it supports one browser, multiple tabs on one device, or separate devices. Do not describe localStorage as cross-device synchronization.\
> 6\. A short implementation sequence and the initial file structure.\
> 7\. The exact commands you expect to use to install, run and build the project.\
> \
> Keep the plan realistic for a three-hour lab. Wait for my approval before writing application code.

## 2. Phase 1 foundation

> Implement Phase 1 only, following AGENTS.md and docs/01-brief.md through docs/03-flows-rules.md.\
> \
> Set up the React + Vite + Tailwind application, install only necessary dependencies, create the route structure for all seven required screens, establish the charcoal/gold design tokens, responsive base layout, English/Gujarati translation dictionaries, and realistic synthetic seed data for the three demo barbers and three demo services.\
> \
> Implement the storage/service abstraction using the approach we agreed in the discovery step. If credentials for a shared provider are unavailable, use a clearly disclosed local-demo implementation and do not claim cross-device synchronization.\
> \
> Do not implement all screen functionality yet. Ensure the app starts, routes render placeholder screen shells, and `npm run build` passes. Report changed files and test results.

**Outcome/fix note:** The scaffold and local-demo repository were created. `npm install` and the build could not be run because `npm` was not available in PATH. The first dependency/build check failed for that environment reason; this remains unresolved.

## 3. Home and Join Queue

> Implement only Home (/) and Join Queue (/join), according to docs/02-screens.md and the customer-joining rules in docs/03-flows-rules.md.\
> \
> Include active service cards, selection limit of 3, barber preference including Any barber, 10-digit Indian phone validation, total duration and INR price calculation, approximate wait summary, closed-online-queue handling, and duplicate active-phone detection. On success, create a queue entry with the next unique token and navigate to its My Status route.\
> \
> Keep queue logic in shared domain/service functions, not inside the page components. Do not modify unrelated screens. Test the main join flow, invalid phone, service limit, duplicate phone and closed queue. Run `npm run build` and report results.

**Outcome/fix note:** Shared join rules and the two customer screens were added. Direct Node assertions passed for the domain cases. Build and browser checks could not run because npm was missing.

## 4. My Status

> Implement only My Status (/status/:id) using docs/02-screens.md and docs/03-flows-rules.md.\
> \
> Display the token, current status, queue position and approximate wait. Show the “Start coming to the salon” state at position 2 and the prominent “It's your turn!” state when called. Allow customer cancellation only while Waiting, with confirmation. Keep the estimate explicitly approximate and handle the case where no barbers are working without dividing by zero.\
> \
> Ensure this screen reads the same queue state as Home/Join and updates according to the configured storage mode. Test Waiting, Called, cancellation and missing-token states. Run `npm run build`.

**Outcome/fix note:** Status view and shared position/cancel functions were added. Domain assertions passed. Browser and build checks could not run because npm was missing.

## 5. Reception Dashboard

> Implement only the Reception Dashboard (/reception), following the tablet-landscape layout in docs/02-screens.md and the exact queue rules in docs/03-flows-rules.md.\
> \
> Include barber cards, ordered waiting list, walk-in form, Call next, Cancel and No-show actions. Call next must select the oldest eligible Waiting entry for the chosen barber, skip customers assigned to a different named barber, reject off-duty/on-break/occupied barbers, and never assign one Any barber entry twice. No-show must be manually triggered only after the 10-minute grace period. Walk-ins must remain possible when online joining is closed.\
> \
> Keep transitions and eligibility in shared tested domain functions. Add clear feedback for no eligible customer and failed updates. Test the rule scenarios from the docs, then run `npm run build`.

**Outcome/fix note:** Reception and shared call/no-show rules were added. Domain assertions passed. Build and visual/browser checks were blocked by missing npm.

## 6. Barber View and Waiting Area TV

> Implement Barber View (/barber/:barberId) and Waiting Area TV (/display), using docs/02-screens.md and docs/03-flows-rules.md.\
> \
> Barber View must show the currently assigned customer, services and elapsed time, with valid Start and Done actions, plus Available/On break controls where allowed. The TV must show each barber's current token and the next five eligible waiting tokens, with a clear visual highlight when a customer is called. Add a subtle chime only where browser audio permissions allow; the visual highlight must work without sound.\
> \
> Keep views consistent with the same queue source. Verify that Start/Done, Call next, barber break and customer status are reflected according to the configured synchronization boundary. Do not claim cross-device sync unless a shared store is actually configured. Run `npm run build`.

**Outcome/fix note:** Barber and TV routes plus shared Start/Done/break functions were added. Domain assertions passed. Build and live cross-view checks were blocked by missing npm/browser.

## 7. Owner Settings

> Implement only Owner Settings (/admin), following docs/02-screens.md and docs/03-flows-rules.md.\
> \
> Allow editing service names in English and Gujarati, duration, price and active status; toggle barbers on duty; open/close online joining; and show today's customers served, average actual wait and no-shows. Existing queue entries must preserve the service details/prices captured when they joined. Apply the configured 30-minute-before-closing online-join cutoff. Do not invent a fixed opening time.\
> \
> Test that inactive services disappear from new joins but do not alter existing entries. Run `npm run build`.

**Outcome/fix note:** Owner Settings and stats were added. Later code inspection found that the service update function rejected partial edits (including active toggles); it was corrected to merge incoming edits with the stored service before validation. Node checks then passed for inactive filtering, preserved history, cutoff, and timestamp-derived stats.

## 8. Full manual checklist and final QA request

> Run the full manual test checklist in docs/03-flows-rules.md against the implemented app. Inspect the relevant code before making fixes.\
> \
> For each checklist item, report Pass, Fail, or Blocked, with a short explanation. Fix failures one at a time without changing documented business rules or redesigning unrelated screens. Verify queue state persistence and clearly state whether synchronization is local-only, same-device, or cross-device. Check mobile, tablet-landscape and TV-landscape layouts, Gujarati text overflow, minimum touch target sizes, browser console errors, and production build.\
> \
> Run the available automated checks and `npm run build`. Do not claim a test passed unless it was actually run.

**Outcome/fix note:** Domain assertions passed for implemented rules. Browser checklist, console, layout, and refresh checks remained blocked because the app could not be installed/launched without npm. Code inspection found and fixed the partial service-edit bug described above. `npm run build` was attempted and failed to start because npm could not be found.

## 9. Lab submission preparation (current)

> Prepare the project for the lab submission without claiming deployment is complete unless it is actually deployed and verified.\
> \
> Create/update README.md with project overview, features, stack, local setup and run commands, storage/synchronization limitation, demo routes/access instructions, and deployment instructions. Create/update prompts.md with the prompts actually used in chronological order, including unsuccessful prompts and fixes. Add a three-minute demo sequence covering customer joins, reception calls a barber, barber starts/completes service, TV/status updates, and owner settings. Add a short reflection template describing one incorrect assumption made by the coding agent, how it was noticed and how it was corrected.\
> \
> If deployment credentials/platform access are not configured, provide exact manual deployment steps and clearly label deployment as pending. Ensure the final `npm run build` passes.

## 10. Shared Supabase backend and deployment readiness (current)

> IMPORTANT PROJECT REQUIREMENT UPDATE — FOLLOW THE ORIGINAL SALON QUEUE VIBE CODING GUIDE.
>
> Our project must be a deployed, working application, not just a locally running prototype.
>
> I inspected README.md and discovered that the current application uses browser localStorage. This does not satisfy the requirement that customer, reception, barber and TV screens remain synchronized across devices.
>
> We must fix this before final QA and deployment.
>
> OBJECTIVE
>
> Upgrade the existing Salon Queue Management System to use a shared cloud database and real-time synchronization.
>
> 1. Inspect before changing anything
>
> Read:
> - AGENTS.md
> - docs/01-brief.md
> - docs/02-screens.md
> - docs/03-flows-rules.md
> - README.md
> - Existing source code and storage/domain modules.
>
> Understand the current data structures and queue logic before changing the architecture.
>
> Do not rebuild the application.
>
> 2. Cloud backend
>
> Use Supabase PostgreSQL as the preferred backend.
>
> Implement:
> - A shared database as the source of truth.
> - A proper data access/repository layer.
> - Database migrations in the repository.
> - Supabase Realtime subscriptions.
> - Appropriate database constraints and security policies.
>
> Suggested data entities:
> - Queue entries
> - Services
> - Barbers
> - Salon settings
>
> Adapt the schema to the existing project rather than duplicating data unnecessarily.
>
> 3. Real-time synchronization
>
> This is a mandatory requirement.
>
> The following must work across separate devices and browser profiles:
> - Customer phone: Join Queue and My Status.
> - Reception tablet: Add walk-ins, Call Next, No-show and Cancel.
> - Barber phone: Start service, Complete service, Availability and break status.
> - Waiting-area TV: Current customers, upcoming tokens and newly called customer announcements.
>
> Whenever one screen performs an action, all relevant connected screens must reflect the change within 5 seconds.
>
> Use Supabase Realtime subscriptions and an initial database fetch. Handle reconnections and subscription cleanup correctly.
>
> Do not use localStorage as the authoritative queue database. It may remain for noncritical preferences only.
>
> 4. Preserve business logic
>
> This migration must not break:
> - First-come, first-served ordering.
> - Barber preference rules.
> - Any-barber assignment.
> - Sequential tokens.
> - Duplicate active phone prevention.
> - One active customer per barber.
> - Waiting → Called → In Chair → Done.
> - Cancellation and No-show rules.
> - The 10-minute No-show grace period.
> - Online queue closure 30 minutes before closing.
>
> Critical operations such as token generation and Call Next must be safe against concurrent requests. Use appropriate database transactions or RPC functions.
>
> 5. Security and configuration
>
> - Enable and configure Row Level Security.
> - Never expose the Supabase service_role or secret key in frontend code.
> - Use the appropriate publishable client key.
> - Store credentials in environment variables.
> - Add .env.example.
> - Add .env.local to .gitignore.
> - Do not hardcode credentials.
> - Use only synthetic demo customer information.
>
> Do not claim production security if the staff routes remain publicly accessible.
>
> 6. Setup documentation
>
> Create SUPABASE_SETUP.md explaining:
> 1. How to create a Supabase project.
> 2. How to configure environment variables.
> 3. How to execute database migrations.
> 4. How to enable required Realtime functionality.
> 5. How to verify database connectivity.
> 6. How to seed synthetic demo data safely.
>
> If external credentials are required, create all necessary code and setup files first. Then tell me exactly which dashboard values I need to provide/configure. Never invent credentials.
>
> 7. Testing
>
> Test the following using different browser profiles or devices:
>
> TEST A:
> Customer joins through one browser. Reception on another browser must display the customer within 5 seconds.
>
> TEST B:
> Reception calls the customer. Customer My Status and Waiting Area TV must update within 5 seconds.
>
> TEST C:
> Barber starts service. Reception and TV must reflect In Chair.
>
> TEST D:
> Barber completes service. Queue position, waiting estimates and daily statistics must update correctly.
>
> TEST E:
> Refresh all browser windows. The correct shared state must be restored from the database.
>
> TEST F:
> Reconnect after a temporary internet interruption. The application must recover without creating duplicate queue entries.
>
> 8. README and submission preparation
>
> Update README.md to describe the actual architecture.
>
> The live demo link must be the first content immediately below the README title once deployment is complete.
>
> Include:
> - Live demo URL.
> - Hosting information.
> - Setup instructions.
> - Demo routes.
> - Staff test login/PIN if implemented.
> - Important limitations.
>
> Update prompts.md with the actual project prompts in chronological order, including unsuccessful attempts. Do not invent prompts that were never used.
>
> 9. Build verification
>
> Run:
> - npm.cmd install
> - npm.cmd run build
> - Relevant automated tests.
>
> Fix errors and report genuine results.
>
> Do not claim multi-device synchronization works until it has been tested using separate devices or browser profiles.
>
> 10. Final deliverables
>
> Prepare:
> - Working cloud-connected application.
> - Supabase SQL migrations.
> - SUPABASE_SETUP.md.
> - Updated README.md.
> - prompts.md.
> - QA_REPORT.md.
>
> Do not begin unrelated UI redesign.
>
> Work incrementally, preserve the existing design and functionality, and prioritize satisfying the original assignment guide.
>
> Start by inspecting the existing architecture and explaining the migration plan. Then implement it directly.

**Outcome/fix note:** Requirements and source were re-read. Cloud repository/RPC/Realtime scaffolding, SQL migration, setup documentation, cloud-state messaging and public-demo security disclosure were added. The first npm client install failed inside the network-restricted sandbox with `ENOTFOUND registry.npmjs.org`; the authorized retry with registry access installed `@supabase/supabase-js` successfully. The later `npm.cmd install`, 32 automated tests, and production build passed. Supabase and hosting credentials are not configured, so applying the migration, cross-device tests and deployment remain pending and are not reported as passes.

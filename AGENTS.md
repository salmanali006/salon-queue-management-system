# AGENTS.md — Salon Queue Management System

## Project goal
Build a polished, working single-salon queue management prototype. Customers join and track a queue; reception and barbers manage it; a waiting-area TV display shows current and upcoming tokens.

## Required context — source of truth
Before implementing a feature, read the relevant requirement documents:

- `docs/01-brief.md` — problem, users, scope, demo seed data and non-goals.
- `docs/02-screens.md` — the seven required screens, layouts, controls and responsive behaviour.
- `docs/03-flows-rules.md` — queue statuses, barber assignment, waiting-time calculations, edge cases and manual test checklist.

These documents are authoritative. Do not silently change a business rule or expand scope. If implementation conflicts with a requirement, describe the conflict and propose the smallest fix. Update the relevant document only when the product requirement itself changes.

## Stack and architecture
- Frontend: React + Vite + Tailwind CSS.
- Use a simple maintainable component structure, reusable UI elements and a single shared source of truth for queue rules.
- Use `npm run dev` for local development and ensure `npm run build` succeeds.
- Keep storage behind a small service/repository layer so the UI does not depend directly on a storage provider.
- Before choosing storage, explain the actual synchronization boundary: same-browser tabs, same-device browser storage, or different devices.
- Prefer a shared hosted data store with real-time updates only when credentials/configuration are available and the setup fits the lab time. Otherwise implement a clearly disclosed local-demo fallback. Never claim localStorage synchronizes across separate devices.
- Do not build an elaborate custom backend or database unless the requirements cannot be met otherwise.

## Design requirements
- Premium salon visual style: charcoal `#1F2937` with gold `#D4A017`, rounded cards, clear contrast and clean typography.
- Customer screens are mobile-first.
- Reception dashboard is optimized for a 10-inch tablet in landscape.
- Barber view is phone-first.
- TV display is landscape and readable from about five metres.
- Mobile touch targets must be at least 44 × 44 px.
- Provide English/Gujarati language switching. Put all visible UI text in translation dictionaries; do not hard-code visible labels inside components.
- Use INR currency formatting and the editable demo data in `docs/01-brief.md`.

## Codex working method
1. Work from the repository root so this `AGENTS.md` is in scope. Codex should load this file automatically when starting a session from this project.
2. For the initial task, inspect the repository and read all three files in `docs/`. Summarize the app, identify only genuinely blocking ambiguities, state the proposed storage/synchronization boundary, and give a short implementation plan. Do not write application code during this initial discovery task.
3. After the initial plan, implement in the phases listed below. Each task should cover one screen or one tightly related feature, not the entire application at once.
4. Make reasonable low-risk assumptions from the requirements rather than interrupting for non-blocking questions. Clearly disclose assumptions that affect storage, login/demo access, or deployment.
5. After each phase, run the relevant checks (`npm run build`, lint/tests if configured), inspect the changed files/diff, and report changed files, checks, results and known limitations.
6. When fixing a bug, reproduce it or describe exact reproduction steps, actual result and expected result before editing.
7. Keep queue transitions, token generation, eligibility and wait estimation in shared domain functions. Do not duplicate business rules across screens.
8. Use synthetic demo data only. Do not require real customer personal information.
9. Do not add features in the non-goals section or invent extra product features.
10. Preserve existing working behaviour when making changes. Avoid broad rewrites and unnecessary dependencies.

## Build order
1. Repository setup, routes, theme, shared components, translations and seed data.
2. Home + Join Queue: validation, service totals, duplicate phone check and token creation.
3. My Status: token, position, approximate wait and status messages.
4. Reception Dashboard: walk-ins, Call next, cancel and no-show.
5. Barber View: Start/Done and availability.
6. Waiting Area TV and synchronization across views.
7. Owner Settings and statistics.
8. Gujarati review, responsive polish, full test checklist and deployment readiness.

## Quality gates
- No dead buttons, fake success states or silent failures.
- No invalid queue status transitions or barber-preference violations.
- Queue state must survive refreshes for the chosen persistence mode.
- Clearly label local-only mode if no shared hosted data store is configured.
- Run `npm run build` and the manual checklist in `docs/03-flows-rules.md` before calling the prototype complete.
- Do not claim deployment is complete until the live URL has been opened and verified.
- Keep `README.md` ready for submission. If deployed, put the live demo URL immediately below the project title, followed by hosting and demo-access details.

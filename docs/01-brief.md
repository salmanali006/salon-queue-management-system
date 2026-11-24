# Salon Queue Management System — Project Brief & Scope

## 1. Project summary

A mobile-first queue management application for a single salon. Customers can join the live queue remotely or as walk-ins, choose one or more services and a preferred barber, and monitor their turn. Reception staff manage the waiting list, barbers update service progress, a waiting-area display shows current and upcoming tokens, and the owner manages services, staff availability and queue settings.

## 2. Problem

Customers may wait a long time without knowing their place in line or when they will be served. Reception staff need a reliable way to manage walk-ins, customer preferences and no-shows. Barbers and customers also need queue updates without repeatedly asking reception.

## 3. Project goals

- Make joining the queue quick and understandable on a phone.
- Show each customer their token, queue position and approximate waiting time.
- Give reception one place to manage walk-ins and the live queue.
- Let barbers mark a service as started and completed.
- Keep the customer status, reception dashboard, barber views and waiting-area display consistent.
- Provide a readable waiting-area display and an English/Gujarati language option.
- Deliver a polished working prototype suitable for a live demonstration.

## 4. Users and roles

| User | Main needs |
|---|---|
| Customer | Join the queue, select services and a barber, see status and wait estimate, cancel while waiting. |
| Receptionist | Add walk-ins, see and manage the waiting list, call the next eligible customer, mark no-shows and cancellations. |
| Barber | See the customer assigned to them, start and finish a service, set availability/on-break status. |
| Owner | Manage services, set which barbers are on duty, open or close online joining, review today's basic statistics. |

## 5. Must-have features

1. **Customer queue joining:** collect name and 10-digit Indian mobile number; allow selection of 1–3 services and one barber or “Any barber”.
2. **Live customer status:** issue a unique token (for example, `S-14`), show queue position and approximate wait, show “Start coming” when the customer is second in line, and show “It's your turn!” when called.
3. **Reception dashboard:** show barber cards and the ordered waiting list; add walk-ins; call next; mark no-show; cancel an eligible waiting entry.
4. **Barber view:** show the assigned/current customer and selected services; allow Start and Done; allow Available/On break status.
5. **Waiting-area display:** show each barber, the token currently with them, and the next five tokens with estimated times; visually highlight a newly called token and play a subtle chime where browser permissions allow.
6. **Owner settings:** manage service names in English/Gujarati, duration, price and active state; set barbers on duty; open/close online joining; show customers served, average wait and no-shows for today.
7. **English/Gujarati interface:** all user-facing labels, buttons, statuses, validation messages and notifications must switch with the language toggle.

## 6. Screens and routes

The application has these seven primary screens (details are in `docs/02-screens.md`):

| Screen | Route | Primary user | Layout priority |
|---|---|---|---|
| Home | `/` | Customer | Mobile-first |
| Join Queue | `/join` | Customer | Mobile-first |
| My Status | `/status/:id` | Customer | Mobile-first |
| Reception Dashboard | `/reception` | Receptionist | 10-inch tablet, landscape |
| Barber View | `/barber/:barberId` | Barber | Phone |
| Waiting Area TV | `/display` | Waiting customers | Large TV / landscape |
| Owner Settings | `/admin` | Owner | Tablet / desktop |

## 7. Demo data and explicit assumptions

The handout gives example salon data. Use the following as **editable demo seed data**, not as claims about a real salon:

### Demo barbers
- Ravi
- Amit
- Imran

### Demo services

| Service | Duration | Price |
|---|---:|---:|
| Haircut | 30 min | ₹150 |
| Beard trim | 15 min | ₹80 |
| Hair spa | 45 min | ₹400 |

The owner must be able to edit these values and activate/deactivate services. Use INR (₹). The handout's example closing time is 9:00 PM; use this as the initial demo closing time, editable in settings. The opening time is not specified, so do not invent a fixed opening time; use an Open/Closed control or a configurable value.

Additional implementation assumptions for this prototype:
- One salon branch only.
- The first token is `S-1`; tokens increment for each new queue entry during the running demo. A re-added no-show receives a new token.
- A phone number can have only one active queue entry at a time.
- Staff screens are demonstration screens, not production-secured administration. Use synthetic/demo customer data only; do not present the prototype as suitable for storing real customer information.
- The user interface defaults to English and offers a visible English/Gujarati toggle.
- The app must retain queue data across page refreshes. Before implementation, the coding agent must explain its storage and synchronization choice. A shared hosted data store is needed for true synchronization across different devices. If no credentials or hosted store are available, a local-only fallback may be used for the demonstration, but it must be clearly identified as local-only and must not be described as cross-device synchronization.

## 8. Non-goals — do not build

- Online payments or payment gateway integration.
- Future-date appointments, calendar booking or time-slot reservations.
- SMS, WhatsApp or paid push-notification integrations.
- Loyalty points, memberships or rewards.
- Multiple salon branches or branch switching.
- Complex analytics, payroll, inventory or accounting.
- A production-grade authentication/authorization system.
- A custom database schema or API designed manually before the agent has proposed the simplest workable storage approach.

## 9. Look and feel

Premium, clean salon experience: dark charcoal `#1F2937` with gold `#D4A017` accents, rounded cards, strong readable typography, clear status colours and generous touch targets. Customer screens are mobile-first; the reception screen is optimized for a 10-inch tablet in landscape; the TV screen uses large text readable from approximately five metres. Avoid clutter and keep the main action obvious on every screen.

## 10. Quality and acceptance criteria

The prototype is acceptable when:
- All seven routes load and have a clear, usable layout at their target screen sizes.
- A customer can join with valid details, select up to three services, choose a barber and receive a token.
- The displayed service total, price and queue position update correctly.
- Duplicate active phone numbers do not create duplicate queue entries.
- Reception can add a walk-in, call the next eligible customer, cancel an eligible waiting entry and mark a called customer as a no-show.
- Barber Start/Done actions update the queue and related views.
- The TV display shows current assignments and up to five upcoming tokens.
- Owner changes to service availability, barber duty and online queue status affect the customer joining flow.
- English/Gujarati switching covers all visible interface text.
- The tests in `docs/03-flows-rules.md` are run and reported honestly.

## 11. Priorities for the three-hour build

**P0 — must work:** Home, Join Queue, My Status, reception queue management, correct barber assignment, barber Start/Done, persistence, responsive layout.

**P1 — important:** TV display, owner settings, English/Gujarati translations, no-show and break edge cases, today's statistics.

**P2 — polish:** subtle animation, chime, refined empty states, visual details and deployment polish.

Build P0 before spending time on decorative polish. Do not silently drop a P0 feature; report any limitation clearly.

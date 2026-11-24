# Salon Queue Management System — Screens & Features

This document is the UI and interaction source of truth. Build the seven screens below. Keep the shared charcoal/gold theme consistent and use the English/Gujarati language dictionary for every visible string.

## Global UI requirements

- Theme: charcoal `#1F2937`, gold `#D4A017`, light neutral surfaces, readable contrast, rounded cards.
- Default language: English. Provide a visible `EN | ગુજરાતી` toggle. Persist the selected language for the current browser.
- Use reusable components for service cards, barber cards, status badges, token displays, queue rows, confirmation dialogs and empty states.
- Minimum touch target on phone: 44 × 44 px.
- Show clear loading, empty, validation and error states. Do not leave buttons that look active but do nothing.
- Use Indian number formatting and INR prices (for example `₹150`).
- Seed data: barbers Ravi, Amit, Imran; services Haircut (30 min, ₹150), Beard trim (15 min, ₹80), Hair spa (45 min, ₹400). Treat these as editable demo data.
- Use responsive layouts, not separate unrelated implementations for each device.

## Screen 1: Home (`/`)

**User and purpose:** Customer landing page; explain the live queue and make joining easy.

**Top to bottom:**
1. Salon name/logo placeholder and current queue state badge (`Open` / `Closed`). When known, show the configured closing time (demo default: 9:00 PM).
2. Live queue summary card: number of customers waiting and approximate current wait.
3. Barber status row/cards: barber name and `Available`, `Busy` or `On break` status. A barber not on duty should be shown as unavailable/not on duty.
4. Primary gold `[Join Queue]` button.
5. Short note explaining that walk-ins are also accepted, where appropriate.
6. Language toggle in a visible, consistent location.

**Interactions:**
- `[Join Queue]` navigates to `/join` when online joining is open.
- When online joining is closed or it is within 30 minutes of closing, disable the online join action and show a clear explanation. Reception can still add walk-ins.
- Barber status and queue summary reflect the latest available queue data.

**Responsive behaviour:** Single-column on phones; compact centered content on tablet/desktop.

**States:** If nobody is waiting, show a friendly empty state such as “No one waiting — walk right in!”. If no barbers are working, explain that service is currently unavailable rather than showing a misleading wait estimate.

## Screen 2: Join Queue (`/join`)

**User and purpose:** Customer creates one queue entry.

**Form, top to bottom:**
1. Name field (required).
2. Mobile number field (required; exactly 10 digits for this prototype).
3. Service cards. Support selecting 1–3 active services. Each card shows service name, duration and price. Prevent selection of inactive services and selection of more than three services.
4. Barber picker: `Any barber (fastest)` plus available/on-duty barbers. Show a status for each barber; do not allow choosing a barber who is off duty or on break.
5. Live summary: selected service count, combined duration, combined price and approximate expected wait.
6. `[Confirm & Join Queue]` primary button.

**Interactions and validation:**
- Total duration is the sum of selected service durations. Total price is the sum of selected service prices.
- Require at least one service and no more than three.
- Validate the phone number as exactly 10 digits; show a friendly inline error.
- If that phone number already has an active entry, do not create another. Show the existing token and link to its status screen.
- On success, create a new token (`S-1`, `S-2`, …), append the customer to the end of the waiting queue, and navigate to `/status/:id`.
- If online joining is closed, disable submission and explain that walk-ins can still be added by reception.
- Do not charge or collect payment.

**Responsive behaviour:** Stacked fields and full-width service cards/buttons on mobile; compact form on larger screens.

**States:** Empty service selection, validation errors, duplicate active phone number, closed online queue, unavailable barber, submitting and successful submission.

## Screen 3: My Status (`/status/:id`)

**User and purpose:** Customer tracks their queue entry.

**Top to bottom:**
1. Large token display (for example `S-14`).
2. Current status badge: `Waiting`, `Called`, `In chair`, `Done`, `Cancelled` or `No-show` as applicable.
3. Queue position (for waiting customers) and approximate wait.
4. Selected services, selected barber or `Any barber`, and the customer's name.
5. Contextual banner:
   - When second in line: “Start coming to the salon”.
   - When called: full-screen or prominent gold treatment with “It's your turn! Go to [Barber name]”.
6. `[Cancel my spot]` button while the entry is still `Waiting`.

**Interactions:**
- Status, position and wait update when the shared queue state changes.
- `[Cancel my spot]` opens a confirmation dialog. Confirming changes `Waiting` to `Cancelled`; dismissing leaves the entry unchanged.
- Once called, do not offer customer cancellation; the receptionist handles a missed call using the No-show action.
- When `Done`, show a clear completion message. For `No-show` or `Cancelled`, explain that the active spot has ended.

**Responsive behaviour:** Prioritize the token, status and next action on the first phone viewport. Keep the gold called state legible and accessible.

**States:** Waiting, second in line, Called, In chair, Done, Cancelled, No-show, missing/invalid token and connection/update unavailable.

## Screen 4: Reception Dashboard (`/reception`)

**User and purpose:** Receptionist manages the whole live queue. Optimize first for a 10-inch tablet in landscape.

**Header:** Salon name, queue Open/Closed indicator, current time if available, language toggle and `[+ Add walk-in]` button.

**Barber area:**
- Display one card per barber in a clear row/grid (three columns works for the demo).
- Show barber name, availability/on-break state, current customer/token, services and elapsed service time or time since call.
- Show `[Call next]` when the barber is working/available and has no active customer. Disable it when busy, off duty, on break or no eligible customer exists.

**Waiting list:**
- Show entries in first-come-first-served order.
- Each row includes token, customer name, services, preferred barber (`Any` or a name), time waiting and current status.
- Provide `[No-show]` for a called customer after the 10-minute grace period.
- Provide `[Cancel]` for an entry still in `Waiting` status, with confirmation.
- Highlight customers waiting more than 60 minutes in amber.
- Show a clear empty state when nobody is waiting.

**Add walk-in form:**
- Open from `[+ Add walk-in]`.
- Collect name, 10-digit phone, 1–3 services and preferred barber or `Any`.
- Apply the same validation, duplicate-phone rule, totals and token generation as online joining.
- Successful walk-in joins the end of the same queue.

**Interactions:**
- `[Call next]` applies the exact barber-preference rules in `docs/03-flows-rules.md`; it must not skip an earlier eligible customer.
- Calling a customer changes their state to `Called`, assigns the barber, and updates My Status and the TV display.
- No-show and Cancel actions require a confirmation step and update all views.
- Reception changes must appear in other connected views within five seconds when the selected storage/sync approach supports live sync.

**Responsive behaviour:** Tablet landscape is the target. On a narrow screen, stack barber cards above the waiting list and preserve usable action buttons.

**States:** Empty queue, all barbers busy, no eligible customer for a particular barber, closed online joining, loading and sync error.

## Screen 5: Barber View (`/barber/:barberId`)

**User and purpose:** A barber manages their own service progress. Optimize for a phone.

**Top to bottom:**
1. Barber name and state (`Available`, `Busy`, `On break`, `Off duty`).
2. Current customer card: token, customer name, selected services and preferred service duration.
3. Large action button:
   - For a called customer: `[Start]` changes `Called` to `In chair` and starts the elapsed-service timer.
   - For an in-chair customer: `[Done]` changes `In chair` to `Done` and clears the barber's active customer.
4. `Next for you` preview: earliest waiting customer eligible for this barber, with token and service summary.
5. Availability control: `[On break]` / `[Available]` where applicable. A barber cannot be marked Available if off duty in owner settings.

**Interactions:**
- Start and Done update Reception, the customer's status and the TV display.
- A barber can have only one customer in the chair at a time.
- On break prevents new assignments to that barber. It does not reassign customers who explicitly selected that barber.

**Responsive behaviour:** Large text and full-width touch actions; make the current customer the most prominent element.

**States:** No current customer, Called, In chair, Done, On break, Off duty and sync error.

## Screen 6: Waiting Area TV (`/display`)

**User and purpose:** Public view for customers waiting inside the salon. Optimize for a large landscape TV and readability from approximately five metres.

**Layout:**
- Prominent salon name and queue/open status.
- One row/card per barber with barber name, status and `Now: S-xx` (or `Available`).
- A clearly separated `Up next` list showing up to five upcoming tokens and approximate times.
- Newly called token receives a gold highlight/brief pulse and a subtle chime where browser audio is permitted.
- Do not expose customer phone numbers. Use token and, if needed, first name only.

**Interactions:**
- Update automatically when Reception or Barber View changes the queue.
- The chime must not block the page if audio is disallowed; visual highlighting is the fallback.

**Responsive behaviour:** Landscape-first, large high-contrast text, minimal controls and no small tap-dependent elements.

**States:** No one waiting, no active barber, no upcoming tokens and connection/update unavailable.

## Screen 7: Owner Settings (`/admin`)

**User and purpose:** Owner configures the day's salon operation.

**Sections:**
1. **Services:** list active and inactive services; edit English name, Gujarati name, duration in minutes and price; toggle active/inactive. Changes to active services immediately affect Join Queue and Add walk-in.
2. **Barbers on duty:** toggle Ravi, Amit and Imran (and any added demo barber) on duty/off duty. Off-duty barbers cannot receive new assignments.
3. **Queue controls:** Open/Closed switch for online joining. Closing online joining disables customer online submission but does not stop reception walk-ins. Show the configured closing time and apply the 30-minute online-joining cutoff.
4. **Today's stats:** customers served, average wait and no-shows. Use clearly labeled demo-derived values; do not invent data when the underlying event history is unavailable.

**Interactions:**
- Confirm destructive or operational changes when appropriate.
- Turning a service inactive hides it from new queue entries; do not delete old queue history that references it.
- Turning a barber off duty prevents new assignments. Do not silently move an already called or in-chair customer to another barber.
- Closing online joining shows a clear message on Home and Join Queue; walk-ins remain possible.

**Responsive behaviour:** Sections in cards; two-column layout on desktop/tablet where space allows, stacked on mobile.

**States:** No services configured, no barbers on duty, queue closed and settings save error.

## Shared interaction and visual rules

- Use status labels consistently across every screen.
- Do not show a fake countdown that decreases independently of queue data. The displayed wait is an estimate and should recalculate when the queue changes.
- Show disabled-button reasons, not just disabled controls.
- All errors should explain what the user can do next.
- Use confirmation dialogs for cancellation and no-show actions.
- Keep the main action visually dominant, and do not add screens/features outside this specification without first updating this document.

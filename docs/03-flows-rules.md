# Salon Queue Management System — Flows, Rules & Test Checklist

This document is the source of truth for queue behaviour. Implement the rules once in shared application logic and reuse them across Customer, Reception, Barber and TV screens.

## 1. Main flow: remote customer

1. Customer opens Home (`/`) and checks whether online joining is open.
2. Customer selects Join Queue and enters name and 10-digit phone number.
3. Customer selects 1–3 active services and chooses a named barber or `Any barber`.
4. The app validates the details, calculates combined service duration and price, and checks for an existing active entry with the same phone number.
5. If valid and not duplicated, the app creates a new token (for example `S-14`) and appends the entry to the end of the waiting queue.
6. Customer is sent to My Status (`/status/:id`) and sees token, position and estimated wait.
7. When the customer is second in line, show “Start coming to the salon”.
8. Reception calls the next eligible customer for a barber. The entry becomes `Called` and is assigned to that barber.
9. Customer sees “It's your turn! Go to [Barber]”; the TV highlights the token.
10. Barber taps Start; status becomes `In chair`.
11. Barber taps Done; status becomes `Done`, the barber becomes available, and the active queue position/wait estimates are recalculated.

## 2. Main flow: walk-in customer

1. Receptionist taps `[+ Add walk-in]` on the Reception Dashboard.
2. Receptionist enters the customer's name, phone, service selection and barber preference.
3. The same validation and duplicate active phone-number check used by online joining is applied.
4. A valid walk-in receives a new token and joins the end of the same waiting queue.
5. The entry follows the same Call next → Start → Done workflow as an online customer.

## 3. Queue statuses and allowed transitions

Use these exact status names in the data model and translate their visible labels in the UI.

| Current status | Allowed next status | Trigger |
|---|---|---|
| `Waiting` | `Called` | Reception calls this customer for an eligible barber. |
| `Waiting` | `Cancelled` | Customer or receptionist cancels the waiting spot (with confirmation). |
| `Called` | `In chair` | Assigned barber taps Start. |
| `Called` | `No-show` | Reception marks the customer no-show after the 10-minute grace period. |
| `In chair` | `Done` | Assigned barber taps Done. |

No other backward or direct transitions are allowed. In particular, do not move `Called` back to `Waiting`, do not cancel a `Called` customer through the normal Cancel action, and do not move a `Done`, `Cancelled` or `No-show` entry back into the active queue. If a no-show customer returns, create a new queue entry at the end with a new token.

## 4. First-come-first-served ordering

- Maintain one ordered waiting list for the salon.
- A new online customer or walk-in is appended to the end of that list.
- The ordering key is the time/sequence at which the entry joined. Use a stable sequence as a tie-breaker so two simultaneous joins still have a deterministic order.
- Calling a customer removes that entry from the waiting list and changes it to `Called`; it does not delete its history.
- Cancelled and No-show entries are not active waiting entries.
- A customer who is re-added after a no-show receives a new token and joins at the end.

## 5. Barber selection and Call next rules

When the receptionist taps `[Call next]` for barber X:

1. Confirm barber X is on duty, available and not already serving/called for another customer.
2. Search the waiting list from oldest to newest.
3. Select the earliest customer whose preference is either barber X or `Any barber`.
4. Skip entries that explicitly selected a different named barber.
5. Never assign a customer who selected Ravi to Amit or Imran (and apply the same rule to every named barber).
6. Assign the selected customer to barber X and transition the customer from `Waiting` to `Called`.
7. If there is no eligible customer, leave the queue unchanged and show a clear “No eligible customer waiting for this barber” message.

A customer who selected `Any barber` may be assigned to the first available barber whose Call next action successfully claims that customer. If several staff views are open, the update must avoid assigning the same `Any barber` entry to two barbers; use the chosen shared storage mechanism's atomic update/transaction where available.

A barber has only one active customer at a time. For this prototype, a barber is considered occupied from `Called` until the entry becomes `Done` or `No-show`. A barber on break or off duty cannot receive new assignments. Customers who explicitly selected a barber on break remain associated with that barber; do not silently reassign them.

## 6. Waiting-time and position rules

- Queue position is based on the ordered `Waiting` entries, not on historical `Called`, `In chair`, `Done`, `Cancelled` or `No-show` entries.
- For a waiting customer, position 1 means they are the next waiting entry in the overall ordered list; position 2 triggers the “Start coming” message.
- Use the handout's simple approximate estimate: **sum the estimated service minutes for the waiting customers ahead, then divide by the number of barbers working**. Round up to a whole minute for display.
- This is an approximate salon-wide estimate, not a guaranteed appointment time. Label it `Approx. wait` or equivalent.
- If there are no barbers working, do not divide by zero; show an unavailable message instead of a numeric estimate.
- Recalculate position and wait when a customer joins, is called, is cancelled, becomes a no-show, starts/finishes service, or when barber duty changes.

## 7. Cancellation, no-show and duplicate rules

- A customer may cancel their own spot only while status is `Waiting`; ask for confirmation first.
- Reception may cancel an entry only while status is `Waiting`; ask for confirmation first.
- When a customer is called, start a 10-minute grace period. After 10 minutes, reception may mark the entry `No-show`.
- Do not automatically mark no-shows; the handout says the receptionist can mark them.
- If a no-show customer later arrives, receptionist adds them again as a new walk-in. They receive a new token at the end of the queue.
- Only one active queue entry is allowed per phone number. Active means `Waiting`, `Called` or `In chair`.
- If the phone number already has an active entry, do not create another; show the existing token/status and offer its status page.
- Validate a phone number as exactly 10 digits in this prototype.

## 8. Opening, closing and online joining

- Owner can set online joining Open or Closed.
- Online joining closes 30 minutes before the configured closing time, even if the Open switch has not yet been manually changed.
- When online joining is closed, disable the Join action and show a clear explanation.
- Reception walk-ins remain allowed while online joining is closed.
- The handout's sample closing time is 9:00 PM. Use it only as the initial editable demo value; do not hard-code it throughout the app.

## 9. Service and barber settings

- Each service has English name, Gujarati name, duration in minutes, price and active/inactive state.
- Only active services may be selected for new entries.
- Existing queue entries retain the service name, duration and price that were selected when they joined; changing a service later must not silently rewrite an existing customer's selection or total.
- Owner can mark barbers on duty/off duty.
- Barber can toggle Available/On break when on duty and not occupied.
- Off-duty or on-break barbers cannot receive new customers.
- A barber with a customer in `Called` or `In chair` remains occupied until the status becomes `No-show` or `Done`.

## 10. Cross-screen updates and persistence

- The queue must survive a browser refresh.
- Reception, My Status, Barber View and TV Display must reflect queue changes within five seconds when a shared live data store is configured.
- Before implementing storage, the coding agent must explain its choice and distinguish between same-browser synchronization and true cross-device synchronization.
- Preferred approach when credentials/configuration are available: a small shared hosted data store with real-time updates. If this cannot be configured within the lab, a local demo fallback is acceptable, but the UI/documentation must clearly disclose that it is local-only and cannot synchronize separate devices.
- A failed update must show an error and must not falsely display a successful state transition.

## 11. Statistics

- `Customers served`: count entries that reached `Done` today.
- `No-shows`: count entries that reached `No-show` today.
- `Average wait`: average actual waiting time for entries served today, measured from queue join to service start. If the required timestamps are unavailable or there are no completed samples, show `—` or `No data` rather than inventing a number.

## 12. Test checklist

Run these tests manually in the browser and record Pass/Fail. Include the result in the final handoff.

- [ ] Join with two services; verify combined duration and price are correct.
- [ ] Attempt to select four services; verify the third-service limit is enforced.
- [ ] Enter an invalid phone number; verify submission is blocked with a useful message.
- [ ] Join twice with the same phone number while the first entry is active; verify no duplicate is created and the existing token is shown.
- [ ] Call next for Amit when the earliest waiting customer selected Ravi; verify the Ravi customer is skipped.
- [ ] Call next for a barber when the earliest eligible entry selected that barber; verify that entry is called before later eligible entries.
- [ ] Verify an `Any barber` customer can be assigned to an available barber and cannot be assigned twice.
- [ ] Verify the customer status changes to “It's your turn!” and the TV highlights the token after Call next.
- [ ] Verify a customer in position 2 sees “Start coming to the salon”.
- [ ] Start and Done on Barber View; verify Reception, My Status and TV update.
- [ ] Mark a called entry No-show after the 10-minute grace period; re-add that person and verify they receive a new token at the end.
- [ ] Cancel a Waiting entry; verify confirmation appears and the entry leaves the active waiting list.
- [ ] Verify cancellation is unavailable after an entry is Called.
- [ ] Close online joining; verify customer Join is disabled with a message, while Reception can still add a walk-in.
- [ ] Toggle a service inactive; verify it disappears from new customer/walk-in forms but existing entries remain intact.
- [ ] Put a barber on break; verify Call next cannot assign new customers to that barber.
- [ ] Verify waiting longer than 60 minutes is highlighted in amber.
- [ ] Switch to Gujarati; verify labels, buttons, statuses, errors and notifications all translate.
- [ ] Verify queue state survives refresh.
- [ ] Open separate views and verify updates arrive within five seconds for the configured storage mode; record whether this is same-browser only or cross-device.
- [ ] Check phone, tablet-landscape and TV-landscape layouts for overflow and readable tap targets/text.

## 13. Known prototype limits to disclose

- Waiting time is an estimate based on the handout's simple formula and is not a guaranteed service time.
- Without a configured shared hosted store, queue data is local to the browser/device and will not synchronize across separate devices.
- Demo staff routes are not production-secured. Use fictional data only.
- Browser audio may be blocked until a user interacts with the page; the TV's visual highlight remains the fallback.

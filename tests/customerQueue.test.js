import test from 'node:test';
import assert from 'node:assert/strict';
import { seedData } from '../src/data/seed.js';
import {
  activeServices,
  approximateWait,
  callNextCustomer,
  cancelWaitingCustomer,
  completeBarberService,
  eligibleWaitingEntries,
  findActivePhone,
  getCustomerQueueStatus,
  joinCustomer,
  markNoShow,
  onlineQueueOpen,
  serviceTotals,
  setBarberBreak,
  setBarberOnDuty,
  startBarberService,
  todayStatistics,
  updateService,
  validateJoin,
} from '../src/domain/customerQueue.js';

const stateWithQueue = queue => ({ ...structuredClone(seedData), queue });
const now = new Date('2026-05-14T12:00:00.000Z');
const input = (overrides = {}) => ({
  name: 'Demo Customer', phone: '9876543210', serviceIds: ['haircut'], barberId: 'any', ...overrides,
});
const waitingEntry = (id, sequence, barberId = 'any', overrides = {}) => ({
  id, token: `S-${sequence}`, tokenNumber: sequence, name: `Customer ${sequence}`, phone: `900000${String(sequence).padStart(4, '0')}`,
  serviceIds: ['haircut'], services: [{ id: 'haircut', name: { en: 'Haircut', gu: 'વાળ કાપવા' }, durationMinutes: 30, priceInr: 150 }],
  durationMinutes: 30, priceInr: 150, barberId, joinedAt: new Date(now.getTime() + sequence * 1000).toISOString(), status: 'Waiting', sequence, ...overrides,
});

test('AQ-01 validates names, Indian phone length, selected services and active service state', () => {
  const base = structuredClone(seedData);
  assert.equal(validateJoin(base, input({ name: '   ' })), 'nameRequired');
  assert.equal(validateJoin(base, input({ phone: '123456789' })), 'phoneInvalid');
  assert.equal(validateJoin(base, input({ phone: '12345678901' })), 'phoneInvalid');
  assert.equal(validateJoin(base, input({ serviceIds: [] })), 'serviceRequired');
  base.services.push({ id: 'fourth', name: { en: 'Fourth', gu: 'ચોથી' }, durationMinutes: 10, priceInr: 10, active: true });
  assert.equal(validateJoin(base, input({ serviceIds: ['haircut', 'beard-trim', 'hair-spa', 'fourth'] })), 'serviceLimit');
  base.services[1].active = false;
  assert.equal(validateJoin(base, input({ serviceIds: ['haircut', 'beard-trim'] })), 'serviceUnavailable');
});

test('AQ-02 calculates selected service duration and price from configured services', () => {
  const chosen = seedData.services.filter(service => ['haircut', 'beard-trim'].includes(service.id));
  assert.deepEqual(serviceTotals(chosen), { minutes: 45, price: 230 });
});

test('AQ-03 issues sequential tokens and appends entries to the queue tail', () => {
  const first = joinCustomer(structuredClone(seedData), input(), now);
  assert.equal(first.entry.token, 'S-1');
  const second = joinCustomer(first.nextState, input({ phone: '9876543211' }), new Date(now.getTime() + 1000));
  assert.equal(second.entry.token, 'S-2');
  assert.deepEqual(second.nextState.queue.map(entry => entry.token), ['S-1', 'S-2']);
});

test('AQ-04 duplicate-phone detection blocks active entries but permits ended entries', () => {
  for (const status of ['Waiting', 'Called', 'In chair']) {
    const state = stateWithQueue([waitingEntry('existing', 1, 'ravi', { status, phone: '9876543210' })]);
    assert.equal(findActivePhone(state, '9876543210').id, 'existing');
    assert.ok(joinCustomer(state, input(), now).duplicate);
  }
  for (const status of ['Done', 'Cancelled', 'No-show']) {
    const state = stateWithQueue([waitingEntry('ended', 1, 'ravi', { status, phone: '9876543210' })]);
    assert.equal(findActivePhone(state, '9876543210'), null);
    assert.equal(joinCustomer(state, input(), now).entry.token, 'S-2');
  }
});

test('AQ-05 online joining closes at the exact 30-minute cutoff while walk-ins remain allowed', () => {
  const state = structuredClone(seedData);
  state.settings.closingTime = '21:00';
  assert.equal(onlineQueueOpen(state, new Date(2026, 4, 14, 20, 29)), true);
  assert.equal(onlineQueueOpen(state, new Date(2026, 4, 14, 20, 30)), false);
  const closed = joinCustomer(state, input(), new Date(2026, 4, 14, 20, 30));
  assert.equal(closed.error, 'queueClosed');
  const walkIn = joinCustomer(state, input(), new Date(2026, 4, 14, 20, 30), { walkIn: true });
  assert.equal(walkIn.entry.token, 'S-1');
});

test('AQ-31 cutoff and daily statistics use the configured salon timezone', () => {
  const state = structuredClone(seedData);
  state.settings.timeZone = 'Asia/Kolkata';
  state.settings.closingTime = '21:00';
  assert.equal(onlineQueueOpen(state, new Date('2026-05-14T14:59:00.000Z')), true);
  assert.equal(onlineQueueOpen(state, new Date('2026-05-14T15:00:00.000Z')), false);
  state.queue = [waitingEntry('done-salon-today', 1, 'ravi', {
    status: 'Done', joinedAt: '2026-05-14T17:00:00.000Z',
    startedAt: '2026-05-14T17:20:00.000Z', doneAt: '2026-05-14T18:40:00.000Z',
  })];
  assert.deepEqual(todayStatistics(state, new Date('2026-05-14T18:45:00.000Z')), { served: 1, noShows: 0, averageWait: 20 });
});

test('AQ-06 Call next skips a different named barber preference and selects the earliest eligible entry', () => {
  const state = stateWithQueue([
    waitingEntry('ravi-first', 1, 'ravi'),
    waitingEntry('any-second', 2, 'any'),
    waitingEntry('amit-third', 3, 'amit'),
  ]);
  const result = callNextCustomer(state, 'amit', now);
  assert.equal(result.entry.id, 'any-second');
  assert.equal(result.entry.status, 'Called');
  assert.equal(result.entry.barberId, 'amit');
  assert.equal(result.nextState.queue.find(entry => entry.id === 'ravi-first').status, 'Waiting');
});

test('AQ-07 Call next chooses the oldest entry specifically assigned to the selected barber', () => {
  const state = stateWithQueue([
    waitingEntry('other-first', 1, 'ravi'),
    waitingEntry('amit-second', 2, 'amit'),
    waitingEntry('amit-third', 3, 'amit'),
  ]);
  const result = callNextCustomer(state, 'amit', now);
  assert.equal(result.entry.id, 'amit-second');
});

test('AQ-08 Any barber entries are claimed once and an occupied barber cannot receive another', () => {
  const state = stateWithQueue([waitingEntry('any', 1, 'any')]);
  const first = callNextCustomer(state, 'ravi', now);
  assert.equal(first.ok, true);
  const second = callNextCustomer(first.nextState, 'amit', now);
  assert.equal(second.error, 'noEligibleCustomer');
  const occupied = callNextCustomer(first.nextState, 'ravi', now);
  assert.equal(occupied.error, 'barberOccupied');
  assert.equal(first.nextState.queue.filter(entry => entry.id === 'any' && entry.status === 'Called').length, 1);
});

test('AQ-09 Call next rejects off-duty and on-break barbers and leaves waiting entries unchanged', () => {
  for (const barber of [
    { id: 'ravi', onDuty: false, availability: 'available' },
    { id: 'ravi', onDuty: true, availability: 'break' },
  ]) {
    const state = stateWithQueue([waitingEntry('ravi-entry', 1, 'ravi')]);
    state.barbers = state.barbers.map(item => item.id === 'ravi' ? { ...item, ...barber } : item);
    const result = callNextCustomer(state, 'ravi', now);
    assert.equal(result.error, 'barberUnavailable');
    assert.equal(state.queue[0].status, 'Waiting');
  }
});

test('AQ-10 Start and Done use only Called and In-chair transitions', () => {
  const called = callNextCustomer(stateWithQueue([waitingEntry('customer', 1, 'ravi')]), 'ravi', now);
  const started = startBarberService(called.nextState, 'ravi', new Date(now.getTime() + 1000));
  assert.equal(started.entry.status, 'Called');
  assert.equal(started.nextState.queue[0].status, 'In chair');
  assert.equal(started.nextState.queue[0].startedAt, new Date(now.getTime() + 1000).toISOString());
  const done = completeBarberService(started.nextState, 'ravi', new Date(now.getTime() + 60000));
  assert.equal(done.nextState.queue[0].status, 'Done');
  assert.equal(startBarberService(stateWithQueue([waitingEntry('waiting', 1, 'ravi')]), 'ravi', now).error, 'noCalledCustomer');
  assert.equal(completeBarberService(called.nextState, 'ravi', now).error, 'noInChairCustomer');
});

test('AQ-11 barber break is allowed only while on duty and unoccupied', () => {
  const available = structuredClone(seedData);
  const onBreak = setBarberBreak(available, 'ravi', true);
  assert.equal(onBreak.nextState.barbers.find(barber => barber.id === 'ravi').availability, 'break');
  assert.equal(callNextCustomer({ ...onBreak.nextState, queue: [waitingEntry('ravi-entry', 1, 'ravi')] }, 'ravi', now).error, 'barberUnavailable');
  const called = callNextCustomer(stateWithQueue([waitingEntry('assigned', 1, 'ravi')]), 'ravi', now);
  assert.equal(setBarberBreak(called.nextState, 'ravi', true).error, 'barberOccupied');
  const offDuty = { ...available, barbers: available.barbers.map(barber => barber.id === 'ravi' ? { ...barber, onDuty: false } : barber) };
  assert.equal(setBarberBreak(offDuty, 'ravi', true).error, 'barberUnavailable');
});

test('AQ-12 No-show requires the manual action and the full 10-minute grace period', () => {
  const called = callNextCustomer(stateWithQueue([waitingEntry('called', 1, 'ravi')]), 'ravi', now).nextState;
  assert.equal(markNoShow(called, 'called', new Date(now.getTime() + 599999)).error, 'gracePeriod');
  assert.equal(called.queue[0].status, 'Called');
  const noShow = markNoShow(called, 'called', new Date(now.getTime() + 600000));
  assert.equal(noShow.nextState.queue[0].status, 'No-show');
  const rejoined = joinCustomer(noShow.nextState, input(), new Date(now.getTime() + 601000));
  assert.equal(rejoined.entry.token, 'S-2');
  assert.equal(rejoined.nextState.queue.at(-1).status, 'Waiting');
});

test('AQ-13 cancellation is permitted only while Waiting', () => {
  const waiting = stateWithQueue([waitingEntry('waiting', 1, 'ravi')]);
  assert.equal(cancelWaitingCustomer(waiting, 'waiting', now).nextState.queue[0].status, 'Cancelled');
  const called = callNextCustomer(waiting, 'ravi', now).nextState;
  assert.equal(cancelWaitingCustomer(called, 'waiting', now).error, 'notWaiting');
});

test('AQ-14 queue position and approximate wait use ordered waiting entries and working barbers', () => {
  const state = stateWithQueue([waitingEntry('first', 1), waitingEntry('second', 2)]);
  const result = getCustomerQueueStatus(state, 'second');
  assert.equal(result.position, 2);
  assert.equal(result.waitMinutes, 10);
  assert.equal(getCustomerQueueStatus(state, 'first').position, 1);
});

test('AQ-15 approximate wait is unavailable with zero working barbers', () => {
  const state = structuredClone(seedData);
  state.barbers = state.barbers.map(barber => ({ ...barber, onDuty: false }));
  assert.equal(approximateWait(state, 45), null);
});

test('AQ-16 TV eligible list is ordered, capped at five and excludes unavailable preferences', () => {
  const state = stateWithQueue(Array.from({ length: 7 }, (_, index) => waitingEntry(`any-${index + 1}`, index + 1, 'any')));
  state.queue.push(waitingEntry('ravi-only', 8, 'ravi'));
  state.barbers = state.barbers.map(barber => barber.id === 'ravi' ? { ...barber, availability: 'break' } : barber);
  const eligible = eligibleWaitingEntries(state);
  assert.deepEqual(eligible.map(entry => entry.id), ['any-1', 'any-2', 'any-3', 'any-4', 'any-5']);
  assert.equal(eligible.length, 5);
});

test('AQ-17 service edits affect new joins but preserve existing queue service snapshots', () => {
  const original = joinCustomer(structuredClone(seedData), input({ serviceIds: ['haircut', 'beard-trim'] }), now);
  const updated = updateService(original.nextState, 'haircut', { name: { en: 'Classic cut', gu: 'ક્લાસિક કટ' }, durationMinutes: 40, priceInr: 175 });
  assert.equal(updated.nextState.services.find(service => service.id === 'haircut').priceInr, 175);
  assert.deepEqual(updated.nextState.queue[0].services[0], original.entry.services[0]);
  const inactive = updateService(updated.nextState, 'haircut', { active: false });
  assert.equal(activeServices(inactive.nextState).some(service => service.id === 'haircut'), false);
  assert.deepEqual(inactive.nextState.queue[0].services[0], original.entry.services[0]);
});

test('AQ-18 daily statistics count actual Done and No-show timestamps and omit missing wait samples', () => {
  const state = stateWithQueue([
    waitingEntry('done-today', 1, 'ravi', { status: 'Done', joinedAt: '2026-05-14T10:00:00.000Z', startedAt: '2026-05-14T10:20:00.000Z', doneAt: '2026-05-14T10:50:00.000Z' }),
    waitingEntry('done-incomplete', 2, 'amit', { status: 'Done', joinedAt: '2026-05-14T11:00:00.000Z', doneAt: '2026-05-14T11:30:00.000Z' }),
    waitingEntry('no-show-today', 3, 'imran', { status: 'No-show', noShowAt: '2026-05-14T11:00:00.000Z' }),
    waitingEntry('done-yesterday', 4, 'ravi', { status: 'Done', joinedAt: '2026-05-13T10:00:00.000Z', startedAt: '2026-05-13T10:15:00.000Z', doneAt: '2026-05-13T10:30:00.000Z' }),
  ]);
  assert.deepEqual(todayStatistics(state, now), { served: 2, noShows: 1, averageWait: 20 });
  const noSamples = stateWithQueue([waitingEntry('incomplete', 1, 'ravi', { status: 'Done', doneAt: now.toISOString() })]);
  assert.equal(todayStatistics(noSamples, now).averageWait, null);
});

test('AQ-19 taking a barber off duty preserves existing customer assignment', () => {
  const called = callNextCustomer(stateWithQueue([waitingEntry('assigned', 1, 'ravi')]), 'ravi', now).nextState;
  const updated = setBarberOnDuty(called, 'ravi', false).nextState;
  assert.equal(updated.barbers.find(barber => barber.id === 'ravi').onDuty, false);
  assert.equal(updated.queue[0].barberId, 'ravi');
  assert.equal(updated.queue[0].status, 'Called');
});

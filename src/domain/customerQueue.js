const ACTIVE = new Set(['Waiting', 'Called', 'In chair']);

function zonedParts(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' };
  if (timeZone) options.timeZone = timeZone;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', options).formatToParts(date).map(part => [part.type, part.value]));
  return parts;
}

function salonDayKey(value, timeZone) {
  const parts = zonedParts(value, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function onlineQueueOpen(state, now = new Date()) {
  if (!state.settings.onlineOpen) return false;
  const [hours, minutes] = (state.settings.closingTime || '21:00').split(':').map(Number);
  try {
    const current = zonedParts(now, state.settings.timeZone);
    const currentMinutes = Number(current.hour) * 60 + Number(current.minute) + Number(current.second) / 60;
    return hours * 60 + minutes - currentMinutes > 30;
  } catch {
    const closing = new Date(now);
    closing.setHours(hours, minutes, 0, 0);
    return closing.getTime() - now.getTime() > 30 * 60 * 1000;
  }
}

export function activeServices(state) { return state.services.filter(service => service.active); }
export function eligibleBarbers(state) { return state.barbers.filter(barber => barber.onDuty && barber.availability === 'available'); }
export function serviceTotals(services) {
  return services.reduce((total, service) => ({ minutes: total.minutes + Number(service.durationMinutes), price: total.price + Number(service.priceInr) }), { minutes: 0, price: 0 });
}
export function approximateWait(state, durationAhead = 0) {
  const working = state.barbers.filter(barber => barber.onDuty && barber.availability !== 'break').length;
  return working ? Math.ceil(durationAhead / working) : null;
}
export function validateJoin(state, { name, phone, serviceIds, barberId }) {
  if (!name.trim()) return 'nameRequired';
  if (!/^\d{10}$/.test(phone)) return 'phoneInvalid';
  if (!serviceIds.length) return 'serviceRequired';
  if (serviceIds.length > 3) return 'serviceLimit';
  const services = state.services.filter(service => serviceIds.includes(service.id) && service.active);
  if (services.length !== serviceIds.length) return 'serviceUnavailable';
  if (barberId !== 'any' && !eligibleBarbers(state).some(barber => barber.id === barberId)) return 'barberUnavailable';
  return null;
}
export function findActivePhone(state, phone) { return state.queue.find(entry => ACTIVE.has(entry.status) && entry.phone === phone) ?? null; }
export function joinCustomer(state, input, now = new Date(), { walkIn = false } = {}) {
  const error = validateJoin(state, input);
  if (error) return { ok: false, error };
  const duplicate = findActivePhone(state, input.phone);
  if (duplicate) return { ok: false, duplicate };
  if (!walkIn && !onlineQueueOpen(state, now)) return { ok: false, error: 'queueClosed' };
  const services = state.services.filter(service => input.serviceIds.includes(service.id));
  const totals = serviceTotals(services);
  const tokenNumber = Math.max(Number(state.nextTokenNumber) || 1, ...state.queue.map(entry => Number(entry.tokenNumber) + 1 || 1));
  const entry = { id: crypto.randomUUID(), token: `S-${tokenNumber}`, tokenNumber, name: input.name.trim(), phone: input.phone, serviceIds: services.map(service => service.id), services: services.map(service => ({ id: service.id, name: service.name, durationMinutes: service.durationMinutes, priceInr: service.priceInr })), durationMinutes: totals.minutes, priceInr: totals.price, barberId: input.barberId, joinedAt: now.toISOString(), status: 'Waiting', sequence: tokenNumber };
  return { ok: true, entry, nextState: { ...state, nextTokenNumber: tokenNumber + 1, queue: [...state.queue, entry] } };
}
export function callNextCustomer(state, barberId, now = new Date()) {
  const barber = state.barbers.find(item => item.id === barberId);
  if (!barber || !barber.onDuty || barber.availability !== 'available') return { ok: false, error: 'barberUnavailable' };
  if (state.queue.some(entry => entry.barberId === barberId && ['Called', 'In chair'].includes(entry.status))) return { ok: false, error: 'barberOccupied' };
  const waiting = state.queue.filter(entry => entry.status === 'Waiting').sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.joinedAt.localeCompare(b.joinedAt));
  const entry = waiting.find(item => item.barberId === 'any' || item.barberId === barberId);
  if (!entry) return { ok: false, error: 'noEligibleCustomer' };
  const nextState = { ...state, queue: state.queue.map(item => item.id === entry.id ? { ...item, status: 'Called', barberId, calledAt: now.toISOString() } : item) };
  return { ok: true, entry: nextState.queue.find(item => item.id === entry.id), nextState };
}
export function markNoShow(state, entryId, now = new Date()) {
  const entry = state.queue.find(item => item.id === entryId);
  if (!entry || entry.status !== 'Called') return { ok: false, error: 'notCalled' };
  if (!entry.calledAt || now.getTime() - new Date(entry.calledAt).getTime() < 10 * 60 * 1000) return { ok: false, error: 'gracePeriod' };
  return { ok: true, nextState: { ...state, queue: state.queue.map(item => item.id === entryId ? { ...item, status: 'No-show', noShowAt: now.toISOString() } : item) } };
}
export function startBarberService(state, barberId, now = new Date()) {
  const entry = state.queue.find(item => item.barberId === barberId && item.status === 'Called');
  if (!entry) return { ok: false, error: 'noCalledCustomer' };
  return { ok: true, entry, nextState: { ...state, queue: state.queue.map(item => item.id === entry.id ? { ...item, status: 'In chair', startedAt: now.toISOString() } : item) } };
}
export function completeBarberService(state, barberId, now = new Date()) {
  const entry = state.queue.find(item => item.barberId === barberId && item.status === 'In chair');
  if (!entry) return { ok: false, error: 'noInChairCustomer' };
  return { ok: true, entry, nextState: { ...state, queue: state.queue.map(item => item.id === entry.id ? { ...item, status: 'Done', doneAt: now.toISOString() } : item) } };
}
export function setBarberBreak(state, barberId, onBreak) {
  const barber = state.barbers.find(item => item.id === barberId);
  if (!barber || !barber.onDuty) return { ok: false, error: 'barberUnavailable' };
  if (state.queue.some(item => item.barberId === barberId && ['Called', 'In chair'].includes(item.status))) return { ok: false, error: 'barberOccupied' };
  return { ok: true, nextState: { ...state, barbers: state.barbers.map(item => item.id === barberId ? { ...item, availability: onBreak ? 'break' : 'available' } : item) } };
}
export function eligibleWaitingEntries(state) {
  const availableBarberIds = state.barbers.filter(barber => barber.onDuty && barber.availability === 'available' && !state.queue.some(item => item.barberId === barber.id && ['Called', 'In chair'].includes(item.status))).map(barber => barber.id);
  return state.queue.filter(entry => entry.status === 'Waiting' && (entry.barberId === 'any' ? availableBarberIds.length > 0 : availableBarberIds.includes(entry.barberId))).sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.joinedAt.localeCompare(b.joinedAt)).slice(0, 5);
}
export function nextEligibleCustomerForBarber(state, barberId) {
  const barber = state.barbers.find(item => item.id === barberId);
  if (!barber || !barber.onDuty || barber.availability !== 'available') return null;
  const waiting = state.queue.filter(entry => entry.status === 'Waiting').sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.joinedAt.localeCompare(b.joinedAt));
  return waiting.find(entry => entry.barberId === 'any' || entry.barberId === barberId) ?? null;
}
export function updateService(state, serviceId, patch) {
  const target = state.services.find(service => service.id === serviceId);
  if (!target) return { ok: false, error: 'serviceMissing' };
  const name = { ...target.name, ...(patch.name ?? {}) };
  const duration = Number(patch.durationMinutes ?? target.durationMinutes);
  const price = Number(patch.priceInr ?? target.priceInr);
  if (!name.en?.trim() || !name.gu?.trim() || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(price) || price < 0) return { ok: false, error: 'invalidService' };
  return { ok: true, nextState: { ...state, services: state.services.map(service => service.id === serviceId ? { ...service, ...patch, name, durationMinutes: duration, priceInr: price } : service) } };
}
export function setBarberOnDuty(state, barberId, onDuty) {
  if (!state.barbers.some(barber => barber.id === barberId)) return { ok: false, error: 'barberMissing' };
  return { ok: true, nextState: { ...state, barbers: state.barbers.map(barber => barber.id === barberId ? { ...barber, onDuty, availability: onDuty ? barber.availability : 'available' } : barber) } };
}
export function updateQueueSettings(state, patch) {
  const closingTime = patch.closingTime ?? state.settings.closingTime;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(closingTime)) return { ok: false, error: 'invalidClosingTime' };
  return { ok: true, nextState: { ...state, settings: { ...state.settings, ...patch, closingTime } } };
}
export function todayStatistics(state, now = new Date()) {
  const timeZone = state.settings.timeZone;
  const today = salonDayKey(now, timeZone);
  const isToday = timestamp => { if (!timestamp) return false; try { return salonDayKey(timestamp, timeZone) === today; } catch { return false; } };
  const served = state.queue.filter(entry => entry.status === 'Done' && isToday(entry.doneAt));
  const noShows = state.queue.filter(entry => entry.status === 'No-show' && isToday(entry.noShowAt));
  const waits = served.map(entry => entry.startedAt && entry.joinedAt ? (new Date(entry.startedAt) - new Date(entry.joinedAt)) / 60000 : null).filter(value => Number.isFinite(value) && value >= 0);
  return { served: served.length, noShows: noShows.length, averageWait: waits.length ? Math.round(waits.reduce((sum, value) => sum + value, 0) / waits.length) : null };
}
export function estimateForNewJoin(state) {
  const ahead = state.queue.filter(entry => entry.status === 'Waiting').reduce((sum, entry) => sum + entry.durationMinutes, 0);
  return approximateWait(state, ahead);
}
export function getCustomerQueueStatus(state, id) {
  const entry = state.queue.find(item => item.id === id);
  if (!entry) return { entry: null, position: null, waitMinutes: null };
  if (entry.status !== 'Waiting') return { entry, position: null, waitMinutes: null };
  const waiting = state.queue.filter(item => item.status === 'Waiting').sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.joinedAt.localeCompare(b.joinedAt));
  const index = waiting.findIndex(item => item.id === id);
  const aheadMinutes = waiting.slice(0, index).reduce((sum, item) => sum + Number(item.durationMinutes || 0), 0);
  return { entry, position: index + 1, waitMinutes: approximateWait(state, aheadMinutes) };
}
export function cancelWaitingCustomer(state, id, now = new Date()) {
  const entry = state.queue.find(item => item.id === id);
  if (!entry || entry.status !== 'Waiting') return { ok: false, error: 'notWaiting' };
  const queue = state.queue.map(item => item.id === id ? { ...item, status: 'Cancelled', cancelledAt: now.toISOString() } : item);
  return { ok: true, nextState: { ...state, queue } };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { seedData } from '../src/data/seed.js';
import { createQueueRepository } from '../src/data/storage.js';

const tick = () => new Promise(resolve => setImmediate(resolve));

function fakeClient() {
  let state = structuredClone(seedData);
  let realtimeCallback;
  let statusCallback;
  const calls = [];
  const client = {
    calls,
    channel() {
      return {
        on(_event, _filter, callback) { realtimeCallback = callback; return this; },
        subscribe(callback) { statusCallback = callback; queueMicrotask(() => callback('SUBSCRIBED')); return this; },
      };
    },
    async removeChannel() { return 'ok'; },
    async rpc(name, args = {}) {
      calls.push({ name, args });
      if (name === 'get_salon_snapshot') return { data: structuredClone(state), error: null };
      return { data: { ok: true, entry: { id: 'remote-id', token: 'S-1' } }, error: null };
    },
    triggerRealtime() { realtimeCallback?.(); },
    setStatus(status) { statusCallback?.(status); },
  };
  return { client, calls, setState(next) { state = structuredClone(next); } };
}

test('AQ-20 cloud repository fetches initial state, subscribes to changes and cleans up', async () => {
  const mock = fakeClient();
  const repository = createQueueRepository({ client: mock.client });
  const seen = [];
  const stopUpdates = repository.subscribe(state => seen.push(state));
  const stop = repository.start();
  await tick();
  assert.equal(repository.connection.status, 'connected');
  assert.deepEqual(repository.read().services, seedData.services);

  const changed = structuredClone(seedData);
  changed.queue.push({ id: 'remote', token: 'S-1', name: 'Demo', status: 'Waiting' });
  mock.setState(changed);
  mock.client.triggerRealtime();
  await tick();
  assert.equal(repository.read().queue[0].id, 'remote');
  assert.equal(seen.at(-1).queue[0].id, 'remote');

  stop();
  stopUpdates();
});

test('AQ-20b a Realtime event during an in-flight snapshot causes a follow-up fetch', async () => {
  const mock = fakeClient();
  const originalRpc = mock.client.rpc.bind(mock.client);
  let releaseInitial;
  let resolveStarted;
  let blockInitial = true;
  const initialStarted = new Promise(resolve => { resolveStarted = resolve; });
  mock.client.rpc = async name => {
    if (name === 'get_salon_snapshot' && blockInitial) {
      blockInitial = false;
      resolveStarted();
      await new Promise(resolve => { releaseInitial = resolve; });
      return { data: structuredClone(seedData), error: null };
    }
    return originalRpc(name);
  };

  const repository = createQueueRepository({ client: mock.client });
  const stop = repository.start();
  await initialStarted;
  await tick(); // Let the Realtime subscription become active while the first fetch is blocked.
  const changed = structuredClone(seedData);
  changed.queue.push({ id: 'fresh', token: 'S-1', name: 'Synthetic Guest', status: 'Waiting' });
  mock.setState(changed);
  mock.client.triggerRealtime();
  releaseInitial();
  await tick();
  await tick();

  assert.equal(repository.read().queue[0].id, 'fresh');
  stop();
});

test('AQ-24 a missing Supabase configuration never falls back to persistent localStorage', async () => {
  const repository = createQueueRepository({ client: null });
  assert.equal(repository.mode, 'unconfigured');
  const result = await repository.update({ type: 'callNext', payload: { barberId: 'ravi' } });
  assert.deepEqual({ ok: result.ok, error: result.error }, { ok: false, error: 'cloudNotConfigured' });
  assert.equal(repository.connection.status, 'unconfigured');
});

test('AQ-25 join operations call the transactional RPC with the supplied idempotency key', async () => {
  const mock = fakeClient();
  const repository = createQueueRepository({ client: mock.client });
  const stop = repository.start();
  await tick();
  const input = { name: 'Synthetic Guest', phone: '9876543210', serviceIds: ['haircut'], barberId: 'any' };
  const result = await repository.update({
    type: 'join', payload: { input, requestId: 'b2ad35bf-f85a-4dd3-9c64-9c7d1e3e4001' },
  });
  const call = mock.calls.find(item => item.name === 'join_customer');
  assert.equal(result.ok, true);
  assert.equal(call.args.p_phone, input.phone);
  assert.equal(call.args.p_request_id, 'b2ad35bf-f85a-4dd3-9c64-9c7d1e3e4001');
  assert.equal(call.args.p_walk_in, false);
  stop();
});

test('AQ-26 repository propagates cloud failure without reporting a transition success', async () => {
  const mock = fakeClient();
  mock.client.rpc = async name => name === 'get_salon_snapshot'
    ? { data: structuredClone(seedData), error: null }
    : { data: null, error: new Error('offline') };
  const repository = createQueueRepository({ client: mock.client });
  const stop = repository.start();
  await tick();
  const result = await repository.update({ type: 'callNext', payload: { barberId: 'ravi' } });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'cloudUnavailable');
  assert.equal(repository.connection.status, 'reconnecting');
  stop();
});

test('AQ-27 repository maps every staff/settings mutation to its named database RPC', async () => {
  const mock = fakeClient();
  const repository = createQueueRepository({ client: mock.client });
  const stop = repository.start();
  await tick();
  const operations = [
    { type: 'callNext', payload: { barberId: 'ravi' }, expected: 'call_next_customer' },
    { type: 'cancel', payload: { entryId: 'entry-id' }, expected: 'cancel_waiting_customer' },
    { type: 'noShow', payload: { entryId: 'entry-id' }, expected: 'mark_customer_no_show' },
    { type: 'start', payload: { barberId: 'ravi' }, expected: 'start_barber_service' },
    { type: 'complete', payload: { barberId: 'ravi' }, expected: 'complete_barber_service' },
    { type: 'barberBreak', payload: { barberId: 'ravi', onBreak: true }, expected: 'set_barber_break' },
    { type: 'service', payload: { serviceId: 'haircut', patch: { active: false } }, expected: 'update_service' },
    { type: 'barberDuty', payload: { barberId: 'ravi', onDuty: false }, expected: 'set_barber_on_duty' },
    { type: 'settings', payload: { patch: { onlineOpen: false } }, expected: 'update_queue_settings' },
  ];
  for (const operation of operations) {
    const result = await repository.update(operation);
    assert.equal(result.ok, true, operation.type);
    assert.equal(mock.calls.at(-2).name, operation.expected, operation.type);
  }
  stop();
});

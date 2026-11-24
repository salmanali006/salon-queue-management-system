import { seedData } from './seed.js';
import { supabaseClient } from './supabaseClient.js';

const clone = value => structuredClone(value);

const operationToRpc = operation => {
  const payload = operation.payload ?? {};
  switch (operation.type) {
    case 'join':
    case 'walkIn':
      return ['join_customer', {
        p_name: payload.input.name,
        p_phone: payload.input.phone,
        p_service_ids: payload.input.serviceIds,
        p_barber_id: payload.input.barberId,
        p_walk_in: operation.type === 'walkIn',
        p_request_id: payload.requestId,
      }];
    case 'callNext': return ['call_next_customer', { p_barber_id: payload.barberId }];
    case 'cancel': return ['cancel_waiting_customer', { p_entry_id: payload.entryId }];
    case 'noShow': return ['mark_customer_no_show', { p_entry_id: payload.entryId }];
    case 'start': return ['start_barber_service', { p_barber_id: payload.barberId }];
    case 'complete': return ['complete_barber_service', { p_barber_id: payload.barberId }];
    case 'barberBreak': return ['set_barber_break', { p_barber_id: payload.barberId, p_on_break: payload.onBreak }];
    case 'service': return ['update_service', { p_service_id: payload.serviceId, p_patch: payload.patch }];
    case 'barberDuty': return ['set_barber_on_duty', { p_barber_id: payload.barberId, p_on_duty: payload.onDuty }];
    case 'settings': return ['update_queue_settings', { p_patch: payload.patch }];
    default: return null;
  }
};

export function createQueueRepository({ client = supabaseClient, initialState = seedData, retryBaseMs = 1000 } = {}) {
  let snapshot = clone(initialState);
  let snapshotLoaded = false;
  let started = false;
  let channel = null;
  let realtimeConnected = false;
  let retryTimer = null;
  let retryAttempt = 0;
  let refreshInFlight = null;
  let refreshAgain = false;
  let connection = { status: client ? 'connecting' : 'unconfigured', error: null, revision: null };
  const snapshotListeners = new Set();
  const connectionListeners = new Set();

  const publish = next => {
    snapshot = clone(next);
    snapshotLoaded = true;
    snapshotListeners.forEach(listener => listener(clone(snapshot)));
  };
  const setConnection = patch => {
    connection = { ...connection, ...patch };
    connectionListeners.forEach(listener => listener({ ...connection }));
  };

  async function refresh() {
    if (!client) return { ok: false, error: 'cloudNotConfigured' };
    if (refreshInFlight) {
      // A Realtime event can arrive while the current snapshot request is still
      // in flight. Remember it so the latest committed state is fetched again.
      refreshAgain = true;
      return refreshInFlight;
    }
    refreshInFlight = (async () => {
      let data;
      do {
        refreshAgain = false;
        const response = await client.rpc('get_salon_snapshot');
        if (response.error) throw response.error;
        data = response.data;
        if (!data || !Array.isArray(data.queue) || !Array.isArray(data.services) || !Array.isArray(data.barbers) || !data.settings) {
          throw new Error('Invalid salon snapshot response');
        }
        publish(data);
        setConnection({ revision: data.revision ?? null, error: null });
      } while (refreshAgain);
      return { ok: true, state: clone(snapshot) };
    })().finally(() => { refreshInFlight = null; });
    return refreshInFlight;
  }

  function scheduleReconnect() {
    if (!started || !client || retryTimer) return;
    const delay = Math.min(retryBaseMs * (2 ** retryAttempt), 5000);
    retryAttempt += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void refresh().then(() => {
        setConnection({ status: realtimeConnected ? 'connected' : 'reconnecting', error: null });
      }).catch(() => setConnection({ status: 'reconnecting', error: 'cloudUnavailable' }));
      if (started && !channel) connectRealtime();
    }, delay);
  }

  function connectRealtime() {
    if (!started || !client || channel) return;
    channel = client
      .channel('salon-queue-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'queue_updates', filter: 'id=eq.1' }, () => {
        void refresh().catch(() => {
          setConnection({ status: 'reconnecting', error: 'cloudUnavailable' });
          scheduleReconnect();
        });
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          realtimeConnected = true;
          retryAttempt = 0;
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = null;
          void refresh().then(() => setConnection({ status: 'connected', error: null })).catch(() => {
            setConnection({ status: 'reconnecting', error: 'cloudUnavailable' });
            scheduleReconnect();
          });
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          realtimeConnected = false;
          setConnection({ status: 'reconnecting', error: 'cloudUnavailable' });
          const failedChannel = channel;
          channel = null;
          if (failedChannel) void client.removeChannel(failedChannel);
          scheduleReconnect();
        }
      });
  }

  async function runOperation(operation) {
    if (!client) return { ok: false, error: 'cloudNotConfigured' };
    const rpc = operationToRpc(operation);
    if (!rpc) return { ok: false, error: 'cloudOperationRequired' };
    try {
      const [name, args] = rpc;
      const { data, error } = await client.rpc(name, args);
      if (error) throw error;
      if (!data?.ok) return data ?? { ok: false, error: 'cloudUnavailable' };
      // The RPC response confirms the committed operation. Re-fetch to install the
      // canonical snapshot immediately; Realtime remains the cross-client path.
      try { await refresh(); } catch {
        setConnection({ status: 'reconnecting', error: 'cloudUnavailable' });
        scheduleReconnect();
      }
      return data;
    } catch (error) {
      setConnection({ status: snapshotLoaded ? 'reconnecting' : 'error', error: 'cloudUnavailable' });
      scheduleReconnect();
      return { ok: false, error: 'cloudUnavailable', cause: error };
    }
  }

  return {
    get mode() { return client ? 'supabase' : 'unconfigured'; },
    get connection() { return { ...connection }; },
    get hasRemoteSnapshot() { return snapshotLoaded; },
    read() { return clone(snapshot); },
    getSnapshot() { return clone(snapshot); },
    subscribe(callback) {
      snapshotListeners.add(callback);
      callback(clone(snapshot));
      return () => snapshotListeners.delete(callback);
    },
    subscribeConnection(callback) {
      connectionListeners.add(callback);
      callback({ ...connection });
      return () => connectionListeners.delete(callback);
    },
    start() {
      if (started) return () => this.stop();
      started = true;
      if (!client) {
        setConnection({ status: 'unconfigured', error: 'cloudNotConfigured' });
        return () => this.stop();
      }
      setConnection({ status: 'connecting', error: null });
      void refresh().then(() => {
        if (!channel) setConnection({ status: 'connecting', error: null });
      }).catch(() => {
        setConnection({ status: 'error', error: 'cloudUnavailable' });
        scheduleReconnect();
      });
      connectRealtime();
      globalThis.window?.addEventListener?.('online', handleOnline);
      return () => this.stop();
    },
    stop() {
      started = false;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      globalThis.window?.removeEventListener?.('online', handleOnline);
      if (channel) void client?.removeChannel(channel);
      channel = null;
      realtimeConnected = false;
    },
    update(operation) { return runOperation(operation); },
  };

  function handleOnline() {
    setConnection({ status: 'reconnecting', error: null });
    if (!channel) connectRealtime();
    void refresh().then(() => setConnection({ status: realtimeConnected ? 'connected' : 'reconnecting', error: null })).catch(() => {
      setConnection({ status: 'reconnecting', error: 'cloudUnavailable' });
      scheduleReconnect();
    });
  }
}

export const queueRepository = createQueueRepository();

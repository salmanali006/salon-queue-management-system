import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('AQ-28 migration enables RLS, restricts direct data access and publishes only the signal row', async () => {
  const migration = await read('supabase/migrations/20261124120000_shared_queue.sql');
  for (const table of ['salon_settings', 'barbers', 'services', 'queue_entries', 'queue_updates']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
  assert.match(migration, /revoke all on table public\.salon_settings, public\.barbers, public\.services, public\.queue_entries, public\.queue_updates from anon, authenticated/i);
  assert.match(migration, /alter publication supabase_realtime add table public\.queue_updates/i);
  const entryFunction = migration.match(/create or replace function private\.entry_json[\s\S]*?as \$\$([\s\S]*?)\$\$;/i)?.[1];
  assert.ok(entryFunction);
  assert.doesNotMatch(entryFunction, /customer_phone/i);
});

test('AQ-29 migration includes transaction locks, sequential tokens, active uniqueness and all queue RPCs', async () => {
  const migration = await read('supabase/migrations/20261124120000_shared_queue.sql');
  assert.match(migration, /queue_entries_one_active_phone/i);
  assert.match(migration, /queue_entries_one_active_customer_per_barber/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /next_token_number = v_number \+ 1/i);
  for (const functionName of [
    'join_customer', 'call_next_customer', 'cancel_waiting_customer', 'mark_customer_no_show',
    'start_barber_service', 'complete_barber_service', 'set_barber_break', 'update_service',
    'set_barber_on_duty', 'update_queue_settings', 'get_salon_snapshot',
  ]) assert.match(migration, new RegExp(`function public\\.${functionName}\\(`, 'i'));
  assert.match(migration, /called_at <= now\(\) - interval '10 minutes'/i);
  assert.match(migration, /status = 'Waiting' and \(preferred_barber_id = 'any' or preferred_barber_id = p_barber_id\)/i);
});

test('AQ-30 service-role and secret keys are not present in frontend source', async () => {
  const files = await Promise.all([
    read('src/data/supabaseClient.js'), read('src/data/storage.js'), read('src/App.jsx'),
  ]);
  const source = files.join('\n');
  assert.doesNotMatch(source, /service_role|sb_secret|SUPABASE_SERVICE_ROLE_KEY/i);
  assert.match(source, /VITE_SUPABASE_PUBLISHABLE_KEY/);
});

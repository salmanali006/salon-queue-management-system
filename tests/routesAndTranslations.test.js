import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { translations } from '../src/i18n/translations.js';

const readSource = path => readFile(new URL(path, import.meta.url), 'utf8');

test('AQ-21 all seven required routes are declared for direct SPA navigation', async () => {
  const app = await readSource('../src/App.jsx');
  for (const route of ['/', '/join', '/status/:id', '/reception', '/barber/:barberId', '/display', '/admin']) {
    assert.ok(app.includes(`path="${route}"`), `Missing route ${route}`);
  }
});

test('AQ-22 navigation contains all destination links and all three barber choices', async () => {
  const navigation = await readSource('../src/components/Navigation.jsx');
  for (const destination of ["to: '/'", "to: '/join'", "to: '/reception'", "to: '/display'", "to: '/admin'"]) {
    assert.ok(navigation.includes(destination), `Missing navigation destination ${destination}`);
  }
  for (const barber of ["id: 'ravi'", "id: 'amit'", "id: 'imran'"]) assert.ok(navigation.includes(barber));
  assert.match(navigation, /pathname === '\/display'.*tv-navigation-hidden/);
  assert.match(navigation, /aria-expanded=\{menuOpen\}/);
});

test('AQ-23 statically referenced screen labels exist in both language dictionaries', async () => {
  const files = [
    '../src/App.jsx', '../src/components/CloudConnectionLabel.jsx',
    '../src/pages/Home.jsx', '../src/pages/JoinQueue.jsx', '../src/pages/MyStatus.jsx', '../src/pages/Reception.jsx',
    '../src/pages/BarberView.jsx', '../src/pages/WaitingDisplay.jsx', '../src/pages/OwnerSettings.jsx', '../src/components/Navigation.jsx',
  ];
  const source = (await Promise.all(files.map(readSource))).join('\n');
  const keys = [...new Set([...source.matchAll(/(?<![A-Za-z0-9_$])t\.([A-Za-z_$][A-Za-z0-9_$]*)/g)].map(match => match[1]))];
  assert.ok(keys.length > 100, `Expected broad screen coverage, found ${keys.length} labels`);
  for (const language of ['en', 'gu']) {
    const missing = keys.filter(key => translations[language][key] === undefined);
    assert.deepEqual(missing, [], `Missing ${language} labels`);
  }
});

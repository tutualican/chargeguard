// Bilgilendirme metinleri + Linux otomatik başlatma (saf) + core note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangeNote, dropNote } from '../src/info.js';
import { linuxUnitContent } from '../src/autostart.js';
import { open } from '../src/core.js';

test('rangeNote: "alt eşiğe düşme" bilgisini içerir', () => {
  const t = rangeNote(65, 80);
  assert.match(t, /%80/);
  assert.match(t, /%65/);
  assert.match(t, /FİŞTEN ÇIKAR/);
  assert.match(t, /YENİDEN şarj başlar/);
  assert.match(t, /ETMEZ/);
});

test('dropNote: fiş bilgisini içerir', () => {
  assert.match(dropNote(), /FİŞTEN ÇIKAR/);
});

test('linuxUnitContent: geçerli bir systemd unit üretir', () => {
  const u = linuxUnitContent('/usr/bin/node', '/opt/cg/cli.js daemon');
  assert.match(u, /\[Unit\]/);
  assert.match(u, /ExecStart=\/usr\/bin\/node \/opt\/cg\/cli\.js daemon/);
  assert.match(u, /Environment=CG_CONFIG_DIR=\/etc/);
  assert.match(u, /WantedBy=multi-user\.target/);
});

test('core: holdRange sonucuna note eklenir (aralık destekleyen arka uç)', () => {
  const backend = {
    id: 'fake',
    capabilities: () => ({ range: true, stopAt: true }),
    getStatus: () => ({ percent: 70, startThreshold: 65, endThreshold: 80, mode: 1 }),
    holdRange: () => ({ ok: true }),
  };
  const app = open({ device: { os: 'linux', brand: 'generic' }, backend });
  const r = app.holdRange(65, 80);
  assert.equal(r.ok, true);
  assert.match(r.note, /FİŞTEN ÇIKAR/);
});

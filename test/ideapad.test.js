// IdeaPad koruma modu arka ucu — sahte dosyayla test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('linux-ideapad: koruma modu aç/kapat', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cgideapad-'));
  const f = path.join(root, 'conservation_mode');
  fs.writeFileSync(f, '0');
  process.env.CG_IDEAPAD_PATH = f;

  const { createLinuxIdeapadBackend } = await import('../src/backends/linux-ideapad.js?v=' + Date.now());
  const b = createLinuxIdeapadBackend();
  assert.ok(b, 'backend oluşmalı');

  const caps = b.capabilities();
  assert.equal(caps.conservation, true);
  assert.equal(caps.stopAt, false);

  assert.equal(b.getStatus().conservation, false);
  assert.equal(b.conserve(true).ok, true);
  assert.equal(fs.readFileSync(f, 'utf8').trim(), '1');
  assert.equal(b.getStatus().conservation, true);

  assert.equal(b.disable().ok, true);
  assert.equal(fs.readFileSync(f, 'utf8').trim(), '0');
});

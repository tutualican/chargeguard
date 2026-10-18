// Marka normalizasyonu (saf fonksiyon).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBrand } from '../src/detect.js';

test('marka normalizasyonu', () => {
  assert.equal(normalizeBrand('HUAWEI', 'BOD-WXX9'), 'huawei');
  assert.equal(normalizeBrand('ASUSTeK COMPUTER INC.', 'ZenBook'), 'asus');
  assert.equal(normalizeBrand('LENOVO', 'ThinkPad X1'), 'lenovo');
  assert.equal(normalizeBrand('Micro-Star International', 'MS-16'), 'msi');
  assert.equal(normalizeBrand('Dell Inc.', 'XPS 13'), 'dell');
  assert.equal(normalizeBrand('Acer', 'Aspire'), 'acer');
  assert.equal(normalizeBrand('HP', 'EliteBook'), 'hp');
  assert.equal(normalizeBrand('Bilinmeyen', 'Marka'), 'unknown');
});

test('model adı markayı belirleyebilir (xiaomi/redmi)', () => {
  assert.equal(normalizeBrand('', 'RedmiBook 15'), 'xiaomi');
});

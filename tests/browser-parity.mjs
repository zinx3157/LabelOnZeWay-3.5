import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.LZ35_TEST_URL || 'http://127.0.0.1:4173/?test=1';
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

  await page.goto(`${BASE}#/home`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });

  await page.goto(`${BASE}#/label`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="name"]').fill('Finance UAT Customer');
  await page.locator('input[name="phone"]').fill('0341234567');
  await page.locator('textarea[name="address"]').fill('Antananarivo');
  await page.getByRole('button', { name: 'Continue to parcel' }).click();
  await page.locator('input[name="qty"]').fill('2');
  await page.locator('input[name="unitPrice"]').fill('5000');
  await page.locator('input[name="deliveryCharge"]').fill('1500');
  assert.match(await page.locator('.calculation').innerText(), /Collect:\s*10\s?000/i);
  assert.match(await page.locator('.calculation').innerText(), /Delivery:\s*1\s?500/i);
  await page.getByRole('button', { name: 'Review label' }).click();
  assert.match(await page.locator('.label-preview').innerText(), /Delivery:\s*1\s?500/i);
  await page.getByRole('button', { name: 'Save label' }).click();
  await page.locator('table').waitFor();
  assert.match(await page.locator('table').innerText(), /10\s?000/);
  assert.match(await page.locator('table').innerText(), /1\s?500/);

  const pickId = await page.evaluate(() => JSON.parse(localStorage.getItem('labelonzeway.3.5.state.v1')).parcels[0].pickId);
  await page.goto(`${BASE}#/reconciliation`, { waitUntil: 'domcontentloaded' });
  const reconciliation = await page.locator('.metric-grid').innerText();
  assert.match(reconciliation, /Merchandise Collect[\s\S]*10\s?000/i);
  assert.match(reconciliation, /Delivery Revenue[\s\S]*1\s?500/i);
  assert.match(reconciliation, /Total Receivable[\s\S]*11\s?500/i);

  await page.goto(`${BASE}#/claims`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="claimPickId"]').fill(pickId);
  await page.locator('textarea[name="claimReason"]').fill('UAT damaged parcel claim');
  await page.getByRole('button', { name: 'Open claim' }).click();
  assert.match(await page.locator('body').innerText(), /UAT damaged parcel claim/);
  assert.match(await page.locator('body').innerText(), /open/i);
  await page.getByRole('button', { name: /Resolve claim/ }).click();
  assert.match(await page.locator('body').innerText(), /resolved/i);
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.match(await page.locator('body').innerText(), /UAT damaged parcel claim/);
  assert.match(await page.locator('body').innerText(), /resolved/i);

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('labelonzeway.3.5.state.v1')));
  assert.equal(persisted.claims.length, 1);
  assert.equal(persisted.claims[0].status, 'resolved');
  assert.equal(persisted.parcels[0].deliveryCharge, 1500);
  assert.deepEqual(errors, []);
  await context.close();
} finally {
  await browser.close();
}

console.log('Financial and claims parity acceptance: PASS');

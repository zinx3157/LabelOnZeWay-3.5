import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.LZ35_TEST_URL || 'http://127.0.0.1:4173/?test=1';
const viewports = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'iphone-portrait', width: 390, height: 844, mobile: true },
  { name: 'iphone-landscape', width: 844, height: 390, mobile: false },
  { name: 'android-portrait', width: 360, height: 800, mobile: true },
  { name: 'android-landscape', width: 800, height: 360, mobile: true },
];

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

    await page.goto(`${BASE}#/home`, { waitUntil: 'domcontentloaded' });
    await page.locator('.app-shell').waitFor();
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.app-shell').waitFor();

    const layout = await page.evaluate(() => ({
      sidebar: getComputedStyle(document.querySelector('.sidebar')).display,
      mobile: getComputedStyle(document.querySelector('.mobile-nav')).display,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    if (!viewport.mobile) {
      assert.notEqual(layout.sidebar, 'none', `${viewport.name} sidebar must be visible`);
      assert.equal(layout.mobile, 'none', `${viewport.name} mobile nav must be hidden`);
    } else {
      assert.equal(layout.sidebar, 'none', `${viewport.name} sidebar must be hidden`);
      assert.notEqual(layout.mobile, 'none', `${viewport.name} mobile nav must be visible`);
    }
    assert.equal(layout.overflow, false, `${viewport.name} home must not overflow horizontally`);

    await page.goto(`${BASE}#/label`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="name"]').fill('UAT Customer <script>alert(1)</script>');
    await page.locator('input[name="phone"]').fill('0341234567');
    await page.locator('textarea[name="address"]').fill('Andraharo, Antananarivo');
    await page.getByRole('button', { name: 'Continue to parcel' }).click();
    await page.locator('input[name="qty"]').fill('3');
    await page.locator('input[name="unitPrice"]').fill('12500');
    await page.locator('.calculation').waitFor();
    assert.match(await page.locator('.calculation').innerText(), /37\s?500|37500/);
    await page.getByRole('button', { name: 'Review label' }).click();
    assert.match(await page.locator('.label-preview').innerText(), /UAT Customer <script>alert\(1\)<\/script>/);
    assert.equal(await page.locator('.label-preview script').count(), 0, 'Customer input must never become executable markup');
    await page.getByRole('button', { name: 'Save label' }).click();
    await page.locator('table').waitFor();
    assert.match(await page.locator('body').innerText(), /UAT Customer/);
    assert.equal(await page.locator('body script').count(), 1, 'Only the application module script should exist');

    const checkbox = page.locator('tbody input[type="checkbox"]').first();
    await checkbox.check();
    await page.locator('select.select').selectOption('delivered');
    await page.getByRole('button', { name: 'Update selected' }).click();
    assert.match(await page.locator('body').innerText(), /delivered/i);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('table').waitFor();
    assert.match(await page.locator('body').innerText(), /delivered/i, `${viewport.name} status must persist after reload`);

    await page.goto(`${BASE}#/customers`, { waitUntil: 'domcontentloaded' });
    assert.match(await page.locator('body').innerText(), /Previous shipment:/);
    await page.getByRole('button', { name: 'Edit' }).first().click();
    await page.locator('input[name="customerEditName"]').fill('UAT Customer Edited');
    await page.getByRole('button', { name: 'Save customer' }).click();
    assert.match(await page.locator('body').innerText(), /UAT Customer Edited/);

    await page.goto(`${BASE}#/archive`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('checkbox', { name: /Archive / }).first().check();
    await page.getByRole('button', { name: 'Archive selected' }).click();
    assert.match(await page.locator('.archive-list').innerText(), /UAT Customer/);
    await page.locator('input[name="archiveSearch"]').fill('UAT Customer');
    assert.match(await page.locator('.archive-list').innerText(), /UAT Customer/);
    await page.getByRole('button', { name: 'Restore' }).first().click();
    assert.match(await page.locator('body').innerText(), /Archive is empty/);

    await page.goto(`${BASE}#/reconciliation`, { waitUntil: 'domcontentloaded' });
    await page.locator('.metric-grid').waitFor();
    const reconciliation = await page.locator('.metric-grid').innerText();
    assert.match(reconciliation, /37\s?500|37500/);

    for (let cycle = 0; cycle < 20; cycle += 1) {
      await page.goto(`${BASE}#/manifest`, { waitUntil: 'domcontentloaded' });
      await page.locator('.screen').waitFor();
      await page.goto(`${BASE}#/tracking`, { waitUntil: 'domcontentloaded' });
      await page.locator('.screen').waitFor();
      await page.goto(`${BASE}#/customers`, { waitUntil: 'domcontentloaded' });
      await page.locator('.screen').waitFor();
    }

    await page.goto(`${BASE}#/customers`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('checkbox', { name: /Select UAT Customer Edited/ }).check();
    await page.getByRole('button', { name: 'Delete selected' }).click();
    assert.match(await page.locator('body').innerText(), /No saved customers yet/);

    const finalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert.equal(finalOverflow, false, `${viewport.name} must not develop horizontal overflow after navigation loops`);
    assert.deepEqual(errors, [], `${viewport.name} browser console/page errors: ${errors.join(' | ')}`);
    await context.close();
  }
} finally {
  await browser.close();
}
console.log('Browser regression loops: PASS');

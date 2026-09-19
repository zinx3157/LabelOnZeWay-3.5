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
    assert.match(await page.locator('.label-preview').innerText(), /UAT Customer <script>alert\(1\)<\/script>/i);
    assert.equal(await page.locator('.label-preview script').count(), 0, 'Customer input must never become executable markup');
    await page.getByRole('button', { name: 'Save label' }).click();
    await page.locator('table').waitFor();
    assert.match(await page.locator('body').innerText(), /UAT Customer/i);
    assert.equal(await page.locator('body script').count(), 1, 'Only the application module script should exist');

    const originalIdentity = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('lzway.3.5.state.v1'));
      return { id: state.parcels[0].id, pickId: state.parcels[0].pickId, trackingToken: state.parcels[0].trackingToken };
    });

    await page.getByRole('button', { name: /Edit / }).first().click();
    assert.match(await page.locator('h1').innerText(), /Edit Label/);
    await page.locator('input[name="name"]').fill('UAT Customer Edited');
    await page.getByRole('button', { name: 'Continue to parcel' }).click();
    await page.locator('input[name="qty"]').fill('4');
    await page.locator('input[name="unitPrice"]').fill('10000');
    await page.getByRole('button', { name: 'Review label' }).click();
    await page.getByRole('button', { name: 'Update label' }).click();
    await page.locator('table').waitFor();
    const editedIdentity = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('lzway.3.5.state.v1'));
      return { count: state.parcels.length, id: state.parcels[0].id, pickId: state.parcels[0].pickId, trackingToken: state.parcels[0].trackingToken, collect: state.parcels[0].collect };
    });
    assert.equal(editedIdentity.count, 1, `${viewport.name} editing must not duplicate parcel`);
    assert.equal(editedIdentity.id, originalIdentity.id, `${viewport.name} edit must preserve parcel id`);
    assert.equal(editedIdentity.pickId, originalIdentity.pickId, `${viewport.name} edit must preserve Pick ID`);
    assert.equal(editedIdentity.trackingToken, originalIdentity.trackingToken, `${viewport.name} edit must preserve tracking token`);
    assert.equal(editedIdentity.collect, 40000, `${viewport.name} edited Collect must recalculate`);

    for (const lifecycleStatus of ['dispatch','in-transit','delivery','exception','delivered']) {
      const checkbox = page.locator('tbody input[type="checkbox"]').first();
      await checkbox.check();
      await page.locator('select.select').selectOption(lifecycleStatus);
      await page.getByRole('button', { name: 'Update selected' }).click();
      assert.match((await page.locator('tbody').innerText()).toLowerCase(), new RegExp(lifecycleStatus.replace('-', '[ -]?')));
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('table').waitFor();
    assert.match(await page.locator('body').innerText(), /delivered/i, `${viewport.name} status must persist after reload`);

    await page.goto(`${BASE}#/customers`, { waitUntil: 'domcontentloaded' });
    assert.match(await page.locator('body').innerText(), /Previous shipment:/);
    await page.getByRole('button', { name: 'Edit' }).first().click();
    await page.locator('input[name="customerEditName"]').fill('UAT Customer Maintained');
    await page.getByRole('button', { name: 'Save customer' }).click();
    assert.match(await page.locator('body').innerText(), /UAT Customer Maintained/);

    await page.goto(`${BASE}#/tracking`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="trackingSearch"]').fill('NOT-A-REAL-ID');
    assert.match(await page.locator('body').innerText(), /Tracking ID not found/);
    await page.locator('input[name="trackingSearch"]').fill(originalIdentity.trackingToken);
    assert.match(await page.locator('body').innerText(), new RegExp(originalIdentity.pickId));

    const publicBase = new URL(BASE);
    publicBase.searchParams.set('track', originalIdentity.trackingToken);
    await page.goto(`${publicBase.toString()}#/tracking`, { waitUntil: 'domcontentloaded' });
    await page.locator('.screen').waitFor();
    assert.match(await page.locator('body').innerText(), /Shipment Tracking/);
    assert.match(await page.locator('body').innerText(), /delivered/i);
    assert.equal(await page.getByRole('button', { name: 'WhatsApp' }).count(), 0, 'Public tracking must be read-only');

    await page.goto(`${BASE}#/archive`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('checkbox', { name: /Archive / }).first().check();
    await page.getByRole('button', { name: 'Archive selected' }).click();
    assert.match(await page.locator('.archive-list').innerText(), /UAT Customer/);
    await page.locator('input[name="archiveSearch"]').fill('UAT Customer');
    assert.match(await page.locator('.archive-list').innerText(), /UAT Customer/);

    await page.goto(`${publicBase.toString()}#/tracking`, { waitUntil: 'domcontentloaded' });
    assert.match(await page.locator('body').innerText(), /Archived shipment/);
    assert.match(await page.locator('body').innerText(), /delivered/i);

    await page.goto(`${BASE}#/archive`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Restore' }).first().click();
    assert.match(await page.locator('body').innerText(), /Archive is empty/);

    await page.goto(`${BASE}#/reconciliation`, { waitUntil: 'domcontentloaded' });
    await page.locator('.metric-grid').waitFor();
    const reconciliation = await page.locator('.metric-grid').innerText();
    assert.match(reconciliation, /40\s?000|40000/);

    const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('lzway.3.5.state.v1')));
    const restoreSnapshot = {
      version: '3.5',
      customers: snapshot.customers,
      parcels: snapshot.parcels.map((item) => ({ ...item, customer: { ...item.customer, name: 'Restored Customer' } })),
      archive: snapshot.archive,
      workspace: snapshot.workspace,
    };
    await page.goto(`${BASE}#/reports`, { waitUntil: 'domcontentloaded' });
    const restoreInput = page.locator('input[type="file"]');
    await restoreInput.setInputFiles({ name: 'bad-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: '2.0', customers: [], parcels: [], archive: [] })) });
    await page.getByText(/Restore rejected:/).waitFor();
    await restoreInput.setInputFiles({ name: 'uat-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(restoreSnapshot)) });
    await page.getByText(/Backup restored:/).waitFor();
    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('lzway.3.5.state.v1')));
    assert.equal(restored.parcels.length, restoreSnapshot.parcels.length, `${viewport.name} restore parcel parity`);
    assert.equal(restored.parcels[0].collect, 40000, `${viewport.name} restore financial parity`);

    await page.evaluate(() => {
      const key = 'lzway.3.5.state.v1';
      const state = JSON.parse(localStorage.getItem(key));
      state.workspace = { id: 'uat-workspace', name: 'UAT Company', profileId: 'ps_default' };
      localStorage.setItem(key, JSON.stringify(state));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.goto(`${BASE}#/profiles`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="profileId"]').fill('ops_uat');
    await page.getByRole('button', { name: 'Use profile' }).click();
    assert.match(await page.locator('.topbar').innerText(), /UAT Company \/ ops_uat/);
    await page.goto(`${BASE}#/manifest`, { waitUntil: 'domcontentloaded' });
    assert.match(await page.locator('body').innerText(), /No parcels in the current manifest/);
    await page.goto(`${BASE}#/profiles`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="profileId"]').fill('ps_default');
    await page.getByRole('button', { name: 'Use profile' }).click();
    await page.goto(`${BASE}#/manifest`, { waitUntil: 'domcontentloaded' });
    assert.match(await page.locator('body').innerText(), /Restored Customer/);

    for (let cycle = 0; cycle < 20; cycle += 1) {
      await page.goto(`${BASE}#/manifest`, { waitUntil: 'domcontentloaded' });
      await page.locator('.screen').waitFor();
      await page.goto(`${BASE}#/tracking`, { waitUntil: 'domcontentloaded' });
      await page.locator('.screen').waitFor();
      await page.goto(`${BASE}#/customers`, { waitUntil: 'domcontentloaded' });
      await page.locator('.screen').waitFor();
    }

    await page.goto(`${BASE}#/customers`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('checkbox', { name: /Select UAT Customer Maintained/ }).check();
    await page.getByRole('button', { name: 'Delete selected' }).click();
    assert.match(await page.locator('body').innerText(), /No saved customers yet/);

    const sprint3Screens = [
      ['stock', /Stock Management/],
      ['notify', /Customer Notifications/],
      ['settlements', /COD Settlements/],
      ['sync', /Sync Center/],
    ];
    for (const [route, expected] of sprint3Screens) {
      await page.goto(`${BASE}#/${route}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.screen').waitFor();
      assert.match(await page.locator('body').innerText(), expected, `${route} screen must render its heading`);
    }
    await page.goto(`${BASE}#/settings`, { waitUntil: 'domcontentloaded' });
    await page.locator('.screen').waitFor();
    assert.match(await page.locator('body').innerText(), /COD settlements/, 'settings must expose the sprint-3 tools');

    const finalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert.equal(finalOverflow, false, `${viewport.name} must not develop horizontal overflow after navigation loops`);
    assert.deepEqual(errors, [], `${viewport.name} browser console/page errors: ${errors.join(' | ')}`);
    await context.close();
  }
} finally {
  await browser.close();
}
console.log('Browser regression loops: PASS');

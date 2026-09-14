import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.LZ35_TEST_URL || 'http://127.0.0.1:4173/?test=1';

const browser = await chromium.launch({ headless: true });
try {
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${BASE}&track=uat-public-tracking-sentinel#/tracking`, { waitUntil: 'domcontentloaded' });
    await page.locator('.app-shell').waitFor();
    await page.getByText('UAT-PUBLIC-TRACK').waitFor({ timeout: 15000 });
    const body = await page.locator('body').innerText();
    assert.match(body, /in transit/i, 'Anonymous cloud tracking must resolve current status');
    assert.equal(await page.getByRole('button', { name: 'WhatsApp' }).count(), 0, 'Public cloud tracking must be read-only');
    assert.equal(await page.locator('body').innerText().then((text) => /034|phone|address/i.test(text)), false, 'Public tracking must not disclose customer contact details');
    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
    const page = await context.newPage();
    await page.goto(`${BASE}#/home`, { waitUntil: 'networkidle' });
    await page.locator('.app-shell').waitFor();
    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) throw new Error('Service worker unsupported');
      await navigator.serviceWorker.ready;
    });
    await page.goto(`${BASE}#/label`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="name"]').fill('Offline UAT Customer');
    await page.getByRole('button', { name: 'Continue to parcel' }).click();
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.app-shell').waitFor({ timeout: 10000 });
    assert.match(await page.locator('body').innerText(), /Offline/i, 'Offline shell must report offline state');
    await context.setOffline(false);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.app-shell').waitFor();
    assert.match(await page.locator('body').innerText(), /Online/i, 'PWA must recover after reconnect');
    await context.close();
  }
} finally {
  await browser.close();
}

console.log('Browser integration acceptance: PASS');

import { chromium } from "playwright-core";
(async () => {
  const browser = await chromium.launch({
    executablePath: '/home/aditya/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.locator('text=Every decision your team made.').first().waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/edms-home-smoke.png', fullPage: true });
  await browser.close();
})();

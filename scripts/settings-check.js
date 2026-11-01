/*
 * Turns each setting off through its menu command on the live site and reports which
 * features remain, plus whether the setting survives the reload and turns back on.
 * Input: none.
 * Usage: Playwright MCP browser_run_code_unsafe with filename set to this file.
 * Stores settings in localStorage through GM_* shims, not through Tampermonkey.
 */
async (defaultPage) => {
  const USERSCRIPT = 'D:/GitHub/FitGirl-Power-Pack-UserScript/FitGirl Power Pack.user.js';
  const BASE = 'https://fitgirl-repacks.site';
  const context = await defaultPage.context().browser().newContext({ viewport: null });
  await context.addInitScript(() => {
    window.__menu = {};
    window.GM_addStyle = css => { const s = new CSSStyleSheet(); s.replaceSync(css); document.adoptedStyleSheets = [...document.adoptedStyleSheets, s]; };
    window.GM_xmlhttpRequest = () => {};
    window.GM_getValue = (key, fallback) => { const v = localStorage.getItem('fg-' + key); return v === null ? fallback : v === 'true'; };
    window.GM_setValue = (key, value) => localStorage.setItem('fg-' + key, value);
    window.GM_registerMenuCommand = (label, callback) => { window.__menu[label] = callback; };
  });
  await context.addInitScript({ path: USERSCRIPT });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  const settle = () => page.waitForTimeout(2200);
  const open = async path => { await page.goto(BASE + path, { waitUntil: 'load' }); await settle(); };
  const homeState = () => page.evaluate(() => ({
    menu: Object.keys(window.__menu),
    dark: getComputedStyle(document.querySelector('article')).backgroundColor === 'rgb(26, 26, 26)',
    recoloredImages: document.querySelectorAll('.fg-paw, .fg-support').length > 0,
    trailers: document.querySelectorAll('a.nframe').length > 0,
    tagsLink: [...document.querySelectorAll('#primary-menu a')].some(a => a.textContent.trim() === 'Tags'),
  }));
  const click = async label => {
    await page.evaluate(label => {
      const entry = Object.keys(window.__menu).find(text => text.includes(label));
      window.__menu[entry]();
    }, label);
    await page.waitForLoadState('load');
    await settle();
  };
  const featureOn = {
    'Infinite scroll': async () => {
      await open('/');
      const before = await page.locator('article').count();
      await page.locator('a.next.page-numbers').scrollIntoViewIfNeeded();
      await page.waitForTimeout(3000);
      return (await page.locator('article').count()) > before;
    },
    'Hide comments': async () => {
      await open('/upcoming-repacks-10/');
      await page.waitForTimeout(2000);
      return page.evaluate(() => [...document.querySelectorAll('button')].some(b => /Show Comments/.test(b.textContent)));
    },
    'Tags page': async () => {
      await open('/tags');
      await page.waitForTimeout(2000);
      return page.evaluate(() => /Tag Index/.test(document.body.textContent));
    },
    'Donate page': async () => {
      await open('/donations/');
      return (await page.locator('.fg-scroll-wrapper').count()) > 0;
    },
  };

  const out = {};
  await open('/');
  out.defaults = await homeState();

  for (const label of ['Dark theme', 'YouTube trailer']) {
    await click(label);
    out['off: ' + label] = await homeState();
    await click(label);
  }
  for (const [label, check] of Object.entries(featureOn)) {
    await open('/');
    await click(label);
    const off = await check();
    await open('/');
    await click(label);
    out[label] = { whileOff: off, afterTurningBackOn: await check() };
  }
  await open('/');
  out.finalState = await homeState();
  out.errors = errors;
  await context.close();
  return out;
}

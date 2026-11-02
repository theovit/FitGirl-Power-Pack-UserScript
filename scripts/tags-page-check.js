/*
 * Tests the Tags page's use of the saved tag list on the live site: first load, instant
 * repeat loads, old lists refreshing, failures, names with special characters, and the
 * Refresh tags button.
 * Input: none.
 * Usage: Playwright MCP browser_run_code_unsafe with filename set to this file; paths are relative to the folder holding this repo.
 * Injects with GM_* shims, not through Tampermonkey.
 */
async (defaultPage) => {
  const USERSCRIPT = 'FitGirl-Power-Pack-UserScript/FitGirl Power Pack.user.js';
  const context = await defaultPage.context().browser().newContext({ viewport: null });
  const page = await context.newPage();
  const errors = [];
  let tagRequests = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (/\/wp-json\/wp\/v2\/tags/.test(r.url())) tagRequests++; });
  const SHIMS = `window.GM_addStyle = css => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); return s; }; window.GM_xmlhttpRequest = () => {}; window.GM_getValue = (k, d) => { const v = localStorage.getItem("fg-" + k); return v === null ? d : JSON.parse(v); }; window.GM_setValue = (k, v) => localStorage.setItem("fg-" + k, JSON.stringify(v)); window.GM_registerMenuCommand = () => {};`;
  // Timed from inside the page: from just before the script starts until the list appears
  const open = async () => {
    tagRequests = 0;
    await page.goto('https://fitgirl-repacks.site/tags', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ content: 'window.__started = performance.now(); new MutationObserver((_, o) => { if (document.querySelector(".page-content li a")) { window.__msUntilTags = Math.round(performance.now() - window.__started); o.disconnect(); } }).observe(document.body, { childList: true, subtree: true });' });
    await page.addScriptTag({ content: SHIMS });
    await page.addScriptTag({ path: USERSCRIPT });
  };
  const read = () => page.evaluate(() => ({
    msUntilTags: window.__msUntilTags ?? null,
    heading: document.querySelector('.page-content h2')?.textContent ?? null,
    links: document.querySelectorAll('.page-content li a').length,
    message: document.querySelector('.page-content > div > p')?.textContent ?? null,
    title: document.title,
  }));
  const saved = () => page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('fg-filterTagCache'));
    return c ? { tags: c.tags.length, ageMs: Date.now() - c.savedAt } : null;
  });
  const editCache = change => page.evaluate(change => {
    const c = JSON.parse(localStorage.getItem('fg-filterTagCache'));
    if (change.ageHours) c.savedAt = Date.now() - change.ageHours * 3600000;
    if (change.keep) c.tags = c.tags.slice(0, change.keep);
    if (change.add) c.tags.unshift(change.add);
    localStorage.setItem('fg-filterTagCache', JSON.stringify(c));
  }, change);
  const out = {};

  await page.goto('https://fitgirl-repacks.site/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());

  await open();
  await page.waitForTimeout(4000);
  out.nothingSaved = { ...(await read()), tagRequests, saved: await saved() };

  await open();
  await page.waitForTimeout(2000);
  out.savedWithinADay = { ...(await read()), tagRequests };

  // A name that would break out of the page if it were treated as HTML
  await editCache({ add: { slug: 'test-tag', name: '<img src=x onerror="window.__injected=true">Hack & Slash' } });
  await open();
  await page.waitForTimeout(1000);
  out.specialCharacters = await page.evaluate(() => {
    const a = document.querySelector('.page-content li a');
    return { text: a.textContent, href: a.getAttribute('href'), injectedImages: document.querySelectorAll('.page-content li img').length, ran: window.__injected === true };
  });
  await editCache({ keep: 5, ageHours: 25 });
  await open();
  await page.waitForFunction(() => document.querySelector('.page-content h2'), null, { timeout: 5000 });
  const oldRightAway = await read();
  await page.waitForTimeout(4000);
  out.savedOverADayAgo = { rightAway: oldRightAway.heading, msUntilTags: oldRightAway.msUntilTags, afterRefresh: (await read()).heading, tagRequests, saved: await saved() };

  // Failing with an old list keeps it, and failing with nothing says so
  await editCache({ keep: 5, ageHours: 25 });
  await page.route('**/wp-json/wp/v2/tags*', r => r.fulfill({ status: 500, body: '{}' }));
  await open();
  await page.waitForTimeout(1500);
  out.oldListRefreshFails = await read();
  await page.evaluate(() => localStorage.removeItem('fg-filterTagCache'));
  await open();
  await page.waitForTimeout(1500);
  out.nothingSavedFails = await read();
  await page.unroute('**/wp-json/wp/v2/tags*');

  // Refresh tags updates the open page without a reload
  await open();
  await page.waitForTimeout(3000);
  await editCache({ keep: 5 });
  await open();
  await page.waitForTimeout(800);
  const before = (await read()).heading;
  await page.evaluate(() => { window.__samePage = true; });
  await page.locator('#primary-menu a', { hasText: 'Settings' }).click();
  await page.locator('.fg-settings-refresh').click();
  await page.waitForFunction(() => !document.querySelector('.fg-settings-refresh').disabled, null, { timeout: 15000 });
  out.refreshButton = { before, after: (await read()).heading, status: await page.locator('.fg-settings-refresh-status').textContent(), samePage: await page.evaluate(() => window.__samePage === true) };
  await page.keyboard.press('Escape');

  // Links still work and stay in the same tab
  const tabs = context.pages().length;
  await Promise.all([page.waitForURL('**/tag/**'), page.locator('.page-content li a').first().click()]);
  out.linkClick = { url: new URL(page.url()).pathname, tabsAdded: context.pages().length - tabs };

  out.errors = errors;
  await context.close();
  return out;
}

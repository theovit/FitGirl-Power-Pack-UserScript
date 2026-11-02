/*
 * Tests the settings panel's Refresh tags button on the live site: it saves a new list,
 * updates an open filter without a reload, keeps the panel open, and reports failure.
 * Input: none.
 * Usage: Playwright MCP browser_run_code_unsafe with filename set to this file.
 * Injects with GM_* shims, not through Tampermonkey.
 */
async (defaultPage) => {
  const USERSCRIPT = 'D:/GitHub/FitGirl-Power-Pack-UserScript/FitGirl Power Pack.user.js';
  const SHOTS = 'C:/Users/Andrew/AppData/Local/Temp/claude/D--GitHub/a85b545d-3b74-4545-b5ad-f306bf0b875c/scratchpad';
  const context = await defaultPage.context().browser().newContext({ viewport: null });
  const page = await context.newPage();
  const errors = [];
  let tagRequests = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (/\/wp-json\/wp\/v2\/tags/.test(r.url())) tagRequests++; });
  const SHIMS = `window.GM_addStyle = css => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); return s; }; window.GM_xmlhttpRequest = () => {}; window.GM_getValue = (k, d) => { const v = localStorage.getItem("fg-" + k); return v === null ? d : JSON.parse(v); }; window.GM_setValue = (k, v) => localStorage.setItem("fg-" + k, JSON.stringify(v)); window.GM_registerMenuCommand = () => {};`;
  page.on('domcontentloaded', async () => {
    await page.addScriptTag({ content: SHIMS }).catch(() => {});
    await page.addScriptTag({ path: USERSCRIPT }).catch(() => {});
    await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => getComputedStyle(e).position === 'fixed' && /Discover more/.test(e.textContent)).forEach(e => e.remove())).catch(() => {});
  });
  const open = async path => {
    await page.goto('https://fitgirl-repacks.site' + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
  };
  const saved = () => page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('fg-filterTagCache'));
    return c ? { tags: c.tags.length, ageMs: Date.now() - c.savedAt } : null;
  });
  const panelState = () => page.evaluate(() => ({
    open: document.querySelector('dialog.fg-settings').open,
    status: document.querySelector('.fg-settings-refresh-status').textContent,
    disabled: document.querySelector('.fg-settings-refresh').disabled,
    filterOptions: document.querySelectorAll('#fg-filter-tags option').length,
    stillSamePage: window.__samePage === true,
  }));
  const openPanel = async () => {
    await page.locator('#primary-menu a', { hasText: 'Settings' }).click();
    await page.locator('dialog.fg-settings').waitFor();
  };
  const refresh = () => page.locator('.fg-settings-refresh').click();
  const done = () => page.waitForFunction(() => !document.querySelector('.fg-settings-refresh').disabled, null, { timeout: 15000 });
  const out = {};

  await open('/');
  await page.evaluate(() => { localStorage.clear(); window.__samePage = true; });

  // Nothing saved yet, with the filter bar closed
  await openPanel();
  await page.waitForTimeout(200);
  await page.screenshot({ path: SHOTS + '/refresh-before.png' });
  tagRequests = 0;
  await refresh();
  out.whileRefreshing = await panelState();
  await done();
  out.afterRefresh = { ...(await panelState()), saved: await saved(), tagRequests };
  await page.screenshot({ path: SHOTS + '/refresh-after.png' });

  // A short old list with the filter open is replaced, and the panel never reloads the page
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('fg-filterTagCache'));
    c.tags = c.tags.slice(0, 5);
    localStorage.setItem('fg-filterTagCache', JSON.stringify(c));
  });
  await open('/');
  await page.evaluate(() => { window.__samePage = true; });
  await page.locator('.fg-filter summary').click();
  await page.waitForTimeout(300);
  const before = (await panelState()).filterOptions;
  await openPanel();
  await refresh();
  await done();
  out.updatesOpenFilter = { before, ...(await panelState()), saved: await saved() };
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const input = page.locator('[data-list="filterInclude"] input');
  await input.fill('Action');
  await input.press('Enter');
  await page.waitForTimeout(300);
  out.refreshedTagUsable = await page.evaluate(() => [...document.querySelectorAll('[data-list="filterInclude"] .fg-filter-chips button')].map(b => b.textContent));

  // Failure leaves the saved list alone and the button usable
  await open('/');
  await page.evaluate(() => { window.__samePage = true; });
  await page.route('**/wp-json/wp/v2/tags*', r => r.fulfill({ status: 500, body: '{}' }));
  await openPanel();
  await refresh();
  await done();
  out.failure = { ...(await panelState()), saved: await saved() };
  await page.unroute('**/wp-json/wp/v2/tags*');
  await refresh();
  await done();
  out.retryAfterFailure = await panelState();

  // A page with no filter bar, and closing with Close without any setting changed
  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(500);
  out.closeWithNoSettingChange = await page.evaluate(() => ({ open: document.querySelector('dialog.fg-settings').open, samePage: window.__samePage === true }));
  await open('/donations/');
  await openPanel();
  await refresh();
  await done();
  out.pageWithoutFilter = (await panelState()).status;

  out.errors = errors;
  await context.close();
  return out;
}

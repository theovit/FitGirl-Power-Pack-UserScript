/*
 * Tests Page Up and Page Down snapping on the live site: each press puts a post just under the header,
 * filtered posts are skipped, infinite scroll keeps up, and keys are left alone when they should be.
 * Input: none.
 * Usage: Playwright MCP browser_run_code_unsafe with filename set to this file; paths are relative to the folder holding this repo.
 * Injects with GM_* shims, not through Tampermonkey.
 */
async (defaultPage) => {
  const USERSCRIPT = 'FitGirl-Power-Pack-UserScript/FitGirl Power Pack.user.js';
  const context = await defaultPage.context().browser().newContext({ viewport: null });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const SHIMS = `window.GM_addStyle = css => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); return s; }; window.GM_xmlhttpRequest = () => {}; window.GM_getValue = (k, d) => { const v = localStorage.getItem("fg-" + k); return v === null ? d : JSON.parse(v); }; window.GM_setValue = (k, v) => localStorage.setItem("fg-" + k, JSON.stringify(v)); window.GM_registerMenuCommand = () => {};`;
  page.on('domcontentloaded', async () => {
    await page.addScriptTag({ content: SHIMS }).catch(() => {});
    await page.addScriptTag({ path: USERSCRIPT }).catch(() => {});
    await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => getComputedStyle(e).position === 'fixed' && /Discover more/.test(e.textContent)).forEach(e => e.remove())).catch(() => {});
  });
  const open = async (path, filters) => {
    await page.goto('https://fitgirl-repacks.site/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    if (filters) await page.evaluate(f => sessionStorage.setItem('fg-filters', JSON.stringify(f)), filters);
    await page.goto('https://fitgirl-repacks.site' + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
  };
  // The post nearest the snap line, and how far its top is from the bottom of the header
  const where = () => page.evaluate(() => {
    const header = document.querySelector('#masthead');
    const bottom = header.getBoundingClientRect().bottom;
    const shown = [...document.querySelectorAll('article')].filter(p => p.offsetParent !== null);
    const nearest = shown.map((p, i) => ({ i, gap: Math.round(p.getBoundingClientRect().top - bottom), title: p.querySelector('.entry-title')?.textContent.trim().slice(0, 28) })).sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))[0];
    return { ...nearest, scrollY: Math.round(scrollY), shown: shown.length, total: document.querySelectorAll('article').length };
  });
  const press = async key => { await page.keyboard.press(key); await page.waitForTimeout(150); return where(); };
  const out = {};

  await page.goto('https://fitgirl-repacks.site/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await open('/');
  out.start = await where();
  out.down = [await press('PageDown'), await press('PageDown'), await press('PageDown')];
  out.up = [await press('PageUp'), await press('PageUp')];

  // From the middle of a post, up returns to that post's top, and down goes to the next one
  await page.keyboard.press('PageDown');
  await page.evaluate(() => scrollBy(0, 400));
  out.midPost = await where();
  out.upFromMid = await press('PageUp');
  await page.evaluate(() => scrollBy(0, 400));
  out.downFromMid = await press('PageDown');

  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(100);
  await page.keyboard.press('PageDown');
  out.upToVeryTop = [await press('PageUp'), await press('PageUp')];

  // Holding it down past what's loaded, so infinite scroll has to keep up
  await open('/');
  const seen = [];
  for (let i = 0; i < 35; i++) {
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(350);
    if (i % 7 === 6) seen.push(await where());
  }
  out.manyPresses = seen;

  // Filtered posts are skipped
  await open('/category/lossless-repack/', { filterInclude: [{ slug: 'action', name: 'Action' }], filterExclude: [] });
  const filtered = [];
  for (let i = 0; i < 3; i++) filtered.push(await press('PageDown'));
  out.filtered = filtered;
  out.filteredAllAction = await page.evaluate(() => [...document.querySelectorAll('article')].filter(p => p.offsetParent !== null).every(p => p.classList.contains('tag-action')));

  // Keys left alone: typing, the settings panel, modifiers, and other page types
  await open('/');
  await page.locator('.fg-filter summary').click();
  const input = page.locator('[data-list="filterInclude"] input');
  await input.focus();
  const beforeTyping = await where();
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(150);
  out.whileTyping = { before: beforeTyping.scrollY, after: (await where()).scrollY, focusKept: await input.evaluate(e => document.activeElement === e) };
  await input.blur();
  await page.locator('#primary-menu a', { hasText: 'Settings' }).click();
  const beforePanel = await where();
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(150);
  out.panelOpen = { before: beforePanel.scrollY, after: (await where()).scrollY };
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const beforeModifier = await where();
  await page.keyboard.press('Shift+PageDown');
  await page.waitForTimeout(200);
  out.withShift = { nearestGapBefore: beforeModifier.gap, nearestGapAfter: (await where()).gap };

  await open('/upcoming-repacks-10/');
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(400);
  out.singlePostUsesNormalScroll = await where();

  await open('/page/817/');
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(150);
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(150);
  const atLast = await where();
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(500);
  out.pastLastPost = { before: atLast.scrollY, after: (await where()).scrollY, endMessage: await page.locator('.fg-filter-searching').textContent() };

  await page.evaluate(() => localStorage.setItem('fg-pageKeys', 'false'));
  await open('/');
  await page.evaluate(() => localStorage.setItem('fg-pageKeys', 'false'));
  await page.goto('https://fitgirl-repacks.site/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(400);
  out.settingOff = await where();

  // Arrow keys keep scrolling normally
  await page.evaluate(() => localStorage.removeItem('fg-pageKeys'));
  await open('/');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(400);
  out.arrowKeyNormalScroll = await where();

  out.errors = errors;
  await context.close();
  return out;
}

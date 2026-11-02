/*
 * Exercises the tag filter on the live site: tag loading, include, exclude, persistence,
 * infinite scroll, page types, the empty-search pause, and tag load failure.
 * Input: none.
 * Usage: Playwright MCP browser_run_code_unsafe with filename set to this file.
 * Stores values in localStorage through GM_* shims, not through Tampermonkey.
 * Datalist popups can't be clicked here, so tags are typed and confirmed with Enter.
 */
async (defaultPage) => {
  const USERSCRIPT = 'D:/GitHub/FitGirl-Power-Pack-UserScript/FitGirl Power Pack.user.js';
  const SHOTS = 'C:/Users/Andrew/AppData/Local/Temp/claude/D--GitHub/a85b545d-3b74-4545-b5ad-f306bf0b875c/scratchpad';
  const BASE = 'https://fitgirl-repacks.site';
  const context = await defaultPage.context().browser().newContext({ viewport: null });
  const page = await context.newPage();
  const errors = [];
  let pageRequests = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.resourceType() === 'fetch' && /\/page\/\d+\/$/.test(r.url())) pageRequests++; });

  const SHIMS = `
    window.GM_addStyle = css => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); return s; };
    window.GM_xmlhttpRequest = () => {};
    window.GM_getValue = (k, d) => { const v = localStorage.getItem("fg-" + k); return v === null ? d : JSON.parse(v); };
    window.GM_setValue = (k, v) => localStorage.setItem("fg-" + k, JSON.stringify(v));
    window.GM_registerMenuCommand = () => {};`;
  // Injected on every load, because changing a filter after posts were discarded reloads the page
  page.on('domcontentloaded', async () => {
    await page.addScriptTag({ content: SHIMS }).catch(() => {});
    await page.addScriptTag({ path: USERSCRIPT }).catch(() => {});
    await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => getComputedStyle(e).position === 'fixed' && /Discover more/.test(e.textContent)).forEach(e => e.remove())).catch(() => {});
  });
  const open = async path => {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
  };
  const setFilters = async (include = [], exclude = []) => {
    await page.evaluate(([i, e]) => {
      localStorage.setItem('fg-filterInclude', JSON.stringify(i));
      localStorage.setItem('fg-filterExclude', JSON.stringify(e));
    }, [include, exclude]);
  };
  const tag = (slug, name) => ({ slug, name });
  const state = () => page.evaluate(() => {
    const posts = [...document.querySelectorAll('article')];
    return {
      bar: !!document.querySelector('.fg-filter'),
      open: document.querySelector('.fg-filter')?.open,
      status: document.querySelector('.fg-filter-status')?.textContent,
      options: document.querySelectorAll('#fg-filter-tags option').length,
      inPage: posts.length,
      shown: posts.filter(p => p.offsetParent !== null).length,
      include: [...document.querySelectorAll('[data-list="filterInclude"] .fg-filter-chips button')].map(b => b.textContent),
      exclude: [...document.querySelectorAll('[data-list="filterExclude"] .fg-filter-chips button')].map(b => b.textContent),
    };
  });
  const everyShownHas = name => page.evaluate(name => [...document.querySelectorAll('article')].filter(p => p.offsetParent !== null).every(p => p.classList.contains('tag-' + name)), name);
  const noShownHas = name => page.evaluate(name => ![...document.querySelectorAll('article')].filter(p => p.offsetParent !== null).some(p => p.classList.contains('tag-' + name)), name);
  const pick = async (column, name) => {
    const input = page.locator(`[data-list="${column}"] input`);
    await input.fill(name);
    await input.press('Enter');
    await page.waitForTimeout(200);
  };
  const tagsReady = () => page.waitForFunction(() => document.querySelectorAll('#fg-filter-tags option').length > 0, null, { timeout: 15000 });
  const out = {};

  // Picking through the bar, before anything has been discarded
  await page.goto(BASE + '/');
  await page.evaluate(() => localStorage.clear());
  await open('/');
  out.defaultHome = await state();
  await page.locator('.fg-filter summary').click();
  await tagsReady();
  out.tagsLoaded = (await state()).options;
  await pick('filterInclude', 'notarealtag');
  out.fakeTag = { ...(await state()), inputKept: await page.locator('[data-list="filterInclude"] input').inputValue() };
  await page.locator('[data-list="filterInclude"] input').fill('');
  await pick('filterExclude', 'action');
  out.typedExclude = { ...(await state()), noAction: await noShownHas('action') };
  await page.screenshot({ path: SHOTS + '/filter-exclude.png' });

  // Tag moved between lists stays in one list, in storage
  await setFilters([], [tag('action', 'Action')]);
  await open('/');
  await tagsReady();
  await pick('filterInclude', 'Action');
  await page.waitForTimeout(1500);
  out.movedToInclude = await page.evaluate(() => ({ include: localStorage.getItem('fg-filterInclude'), exclude: localStorage.getItem('fg-filterExclude') }));

  // Both lists together, reload, and scrolling
  await setFilters([tag('action', 'Action')], [tag('first-person', 'First-person')]);
  await open('/');
  await page.waitForTimeout(2500);
  out.both = { ...(await state()), allAction: await everyShownHas('action'), noFirst: await noShownHas('first-person') };
  await page.screenshot({ path: SHOTS + '/filter-both.png' });
  await page.mouse.move(800, 600);
  for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, 500); await page.waitForTimeout(150); }
  await page.waitForTimeout(1500);
  out.afterScroll = { ...(await state()), allAction: await everyShownHas('action'), noFirst: await noShownHas('first-person') };

  // Clearing after posts were discarded brings them back through a reload
  await page.evaluate(() => scrollTo(0, 0));
  await Promise.all([page.waitForEvent('domcontentloaded'), page.locator('.fg-filter-clear').click()]);
  await page.waitForTimeout(1500);
  out.clearedAfterDiscard = { ...(await state()), stored: await page.evaluate(() => localStorage.getItem('fg-filterInclude')) };

  // Other page types
  await setFilters([tag('action', 'Action')], []);
  for (const path of ['/page/2/', '/category/lossless-repack/', '/tag/rpg/', '/?s=racing', '/2026/10/']) {
    await open(path);
    out['page ' + path] = { ...(await state()), allAction: await everyShownHas('action') };
  }
  for (const path of ['/upcoming-repacks-10/', '/popular-repacks/', '/donations/']) {
    await open(path);
    const s = await state();
    out['not a list ' + path] = { bar: s.bar, inPage: s.inPage, shown: s.shown };
  }

  // A filter nothing matches pauses after 20 pages, then scrolling resumes it
  await setFilters([tag('no-such-tag', 'Nothing')], []);
  pageRequests = 0;
  const started = Date.now();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /keep looking/.test(document.querySelector('.fg-filter-status')?.textContent || ''), null, { timeout: 60000 });
  out.emptySearch = { ...(await state()), pageRequests, seconds: Math.round((Date.now() - started) / 1000) };
  await page.waitForTimeout(3000);
  out.staysPaused = pageRequests;
  await page.mouse.move(800, 600);
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(3500);
  out.resumedByWheel = { ...(await state()), pageRequests };

  // Tag loading failure, then a working reopen
  await setFilters();
  await page.route('**/wp-json/wp/v2/tags*', r => r.fulfill({ status: 500, body: '{}' }));
  await open('/');
  await page.locator('.fg-filter summary').click();
  await page.waitForTimeout(800);
  out.tagFailure = await page.locator('[data-list="filterInclude"] input').getAttribute('placeholder');
  await page.unroute('**/wp-json/wp/v2/tags*');
  await page.locator('.fg-filter summary').click();
  await page.locator('.fg-filter summary').click();
  await tagsReady();
  out.tagRetry = (await state()).options;

  // Setting turned off ignores a saved filter
  await setFilters([], [tag('3d', '3D')]);
  await page.evaluate(() => localStorage.setItem('fg-gameFilter', 'false'));
  await open('/');
  const off = await state();
  out.settingOff = { bar: off.bar, shown: off.shown, inPage: off.inPage };

  out.errors = errors;
  await context.close();
  return out;
}

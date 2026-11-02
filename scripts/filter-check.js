/*
 * Exercises the tag filter on the live site: tag loading, include, exclude, persistence,
 * infinite scroll, page types, the auto-load limit, and tag load failure.
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
  const open = async path => {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ content: SHIMS });
    await page.addScriptTag({ path: USERSCRIPT });
    await page.waitForTimeout(1200);
    await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => getComputedStyle(e).position === 'fixed' && /Discover more/.test(e.textContent)).forEach(e => e.remove()));
  };
  const state = () => page.evaluate(() => {
    const posts = [...document.querySelectorAll('article')];
    const shown = posts.filter(p => p.offsetParent !== null);
    return {
      bar: !!document.querySelector('.fg-filter'),
      open: document.querySelector('.fg-filter')?.open,
      status: document.querySelector('.fg-filter-status')?.textContent,
      options: document.querySelectorAll('#fg-filter-tags option').length,
      posts: posts.length,
      shown: shown.length,
      include: [...document.querySelectorAll('[data-list="filterInclude"] .fg-filter-chips button')].map(b => b.textContent),
      exclude: [...document.querySelectorAll('[data-list="filterExclude"] .fg-filter-chips button')].map(b => b.textContent),
    };
  });
  const everyShownHas = tag => page.evaluate(tag => [...document.querySelectorAll('article')].filter(p => p.offsetParent !== null).every(p => p.classList.contains('tag-' + tag)), tag);
  const noShownHas = tag => page.evaluate(tag => ![...document.querySelectorAll('article')].filter(p => p.offsetParent !== null).some(p => p.classList.contains('tag-' + tag)), tag);
  const pick = async (column, name) => {
    const input = page.locator(`[data-list="${column}"] input`);
    await input.fill(name);
    await input.press('Enter');
    await page.waitForTimeout(200);
  };
  const openBar = async () => {
    await page.locator('.fg-filter summary').click();
    await page.waitForFunction(() => document.querySelectorAll('#fg-filter-tags option').length > 0, null, { timeout: 15000 });
  };
  const out = {};

  await open('/');
  out.defaultHome = await state();
  await openBar();
  out.tagsLoaded = (await state()).options;

  await pick('filterExclude', '3d');
  out.exclude3d = { ...(await state()), none3d: await noShownHas('3d') };
  await page.screenshot({ path: SHOTS + '/filter-exclude.png' });

  await page.locator('.fg-filter-clear').click();
  out.cleared = await state();

  await pick('filterInclude', 'Action');
  out.includeAction = { ...(await state()), allAction: await everyShownHas('action') };

  // Moving a tag between lists, and a name that isn't a tag
  await pick('filterExclude', 'Action');
  out.movedToExclude = await state();
  await pick('filterInclude', 'notarealtag');
  out.fakeTag = { ...(await state()), inputKept: await page.locator('[data-list="filterInclude"] input').inputValue() };
  await page.locator('[data-list="filterInclude"] input').fill('');
  await page.locator('.fg-filter-clear').click();

  await pick('filterInclude', 'Action');
  await pick('filterExclude', 'First-person');
  out.both = { ...(await state()), allAction: await everyShownHas('action'), noFirst: await noShownHas('first-person') };
  await page.waitForTimeout(800);

  await open('/');
  out.afterReload = { ...(await state()), allAction: await everyShownHas('action'), noFirst: await noShownHas('first-person') };
  await page.screenshot({ path: SHOTS + '/filter-both.png' });

  await page.locator('a.next.page-numbers').scrollIntoViewIfNeeded();
  await page.waitForTimeout(3000);
  out.afterScroll = { ...(await state()), allAction: await everyShownHas('action'), noFirst: await noShownHas('first-person') };

  for (const path of ['/page/2/', '/category/lossless-repack/', '/tag/rpg/', '/?s=racing', '/2026/10/']) {
    await open(path);
    out['page ' + path] = { ...(await state()), allAction: await everyShownHas('action') };
  }
  for (const path of ['/upcoming-repacks-10/', '/popular-repacks/', '/donations/']) {
    await open(path);
    const s = await state();
    out['not a list ' + path] = { bar: s.bar, posts: s.posts, shown: s.shown };
  }

  // Auto-load limit with a rare tag, with no scrolling
  await open('/');
  await page.waitForFunction(() => document.querySelectorAll('#fg-filter-tags option').length > 0, null, { timeout: 15000 });
  await page.locator('.fg-filter-clear').click();
  await page.waitForTimeout(3000);
  pageRequests = 0;
  await pick('filterInclude', 'Hunting');
  await page.waitForTimeout(15000);
  out.rareTag = { ...(await state()), pageRequests };
  await page.locator('.fg-filter-clear').click();
  await page.waitForTimeout(500);

  // Tag loading failure, then a working reopen
  await page.route('**/wp-json/wp/v2/tags*', r => r.fulfill({ status: 500, body: '{}' }));
  await open('/');
  await page.locator('.fg-filter summary').click();
  await page.waitForTimeout(800);
  out.tagFailure = await page.locator('[data-list="filterInclude"] input').getAttribute('placeholder');
  await page.unroute('**/wp-json/wp/v2/tags*');
  await page.locator('.fg-filter summary').click();
  await page.locator('.fg-filter summary').click();
  await page.waitForFunction(() => document.querySelectorAll('#fg-filter-tags option').length > 0, null, { timeout: 15000 });
  out.tagRetry = (await state()).options;

  // Setting turned off
  await page.evaluate(() => {
    GM_setValue('filterExclude', [{ slug: '3d', name: '3D' }]);
    GM_setValue('gameFilter', false);
  });
  await open('/');
  const off = await state();
  out.settingOff = { bar: off.bar, shown: off.shown, posts: off.posts };

  out.errors = errors;
  await context.close();
  return out;
}

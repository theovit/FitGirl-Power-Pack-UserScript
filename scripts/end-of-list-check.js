/*
 * Checks the hidden page bar and end-of-list messages on the live site: scrolling still
 * loads, the last page and short lists say there's nothing more, and the paused wording.
 * Input: none.
 * Usage: Playwright MCP browser_run_code_unsafe with filename set to this file.
 * Injects with GM_* shims, not through Tampermonkey.
 */
async (defaultPage) => {
  const USERSCRIPT = 'D:/GitHub/FitGirl-Power-Pack-UserScript/FitGirl Power Pack.user.js';
  const SHOTS = 'C:/Users/Andrew/AppData/Local/Temp/claude/D--GitHub/a85b545d-3b74-4545-b5ad-f306bf0b875c/scratchpad';
  const BASE = 'https://fitgirl-repacks.site';
  const context = await defaultPage.context().browser().newContext({ viewport: null });
  const page = await context.newPage();
  const errors = [];
  let requests = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.resourceType() === 'fetch' && /\/page\/\d+\/$/.test(r.url())) requests++; });
  const SHIMS = `window.GM_addStyle = css => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); return s; }; window.GM_xmlhttpRequest = () => {}; window.GM_getValue = (k, d) => { const v = localStorage.getItem("fg-" + k); return v === null ? d : JSON.parse(v); }; window.GM_setValue = (k, v) => localStorage.setItem("fg-" + k, JSON.stringify(v)); window.GM_registerMenuCommand = () => {};`;
  page.on('domcontentloaded', async () => {
    await page.addScriptTag({ content: SHIMS }).catch(() => {});
    await page.addScriptTag({ path: USERSCRIPT }).catch(() => {});
    await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => getComputedStyle(e).position === 'fixed' && /Discover more/.test(e.textContent)).forEach(e => e.remove())).catch(() => {});
  });
  const start = async (path, values = {}) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ filterInclude, ...settings }) => {
      localStorage.clear();
      for (const k in settings) localStorage.setItem('fg-' + k, JSON.stringify(settings[k]));
      // Filters only survive one load, which is all this needs
      if (filterInclude) sessionStorage.setItem('fg-filters', JSON.stringify({ filterInclude, filterExclude: [] }));
    }, values);
    requests = 0;
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
  };
  const read = () => page.evaluate(() => {
    const nav = document.querySelector('nav.paging-navigation');
    const message = document.querySelector('.fg-filter-searching');
    const box = nav?.getBoundingClientRect();
    return {
      bar: nav ? { visibility: getComputedStyle(nav).visibility, height: Math.round(box.height) } : null,
      message: message?.textContent ?? null,
      messageVisible: message ? message.offsetParent !== null : false,
      messageLink: message?.querySelector('a')?.getAttribute('href') ?? null,
      afterLastPost: message ? !!([...document.querySelectorAll('article')].pop().compareDocumentPosition(message) & 4) : null,
      posts: document.querySelectorAll('article').length,
      status: document.querySelector('.fg-filter-status')?.textContent,
    };
  });
  const wheel = async (times, delta = 800) => {
    await page.mouse.move(800, 600);
    for (let i = 0; i < times; i++) { await page.mouse.wheel(0, delta); await page.waitForTimeout(120); }
  };
  const out = {};

  await start('/');
  out.homeNoRunaway = { ...(await read()), requestsBeforeScrolling: requests };
  await wheel(40);
  await page.waitForTimeout(2000);
  out.homeAfterScroll = { ...(await read()), requests };
  await page.screenshot({ path: SHOTS + '/no-page-bar.png' });

  await start('/page/816/');
  await wheel(40);
  await page.waitForTimeout(2500);
  out.scrolledToLastPage = await read();
  await page.evaluate(() => document.querySelector('.fg-filter-searching').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOTS + '/end-of-list.png' });

  await start('/page/817/');
  out.openedLastPage = await read();

  const shortTag = await page.evaluate(async () => {
    const all = [];
    for (let i = 1; i <= 4; i++) all.push(...await (await fetch('/wp-json/wp/v2/tags?per_page=100&page=' + i)).json());
    return all.filter(t => t.count > 0 && t.count < 8)[0].slug;
  });
  await start(`/tag/${shortTag}/`);
  out.shortList = { shortTag, ...(await read()) };

  await start('/upcoming-repacks-10/');
  out.singlePost = await read();

  const nothing = [{ slug: 'no-such-tag', name: 'Nothing' }];
  await start('/', { filterInclude: nothing });
  await page.waitForFunction(() => document.querySelector('.fg-filter-searching a'), null, { timeout: 30000 });
  out.slowSearch = await read();
  await page.waitForFunction(() => /No matches/.test(document.querySelector('.fg-filter-searching')?.textContent || ''), null, { timeout: 60000 });
  out.paused = await read();
  const pausedAt = requests;
  await page.waitForTimeout(3000);
  out.stopsLoading = requests === pausedAt;
  await page.evaluate(() => document.querySelector('.fg-filter-searching').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOTS + '/paused-message.png' });

  await start('/', { filterInclude: nothing, tags: false });
  await page.waitForFunction(() => /No matches/.test(document.querySelector('.fg-filter-searching')?.textContent || ''), null, { timeout: 60000 });
  out.pausedTagsOff = await read();

  await start('/', { infiniteScroll: false });
  out.infiniteOff = { ...(await read()), requests };
  await start('/page/817/', { infiniteScroll: false });
  out.infiniteOffLastPage = await read();

  out.errors = errors;
  await context.close();
  return out;
}

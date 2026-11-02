/*
 * Scrolls the live main page at several speeds and reports how close the viewport
 * got to the end of the loaded posts. A gap at or below 0 means the end came into view.
 * Input: none; edit USERSCRIPTS to compare versions and PAGE_DELAY to simulate a slower connection.
 * Usage: Playwright MCP browser_run_code_unsafe with filename set to this file.
 * Injects with GM_* shims, not through Tampermonkey.
 */
async (defaultPage) => {
  const USERSCRIPTS = { current: 'D:/GitHub/FitGirl-Power-Pack-UserScript/FitGirl Power Pack.user.js' };
  const PAGE_DELAY = 500;
  const browser = defaultPage.context().browser();

  const run = async (path, pixelsPerSecond) => {
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/page/*', async route => {
      await new Promise(done => setTimeout(done, PAGE_DELAY));
      await route.continue();
    });
    await page.goto('https://fitgirl-repacks.site/', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ content: 'window.GM_addStyle = css => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); }; window.GM_xmlhttpRequest = () => {}; window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_registerMenuCommand = () => {};' });
    await page.addScriptTag({ path });
    await page.waitForTimeout(1500);
    const start = await page.evaluate(() => {
      window.__smallestGap = Infinity;
      const measure = () => {
        const next = document.querySelector('a.next.page-numbers');
        if (next) window.__smallestGap = Math.min(window.__smallestGap, next.getBoundingClientRect().top - innerHeight);
        requestAnimationFrame(measure);
      };
      measure();
      return { articles: document.querySelectorAll('article').length, gapAtStart: Math.round(document.querySelector('a.next.page-numbers').getBoundingClientRect().top - innerHeight) };
    });
    await page.mouse.move(800, 600);
    const stepMs = 50;
    for (let elapsed = 0; elapsed < 8000; elapsed += stepMs) {
      await page.mouse.wheel(0, pixelsPerSecond * stepMs / 1000);
      await page.waitForTimeout(stepMs);
    }
    const result = await page.evaluate(() => ({ smallestGap: Math.round(window.__smallestGap), articles: document.querySelectorAll('article').length, scrolled: Math.round(scrollY) }));
    await context.close();
    return { ...start, ...result, errors };
  };

  const out = {};
  for (const [name, path] of Object.entries(USERSCRIPTS)) {
    out[name] = {};
    for (const speed of [1000, 2500, 5000]) out[name][speed + 'px/s'] = await run(path, speed);
  }
  return out;
}

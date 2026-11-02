/*
 * Tests the back to top button on the live site: when it shows, that clicking it returns
 * to the top after infinite scroll has added posts, other page types, and its setting.
 * Input: none.
 * Usage: Playwright MCP browser_run_code_unsafe with filename set to this file; paths are relative to the folder holding this repo.
 * Injects with GM_* shims, not through Tampermonkey.
 */
async (defaultPage) => {
  const USERSCRIPT = 'FitGirl-Power-Pack-UserScript/FitGirl Power Pack.user.js';
  const SHOTS = '.playwright-mcp';
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
  const open = async path => {
    await page.goto('https://fitgirl-repacks.site' + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
  };
  const read = () => page.evaluate(() => {
    const button = document.querySelector('.fg-back-to-top');
    const box = button?.getBoundingClientRect();
    const hit = box && box.width ? document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) : null;
    return {
      exists: !!button,
      visible: !!box && box.width > 0,
      onTop: hit === button,
      scrollY: Math.round(scrollY),
      viewportHeight: innerHeight,
      posts: document.querySelectorAll('article').length,
    };
  });
  const out = {};

  await open('/');
  await page.evaluate(() => localStorage.clear());
  await open('/');
  out.atTop = await read();
  await page.mouse.move(800, 600);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(400);
  out.lessThanOneScreen = await read();
  for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 800); await page.waitForTimeout(120); }
  await page.waitForTimeout(1500);
  out.afterLongScroll = await read();
  await page.screenshot({ path: SHOTS + '/back-to-top.png' });
  await page.locator('.fg-back-to-top').click();
  await page.waitForFunction(() => scrollY === 0, null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
  out.afterClick = await read();

  await page.locator('#primary-menu a', { hasText: 'Settings' }).click();
  out.settingListed = await page.getByLabel('Back to top button').isChecked();
  await page.keyboard.press('Escape');

  for (const path of ['/upcoming-repacks-10/', '/tag/3d/', '/donations/', '/tags']) {
    await open(path);
    await page.evaluate(() => scrollTo(0, innerHeight * 1.5));
    await page.waitForTimeout(300);
    const s = await read();
    out['page ' + path] = { exists: s.exists, visible: s.visible, onTop: s.onTop, scrollY: s.scrollY };
  }

  await open('/');
  await page.evaluate(() => localStorage.setItem('fg-backToTop', 'false'));
  await open('/');
  await page.evaluate(() => scrollTo(0, innerHeight * 2));
  await page.waitForTimeout(300);
  out.settingOff = await read();

  out.errors = errors;
  await context.close();
  return out;
}

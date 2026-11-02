/*
 * Compares the right sidebar across page types on the live site against the main page:
 * position, support image size, overlap with page content, and its setting.
 * Input: none.
 * Usage: Playwright MCP browser_run_code_unsafe with filename set to this file; paths are relative to the folder holding this repo.
 * Injects with GM_* shims, not through Tampermonkey.
 */
async (defaultPage) => {
  const USERSCRIPT = 'FitGirl-Power-Pack-UserScript/FitGirl Power Pack.user.js';
  const SHOTS = '.playwright-mcp';
  const PAGES = { home: '/', tag: '/tag/3d/', search: '/?s=racing', game: '/deep-rock-galactic/', faq: '/faq/', donate: '/donations/', paw: '/games-with-my-personal-pink-paw-award/', popular: '/popular-repacks/', az: '/all-my-repacks-a-z/', contacts: '/contacts/', tags: '/tags', notFound: '/no-such-page-xyz/' };
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
  const read = () => page.evaluate(() => {
    const box = e => { if (!e) return null; const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); };
    const side = document.querySelector('#content-sidebar');
    const sideLeft = side.getBoundingClientRect().left;
    // Text blocks in the page content that run underneath the sidebar
    const overlaps = side.getBoundingClientRect().width === 0 ? [] : [...document.querySelectorAll('#content p, #content li, #content table, #content h1, #content h2, #content h3, #content img, #content iframe')]
      .filter(e => e.getClientRects().length && e.getBoundingClientRect().right > sideLeft + 1)
      .map(e => e.tagName + ':' + Math.round(e.getBoundingClientRect().right));
    const images = [...side.querySelectorAll('img')];
    return {
      sidebar: box(side),
      support: box(document.querySelector('.fg-support, img[src*="support2"]')),
      supportRecolored: document.querySelector('.fg-support')?.src.startsWith('data:image/png') ?? false,
      popularImages: images.length,
      popularLoaded: images.filter(i => i.complete && i.naturalWidth > 0).length,
      content: box(document.querySelector('#content')),
      overlaps: overlaps.slice(0, 6),
      overlapCount: overlaps.length,
      pageWidth: document.documentElement.scrollWidth,
    };
  });

  const out = {};
  await page.goto('https://fitgirl-repacks.site/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => localStorage.clear());
  for (const [name, path] of Object.entries(PAGES)) {
    await page.goto('https://fitgirl-repacks.site' + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    out[name] = await read();
    if (['faq', 'donate', 'popular', 'az', 'tags'].includes(name)) await page.screenshot({ path: `${SHOTS}/sidebar-${name}.png` });
  }
  await page.evaluate(() => localStorage.setItem('fg-rightSidebar', 'false'));
  await page.goto('https://fitgirl-repacks.site/faq/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  out.settingOffFaq = await read();
  await page.goto('https://fitgirl-repacks.site/tags', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  out.settingOffTags = await read();
  out.errors = errors;
  await context.close();
  return out;
}

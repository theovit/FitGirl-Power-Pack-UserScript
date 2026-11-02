/*
 * Measures page layout at several window widths on the live site, with and without the
 * script: sideways overflow, whether the right sidebar is cut off, and overlap with posts.
 * Input: none; edit WIDTHS and PAGES to try others, or SCRIPTS to compare versions.
 * Usage: Playwright MCP browser_run_code_unsafe with filename set to this file; paths are relative to the folder holding this repo.
 * Injects with GM_* shims, not through Tampermonkey.
 */
async (defaultPage) => {
  const SCRIPTS = { withScript: 'FitGirl-Power-Pack-UserScript/FitGirl Power Pack.user.js' };
  const WIDTHS = [2560, 1920, 1700, 1600, 1440, 1366, 1301, 1280, 1100, 1024, 1008, 1000, 900, 768, 674, 600, 390];
  const PAGES = { home: '/', faq: '/faq/' };
  const SHOT_WIDTHS = [1920, 1440, 1366, 1024, 768, 390];
  const SHIMS = `window.GM_addStyle = css => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); return s; }; window.GM_xmlhttpRequest = () => {}; window.GM_getValue = (k, d) => { const v = localStorage.getItem("fg-" + k); return v === null ? d : JSON.parse(v); }; window.GM_setValue = (k, v) => localStorage.setItem("fg-" + k, JSON.stringify(v)); window.GM_registerMenuCommand = () => {};`;
  const browser = defaultPage.context().browser();
  const out = {};
  // One compact line per width, because the full report is long
  const brief = r => `overflow ${r.overflow}, cut ${r.sidebarCutOff}, side ${r.sidebarWidth}, over ${r.sidebarOverContent}, content ${r.contentWidth}, post ${r.postWidth}, page ${r.pageWidth}, headerH ${r.headerHeight}, menuClipped ${r.menuClipped}, ${JSON.stringify(r.culprits)}`;
  for (const [version, script] of Object.entries(SCRIPTS)) {
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const [name, path] of Object.entries(PAGES)) {
      await page.goto('https://fitgirl-repacks.site' + path, { waitUntil: 'domcontentloaded' });
      if (script) {
        await page.addScriptTag({ content: SHIMS });
        await page.addScriptTag({ path: script });
      }
      await page.waitForTimeout(2000);
      await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => getComputedStyle(e).position === 'fixed' && /Discover more/.test(e.textContent)).forEach(e => e.remove()));
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(250);
        const result = await page.evaluate(() => {
          const box = e => { if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) }; };
          const client = document.documentElement.clientWidth;
          const side = box(document.querySelector('#content-sidebar'));
          const left = box(document.querySelector('#secondary'));
          const content = box(document.querySelector('#content'));
          const post = box(document.querySelector('article'));
          const pageBox = box(document.querySelector('#page'));
          // Which visible elements stick out past the window, grouped by their top-level section
          const culprits = {};
          for (const e of document.querySelectorAll('body *')) {
            if (!e.getClientRects().length) continue;
            const r = e.getBoundingClientRect();
            if (r.right > client + 1 && r.width > 0 && getComputedStyle(e).position !== 'fixed') {
              const area = e.closest('#content-sidebar') ? 'sidebar' : e.closest('#secondary') ? 'left' : e.closest('#masthead') ? 'header' : e.closest('#content') ? 'content' : e.tagName + '#' + e.id;
              culprits[area] = Math.max(culprits[area] || 0, Math.round(r.right - client));
            }
          }
          return {
            overflow: document.documentElement.scrollWidth - client,
            sidebarCutOff: side ? Math.max(0, side.right - client) : null,
            sidebarWidth: side?.width ?? 'hidden',
            sidebarOverContent: side && content ? Math.max(0, content.right - side.left) : null,
            contentWidth: content?.width ?? null,
            postWidth: post?.width ?? null,
            leftWidth: left?.width ?? 'hidden',
            pageWidth: pageBox?.width,
            headerHeight: Math.round(document.querySelector('#masthead')?.getBoundingClientRect().height),
            menuClipped: [...document.querySelectorAll('#masthead #primary-menu > li, #masthead .search-toggle')].filter(e => e.getClientRects().length && e.getBoundingClientRect().right > client + 1).length,
            culprits,
          };
        });
        out[`${version} ${name} ${width}`] = brief(result);
        if (name === 'home' && SHOT_WIDTHS.includes(width)) await page.screenshot({ path: `.playwright-mcp/width-${version}-${width}.png` });
      }
    }
    out[version + ' errors'] = errors;
    await context.close();
  }
  return out;
}

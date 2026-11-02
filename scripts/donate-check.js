/*
 * Checks on the live site that a donate box only shows when the post above it shows,
 * with tag filters and hide settings, and that nothing else between posts is hidden.
 * Input: none; edit CASES to try other pages and filters.
 * Usage: Playwright MCP browser_run_code_unsafe with filename set to this file.
 * Injects with GM_* shims, not through Tampermonkey.
 */
async (defaultPage) => {
  const USERSCRIPT = 'D:/GitHub/FitGirl-Power-Pack-UserScript/FitGirl Power Pack.user.js';
  const SHOTS = 'C:/Users/Andrew/AppData/Local/Temp/claude/D--GitHub/a85b545d-3b74-4545-b5ad-f306bf0b875c/scratchpad';
  const tag = (slug, name) => ({ slug, name });
  // The site itself hides donate boxes on the main page, so these use other lists
  const CASES = {
    tag3dNoFilter: { path: '/tag/3d/' },
    tag3dAdult: { path: '/tag/3d/', include: [tag('adult', 'Adult')] },
    tag3dAction: { path: '/tag/3d/', include: [tag('action', 'Action')] },
    tag3dHideFirstPerson: { path: '/tag/3d/', exclude: [tag('first-person', 'First-person')] },
    categoryNoFilter: { path: '/category/lossless-repack/' },
    categoryAction: { path: '/category/lossless-repack/', include: [tag('action', 'Action')] },
    dateNoFilter: { path: '/2026/10/' },
    dateHideAction: { path: '/2026/10/', exclude: [tag('action', 'Action')] },
    searchNoFilter: { path: '/?s=racing' },
    searchArcade: { path: '/?s=racing', include: [tag('arcade', 'Arcade')] },
    singlePost: { path: '/upcoming-repacks-10/' },
  };
  const SHIMS = `window.GM_addStyle = css => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); return s; }; window.GM_xmlhttpRequest = () => {}; window.GM_getValue = (k, d) => { const v = localStorage.getItem("fg-" + k); return v === null ? d : JSON.parse(v); }; window.GM_setValue = (k, v) => localStorage.setItem("fg-" + k, JSON.stringify(v)); window.GM_registerMenuCommand = () => {};`;
  const context = await defaultPage.context().browser().newContext({ viewport: null });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('domcontentloaded', async () => {
    await page.addScriptTag({ content: SHIMS }).catch(() => {});
    await page.addScriptTag({ path: USERSCRIPT }).catch(() => {});
    await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => getComputedStyle(e).position === 'fixed' && /Discover more/.test(e.textContent)).forEach(e => e.remove())).catch(() => {});
  });

  const out = {};
  for (const [name, { path, include = [], exclude = [], settings = {} }] of Object.entries(CASES)) {
    await page.goto('https://fitgirl-repacks.site/', { waitUntil: 'domcontentloaded' });
    // Let this page's script run first, or it would use up the filter set below
    await page.waitForTimeout(1000);
    await page.evaluate(([i, e, s]) => {
      localStorage.clear();
      for (const k in s) localStorage.setItem('fg-' + k, JSON.stringify(s[k]));
      sessionStorage.setItem('fg-filters', JSON.stringify({ filterInclude: i, filterExclude: e }));
    }, [include, exclude, settings]);
    await page.goto('https://fitgirl-repacks.site' + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    out[name] = await page.evaluate(() => {
      // A box wrapped in a link measures through its inner box, because the link itself has no height
      const visible = e => {
        const target = e.tagName === 'A' ? e.querySelector('div') || e : e;
        return target.getClientRects().length > 0 && target.getBoundingClientRect().height > 0;
      };
      const list = document.querySelector('article').parentElement;
      const boxes = [...list.children].filter(e => e.tagName !== 'ARTICLE' && e.tagName !== 'STYLE' && /If you like what I do/.test(e.textContent));
      const postBefore = box => { let e = box.previousElementSibling; while (e && e.tagName !== 'ARTICLE') e = e.previousElementSibling; return e; };
      const posts = [...document.querySelectorAll('article')];
      const firstVisible = [...list.children].find(e => e.tagName !== 'STYLE' && e.tagName !== 'HEADER' && !e.classList.contains('fg-filter') && visible(e));
      return {
        posts: posts.length,
        postsShown: posts.filter(visible).length,
        boxes: boxes.length,
        boxesShown: boxes.filter(visible).length,
        boxUnderHiddenPost: boxes.filter(b => visible(b) && !visible(postBefore(b))).length,
        shownPostMissingBox: boxes.filter(b => !visible(b) && visible(postBefore(b))).length,
        firstVisibleUnderBar: firstVisible ? firstVisible.tagName : null,
        otherSiblingsHidden: [...list.children].filter(e => !['ARTICLE', 'STYLE'].includes(e.tagName) && !boxes.includes(e) && !visible(e) && !e.matches('nav.paging-navigation, .fg-filter-searching')).map(e => e.tagName + '.' + e.className),
      };
    });
    if (name === 'tag3dAdult') await page.screenshot({ path: SHOTS + '/donate-adult.png' });
    if (name === 'tag3dAction') await page.screenshot({ path: SHOTS + '/donate-action.png' });
  }
  out.errors = errors;
  await context.close();
  return out;
}

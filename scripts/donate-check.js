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

  // Posts added by infinite scroll bring their boxes with them
  const SCROLL_CASES = {
    scrollTag3d: { path: '/tag/3d/' },
    scrollCategory: { path: '/category/lossless-repack/' },
    scrollTag3dAction: { path: '/tag/3d/', include: [tag('action', 'Action')] },
    scrollTag3dHide: { path: '/tag/3d/', exclude: [tag('first-person', 'First-person')] },
    scrollHome: { path: '/' },
    scrollHomeHideDigests: { path: '/', settings: { hideDigests: true } },
    scrollSearch: { path: '/?s=racing' },
  };
  const readScroll = () => page.evaluate(() => {
    const visible = e => {
      const target = e.tagName === 'A' ? e.querySelector('div') || e : e;
      return target.getClientRects().length > 0 && target.getBoundingClientRect().height > 0;
    };
    const posts = [...document.querySelectorAll('article')];
    const boxes = [...document.querySelectorAll('[id="jBnskDj9"]')];
    const boxOf = post => {
      for (let e = post.nextElementSibling; e && e.tagName !== 'ARTICLE'; e = e.nextElementSibling) {
        if (e.id === 'jBnskDj9' || e.querySelector?.('#jBnskDj9')) return e;
      }
      return null;
    };
    const withBox = posts.map(p => ({ post: p, box: boxOf(p) }));
    return {
      posts: posts.length,
      postsShown: posts.filter(visible).length,
      boxes: boxes.length,
      boxesShown: boxes.filter(visible).length,
      shownPostsWithShownBox: withBox.filter(x => visible(x.post) && x.box && visible(x.box)).length,
      shownBoxUnderHiddenPost: withBox.filter(x => !visible(x.post) && x.box && visible(x.box)).length,
      status: document.querySelector('.fg-filter-status')?.textContent,
    };
  });
  for (const [name, { path, include = [], exclude = [], settings = {} }] of Object.entries(SCROLL_CASES)) {
    await page.goto('https://fitgirl-repacks.site/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.evaluate(([i, e, s]) => {
      localStorage.clear();
      for (const k in s) localStorage.setItem('fg-' + k, JSON.stringify(s[k]));
      sessionStorage.setItem('fg-filters', JSON.stringify({ filterInclude: i, filterExclude: e }));
    }, [include, exclude, settings]);
    await page.goto('https://fitgirl-repacks.site' + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.mouse.move(800, 600);
    for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 800); await page.waitForTimeout(120); }
    await page.waitForTimeout(2500);
    out[name] = await readScroll();
    if (name === 'scrollTag3d') {
      await page.evaluate(() => {
        const boxes = [...document.querySelectorAll('[id="jBnskDj9"]')];
        boxes[boxes.length - 1].scrollIntoView({ block: 'center' });
      });
      await page.waitForTimeout(500);
      await page.screenshot({ path: SHOTS + '/donate-scrolled.png' });
    }
  }

  // A filter added after scrolling, before anything was discarded, hides loaded posts and boxes together
  await page.goto('https://fitgirl-repacks.site/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => localStorage.clear());
  await page.goto('https://fitgirl-repacks.site/tag/3d/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.mouse.move(800, 600);
  for (let i = 0; i < 30; i++) { await page.mouse.wheel(0, 800); await page.waitForTimeout(120); }
  await page.waitForTimeout(2000);
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('.fg-filter summary').click();
  await page.waitForFunction(() => document.querySelectorAll('#fg-filter-tags option').length > 0, null, { timeout: 15000 });
  const input = page.locator('[data-list="filterInclude"] input');
  await input.fill('Action');
  await input.press('Enter');
  await page.waitForTimeout(800);
  out.filterAfterScrolling = await readScroll();
  out.errors = errors;
  await context.close();
  return out;
}

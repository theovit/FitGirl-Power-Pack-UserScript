/*
 * Scrolls filtered post lists with the wheel and keyboard on the live site and samples
 * progress over time, to show whether infinite scroll keeps finding matching posts.
 * Input: none; edit CASES to try other filters.
 * Usage: Playwright MCP browser_run_code_unsafe with filename set to this file.
 * Injects with GM_* shims, not through Tampermonkey.
 */
async (defaultPage) => {
  const USERSCRIPTS = { current: 'D:/GitHub/FitGirl-Power-Pack-UserScript/FitGirl Power Pack.user.js' };
  const SHOTS = 'C:/Users/Andrew/AppData/Local/Temp/claude/D--GitHub/a85b545d-3b74-4545-b5ad-f306bf0b875c/scratchpad';
  const CASES = {
    commonTag: { include: [{ slug: 'action', name: 'Action' }], exclude: [] },
    narrowPair: { include: [{ slug: 'action', name: 'Action' }], exclude: [{ slug: 'first-person', name: 'First-person' }] },
    rareTag: { include: [{ slug: 'hunting', name: 'Hunting' }], exclude: [] },
  };
  const browser = defaultPage.context().browser();
  const SHIMS = `
    window.GM_addStyle = css => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); return s; };
    window.GM_xmlhttpRequest = () => {};
    window.GM_getValue = (k, d) => { const v = localStorage.getItem("fg-" + k); return v === null ? d : JSON.parse(v); };
    window.GM_setValue = (k, v) => localStorage.setItem("fg-" + k, JSON.stringify(v));
    window.GM_registerMenuCommand = () => {};`;

  const run = async (name, filter, input, script) => {
    const context = await browser.newContext({ viewport: null });
    await context.addInitScript(f => {
      // Filters only survive one load, so hand them over on the first one
      if (location.hostname.endsWith('fitgirl-repacks.site') && !sessionStorage.getItem('fg-seeded')) {
        sessionStorage.setItem('fg-seeded', '1');
        sessionStorage.setItem('fg-filters', JSON.stringify({ filterInclude: f.include, filterExclude: f.exclude }));
      }
    }, filter);
    const page = await context.newPage();
    const errors = [];
    let requests = 0;
    let images = 0;
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => {
      if (r.resourceType() === 'fetch' && /\/page\/\d+\/$/.test(r.url())) requests++;
      if (r.resourceType() === 'image') images++;
    });
    await page.goto('https://fitgirl-repacks.site/', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ content: SHIMS });
    await page.addScriptTag({ path: script });
    await page.evaluate(() => {
      [...document.querySelectorAll('body *')].filter(e => getComputedStyle(e).position === 'fixed' && /Discover more/.test(e.textContent)).forEach(e => e.remove());
      window.__longestFreeze = 0;
      window.__frozenMs = 0;
      new PerformanceObserver(list => list.getEntries().forEach(e => {
        window.__longestFreeze = Math.max(window.__longestFreeze, e.duration);
        window.__frozenMs += e.duration;
      })).observe({ type: 'longtask', buffered: false });
    });
    await page.mouse.move(800, 600);
    const sample = () => page.evaluate(() => {
      const posts = [...document.querySelectorAll('article')];
      const next = document.querySelector('a.next.page-numbers');
      return {
        posts: posts.length,
        shown: posts.filter(p => p.offsetParent !== null).length,
        gapToEnd: next ? Math.round(next.getBoundingClientRect().top - innerHeight) : null,
        atBottom: scrollY + innerHeight >= document.documentElement.scrollHeight - 5,
        status: document.querySelector('.fg-filter-status')?.textContent,
      };
    });
    const samples = [];
    for (let second = 1; second <= 12; second++) {
      for (let step = 0; step < 10; step++) {
        if (input === 'wheel') await page.mouse.wheel(0, 150);
        else if (step === 0) await page.keyboard.press('End');
        await page.waitForTimeout(100);
      }
      if (second % 3 === 0) samples.push({ second, ...(await sample()), requests });
    }
    const timeAtBottom = samples.filter(s => s.atBottom).length + ' of ' + samples.length;
    const cost = await page.evaluate(() => ({
      domNodes: document.getElementsByTagName('*').length,
      heapMB: Math.round(performance.memory.usedJSHeapSize / 1048576),
      longestFreezeMs: Math.round(window.__longestFreeze),
      totalFrozenMs: Math.round(window.__frozenMs),
    }));
    await page.screenshot({ path: `${SHOTS}/scroll-${name}-${input}.png` });
    await context.close();
    return { last: samples[samples.length - 1], timeAtBottom, requests, images, ...cost, errors };
  };

  const out = {};
  for (const [version, script] of Object.entries(USERSCRIPTS)) {
    for (const [name, filter] of Object.entries(CASES)) {
      for (const input of ['wheel', 'keyboard']) out[`${version}: ${name} ${input}`] = await run(name, filter, input, script);
    }
  }
  return out;
}

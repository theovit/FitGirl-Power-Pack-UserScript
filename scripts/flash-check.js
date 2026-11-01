/*
 * Checks that the theme is in place as the page is first parsed, with and without
 * the userscript, by running it before page scripts like @run-at document-start.
 * Input: none.
 * Usage: Playwright MCP browser_run_code_unsafe with filename set to this file.
 * Uses GM_* shims, not Tampermonkey, so it can't show Tampermonkey's own start timing.
 */
async (defaultPage) => {
  const USERSCRIPT = 'D:/GitHub/FitGirl-Power-Pack-UserScript/FitGirl Power Pack.user.js';
  const browser = defaultPage.context().browser();
  const recorder = () => {
    const seen = window.__firstSeen = {};
    const note = (name, element, read) => {
      if (element && !seen[name]) seen[name] = { readyState: document.readyState, ...read(getComputedStyle(element)) };
    };
    new MutationObserver(() => {
      note('article', document.querySelector('article'), style => ({ background: style.backgroundColor }));
      note('pawLink', document.querySelector('a[style*="paw"]'), style => ({ image: style.backgroundImage.slice(0, 50) }));
      note('supportImage', document.querySelector('img[src*="support2"]'), style => ({ visibility: style.visibility }));
    }).observe(document, { childList: true, subtree: true });
  };

  const run = async withScript => {
    const context = await browser.newContext({ viewport: null });
    await context.addInitScript(recorder);
    if (withScript) {
      // A constructed sheet, because this can run before the page has a root element
      await context.addInitScript({ content: 'window.GM_addStyle = css => { const s = new CSSStyleSheet(); s.replaceSync(css); document.adoptedStyleSheets = [...document.adoptedStyleSheets, s]; }; window.GM_xmlhttpRequest = () => {}; window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_registerMenuCommand = () => {};' });
      await context.addInitScript({ path: USERSCRIPT });
    }
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('https://fitgirl-repacks.site/', { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const result = await page.evaluate(() => ({
      firstSeen: window.__firstSeen,
      afterLoad: {
        tagsMenu: [...document.querySelectorAll('#primary-menu a')].some(a => a.textContent.trim() === 'Tags'),
        trailerLinks: document.querySelectorAll('a.nframe').length,
        recoloredPaws: [...document.querySelectorAll('.fg-paw')].filter(e => e.style.backgroundImage.startsWith('url("data:image/png')).length,
        supportVisible: getComputedStyle(document.querySelector('img[src*="support2"], img.fg-support')).visibility,
        supportRecolored: document.querySelector('img[src*="support2"], img.fg-support').src.startsWith('data:image/png'),
      },
      errors: [],
    }));
    result.errors = errors;
    if (withScript) await page.screenshot({ path: 'C:/Users/Andrew/AppData/Local/Temp/claude/D--GitHub/a85b545d-3b74-4545-b5ad-f306bf0b875c/scratchpad/flash-home.png' });
    await context.close();
    return result;
  };

  return { withoutScript: await run(false), withScript: await run(true) };
}

/*
 * Runs the userscript against the live site and reports what each fix did.
 * Input: none.
 * Usage: Playwright MCP browser_run_code_unsafe with filename set to this file.
 * Injects after DOMContentLoaded with GM_* shims, not through Tampermonkey.
 * Uses its own full-window context, because the default one is locked to a fixed viewport.
 */
async (defaultPage) => {
  const context = await defaultPage.context().browser().newContext({ viewport: null });
  const page = await context.newPage();
  const USERSCRIPT = 'D:/GitHub/FitGirl-Power-Pack-UserScript/FitGirl Power Pack.user.js';
  const BASE = 'https://fitgirl-repacks.site';
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // A real tab, because page.request fails on YouTube's large response headers
  await page.exposeFunction('__fgFetch', async url => {
    const tab = await context.newPage();
    try {
      await tab.goto(url, { waitUntil: 'domcontentloaded' });
      return await tab.content();
    } finally {
      await tab.close();
    }
  });

  const load = async (path, waitUntil = 'domcontentloaded', prepare) => {
    await page.goto(BASE + path, { waitUntil });
    if (prepare) await page.evaluate(prepare);
    await page.addScriptTag({ content: 'window.GM_addStyle = css => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); }; window.GM_xmlhttpRequest = o => __fgFetch(o.url).then(t => o.onload({ responseText: t }), () => o.onerror()); window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_registerMenuCommand = () => {};' });
    await page.addScriptTag({ path: USERSCRIPT });
  };
  const tagList = () => page.waitForFunction(() => /Tag Index/.test(document.body.textContent), null, { timeout: 30000 })
    .then(() => page.evaluate(() => ({
      heading: document.querySelector('.page-content h2')?.textContent,
      links: document.querySelectorAll('.page-content li a').length,
      error: /could not be loaded/.test(document.body.textContent),
    })));
  const out = {};

  // Off by default so routine runs skip the YouTube searches; turn on after changing trailer code
  const CHECK_TRAILERS = false;
  if (CHECK_TRAILERS) {
    await load('/');
    await page.waitForSelector('a.nframe');
    out.trailers = [];
    const trailerLinks = await page.locator('a.nframe').count();
    for (let i = 0; i < trailerLinks; i++) {
      const link = page.locator('a.nframe').nth(i);
      const game = await link.evaluate(a => a.closest('article').querySelector('.entry-title').textContent);
      const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
      await popup.waitForURL(/youtube\.com\/(watch|results)/, { timeout: 30000 });
      await popup.waitForTimeout(1500);
      out.trailers.push({ game: game.slice(0, 50), url: popup.url(), video: (await popup.title()).slice(0, 70) });
      await popup.close();
    }
  }

  // A renamed image and a repeat run, like the site changing files and infinite scroll
  const garoldState = () => page.evaluate(() => {
    const el = document.querySelector('.fg-garold');
    const image = el.style.backgroundImage;
    return {
      images: (image.match(/garold/g) || []).length,
      gradients: (image.match(/radial-gradient/g) || []).length,
      url: image.slice(0, 80),
      position: el.style.backgroundPosition,
      repeat: el.style.backgroundRepeat,
      blend: getComputedStyle(el).backgroundBlendMode,
    };
  });
  await load('/upcoming-repacks-10/');
  out.garoldCurrent = await garoldState();
  await page.route('**/garold99.jpg', route => route.continue({ url: route.request().url().replace('garold99', 'garold3') }));
  await load('/upcoming-repacks-10/', 'domcontentloaded', () => {
    const el = document.querySelector('[style*="garold3"]');
    el.setAttribute('style', el.getAttribute('style').replace('garold3', 'garold99'));
  });
  await page.evaluate(() => replaceImages());
  out.garoldRenamedTwice = await garoldState();
  await page.unroute('**/garold99.jpg');

  await load('/tags/');
  out.tagsTrailingSlash = await tagList();

  await page.route('**/wp-json/wp/v2/tags?*page=2', r => r.fulfill({ status: 500, body: '{}' }));
  await load('/tags');
  out.tagsServerError = await tagList();
  await page.unroute('**/wp-json/wp/v2/tags?*page=2');

  // Late injection is the case the old load listener missed
  await load('/donations/', 'load');
  out.donateAfterLoad = await page.evaluate(() => ({
    tables: document.querySelectorAll('.entry-content table').length,
    wrapped: document.querySelectorAll('.fg-scroll-wrapper > table').length,
  }));

  await load('/upcoming-repacks-10/');
  await page.waitForSelector('iframe[src*="tolstoycomments.com"]', { state: 'attached', timeout: 30000 });
  await page.waitForTimeout(500);
  const commentState = () => page.evaluate(() => {
    const iframe = document.querySelector('iframe[src*="tolstoycomments.com"]');
    return { button: iframe.previousElementSibling?.textContent, display: iframe.style.display };
  });
  out.commentsHidden = await commentState();
  await page.getByRole('button', { name: 'Show Comments' }).click();
  out.commentsShown = await commentState();

  await load('/page/49/', 'load');
  const before = await page.locator('article').count();
  await page.locator('a.next.page-numbers').scrollIntoViewIfNeeded();
  await page.waitForFunction(n => document.querySelectorAll('article').length > n, before, { timeout: 30000 });
  await page.waitForTimeout(2500);
  out.infiniteScroll = await page.evaluate(n => ({
    before: n,
    after: document.querySelectorAll('article').length,
    lightPawLeft: document.querySelectorAll('div[style*="paw.png"]').length,
    recoloredPaws: [...document.querySelectorAll('article .fg-paw')].filter(e => e.style.backgroundImage.startsWith('url("data:image/png')).length,
    supportRecolored: document.querySelector('img.fg-support')?.src.startsWith('data:image/png'),
    repoImages: [...document.querySelectorAll('[style*="raw.githubusercontent"], img[src*="raw.githubusercontent"]')].length,
    trailerLinks: document.querySelectorAll('a.nframe').length,
  }), before);

  out.css = await page.evaluate(() => {
    const style = selector => {
      const el = document.querySelector(selector);
      return el && getComputedStyle(el);
    };
    return {
      entryHeaderMaxWidth: style('header.entry-header')?.maxWidth,
      spoilerHyphens: style('.su-spoiler-content')?.hyphens,
    };
  });

  out.pageErrors = errors;
  await context.close();
  return out;
}

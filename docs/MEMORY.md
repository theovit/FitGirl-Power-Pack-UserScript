# Project Memory

- `recolorImage` edits the site's images in a canvas, which works because they're on the same domain as the page. Its values are tuned to the current files: `paw.png` is flat `#fddbff` on white, and the white strip in `support2.jpg` starts at pixel row 124. If either file's design changes, these need retuning.
- `scripts/live-check.js` skips trailer popups unless `CHECK_TRAILERS` is turned on.
- Light images can go dark without a new file: `background-blend-mode: multiply` over a radial gradient that ends inside the box fades them into the page. Use it rather than `filter` when text sits inside the same element. `replaceImages` applies this to `garold` images from JavaScript so it can reuse the page's image URL, and the `fg-garold` class stops it stacking when infinite scroll reruns the function.
- Installed copies update from Greasy Fork (script 541076), so pushing to GitHub alone may not reach them. Check that the Greasy Fork version matches before choosing the next version number.
- Greasy Fork sync depends on the raw GitHub URL of `FitGirl Power Pack.user.js`, so don't rename that file or put the version back in its name. Bump `@version` on every release.
- Don't rely on DuckDuckGo `!` bang redirects: one went straight to YouTube in a test browser, but the user got a search page. Trailers now read the first `videoRenderer` ID from YouTube's search HTML, and that markup could change.
- YouTube's top result isn't always the base game's trailer; it can be a season, expansion or console edition trailer.
- Paw images inside posts are rare: of the listing pages sampled on 2026-11-01, only `/page/50/` had one. Test infinite scroll from `/page/49/`.
- The site's tags API returned 314 tags over 4 pages on 2026-11-01.
- `scripts/live-check.js` tests against the live site through Playwright, injecting the script with `GM_addStyle` and `GM_xmlhttpRequest` shims. It doesn't cover Tampermonkey itself. Its shim loads YouTube in a real tab because `page.request` fails on the large response headers.

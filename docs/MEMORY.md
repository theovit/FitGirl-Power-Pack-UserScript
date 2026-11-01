# Project Memory

- Installed copies update from Greasy Fork (script 541076), so pushing to GitHub alone may not reach them. Check that the Greasy Fork version matches before choosing the next version number.
- DuckDuckGo `!` bang searches redirect straight to the first result, so trailer links need no script running on DuckDuckGo.
- Paw images inside posts are rare: of the listing pages sampled on 2026-11-01, only `/page/50/` had one. Test infinite scroll from `/page/49/`.
- The site's tags API returned 314 tags over 4 pages on 2026-11-01.
- `scripts/live-check.js` tests against the live site through Playwright, injecting the script with a `GM_addStyle` shim. It doesn't cover Tampermonkey itself.

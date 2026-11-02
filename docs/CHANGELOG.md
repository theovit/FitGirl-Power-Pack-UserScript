# Changelog

## Unreleased
- The Tags page now uses the saved tag list too, so it appears instantly after the first load. Refresh tags updates it, and a failed load shows the saved list or a clear error.

## 1.0.13
- Fixed the page running off the right side of the window on screens narrower than about 1700px. The right sidebar and top bar now fit, and on phones the sidebar sits below the posts at full width.

## 1.0.12
- The script's description and the README now cover the current features and where to find Settings.
- The right sidebar now shows on every page at the same size as the main page, including FAQ, Donate, Popular Repacks and the Tags page. It can be turned off in settings.

## 1.0.11
- A back to top button now appears once you've scrolled down more than one screen. It can be turned off in settings.
- Filtering no longer stacks donate boxes at the top of the list. A post's donate box now hides along with it, and stays when the post is shown.
- Posts loaded by infinite scroll now keep their donate boxes, wherever the site shows them.
- The filter's tag list now appears instantly after the first load. It's saved and refreshed in the background once a day, and a new Refresh tags button in settings updates it right away.

## 1.0.10
- Tag filters now clear whenever a new page loads, instead of being remembered.
- Links on the Tags page now open in the same tab.
- With infinite scroll on, the page number bar is gone, and the end of a list now says there are no more pages to load.
- When a filter search pauses, the message now simply recommends the Tags page.

## 1.0.9
- Post lists now have a "Filter by tag" bar. You can show only games with chosen tags or hide games with others, using the site's current tag list, and your choices are remembered. It can be turned off in settings. Posts it filters out while scrolling aren't kept, which keeps long sessions fast, so changing a filter after scrolling reloads the page. A message at the end of the list shows when it's still searching for matches, and recommends the Tags page if the search is taking a while.
- A new optional setting can hide Hypervisor Bypass posts on the main page. It's off by default.
- Infinite scroll now starts loading two screens before the end of the page, and keeps loading if you're already near the end when a page arrives, so you're much less likely to reach the bottom.

## 1.0.8
- New optional settings can hide Uncategorized and Updates Digest posts on the main page. Both are off by default, and those posts stay visible on their own pages and category pages.
- A new Settings link in the site's top menu opens a panel with the same on/off options.
- You can now turn each feature on or off from the Tampermonkey menu: dark theme, hidden comments, trailer buttons, infinite scroll, tags, and the donate table fix. Everything stays on by default, and the page reloads when you change one.

## 1.0.7
- The dark theme now starts before the page draws, so the undarkened page and white images should no longer flash on load.
- The script no longer downloads jQuery, Babel or the Babel polyfill, so it has about 2 MB less to load.

## 1.0.6
- The paw and support images are now recolored in the browser from the site's own files, so the script no longer loads any images from GitHub.
- The support image now shows the site's own wording, with a capital "P" in "Please".
- The dark blend now applies to any Upcoming Repacks image with `garold` in its filename, so a new image from the site shouldn't need a script update.

## 1.0.5
- The kitten on the Upcoming Repacks page now blends into the dark theme and fades out at the edges, instead of sitting on a bright white box.

## 1.0.4
- The script file is now `FitGirl Power Pack.user.js`, so its GitHub URL stays the same between versions.
- The repo now includes the layout and spoiler changes from the published 1.0.3 script.
- The spoiler hyphenation rule now takes effect; a misspelled selector had disabled it.
- Trailer buttons now open the first matching YouTube video in the popup, instead of a DuckDuckGo search. If no video can be found, they open YouTube's search results.
- The script no longer runs on DuckDuckGo, so its pages stop getting the dark theme.
- Dark paw images now apply to older posts loaded by infinite scroll.
- The donate page table fix runs reliably instead of depending on page load timing.
- `/tags/` now shows the tag list, the same as `/tags`.
- The tag page shows an error if tags fail to load, instead of a short list or a stuck "Loading tags…".
- Pages without comments no longer check for the comments widget every 300ms.

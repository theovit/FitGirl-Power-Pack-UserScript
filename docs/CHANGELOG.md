# Changelog

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

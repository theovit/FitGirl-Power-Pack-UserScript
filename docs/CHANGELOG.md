# Changelog

## Unreleased
- The script no longer runs on DuckDuckGo, so its pages stop getting the dark theme. Trailer links still work because DuckDuckGo sends them straight to YouTube.
- Dark paw images now apply to older posts loaded by infinite scroll.
- The donate page table fix runs reliably instead of depending on page load timing.
- `/tags/` now shows the tag list, the same as `/tags`.
- The tag page shows an error if tags fail to load, instead of a short list or a stuck "Loading tags…".
- Pages without comments no longer check for the comments widget every 300ms.

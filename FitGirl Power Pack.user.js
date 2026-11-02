// ==UserScript==
// @name         FitGirl Power Pack
// @namespace    https://tampermonkey.net/
// @version      1.0.14
// @description  Dark theme, tag filter, infinite scroll, YouTube trailer links, comments toggle, a tags page, and a back to top button for FitGirl‑Repacks. Every feature can be turned on or off under Settings in the site's top menu.
// @author       theovlit
// @icon         https://www.google.com/s2/favicons?sz=64&domain=fitgirl-repacks.site
// @match        https://fitgirl-repacks.site/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      www.youtube.com
// @license      MIT
// @downloadURL  https://update.greasyfork.org/scripts/541076/FitGirl%20Power%20Pack.user.js
// @updateURL    https://update.greasyfork.org/scripts/541076/FitGirl%20Power%20Pack.meta.js
// ==/UserScript==

// The script starts before the page exists so the theme can beat the first paint;
// anything that needs page content waits here.
function whenDomReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

/*****************************************************************
 * SETTINGS (Tampermonkey menu)                                   *
 *****************************************************************/
const settings = {
  darkTheme: 'Dark theme',
  comments: 'Hide comments behind a button',
  trailers: 'YouTube trailer buttons',
  infiniteScroll: 'Infinite scroll',
  tags: 'Tags page and menu link',
  donateTables: 'Donate page table fix',
  hideUncategorized: 'Hide Uncategorized posts on the main page',
  hideDigests: 'Hide Updates Digest posts on the main page',
  hideHypervisor: 'Hide Hypervisor Bypass posts on the main page',
  gameFilter: 'Tag filter on post lists',
  backToTop: 'Back to top button',
  rightSidebar: 'Right sidebar on every page'
};

const offByDefault = ['hideUncategorized', 'hideDigests', 'hideHypervisor'];

function isEnabled(setting) {
  return GM_getValue(setting, !offByDefault.includes(setting));
}

function whenEnabled(setting, callback) {
  if (isEnabled(setting)) whenDomReady(callback);
}

Object.entries(settings).forEach(([setting, label]) => {
  GM_registerMenuCommand(`${isEnabled(setting) ? '✅' : '⬜'} ${label}`, () => {
    GM_setValue(setting, !isEnabled(setting));
    location.reload();
  });
});

// The site keeps the home class on every main page, including /page/2/ and on.
const categoryHides = {
  hideUncategorized: 'body.home article.category-uncategorized',
  hideDigests: 'body.home article.category-updates-digest',
  hideHypervisor: 'body.home article.category-hypervisor-bypass'
};
// Each post's donate box follows it as a sibling, after a style tag or wrapped in a link,
// so hiding a post has to hide its box too or the boxes pile up at the top of the list
function hidePostRule(selector) {
  return `${selector}, ${selector} + style + div, ${selector} + a { display: none; }`;
}

Object.entries(categoryHides).forEach(([setting, selector]) => {
  if (isEnabled(setting)) GM_addStyle(hidePostRule(selector));
});

/*****************************************************************
 * TAG FILTER                                                     *
 *****************************************************************/
const filterPages = 'body:is(.home, .archive, .search)';

// Collapsed rather than display: none, because infinite scroll measures where the next link sits
if (isEnabled('infiniteScroll')) {
  GM_addStyle('nav.paging-navigation { visibility: hidden; height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; overflow: hidden; }');
}

// Filters reset on every page load. The one exception is the reload the script does
// itself after discarding posts, which hands them over through sessionStorage.
const filters = JSON.parse(sessionStorage.getItem('fg-filters')) || { filterInclude: [], filterExclude: [] };
sessionStorage.removeItem('fg-filters');

function reloadKeepingFilters() {
  sessionStorage.setItem('fg-filters', JSON.stringify(filters));
  location.reload();
}

// Posts carry their tags as classes, so CSS can hide them before they're drawn.
// Include matches any chosen tag.
function filterSelectors() {
  if (!isEnabled('gameFilter')) return [];
  const tags = list => filters[list].map(tag => `.tag-${CSS.escape(tag.slug)}`).join(', ');
  const include = tags('filterInclude');
  const exclude = tags('filterExclude');
  return [
    include && `${filterPages} article:not(${include})`,
    exclude && `${filterPages} article:is(${exclude})`
  ].filter(Boolean);
}

function filterCss() {
  return filterSelectors().map(hidePostRule).join('\n');
}

const filterStyle = isEnabled('gameFilter') ? GM_addStyle(filterCss()) : null;

// Infinite scroll throws away posts that would only be hidden, because keeping them
// makes the page slow. It reports here so the status line can still count them.
let discardedPosts = 0;
let searchPaused = false;
let searching = false;
let pagesWithoutMatch = 0;

function updateFilterStatus() {
  const active = isEnabled('gameFilter') ? filters.filterInclude.length + filters.filterExclude.length : 0;
  const posts = [...document.querySelectorAll('article')];
  const shown = posts.filter(post => post.offsetParent !== null).length;
  const checked = posts.length + discardedPosts;
  const recommendTags = isEnabled('tags');

  const status = document.querySelector('.fg-filter-status');
  if (status) {
    const progress = searchPaused ? ' Search paused.' : searching ? ' Searching for more…' : '';
    status.textContent = active ? `${active} active, showing ${shown} of ${checked} posts checked.${progress}` : '';
  }

  // The status line scrolls out of view, so also say what's happening at the end of the list
  if (!isEnabled('infiniteScroll') || !posts.length || !document.body.matches(filterPages)) return;
  let message = document.querySelector('.fg-filter-searching');
  if (!message) {
    message = document.createElement('p');
    message.className = 'fg-filter-searching';
    message.setAttribute('role', 'status');
    const end = document.querySelector('nav.paging-navigation') || posts[posts.length - 1];
    end.parentNode.insertBefore(message, end.nextSibling);
  }
  const atEnd = !document.querySelector('a.next.page-numbers');
  message.textContent = atEnd ? "You've reached the end. There are no more pages to load."
    : !active ? ''
    : searchPaused ? `No matches in the last 20 pages (${checked} posts checked).${recommendTags ? '' : ' Scroll to keep looking.'}`
    : searching ? `Searching for matching games, this can take a moment. ${checked} posts checked so far.`
    : '';
  if (!atEnd && active && pagesWithoutMatch >= 5 && recommendTags) {
    const tagsLink = document.createElement('a');
    tagsLink.href = 'https://fitgirl-repacks.site/tags';
    tagsLink.textContent = 'Tags page';
    message.append(`${searchPaused ? ' We' : ' Taking a while? We'} recommend the `, tagsLink, ', which goes straight to every game with a tag.');
  }
}

async function fetchAllTags() {
  const perPage = 100;
  let page = 1;
  let allTags = [];
  let hasMore = true;
  let failed = false;

  try {
    while (hasMore) {
      const res = await fetch(`https://fitgirl-repacks.site/wp-json/wp/v2/tags?per_page=${perPage}&page=${page}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const tags = await res.json();
      allTags.push(...tags);
      hasMore = tags.length === perPage;
      page++;
    }
  } catch (err) {
    failed = true;
    console.error('FG tag fetch error', err);
  }
  return { allTags, failed };
}

// Fetches and saves the filter's tag list, returning it, or nothing if the fetch failed
async function refreshTagCache() {
  const { allTags, failed } = await fetchAllTags();
  if (failed) return null;
  // Tag names arrive HTML-escaped, e.g. "Hack &amp; Slash"
  const tags = allTags.map(({ name, slug }) => ({
    slug,
    name: new DOMParser().parseFromString(name, 'text/html').documentElement.textContent
  }));
  GM_setValue('filterTagCache', { savedAt: Date.now(), tags });
  return tags;
}

const tagCacheMaxAge = 24 * 60 * 60 * 1000;

// Set by the filter bar or Tags page, whichever this page has, so the settings button can update it
let showRefreshedTags = null;

whenEnabled('gameFilter', function tagFilterBar() {
  const firstPost = document.querySelector('article');
  if (!firstPost || !document.body.matches(filterPages)) return;

  const bar = document.createElement('details');
  bar.className = 'fg-filter';
  bar.innerHTML = `
    <summary>Filter by tag <span class="fg-filter-status"></span></summary>
    <div class="fg-filter-columns">
      <div data-list="filterInclude">
        <label>Only show games tagged <input list="fg-filter-tags" placeholder="Open to load tags"></label>
        <div class="fg-filter-chips"></div>
      </div>
      <div data-list="filterExclude">
        <label>Hide games tagged <input list="fg-filter-tags" placeholder="Open to load tags"></label>
        <div class="fg-filter-chips"></div>
      </div>
    </div>
    <datalist id="fg-filter-tags"></datalist>
    <button type="button" class="fg-filter-clear">Clear all</button>
  `;
  firstPost.parentNode.insertBefore(bar, firstPost);

  const inputs = bar.querySelectorAll('input');
  let knownTags = null;
  let refreshStarted = false;

  function showTags(tags) {
    knownTags = tags;
    bar.querySelector('datalist').replaceChildren(...tags.map(tag => new Option('', tag.name)));
    inputs.forEach(input => { input.placeholder = 'Type to search tags'; });
  }
  showRefreshedTags = showTags;

  // Saved tags appear right away; a day-old list still shows while a new one loads behind it
  async function loadTags() {
    const tagCache = GM_getValue('filterTagCache', null);
    if (!knownTags && tagCache) showTags(tagCache.tags);
    if (refreshStarted || (tagCache && Date.now() - tagCache.savedAt < tagCacheMaxAge)) return;
    refreshStarted = true;
    if (!knownTags) inputs.forEach(input => { input.placeholder = 'Loading tags…'; });
    const tags = await refreshTagCache();
    if (!tags) {
      refreshStarted = false;
      if (!knownTags) inputs.forEach(input => { input.placeholder = 'Tags failed to load. Reopen to retry.'; });
      return;
    }
    showTags(tags);
  }

  function render() {
    // Discarded posts can't be brought back in place, so a changed filter starts over
    if (discardedPosts) {
      reloadKeepingFilters();
      return;
    }
    bar.querySelectorAll('[data-list]').forEach(column => {
      const list = column.dataset.list;
      column.querySelector('.fg-filter-chips').replaceChildren(...filters[list].map(tag => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.title = `Remove ${tag.name}`;
        chip.textContent = `${tag.name} ×`;
        chip.addEventListener('click', () => {
          filters[list] = filters[list].filter(other => other.slug !== tag.slug);
          render();
        });
        return chip;
      }));
    });
    if (filterStyle) filterStyle.textContent = filterCss();
    updateFilterStatus();
    // The page may be much shorter now, so let infinite scroll check whether it needs more
    window.dispatchEvent(new Event('scroll'));
  }

  function addTag(input) {
    const typed = input.value.trim().toLowerCase();
    const tag = knownTags && knownTags.find(known => known.name.toLowerCase() === typed);
    if (!tag) return;
    const list = input.closest('[data-list]').dataset.list;
    const otherList = list === 'filterInclude' ? 'filterExclude' : 'filterInclude';
    filters[otherList] = filters[otherList].filter(other => other.slug !== tag.slug);
    if (!filters[list].some(other => other.slug === tag.slug)) {
      filters[list] = [...filters[list], tag];
    }
    input.value = '';
    if (filterStyle) render(); else reloadKeepingFilters();
  }

  inputs.forEach(input => {
    input.addEventListener('change', () => addTag(input));
    // Picking from the list has no typing inputType in most browsers, and may not fire change until blur
    input.addEventListener('input', e => {
      if (!e.inputType || e.inputType === 'insertReplacementText') addTag(input);
    });
  });
  bar.querySelector('.fg-filter-clear').addEventListener('click', () => {
    filters.filterInclude = [];
    filters.filterExclude = [];
    render();
  });
  bar.addEventListener('toggle', () => {
    if (bar.open) loadTags();
  });

  bar.open = filters.filterInclude.length + filters.filterExclude.length > 0;
  render();
});

// The site hides this sidebar on plain pages like the FAQ, and "not found" pages, which
// include /tags, miss the sizing the main page gets. These are the main page's values.
if (isEnabled('rightSidebar')) {
  GM_addStyle(`
    #content-sidebar { display: block !important; margin-left: -23% !important; width: 23% !important; padding-top: 0 !important; }
    /* Too narrow for a column on phones, so it goes under the page at full width */
    @media (max-width: 673px) {
      #content-sidebar { margin-left: 0 !important; width: 100% !important; }
    }
    /* Popular Repacks widens this grid for its own list, which would also stretch the sidebar's */
    #content-sidebar .widgets-grid-layout { width: 100% !important; }
  `);
}

// Styled on its own so the panel stays readable with the dark theme turned off
GM_addStyle(`
  .fg-back-to-top {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 100;
    display: none;
    padding: 10px 14px;
    background: #f887ff;
    color: #121212;
    border: none;
    border-radius: 4px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
    font-size: 14px;
    font-weight: bold;
    text-transform: none;
    cursor: pointer;
  }
  .fg-back-to-top.fg-visible {
    display: block;
  }
  .fg-filter-searching {
    margin: 1em 0;
    color: #f887ff;
    font-size: 15px;
    text-align: center;
  }
  .fg-filter-searching:empty {
    display: none;
  }
  .fg-filter {
    margin: 1.5em 0 0;
    padding: 12px 16px;
    background: #1a1a1a;
    color: #e0e0e0;
    border: 1px solid #333;
    border-radius: 8px;
    font-size: 15px;
  }
  .fg-filter summary {
    color: #f887ff;
    font-weight: bold;
    cursor: pointer;
  }
  .fg-filter-status {
    margin-left: 8px;
    color: #aaa;
    font-weight: normal;
    font-size: 13px;
  }
  .fg-filter-columns {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin: 12px 0;
  }
  .fg-filter-columns > div {
    flex: 1 1 220px;
    min-width: 0;
  }
  .fg-filter label {
    display: block;
    color: #e0e0e0;
    font-size: 14px;
  }
  .fg-filter input {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin-top: 4px;
    padding: 6px 8px;
    background: #121212;
    color: #e0e0e0;
    border: 1px solid #555;
    border-radius: 4px;
  }
  .fg-filter-chips button,
  .fg-filter-clear {
    margin: 6px 6px 0 0;
    padding: 3px 8px;
    border: 1px solid #f887ff;
    border-radius: 4px;
    background: transparent;
    color: #f887ff;
    font-size: 13px;
    font-weight: normal;
    text-transform: none;
    cursor: pointer;
  }
  .fg-settings {
    padding: 0;
    width: min(340px, calc(100vw - 32px));
    background: #1a1a1a;
    color: #e0e0e0;
    border: 1px solid #f887ff;
    border-radius: 8px;
  }
  .fg-settings::backdrop {
    background: rgba(0, 0, 0, 0.6);
  }
  .fg-settings form {
    padding: 20px;
  }
  .fg-settings h2 {
    margin: 0 0 12px;
    color: #f887ff;
    font-size: 20px;
    font-weight: bold;
    text-transform: none;
  }
  .fg-settings label {
    display: block;
    padding: 6px 0;
    color: #e0e0e0;
    font-size: 15px;
    cursor: pointer;
  }
  .fg-settings input {
    margin: 0 8px 0 0;
  }
  .fg-settings p {
    margin: 12px 0;
    color: #aaa;
    font-size: 13px;
  }
  .fg-settings button + button {
    margin-left: 8px;
  }
  .fg-settings button:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .fg-settings-refresh-status:empty {
    display: none;
  }
  .fg-settings button {
    padding: 8px 16px;
    background: #f887ff;
    color: #121212;
    border: none;
    border-radius: 4px;
    font-weight: bold;
    cursor: pointer;
  }
`);

whenDomReady(function settingsPanel() {
  const menu = document.querySelector('#primary-menu');
  if (!menu) return;

  const panel = document.createElement('dialog');
  panel.className = 'fg-settings';
  panel.innerHTML = `
    <form method="dialog">
      <h2>Power Pack settings</h2>
      ${Object.entries(settings).map(([setting, label]) =>
        `<label><input type="checkbox" name="${setting}"${isEnabled(setting) ? ' checked' : ''}>${label}</label>`
      ).join('')}
      <p>Changes apply when you close this panel.</p>
      <button>Close</button>
      <button type="button" class="fg-settings-refresh">Refresh tags</button>
      <p class="fg-settings-refresh-status" role="status"></p>
    </form>
  `;
  document.body.appendChild(panel);

  const refreshStatus = panel.querySelector('.fg-settings-refresh-status');
  panel.querySelector('.fg-settings-refresh').addEventListener('click', async e => {
    const button = e.currentTarget;
    button.disabled = true;
    refreshStatus.textContent = 'Refreshing tags…';
    const tags = await refreshTagCache();
    if (tags && showRefreshedTags) showRefreshedTags(tags);
    refreshStatus.textContent = tags ? `Tags updated: ${tags.length} tags.` : 'Tags failed to load. Try again in a moment.';
    button.disabled = false;
  });

  let changed = false;
  panel.addEventListener('change', e => {
    GM_setValue(e.target.name, e.target.checked);
    changed = true;
  });
  // Clicks on the backdrop land on the dialog itself; the form covers the rest
  panel.addEventListener('click', e => {
    if (e.target === panel) panel.close();
  });
  panel.addEventListener('close', () => {
    if (changed) location.reload();
  });

  const li = document.createElement('li');
  li.className = 'menu-item menu-item-type-custom';
  li.innerHTML = '<a href="#">Settings</a>';
  li.firstChild.addEventListener('click', e => {
    e.preventDefault();
    panel.showModal();
  });
  menu.appendChild(li);
});

whenEnabled('backToTop', function backToTopButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'fg-back-to-top';
  button.textContent = '↑ Top';
  button.title = 'Back to top';
  button.setAttribute('aria-label', 'Back to top');
  button.addEventListener('click', () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });
  document.body.appendChild(button);

  const update = () => button.classList.toggle('fg-visible', window.scrollY > window.innerHeight);
  window.addEventListener('scroll', update, { passive: true });
  update();
});

/*****************************************************************
 * 1. DARK MODE STYLES                                           *
 *****************************************************************/
const recoloredImages = {};

// Makes white transparent and paints everything else one colour, starting at fromRow.
// darkest is the channel value that counts as fully painted, so pale artwork can still come out solid.
function recolorImage(src, color, darkest, fromRow = 0) {
  if (!recoloredImages[src]) {
    recoloredImages[src] = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, fromRow, canvas.width, canvas.height - fromRow);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const channel = Math.min(pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]);
          pixels.data.set(color, i);
          pixels.data[i + 3] = 255 * Math.min(1, (255 - channel) / (255 - darkest));
        }
        context.putImageData(pixels, 0, fromRow);
        resolve(canvas.toDataURL());
      };
      image.onerror = reject;
      image.src = src;
    });
  }
  return recoloredImages[src];
}

function showRecoloredPaw(element) {
  const original = element.style.backgroundImage;
  element.classList.add('fg-paw');
  element.style.backgroundImage = 'none';
  recolorImage('https://fitgirl-repacks.site/wp-content/uploads/2022/08/paw.png', [233, 160, 226], 219).then(url => {
    element.style.backgroundImage = `url(${url})`;
  }).catch(err => {
    console.error('FG paw recolor error', err);
    element.style.backgroundImage = original;
  });
}

function replaceImages() {
  if (!isEnabled('darkTheme')) return;
  const divs = document.querySelectorAll('div[style*="paw.png"]:not(.fg-paw)');
  divs.forEach(div => {
    showRecoloredPaw(div);
    div.style.backgroundSize = '213px auto'; // You can adjust this value
    div.style.backgroundRepeat = 'no-repeat'; // Optional: ensure no repeating
    div.style.backgroundPosition = 'top right'; // Optional: keep original alignment
    div.style.backgroundPositionY = '100px'; // shift image down
  });
  const PPA = document.querySelectorAll('a[href="https://fitgirl-repacks.site/games-with-my-personal-pink-paw-award/"]:not(.fg-paw)');
  PPA.forEach(el => {
    showRecoloredPaw(el);
    el.style.backgroundSize = '71px auto'; // You can adjust this value
    el.style.backgroundRepeat = 'no-repeat'; // Optional: ensure no repeating
    el.style.backgroundPosition = 'top right'; // Optional: keep original alignment
  });
  // Blend whichever garold image the page has, so new filenames need no script update
  const garold = document.querySelectorAll('div[style*="garold"]:not(.fg-garold)');
  garold.forEach(div => {
    const { backgroundImage, backgroundPosition, backgroundRepeat } = div.style;
    div.classList.add('fg-garold');
    // The glow stops short of the right edge, where the scrollbar sits
    div.style.backgroundImage = `${backgroundImage}, radial-gradient(ellipse 36% 48% at 60% 52%, #777 0%, #737373 20%, #666 38%, #505050 56%, #393939 72%, #272727 86%, #1e1e1e 94%, #1a1a1a 100%)`;
    div.style.backgroundPosition = `${backgroundPosition || '0 0'}, 0 0`;
    div.style.backgroundRepeat = `${backgroundRepeat || 'repeat'}, repeat`;
    div.style.backgroundBlendMode = 'multiply';
    div.style.scrollbarColor = '#555 #1a1a1a';
  });
  const supportImage = 'https://fitgirl-repacks.site/wp-content/uploads/2024/05/support2.jpg';
  document.querySelectorAll(`img[src="${supportImage}"]:not(.fg-support)`).forEach(img => {
    img.classList.add('fg-support');
    img.style.visibility = 'hidden';
    // Only the white strip under the photo changes
    recolorImage(supportImage, [248, 135, 255], 120, 124).then(url => {
      img.src = url;
    }).catch(err => {
      console.error('FG support image recolor error', err);
    }).finally(() => {
      img.style.visibility = '';
    });
  });

}
whenDomReady(replaceImages);


(function applyDarkTheme() {
  'use strict';

  if (!isEnabled('darkTheme')) return;

  GM_addStyle(`
    :root {
      --background-color: #121212;
      --secondary-bg-color: #1a1a1a;
      --foreground-color: #e0e0e0;
      --accent-color: #f887ff;
      --border-color: #333;
      --link-color: #80cbc4;
    }

    /* Keep the originals out of sight until replaceImages has handled them */
    div[style*="paw.png"]:not(.fg-paw),
    a[style*="paw.png"]:not(.fg-paw),
    div[style*="garold"]:not(.fg-garold) {
      background-image: none !important;
    }

    img[src$="/support2.jpg"]:not(.fg-support) {
      visibility: hidden;
    }

    html,
    body {
      background: var(--background-color) !important;
      color: var(--foreground-color) !important;
    }

    img[src*="torrent-stats.info/"] {
      filter: brightness(90%) invert(100) !important;
    }


    #secondary{
      background-color: black !important;
      border-top-left-radius: unset !important;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      border-top-right-radius: unset;
    }

  .entry-content table td {
    background-color: #1a1a1a !important;
    color: #f0f0f0 !important;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

    a, a:visited {
      color: var(--link-color) !important;
    }


   .site-content .entry-summary {
     background-color: var(--secondary-bg-color)
   }

   .content-sidebar {
     background-color: black
   }

   h2.site-description {
     margin-top: 18px;
   }

   img.fg-support {
   margin: 18px 0 0 0 !important;
   }

    .su-spoiler-style-fancy > .su-spoiler-content {
      background-color: var(--background-color) !important;
      color: #ccc !important;
    }

    .su-spoiler-style-fancy > .su-spoiler-title,
    .su-spoiler-style-fancy.su-spoiler-closed > .su-spoiler-title {
      background-color: var(--accent-color) !important;
      color: #000 !important;
    }

    span[style*="color: black"] {
      background-color: transparent !important;
      color: red !important;
    }


    .primary-navigation .nav-menu {
      background-color: black !important;
    }

    .header-main {
      background-color: black !important;
    }

    #jBnskDj9 {
      background-color: var(--background-color) !important;
      color: var(--foreground-color) !important;
    }

    .site,
    #page,
    .wrapper,
    .container,
    .row,
    .columns,
    .column,
    .site-header,
    .site-content,
    .site-footer,
    .entry-content,
    .post,
    .comment-form,
    .entry-header,
    .entry-footer,
    .site-main,
    .page-content,
    .hentry,
    .nav-menu,
    .entry-meta,
    .site-branding {
      background-color: var(--background-color) !important;
      color: var(--foreground-color) !important;
    }

    .site:before {
      background-color: unset !important;
    }

    header.entry-header, div.entry-content, div.entry-meta {
      margin: 0px !important;
      max-width: 1000px !important;
    }


    .site-header {
      max-width: 1519px;
      border: 1px solid var(--border-color);
    }

    .site-content .entry-meta,
    .site-content .entry-header,
    .site-content .footer.entry-meta,
    .site-content .entry-content {
      background-color: var(--secondary-bg-color) !important;
    }

    .site-main article,
    .site-content article,
    .entry-content article,
    .post article,
    body article {
      background-color: var(--secondary-bg-color) !important;
      border: 1px solid var(--border-color) !important;
      border-radius: 8px !important;
      margin: 1.5em 0 !important;
      padding: 1em !important;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5) !important;
    }

   .su-spoiler-content {
     hyphens: none !important;
   }

    #page {
      width: 95%;
      max-width: 1400px;
      margin: 0 auto !important;
      padding: 0 1em;
    }

    #content {
      padding-left: 22px !important;

    }

    #content h3 div {
      background-image: none;
    }

    .content-sidebar {
      left: 120px;
      border-top-left-radius: unset !important;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      border-top-right-radius: unset;
    }

    /* The sidebar's left: 120px needs room beside a centered page. Below that, line the
       page up on the left and shrink it so the shifted sidebar still fits in the window. */
    @media (max-width: 1699px) {
      #page {
        width: calc(100vw - 172px);
        margin: 0 !important;
      }
      /* The fixed header starts after the page's padding, so it can't be the window's full width */
      .site-header {
        max-width: calc(100vw - 34px);
      }
    }

    /* Tighter menu spacing so the added Settings and Tags links stay on one row */
    @media (min-width: 1008px) and (max-width: 1300px) {
      .primary-navigation li a {
        padding: 0 6px;
        font-size: 10px;
      }
    }

    /* Below this the site's left menu moves to the top, so nothing needs the shift */
    @media (max-width: 1007px) {
      #page {
        width: auto;
        padding: 0;
      }
      .site-header {
        box-sizing: border-box;
        max-width: 100%;
      }
      .content-sidebar {
        left: 0;
      }
    }
  `);
})();

/*****************************************************************
 * 2. TOLSTOY COMMENTS TOGGLE                                     *
 *****************************************************************/
whenEnabled('comments', function toggleTolstoyComments(){
  const selector='iframe[src*="tolstoycomments.com"]';
  function addToggle(){
    const iframe=document.querySelector(selector);
    if(!iframe) return false;

    const btn=document.createElement('button');
    btn.textContent='Show Comments';
    Object.assign(btn.style,{margin:'1em 0',padding:'0.5em 1em',background:'var(--accent-color)',color:'#121212',border:'none',borderRadius:'4px',cursor:'pointer',fontWeight:'bold'});

    iframe.parentNode.insertBefore(btn,iframe);
    iframe.style.display='none';

    let visible=false;
    btn.addEventListener('click',()=>{
      visible=!visible;
      iframe.style.display=visible?'block':'none';
      btn.textContent=visible?'Hide Comments':'Show Comments';
    });
    return true;
  }

  // The widget injects its iframe after load, so wait for it without polling
  if(addToggle()) return;
  const observer=new MutationObserver(()=>{
    if(addToggle()) observer.disconnect();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
});

/*****************************************************************
 * 3. YOUTUBE TRAILER LINK                                        *
 *****************************************************************/
whenEnabled('trailers', function YouTubeTrailerLinks(){
    function addYouTubeTrailerLinks() {
        document.querySelectorAll('article').forEach(article => {
            const title = article.querySelector('.entry-title');

            // Skip if already processed
            if (article.querySelector('.nframe')) return;

            const rawTitleText = title ? title.textContent : '';

            // Attempt to extract the clean title using known patterns
            const dashMatch = rawTitleText.match(/^(.*?)(?=\s+\u2013)/); // Matches " –"
            const plusMatch = rawTitleText.match(/^(.*?)(?=\s+\+)/); // Matches " +"

            let cleanedTitle;

            if (dashMatch) {
                cleanedTitle = dashMatch[1];
            } else if (plusMatch) {
                cleanedTitle = plusMatch[1];
            } else {
                cleanedTitle = rawTitleText;
            }

            // Version numbers throw off the search, e.g. ", v1.40.158958.0"
            cleanedTitle = cleanedTitle.replace(/,?\s+(?:v\d|build\s*\d).*$/i, '');

            const encodedQuery = encodeURIComponent(cleanedTitle);
            const searchUrl = `https://www.youtube.com/results?search_query=${encodedQuery}+trailer+video+game`;

            // Find the specific metadata <p> block by style attribute
            article.querySelectorAll('p[style*="height: 200px"]').forEach(metaBlock => {
                const iconHTML = '<br><a class="nframe entry-meta a" href="' + searchUrl + '" title="YouTube Trailer">' +
                                 '<img src="https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg" width="20" height="20" style="vertical-align: middle;">' +
                                 '</a>';
                metaBlock.insertAdjacentHTML('beforeend', iconHTML);
            });
        });
    }

    // Open links in centered pop-up window
    document.addEventListener('click', e => {
        const link = e.target.closest('a.nframe');
        if (!link) return;
        e.preventDefault();
        const url = link.getAttribute('href');

        const width = screen.width * 0.75;
        const height = screen.height * 0.75;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;

        const params = [
            `width=${width}`,
            `height=${height}`,
            `top=${top}`,
            `left=${left}`,
            'directories=no',
            'location=no',
            'menubar=no',
            'resizable=yes',
            'scrollbars=no',
            'status=no',
            'toolbar=no'
        ].join(', ');

        // Open before the lookup so the click still counts and popup blockers allow it
        const newWindow = window.open('about:blank', 'subpop', params);
        if (!newWindow) return;
        if (window.focus) newWindow.focus();

        // Go to the first video, or the search results if none can be found
        const openVideo = response => {
            const match = response && response.responseText.match(/"videoRenderer":\{"videoId":"([\w-]{11})"/);
            newWindow.location.href = match ? `https://www.youtube.com/watch?v=${match[1]}` : url;
        };
        GM_xmlhttpRequest({
            method: 'GET',
            url,
            timeout: 10000,
            onload: openVideo,
            onerror: () => openVideo(),
            ontimeout: () => openVideo()
        });
    });

    // Run initially and every 2 seconds to catch new content
    addYouTubeTrailerLinks();
    setInterval(addYouTubeTrailerLinks, 2000);

});

/*****************************************************************
 * 4. INFINITE SCROLL                                            *
 *****************************************************************/
whenEnabled('infiniteScroll', function infiniteScroll(){
  let loading=false;
  // A fetched post's donate box follows it the same way as on a normal page (see hidePostRule).
  // The site's own CSS still decides where boxes show, so the main page stays without them.
  function withDonateBox(post){
    const next=post.nextElementSibling;
    if(!next) return [post];
    if(next.matches('a')&&next.querySelector('#jBnskDj9')) return [post,next];
    const box=next.matches('style')&&next.nextElementSibling;
    return box&&box.matches('#jBnskDj9')?[post,next,box]:[post];
  }
  async function loadNext(){
    if(loading) return;
    const next=document.querySelector('a.next.page-numbers');
    if(!next) return;
    loading=true;
    searching=true;
    updateFilterStatus();
    let loaded=false;
    try{
      const html=await (await fetch(next.href)).text();
      const doc=new DOMParser().parseFromString(html,'text/html');
      const articles=[...doc.querySelectorAll('article')];
      const nav=document.querySelector('nav.navigation');
      const parent=nav?nav.parentNode:document.querySelector('main')||document.body;
      // The fetched page has the same body classes, so these match there too
      const hidden=[...filterSelectors(),...Object.keys(categoryHides).filter(isEnabled).map(setting=>categoryHides[setting])].join(', ');
      const kept=hidden?articles.filter(a=>!a.matches(hidden)):articles;
      discardedPosts+=articles.length-kept.length;
      kept.flatMap(withDonateBox).forEach(element=>parent.insertBefore(element,nav||null));
      replaceImages();
      const newNext=doc.querySelector('a.next.page-numbers');
      if(newNext&&next){next.href=newNext.href;} else if(next){next.remove();}
      loaded=true;
      pagesWithoutMatch=kept.length?0:pagesWithoutMatch+1;
      // Stop after a long empty run until the reader scrolls, and go gently before then
      searchPaused=pagesWithoutMatch>=20;
      updateFilterStatus();
      if(!kept.length&&!searchPaused) await new Promise(done=>setTimeout(done,1000));
    }catch(err){console.error('FG infinite scroll error',err);} finally{
      loading=false;
      searching=false;
    }
    // Scrolling during a load is ignored, so check again; not after errors, to avoid retrying forever
    if(loaded&&!searchPaused) loadIfNearEnd();
    if(!loading) updateFilterStatus();
  }
  function loadIfNearEnd(){
    const next=document.querySelector('a.next.page-numbers');
    if(!next) return;
    // Start while the end of the page is still two screens away
    if(next.getBoundingClientRect().top<window.innerHeight*3) loadNext();
  }
  // Wheel too, because a heavily filtered page may be too short to scroll
  ['scroll','wheel'].forEach(type=>window.addEventListener(type,()=>{
    if(searchPaused){
      searchPaused=false;
      pagesWithoutMatch=0;
      updateFilterStatus();
    }
    loadIfNearEnd();
  },{passive:true}));
  loadIfNearEnd();
  updateFilterStatus();
});

/*****************************************************************
 * 45. TAG Injector                                              *
 *****************************************************************/

whenEnabled('tags', async function TagInjecotr() {
  'use strict';

  if (window.location.pathname.replace(/\/+$/, '') !== '/tags') return;

  // Update <title> tag in <head>
  document.title = 'Tags - FitGirl Repacks';

  // Replace header text
  const header = document.querySelector('header.page-header h1.page-title');
  if (header) {
    header.textContent = 'All FitGirl Tags';
    header.style.color = '#f887ff';
  }

  // Find page content block
  const contentDiv = document.querySelector('div.page-content');
  if (!contentDiv) return;

  // Remove "not found" paragraph
  const notFoundPara = contentDiv.querySelector('p');
  if (notFoundPara) notFoundPara.remove();

  // Style update (optional)
  contentDiv.style.paddingTop = '1em';

  // Create and insert a tag container
  const tagContainer = document.createElement('div');
  tagContainer.innerHTML = `<p style="margin:1em 0;color:#ccc;">Loading tags…</p>`;
  contentDiv.appendChild(tagContainer);

  // Replace "Loading…" with actual tag list
  function showTags(tags) {
    tagContainer.innerHTML = `
      <h2 style="color:#f887ff;">Tag Index (${tags.length})</h2>
      <ul style="list-style:none;padding-left:0;line-height:1.6;"></ul>
    `;
    tagContainer.querySelector('ul').replaceChildren(...tags.map(tag => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `https://fitgirl-repacks.site/tag/${tag.slug}/`;
      link.style.cssText = 'color:#80cbc4;text-decoration:none;';
      // Saved names are already decoded, so this must stay plain text
      link.textContent = tag.name;
      item.append(link);
      return item;
    }));
  }
  showRefreshedTags = showTags;

  // Saved tags appear right away; a day-old list still shows while a new one loads behind it
  const tagCache = GM_getValue('filterTagCache', null);
  if (tagCache) showTags(tagCache.tags);
  if (tagCache && Date.now() - tagCache.savedAt < tagCacheMaxAge) return;
  const tags = await refreshTagCache();
  if (tags) {
    showTags(tags);
  } else if (!tagCache) {
    tagContainer.innerHTML = '<p style="margin:1em 0;color:#ff8a80;">Tags could not be loaded. Reload the page to try again.</p>';
  }
});

whenEnabled('tags', function addStandaloneTagsMenuItem() {
  const menu = document.querySelector('#primary-menu');
  if (!menu) return;

  const li = document.createElement('li');
  li.className = 'menu-item menu-item-type-custom';
  li.innerHTML = `<a href="https://fitgirl-repacks.site/tags">Tags</a>`;

  menu.appendChild(li);
});

whenEnabled('donateTables', function fixDonatePage() {
  'use strict';

  const fixTables = () => {
    document.querySelectorAll('.entry-content table').forEach((table) => {
      // Skip if already wrapped
      if (table.parentElement && table.parentElement.classList.contains('fg-scroll-wrapper')) return;

      // Create wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'fg-scroll-wrapper';
      wrapper.style.overflowX = 'auto';
      wrapper.style.maxWidth = '100%';

      // Style table
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
      table.style.tableLayout = 'fixed';

      // Style cells
      table.querySelectorAll('td, th').forEach(cell => {
        cell.style.wordBreak = 'break-word';
        cell.style.overflowWrap = 'anywhere';
      });

      // Wrap the table
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  };

  fixTables();
});

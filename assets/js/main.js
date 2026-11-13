/* AI for Industrial Applications Lab — site scripts */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- Mobile navigation ---------- */
  var header = $('.site-header');
  var toggle = $('.nav-toggle');
  if (header && toggle) {
    var closeNav = function () {
      header.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
    };
    toggle.addEventListener('click', function () {
      var open = header.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNav(); });
    $$('.nav a').forEach(function (a) { a.addEventListener('click', closeNav); });
    window.addEventListener('resize', function () { if (window.innerWidth > 960) closeNav(); });
  }

  /* ---------- Image fallbacks (missing photos show initials) ---------- */
  $$('img[data-fallback]').forEach(function (img) {
    var swap = function () {
      var div = document.createElement('div');
      div.className = 'initials';
      div.setAttribute('aria-hidden', 'true');
      div.textContent = img.getAttribute('data-fallback');
      img.replaceWith(div);
    };
    if (img.complete && img.naturalWidth === 0) swap();
    else img.addEventListener('error', swap);
  });

  /* ---------- Google Scholar data (assets/js/publications.js) ---------- */
  var S = window.SCHOLAR || null;
  var escH = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var scholarQ = function (t) { return 'https://scholar.google.com/scholar?q=' + encodeURIComponent(t); };
  if (S) {
    $$('[data-scholar]').forEach(function (el) {
      var v = S.stats && S.stats[el.getAttribute('data-scholar')];
      if (v == null) return;
      el.textContent = Number(v).toLocaleString('en-US');
      el.setAttribute('data-count', v);
    });
    $$('[data-scholar-count]').forEach(function (el) {
      var n = S.publications.length;
      el.textContent = n; el.setAttribute('data-count', n);
    });
    $$('[data-scholar-updated]').forEach(function (el) {
      var d = new Date(S.updated + 'T00:00:00');
      if (!isNaN(d)) el.textContent = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    });
    var recentCards = $('#recent-pubs');
    if (recentCards) {
      recentCards.innerHTML = S.publications.slice(0, Number(recentCards.getAttribute('data-limit') || 4)).map(function (p) {
        return '<a class="card" href="' + scholarQ(p.title) + '" target="_blank" rel="noopener"><span class="card-meta">' + escH(p.year) + ' &middot; ' + escH(p.journal) +
          (p.student ? ' <span class="badge">Student-led</span>' : '') + '</span><span class="card-title">' + escH(p.title) + '</span><span class="card-text">' + escH(p.authors) + '</span></a>';
      }).join('');
    }
    var pubRows = function (items, showCites) {
      return items.map(function (p) {
        return '<li><span class="mono muted">' + escH(p.year) + '</span><div><a href="' + scholarQ(p.title) + '" target="_blank" rel="noopener">' + escH(p.title) + '</a>' +
          '<span class="meta">' + escH(p.authors) + ' &middot; <em>' + escH(p.venue) + '</em></span></div>' +
          (showCites ? '<span class="badge mono" style="font-weight:500">Cited ' + Number(p.cites).toLocaleString('en-US') + '&times;</span>' : '') + '</li>';
      }).join('');
    };
    var rl = $('#recent-list'); if (rl) rl.innerHTML = pubRows(S.publications.slice(0, Number(rl.getAttribute('data-limit') || 3)), false);
    var cl = $('#cited-list'); if (cl && S.mostCited) cl.innerHTML = pubRows(S.mostCited, true);
  }

  /* ---------- Scroll reveal + number count-up ---------- */
  var revealEls = $$('[data-reveal]');
  var counters = $$('[data-count]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    revealEls.forEach(function (el) { el.classList.add('reveal'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });

    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        co.unobserve(e.target);
        var el = e.target, to = parseFloat(el.getAttribute('data-count'));
        var dec = Number(el.getAttribute('data-decimals') || 0), suffix = el.getAttribute('data-suffix') || '';
        var t0 = null;
        var tick = function (t) {
          if (!t0) t0 = t;
          var k = Math.min(1, (t - t0) / 1300), v = to * (1 - Math.pow(1 - k, 3));
          el.textContent = v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix;
          if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { co.observe(el); });
  }

  /* ---------- Tabs (pipeline + research areas) ---------- */
  $$('[role="tablist"]').forEach(function (list) {
    var tabs = $$('[role="tab"]', list);
    var select = function (tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab); });
      tab.addEventListener('keydown', function (e) {
        var k = e.key, n = null;
        if (k === 'ArrowRight' || k === 'ArrowDown') n = tabs[(i + 1) % tabs.length];
        if (k === 'ArrowLeft' || k === 'ArrowUp') n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (k === 'Home') n = tabs[0];
        if (k === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
  });

  /* ---------- Vibration signal demo ---------- */
  var demo = $('#signal-demo');
  if (demo) {
    var wave = $('#wave', demo), dot = $('#readout-dot', demo), title = $('#readout-title', demo), text = $('#readout-text', demo);
    var modes = {
      healthy: { color: '#6ea8fe', title: 'No fault detected', text: 'Smooth, periodic vibration concentrated at the running frequency.' },
      bearing: { color: '#fb923c', title: 'Bearing fault signature', text: 'Sharp impulses repeat each time a rolling element passes the damaged race.' },
      rotor: { color: '#fb923c', title: 'Broken rotor bar signature', text: 'Slow amplitude modulation as sidebands form around the supply frequency.' }
    };
    var mode = 'bearing', phase = 0, running = false, visible = true;
    var noise = function (i) { var s = Math.sin(i * 12.9898) * 43758.5453; return s - Math.floor(s) - 0.5; };
    var sample = function (i) {
      if (mode === 'healthy') return 16 * Math.sin(i * 0.42) + 5 * Math.sin(i * 1.9) + 8 * noise(i);
      if (mode === 'bearing') {
        var ph = ((i * 2) % 40 + 40) % 40;
        return 12 * Math.sin(i * 0.42) + 6 * noise(i) + 72 * Math.exp(-ph / 5) * Math.sin(ph * 1.35);
      }
      return (1 + 0.6 * Math.sin(i * 0.05)) * 30 * Math.sin(i * 0.42) + 6 * noise(i);
    };
    var draw = function () {
      var pts = [];
      for (var x = 0; x <= 520; x += 2) {
        var y = 110 + sample(Math.floor(x / 2 + phase));
        pts.push(x + ',' + Math.max(8, Math.min(212, y)).toFixed(1));
      }
      wave.setAttribute('points', pts.join(' '));
    };
    var setMode = function (m) {
      mode = m;
      var info = modes[m];
      wave.setAttribute('stroke', info.color);
      dot.style.background = info.color;
      title.textContent = info.title;
      text.textContent = info.text;
      $$('[data-mode]', demo).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mode') === m ? 'true' : 'false'); });
      draw();
    };
    $$('[data-mode]', demo).forEach(function (b) { b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); }); });
    setMode('bearing');

    if (!reduceMotion) {
      var last = 0;
      var loop = function (t) {
        if (!visible || document.hidden) { running = false; return; }
        if (t - last > 33) { phase += 1; draw(); last = t; }
        requestAnimationFrame(loop);
      };
      var start = function () { if (!running) { running = true; requestAnimationFrame(loop); } };
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); }).observe(demo);
      }
      document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });
      start();
    }
  }

  /* ---------- Toast ---------- */
  var toastEl = null, toastTimer = null;
  var toast = function (msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  };
  var copyText = function (str) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(str);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = str; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
      ta.remove();
    });
  };

  /* ---------- Publications ---------- */
  var pubRoot = $('#publications-app');
  if (pubRoot && S) {
    var P = S.publications;
    var listEl = $('#pub-list'), countEl = $('#pub-count'), searchEl = $('#pub-search'), filtersEl = $('#pub-filters');
    var years = P.map(function (p) { return p.year; }).filter(function (y, i, a) { return a.indexOf(y) === i; });
    var FILTERS = [['all', 'All', function () { return true; }]].concat(years.map(function (y) {
      return [y, y, function (p) { return p.year === y; }];
    }));
    if (P.some(function (p) { return p.student; })) FILTERS.push(['student', 'Student-led', function (p) { return p.student; }]);
    var state = { filter: 'all', q: '' };
    var hl = function (str) {
      var e = escH(str);
      if (!state.q) return e;
      var q = escH(state.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return e.replace(new RegExp('(' + q + ')', 'ig'), '<mark>$1</mark>');
    };
    var cite = function (p) { return p.authors + ' (' + p.year + '). ' + p.title + '. ' + p.venue + '.'; };

    FILTERS.forEach(function (f) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'filter'; b.setAttribute('data-k', f[0]);
      b.innerHTML = '<span>' + f[1] + '</span><span class="count">' + P.filter(f[2]).length + '</span>';
      b.addEventListener('click', function () { state.filter = f[0]; render(); });
      filtersEl.appendChild(b);
    });

    var render = function () {
      var f = FILTERS.filter(function (x) { return x[0] === state.filter; })[0];
      var q = state.q.toLowerCase();
      var shown = P.filter(f[2]).filter(function (p) {
        return !q || (p.title + ' ' + p.authors + ' ' + p.venue).toLowerCase().indexOf(q) !== -1;
      });
      countEl.textContent = q
        ? shown.length + (shown.length === 1 ? ' publication matches' : ' publications match') + ' “' + state.q + '”'
        : 'Showing ' + shown.length + ' of ' + P.length + ' publications';
      if (!shown.length) {
        listEl.innerHTML = '<p class="empty">No publications match your search. Try a different keyword or filter.</p>';
      } else {
        var groups = [], cur = null;
        shown.forEach(function (p) {
          if (!cur || cur.year !== p.year) { cur = { year: p.year, items: [] }; groups.push(cur); }
          cur.items.push(p);
        });
        listEl.innerHTML = groups.map(function (g) {
          return '<section class="year-group"><h3>' + escH(g.year) + ' <span>' + g.items.length + (g.items.length === 1 ? ' publication' : ' publications') + '</span></h3><ul class="pub-box">' +
            g.items.map(function (p) {
              return '<li class="pub"><a class="pub-title" href="' + scholarQ(p.title) + '" target="_blank" rel="noopener">' + hl(p.title) + '</a>' +
                '<span class="pub-meta">' + hl(p.authors) + ' · <em>' + hl(p.venue) + '</em></span>' +
                '<span class="pub-actions">' + (p.student ? '<span class="badge">Student-led</span>' : '') +
                '<button type="button" class="cite-btn" data-i="' + P.indexOf(p) + '">Copy citation</button></span></li>';
            }).join('') + '</ul></section>';
        }).join('');
      }
      $$('.filter', filtersEl).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-k') === state.filter ? 'true' : 'false'); });
    };

    listEl.addEventListener('click', function (e) {
      var b = e.target.closest('.cite-btn');
      if (!b) return;
      copyText(cite(P[Number(b.getAttribute('data-i'))])).then(function () {
        b.textContent = 'Copied'; b.classList.add('copied'); toast('Citation copied to clipboard');
        setTimeout(function () { b.textContent = 'Copy citation'; b.classList.remove('copied'); }, 1800);
      }, function () { toast('Copy failed. Select the title text instead.'); });
    });
    var timer = null;
    searchEl.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { state.q = searchEl.value.trim(); render(); }, 120);
    });
    render();
  }

  /* ---------- Back to top + year ---------- */
  var top = $('.to-top');
  if (top) {
    var onScroll = function () { top.classList.toggle('show', window.scrollY > 700); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); });
  }
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();

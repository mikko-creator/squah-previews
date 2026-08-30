/* Elevate Dental - the endless carousel, generalised.
 *
 * This replaces elevatedental-bench.js, which did the same job for one component. There are
 * now two carousels on the page (the clinician bench and the nine hubs) and an infinite
 * loop is fiddly enough - clone counts, the anchor, suspending snap for the shift - that
 * two copies of it would drift apart the first time either was touched. One implementation,
 * driven by data attributes.
 *
 * MARKUP CONTRACT
 *   [data-loop]                  the container
 *   [data-loop-track]            the scrolling flex row (a direct child list)
 *   [data-loop-lead]             OPTIONAL, on the container: mark the item nearest the
 *                                centre with .is-lead. The bench uses it to lift a
 *                                clinician out; the hubs do not ask for a highlight.
 *   [data-loop="prev"|"next"]    OPTIONAL buttons anywhere inside the container
 *
 * HOW THE LOOP WORKS. The markup holds the real items and nothing else. At runtime the set
 * is cloned either side until the track is at least three viewports wide, the scroll parks
 * on the real set, and whenever it drifts more than half a set from that anchor it is
 * shifted back by exactly one set width. One whole set lands on an identical item in an
 * identical position, so there is nothing to see and the strip never runs out either way.
 *
 * WHY CLONE AT RUNTIME. With JavaScript off the section must not become the same items
 * three times over. The markup stays honest at one set; a no-JS reader gets a plain
 * scrollable row and simply no loop.
 *
 * THE CLONES ARE NOT CONTENT. Each carries aria-hidden and every focusable inside it is
 * removed from the tab order, so assistive tech and the keyboard traverse the real set
 * once, not three times.
 */
(function () {
  'use strict';

  function init(root) {
    var track = root.querySelector('[data-loop-track]');
    if (!track) return;
    var originals = [].slice.call(track.children).filter(function (c) { return !c.hasAttribute('data-clone'); });
    if (originals.length < 2) return;

    var wantLead = root.hasAttribute('data-loop-lead');
    var setW = 0, sets = 0, items = [], ticking = false, shifting = false;

    function measureSet() {
      var first = originals[0].getBoundingClientRect();
      var last = originals[originals.length - 1].getBoundingClientRect();
      var gap = parseFloat(getComputedStyle(track).gap) || 0;
      return (last.right - first.left) + gap;
    }

    function withoutSnap(fn) {
      shifting = true;
      track.classList.add('is-shifting');
      fn();
      void track.offsetWidth;          // settle before snap returns, or it re-snaps the jump
      track.classList.remove('is-shifting');
      shifting = false;
    }

    function build() {
      [].slice.call(track.querySelectorAll('[data-clone]')).forEach(function (n) { n.remove(); });
      setW = measureSet();
      if (!setW) return false;

      sets = Math.max(1, Math.ceil(track.clientWidth / setW));
      var before = document.createDocumentFragment();
      var after = document.createDocumentFragment();
      for (var s = 0; s < sets; s++) {
        originals.forEach(function (el) {
          [el.cloneNode(true), el.cloneNode(true)].forEach(function (c, k) {
            c.setAttribute('data-clone', '');
            c.setAttribute('aria-hidden', 'true');
            c.classList.remove('is-lead');
            [].slice.call(c.querySelectorAll('a,button,input,select,textarea,[tabindex]')).forEach(function (f) {
              f.setAttribute('tabindex', '-1');
            });
            (k === 0 ? before : after).appendChild(c);
          });
        });
      }
      track.insertBefore(before, originals[0]);
      track.appendChild(after);
      items = [].slice.call(track.children);
      withoutSnap(function () { track.scrollLeft = setW * sets; });
      return true;
    }

    function wrap() {
      if (!setW) return;
      var d = track.scrollLeft - (setW * sets);
      if (d > setW * 0.5) withoutSnap(function () { track.scrollLeft -= setW; });
      else if (d < -setW * 0.5) withoutSnap(function () { track.scrollLeft += setW; });
    }

    function pick() {
      ticking = false;
      wrap();
      if (!wantLead) return;
      var box = track.getBoundingClientRect();
      var mid = box.left + box.width / 2;
      var best = null, bestD = Infinity;
      for (var i = 0; i < items.length; i++) {
        var r = items[i].getBoundingClientRect();
        if (r.right < box.left - 200 || r.left > box.right + 200) continue;
        // nearest, never "within a threshold": two neighbours can both be near the middle,
        // only one can be nearest, which is what guarantees a single highlight
        var d = Math.abs((r.left + r.width / 2) - mid);
        if (d < bestD) { bestD = d; best = items[i]; }
      }
      for (var j = 0; j < items.length; j++) items[j].classList.toggle('is-lead', items[j] === best);
    }

    function onScroll() {
      if (ticking || shifting) return;
      ticking = true;
      requestAnimationFrame(pick);
    }

    function centre(el) {
      var t = track.getBoundingClientRect(), r = el.getBoundingClientRect();
      track.scrollBy({ left: (r.left + r.width / 2) - (t.left + t.width / 2), behavior: 'smooth' });
    }
    function step(dir) {
      var from = wantLead ? track.querySelector('.is-lead') : nearest();
      if (!from) return;
      var i = items.indexOf(from) + dir;
      if (i < 0 || i > items.length - 1) return;
      centre(items[i]);
    }
    function nearest() {
      var box = track.getBoundingClientRect(), mid = box.left + box.width / 2;
      var best = null, bestD = Infinity;
      for (var i = 0; i < items.length; i++) {
        var r = items[i].getBoundingClientRect();
        var d = Math.abs((r.left + r.width / 2) - mid);
        if (d < bestD) { bestD = d; best = items[i]; }
      }
      return best;
    }

    track.addEventListener('scroll', onScroll, { passive: true });
    track.addEventListener('click', function (e) {
      var it = e.target.closest ? e.target.closest('[data-loop-item]') : null;
      if (it && wantLead) centre(it);
    });
    track.addEventListener('focusin', function (e) {
      var it = e.target.closest ? e.target.closest('[data-loop-item]') : null;
      if (it) centre(it);
    });

    var prev = root.querySelector('[data-loop="prev"]');
    var next = root.querySelector('[data-loop="next"]');
    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (next) next.addEventListener('click', function () { step(1); });

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (build()) pick(); }, 180);
    });

    if (build()) pick();
  }

  [].slice.call(document.querySelectorAll('[data-loop]')).forEach(init);
})();

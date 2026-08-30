/* The endless bench carousel.
 *
 * Clones the twelve either side until the track is at least three viewports wide, parks on
 * the real set, and shifts back by exactly one set width whenever the scroll drifts half a
 * set from the anchor. A shift of one whole set lands on an identical card in an identical
 * position, so the seam is invisible and the strip never runs out in either direction.
 *
 * Cloning happens here rather than in the markup so that with JavaScript off the section is
 * twelve people once, not thirty-six.
 */
(function () {
  'use strict';
  var root = document.querySelector('.ed-bench');
  if (!root) return;
  var track = root.querySelector('.ed-bench__track');
  if (!track) return;

  var originals = [].slice.call(track.children);
  if (!originals.length) return;

  var setW = 0, sets = 0, items = [], ticking = false, shifting = false;

  function measureSet() {
    var first = originals[0].getBoundingClientRect();
    var last = originals[originals.length - 1].getBoundingClientRect();
    var gap = parseFloat(getComputedStyle(track).gap) || 0;
    return (last.right - first.left) + gap;
  }

  function build() {
    // strip any previous clones, then re-clone for the current width
    [].slice.call(track.querySelectorAll('[data-clone]')).forEach(function (n) { n.remove(); });
    setW = measureSet();
    if (!setW) return false;

    // enough copies each side that a full viewport is always covered
    var need = Math.max(1, Math.ceil(track.clientWidth / setW));
    sets = need;

    var before = document.createDocumentFragment();
    var after = document.createDocumentFragment();
    for (var s = 0; s < need; s++) {
      originals.forEach(function (el) {
        var a = el.cloneNode(true), b = el.cloneNode(true);
        [a, b].forEach(function (c) {
          c.setAttribute('data-clone', '');
          c.setAttribute('aria-hidden', 'true');
          [].slice.call(c.querySelectorAll('a,button,input,[tabindex]')).forEach(function (f) {
            f.setAttribute('tabindex', '-1');
          });
        });
        before.appendChild(a);
        after.appendChild(b);
      });
    }
    track.insertBefore(before, originals[0]);
    track.appendChild(after);
    items = [].slice.call(track.children);

    // park on the real set
    withoutSnap(function () { track.scrollLeft = setW * need; });
    return true;
  }

  function withoutSnap(fn) {
    shifting = true;
    track.classList.add('is-shifting');
    fn();
    // force the layout to settle before snap comes back, or the browser re-snaps the jump
    void track.offsetWidth;
    track.classList.remove('is-shifting');
    shifting = false;
  }

  function wrap() {
    if (!setW) return;
    var anchor = setW * sets;
    var d = track.scrollLeft - anchor;
    if (d > setW * 0.5) withoutSnap(function () { track.scrollLeft -= setW; });
    else if (d < -setW * 0.5) withoutSnap(function () { track.scrollLeft += setW; });
  }

  function pick() {
    ticking = false;
    wrap();
    var box = track.getBoundingClientRect();
    var mid = box.left + box.width / 2;
    var best = null, bestD = Infinity;
    for (var i = 0; i < items.length; i++) {
      var r = items[i].getBoundingClientRect();
      if (r.right < box.left - 200 || r.left > box.right + 200) continue;  // off-strip, skip
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
    var lead = track.querySelector('.ed-bench__item.is-lead');
    if (!lead) return;
    var i = items.indexOf(lead) + dir;
    if (i < 0 || i > items.length - 1) return;
    centre(items[i]);
  }

  track.addEventListener('scroll', onScroll, { passive: true });
  track.addEventListener('click', function (e) {
    var it = e.target.closest ? e.target.closest('.ed-bench__item') : null;
    if (it) centre(it);
  });
  track.addEventListener('focusin', function (e) {
    var it = e.target.closest ? e.target.closest('.ed-bench__item') : null;
    if (it) centre(it);
  });
  var prev = root.querySelector('[data-bench="prev"]');
  var next = root.querySelector('[data-bench="next"]');
  if (prev) prev.addEventListener('click', function () { step(-1); });
  if (next) next.addEventListener('click', function () { step(1); });

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { if (build()) pick(); }, 180);
  });

  if (build()) pick();
})();

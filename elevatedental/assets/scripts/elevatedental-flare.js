/* Elevate Dental - the Motion layer.
 *
 * Five effects built on Motion (motion.dev) v13.1.1, chosen because each does something
 * the existing CSS motion sheet genuinely CANNOT, rather than restating it louder:
 *
 *   1  stat count-up      - CSS cannot animate a number at all
 *   2  brass ring draw    - the rings are the brand mark; they now draw themselves
 *   3  magnetic CTA       - follows the pointer with real spring physics
 *   4  spring hover lift  - true spring maths, not an ease curve pretending to be one
 *   5  reading progress   - scroll-LINKED (scrubbed), not scroll-triggered
 *
 * THE RULE EVERY EFFECT OBEYS: it may only ADD motion to something already visible. None
 * of them hides content first and reveals it later. That is deliberate. This build has
 * already shipped a scroll-reveal that left 31 of 156 objects permanently invisible, so
 * nothing here is allowed to depend on JavaScript running in order for content to exist.
 * If this file fails to parse, fails to load, or throws halfway through, every word and
 * picture on the page is still there, and the CSS motion sheet still runs.
 *
 * Each effect is independently wrapped, so one throwing cannot take the others down.
 */
(function () {
  'use strict';

  var M = window.Motion;
  if (!M || typeof M.animate !== 'function') return;   // library absent: CSS carries on alone

  var animate = M.animate, inView = M.inView, hover = M.hover, scroll = M.scroll;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* Tell the stylesheet Motion is live, so the few places where CSS and Motion would
     drive the SAME property can hand over cleanly. Set only now, once the library has
     been confirmed, never at parse time. */
  document.documentElement.classList.add('mo-js');

  var SPRING = { type: 'spring', stiffness: 380, damping: 30, mass: 0.9 };
  var EASE_OUT = [0.16, 1, 0.3, 1];

  function guard(name, fn) {
    try { fn(); } catch (e) {
      if (window.console && console.warn) console.warn('[flare] ' + name + ' skipped: ' + e.message);
    }
  }

  /* ---- 1. THE NUMBERS COUNT UP -------------------------------------------------
     Only plain integers. The same class also carries times (20:00), floor numbers
     (2F), a technology name (3D) and peso figures (P180,000). Counting any of those
     would be nonsense, and rewriting a price even briefly is not something to do on
     a page where every price is a published claim. So the test is deliberately
     strict, and anything that fails it is left exactly as authored.

     The element's rendered width is pinned before counting, because 0 and 31 are
     different widths and the row would otherwise twitch as it counts. */
  guard('count-up', function () {
    if (reduced) return;
    var nodes = document.querySelectorAll('.kit-stat__n');
    Array.prototype.forEach.call(nodes, function (el) {
      var raw = (el.textContent || '').trim();
      if (!/^\d{1,6}$/.test(raw)) return;
      var target = parseInt(raw, 10);
      if (!target) return;                       // 0 has nothing to count to

      inView(el, function () {
        var w = el.getBoundingClientRect().width;
        if (w) { el.style.minWidth = Math.ceil(w) + 'px'; el.style.display = 'inline-block'; }
        animate(0, target, {
          duration: 1.15,
          ease: EASE_OUT,
          onUpdate: function (v) { el.textContent = String(Math.round(v)); },
          onComplete: function () { el.textContent = raw; }   // restore the authored text exactly
        });
      }, { amount: 0.6 });
    });
  });

  /* ---- 2. THE BRASS RINGS DRAW THEMSELVES --------------------------------------
     The ring is the mark this brand is built on, and it currently just sits there.
     Each track circle now draws clockwise as it arrives.

     The dash offset is set and animated in the SAME call, as a two keyframe array,
     so there is no moment where the ring has been hidden by a first step that a
     failure could strand. If the animation never runs, the ring is simply drawn. */
  guard('ring-draw', function () {
    if (reduced) return;
    var rings = document.querySelectorAll('.kit-ring__track');
    Array.prototype.forEach.call(rings, function (c) {
      var r = c.r && c.r.baseVal ? c.r.baseVal.value : 0;
      if (!r) return;
      var len = 2 * Math.PI * r;
      inView(c, function () {
        c.style.strokeDasharray = len + ' ' + len;
        animate(c, { strokeDashoffset: [len, 0] }, { duration: 1.25, ease: EASE_OUT });
      }, { amount: 0.4 });
    });
  });

  /* ---- 3. THE PRIMARY CALL TO ACTION IS MAGNETIC --------------------------------
     It leans a few pixels toward the pointer and springs back when the pointer
     leaves. Six pixels is the whole budget: enough to feel alive under the hand,
     far too little to move the target out from under a click.

     Fine pointers only. On a touch screen there is no hover to respond to, and a
     synthesised one would make the button jump under the thumb mid-press. */
  guard('magnetic-cta', function () {
    if (reduced || !finePointer) return;
    var PULL = 6;
    var btns = document.querySelectorAll('.kit-btn--primary');
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        animate(b, {
          x: Math.max(-1, Math.min(1, dx)) * PULL,
          y: Math.max(-1, Math.min(1, dy)) * PULL - 2   // keeps the CSS lift of -2px
        }, { type: 'spring', stiffness: 260, damping: 18, mass: 0.6 });
      });
      b.addEventListener('pointerleave', function () {
        animate(b, { x: 0, y: 0 }, { type: 'spring', stiffness: 300, damping: 24 });
      });
    });
  });

  /* ---- 4. CARDS AND MEGA TILES LIFT ON A REAL SPRING ----------------------------
     CSS can only approximate a spring with a bezier. This is the actual maths, so
     the lift overshoots a little and settles, which is what makes it read as a
     physical object rather than a fade.

     It drives --mo-y and --mo-s rather than y and scale. Those would compile to
     transform, and .kit-card runs mo-reveal on an animation-timeline: view(); a
     filled CSS animation outranks inline styles, so the reveal was overwriting the
     spring on every frame. The independent translate and scale properties are free
     and compose with transform, so the stylesheet feeds these two variables into
     them instead. */
  guard('spring-hover', function () {
    if (reduced || !finePointer || typeof hover !== 'function') return;
    var els = document.querySelectorAll('.kit-card, .ed-mtile');
    Array.prototype.forEach.call(els, function (el) {
      hover(el, function () {
        // custom properties, not y/scale: those compile to transform, which the
        // element's own view-timeline reveal overwrites every frame.
        animate(el, { '--mo-y': '-6px', '--mo-s': 1.012 }, SPRING);
        return function () { animate(el, { '--mo-y': '0px', '--mo-s': 1 }, SPRING); };
      });
    });
  });

  /* ---- 5. A SCROLL LINKED READING RULE ------------------------------------------
     Not a triggered animation: this is scrubbed by scroll position through Motion's
     ScrollTimeline path, so it tracks the scrollbar exactly and runs off the
     compositor. A thin brass rule across the very top, which is the one piece of
     pure ornament here and earns its place by telling the reader how far through a
     long treatment page they are. */
  guard('scroll-progress', function () {
    if (reduced || typeof scroll !== 'function') return;
    if (document.body.scrollHeight <= window.innerHeight * 1.4) return;  // short page: pointless
    var bar = document.createElement('div');
    bar.className = 'mo-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    scroll(animate(bar, { scaleX: [0, 1] }, { ease: 'linear' }));
  });
})();

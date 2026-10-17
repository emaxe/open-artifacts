(function () {
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  function init(root) {
    var viewport = root.querySelector('.oa-slideshow__viewport');
    var track = root.querySelector('.oa-slideshow__track');
    var slides = Array.prototype.slice.call(track.children);
    var n = slides.length;
    var perView = Math.max(1, parseInt(root.getAttribute('data-per-view'), 10) || 1);
    var loop = root.getAttribute('data-loop') !== 'false';
    var autoplay = reduceMotion ? 0 : (parseInt(root.getAttribute('data-autoplay'), 10) || 0);
    var navMode = root.getAttribute('data-nav') || 'dots';
    var showArrows = root.getAttribute('data-arrows') !== 'false';
    var max = Math.max(0, n - perView);
    var index = 0, timer = null, hovered = false, userStopped = false, visible = true;

    root.classList.add('is-ready');
    if (max === 0) { slides.forEach(function (s) { s.classList.add('is-active'); }); return; }

    var prev, next, dots = [], counter, pauseBtn;

    if (showArrows) {
      prev = el('button', 'oa-slideshow__arrow oa-slideshow__arrow--prev', { type: 'button', 'aria-label': 'Previous slide' });
      next = el('button', 'oa-slideshow__arrow oa-slideshow__arrow--next', { type: 'button', 'aria-label': 'Next slide' });
      prev.innerHTML = '&#8249;';
      next.innerHTML = '&#8250;';
      prev.addEventListener('click', function () { go(index - 1, true); });
      next.addEventListener('click', function () { go(index + 1, true); });
      viewport.appendChild(prev);
      viewport.appendChild(next);
    }

    if (navMode === 'dots' || navMode === 'thumbs') {
      var nav = el('div', 'oa-slideshow__nav oa-slideshow__nav--' + navMode);
      for (var i = 0; i <= max; i++) {
        (function (k) {
          var b = el('button', 'oa-slideshow__dot', { type: 'button', 'aria-label': 'Go to slide ' + (k + 1) });
          if (navMode === 'thumbs') {
            var src = slides[k].querySelector('img');
            if (src) { var t = el('img', '', { alt: '', loading: 'lazy' }); t.src = src.currentSrc || src.src; b.appendChild(t); }
            else b.textContent = String(k + 1);
          }
          b.addEventListener('click', function () { go(k, true); });
          nav.appendChild(b);
          dots.push(b);
        }(i));
      }
      root.appendChild(nav);
    } else if (navMode === 'counter') {
      counter = el('div', 'oa-slideshow__counter', { 'aria-live': 'polite' });
      root.appendChild(counter);
    }

    if (autoplay) {
      pauseBtn = el('button', 'oa-slideshow__pause', { type: 'button', 'aria-label': 'Pause slideshow' });
      pauseBtn.innerHTML = '&#10073;&#10073;';
      pauseBtn.addEventListener('click', function () {
        userStopped = !userStopped;
        pauseBtn.innerHTML = userStopped ? '&#9654;' : '&#10073;&#10073;';
        pauseBtn.setAttribute('aria-label', userStopped ? 'Play slideshow' : 'Pause slideshow');
        schedule();
      });
      viewport.appendChild(pauseBtn);
    }

    function render() {
      root.style.setProperty('--oa-i', index);
      slides.forEach(function (s, k) {
        var on = k >= index && k < index + perView;
        s.classList.toggle('is-active', on);
        s.setAttribute('aria-hidden', on ? 'false' : 'true');
        if ('inert' in s) s.inert = !on;
      });
      dots.forEach(function (d, k) {
        if (k === index) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
      if (counter) counter.textContent = (index + 1) + (perView > 1 ? '–' + Math.min(n, index + perView) : '') + ' / ' + n;
      if (!loop) {
        if (prev) prev.disabled = index === 0;
        if (next) next.disabled = index === max;
      }
    }

    function go(i, byUser) {
      if (i > max) i = loop ? 0 : max;
      if (i < 0) i = loop ? max : 0;
      var changed = i !== index;
      index = i;
      render();
      if (changed) {
        for (var k = index; k < index + perView && k < n; k++) window.__oaReveal(slides[k]);
      }
      if (byUser && autoplay) schedule();
    }

    function schedule() {
      clearInterval(timer);
      timer = null;
      if (!autoplay || userStopped || hovered || !visible || document.hidden) return;
      timer = setInterval(function () {
        if (!loop && index === max) { clearInterval(timer); return; }
        go(index + 1, false);
      }, autoplay);
    }

    root.addEventListener('mouseenter', function () { hovered = true; schedule(); });
    root.addEventListener('mouseleave', function () { hovered = false; schedule(); });
    root.addEventListener('focusin', function () { hovered = true; schedule(); });
    root.addEventListener('focusout', function () { hovered = false; schedule(); });
    document.addEventListener('visibilitychange', schedule);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        schedule();
      }, { threshold: 0.2 }).observe(root);
    }

    root.addEventListener('keydown', function (e) {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') { go(index - 1, true); }
      else if (e.key === 'ArrowRight') { go(index + 1, true); }
    });

    // swipe
    var sx = null, sy = null, swiped = false;
    viewport.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest && e.target.closest('button, a, input, select, textarea, summary')) return;
      sx = e.clientX; sy = e.clientY; swiped = false;
    });
    viewport.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 45 && Math.abs(dy) < Math.abs(dx)) {
        swiped = true;
        go(index + (dx < 0 ? 1 : -1), true);
      }
    });
    viewport.addEventListener('pointercancel', function () { sx = null; });
    // a swipe must not also count as a click on the picture (lightbox)
    viewport.addEventListener('click', function (e) {
      if (swiped) { e.stopPropagation(); e.preventDefault(); swiped = false; }
    }, true);

    render();
    schedule();
  }

  window.__oaReady(function () {
    Array.prototype.forEach.call(document.querySelectorAll('[data-oa-slideshow]'), init);
  });
}());

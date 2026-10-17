(function () {
  if (window.__oaLightbox) return;
  window.__oaLightbox = true;

  var overlay, imgEl, closeBtn, prevBtn, nextBtn, capEl, countEl;
  var items = [], index = 0, opener = null;
  var scale = 1, panX = 0, panY = 0, drag = null, swallowClick = false;

  function build() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Full screen image view');
    overlay.innerHTML =
      '<button type="button" class="lightbox-close" aria-label="Close full screen view">&times;</button>' +
      '<button type="button" class="lightbox-nav lightbox-nav--prev" aria-label="Previous image">&#8249;</button>' +
      '<button type="button" class="lightbox-nav lightbox-nav--next" aria-label="Next image">&#8250;</button>' +
      '<img class="lightbox-img" src="" alt="" draggable="false">' +
      '<div class="lightbox-bar"><span class="lightbox-caption"></span><span class="lightbox-count" aria-live="polite"></span></div>';
    document.body.appendChild(overlay);
    imgEl = overlay.querySelector('.lightbox-img');
    closeBtn = overlay.querySelector('.lightbox-close');
    prevBtn = overlay.querySelector('.lightbox-nav--prev');
    nextBtn = overlay.querySelector('.lightbox-nav--next');
    capEl = overlay.querySelector('.lightbox-caption');
    countEl = overlay.querySelector('.lightbox-count');

    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', function (e) { e.stopPropagation(); step(-1); });
    nextBtn.addEventListener('click', function (e) { e.stopPropagation(); step(1); });
    // clicking the dimmed backdrop (not the picture, bar or buttons) closes
    overlay.addEventListener('click', function (e) {
      if (swallowClick) { swallowClick = false; return; }
      if (e.target === overlay) close();
    });

    imgEl.addEventListener('pointerdown', onDown);
    imgEl.addEventListener('pointermove', onMove);
    imgEl.addEventListener('pointerup', onUp);
    imgEl.addEventListener('pointercancel', function () { drag = null; });
  }

  function isOpen() { return overlay && overlay.classList.contains('lightbox-overlay--active'); }

  function applyTransform() {
    imgEl.style.setProperty('--lb-s', scale);
    imgEl.style.setProperty('--lb-x', panX + 'px');
    imgEl.style.setProperty('--lb-y', panY + 'px');
    imgEl.classList.toggle('is-zoomed', scale > 1);
  }

  function resetZoom() { scale = 1; panX = 0; panY = 0; applyTransform(); }

  function show(i) {
    var it = items[i];
    index = i;
    resetZoom();
    imgEl.src = it.src;
    imgEl.alt = it.alt || '';
    capEl.textContent = it.caption || '';
    capEl.hidden = !it.caption;
    var many = items.length > 1;
    prevBtn.hidden = nextBtn.hidden = !many;
    countEl.textContent = many ? (i + 1) + ' / ' + items.length : '';
    // warm the neighbours so arrows feel instant
    [i - 1, i + 1].forEach(function (k) {
      if (items[k]) { var pre = new Image(); pre.src = items[k].src; }
    });
  }

  function step(d) {
    if (items.length < 2) return;
    show((index + d + items.length) % items.length);
  }

  function open(target) {
    build();
    var group = target.getAttribute('data-oa-group');
    var nodes = group
      ? Array.prototype.slice.call(document.querySelectorAll('img[data-zoomable="true"]')).filter(function (n) {
          return n.getAttribute('data-oa-group') === group;
        })
      : [target];
    items = nodes.map(function (n) {
      return { src: n.currentSrc || n.src, alt: n.alt, caption: n.getAttribute('data-caption') || '' };
    });
    opener = target;
    show(Math.max(0, nodes.indexOf(target)));
    overlay.classList.add('lightbox-overlay--active');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function close() {
    if (!isOpen()) return;
    overlay.classList.remove('lightbox-overlay--active');
    document.body.style.overflow = '';
    setTimeout(function () { if (!isOpen()) imgEl.src = ''; }, 220);
    if (opener && opener.focus) opener.focus();
    opener = null;
  }

  // picture: click toggles 2x, drag pans while zoomed, horizontal swipe flips when not zoomed
  function onDown(e) {
    imgEl.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, px: panX, py: panY, moved: false };
  }
  function onMove(e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) drag.moved = true;
    if (scale > 1) { panX = drag.px + dx; panY = drag.py + dy; applyTransform(); }
  }
  function onUp(e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    var moved = drag.moved;
    drag = null;
    if (!moved) {
      if (scale > 1) resetZoom(); else { scale = 2; applyTransform(); }
    } else if (scale === 1 && Math.abs(dx) > 50 && Math.abs(dy) < 80) {
      step(dx < 0 ? 1 : -1);
    }
    if (moved) swallowClick = true;
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.getAttribute('data-zoomable') === 'true') {
      e.preventDefault();
      open(t);
    }
  });

  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (!isOpen()) {
      if ((e.key === 'Enter' || e.key === ' ') && t && t.tagName === 'IMG' && t.getAttribute('data-zoomable') === 'true') {
        e.preventDefault();
        open(t);
      }
      return;
    }
    if (e.key === 'Escape') { close(); }
    else if (e.key === 'ArrowLeft') { step(-1); }
    else if (e.key === 'ArrowRight') { step(1); }
    else if (e.key === 'Tab') {
      // keep focus inside the dialog
      var f = [closeBtn, prevBtn, nextBtn].filter(function (b) { return !b.hidden; });
      var i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });
}());

(function () {
  window.__oaReady(function () {
    // "#" link on every heading that has an id (also gives a copyable target for the reader)
    var heads = document.querySelectorAll('main h1[id], main h2[id], main h3[id], main h4[id]');
    Array.prototype.forEach.call(heads, function (h) {
      if (h.querySelector('.oa-hlink')) return;
      var a = document.createElement('a');
      a.className = 'oa-hlink';
      a.href = '#' + h.id;
      a.setAttribute('aria-label', 'Link to this section');
      a.textContent = '#';
      h.appendChild(a);
    });

    var top = document.querySelector('.oa-top');
    if (top) {
      top.hidden = false;
      var onScroll = function () { top.classList.toggle('is-visible', window.scrollY > 480); };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      top.addEventListener('click', function (e) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  });
}());

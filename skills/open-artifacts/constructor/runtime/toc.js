(function () {
  window.__oaReady(function () {
    Array.prototype.forEach.call(document.querySelectorAll('[data-oa-toc]'), function (nav) {
      var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
      var pairs = links.map(function (a) {
        var el = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
        return el ? { a: a, el: el } : null;
      }).filter(Boolean);
      if (!pairs.length) return;

      var current = null;
      function activate(pair) {
        if (current === pair) return;
        current = pair;
        pairs.forEach(function (p) {
          if (p === pair) p.a.setAttribute('aria-current', 'true');
          else p.a.removeAttribute('aria-current');
        });
        if (pair && nav.scrollTo && nav.scrollHeight > nav.clientHeight + 4) {
          // keep the active entry visible inside a scrolling sidebar / sticky bar
          var a = pair.a;
          if (nav.scrollWidth > nav.clientWidth + 4) nav.scrollTo({ left: a.offsetLeft - 24, behavior: 'smooth' });
        }
      }

      function update() {
        var line = window.innerHeight * 0.25;
        var best = pairs[0];
        pairs.forEach(function (p) {
          if (p.el.getBoundingClientRect().top <= line) best = p;
        });
        activate(best);
      }

      var ticking = false;
      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () { ticking = false; update(); });
      }, { passive: true });
      window.addEventListener('resize', update);
      update();
    });
  });
}());

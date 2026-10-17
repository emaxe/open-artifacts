(function () {
  window.__oaReady(function () {
    var roots = document.querySelectorAll('[data-oa-accordion]');
    Array.prototype.forEach.call(roots, function (root) {
      var exclusive = root.hasAttribute('data-exclusive');
      var items = root.querySelectorAll(':scope > details');
      Array.prototype.forEach.call(items, function (d) {
        d.addEventListener('toggle', function () {
          if (!d.open) return;
          if (exclusive) {
            // the native `name` grouping already does this where supported
            Array.prototype.forEach.call(items, function (o) { if (o !== d) o.open = false; });
          }
          window.__oaReveal(d);
        });
        if (d.open) window.__oaReveal(d);
      });
    });

    // Closed <details> content is not printed: open everything for the print job, then restore.
    var restore = [];
    window.addEventListener('beforeprint', function () {
      restore = [];
      Array.prototype.forEach.call(document.querySelectorAll('[data-oa-accordion] details'), function (d) {
        if (!d.open) { restore.push(d); d.open = true; }
      });
    });
    window.addEventListener('afterprint', function () {
      restore.forEach(function (d) { d.open = false; });
      restore = [];
    });
  });
}());

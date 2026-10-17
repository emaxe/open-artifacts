(function () {
  window.__oaReady(function () {
    Array.prototype.forEach.call(document.querySelectorAll('[data-oa-compare]'), function (box) {
      var range = box.querySelector('.oa-compare__range');
      if (!range) return;
      var set = function () { box.style.setProperty('--oa-pos', range.value + '%'); };
      range.addEventListener('input', set);
      set();
    });
  });
}());

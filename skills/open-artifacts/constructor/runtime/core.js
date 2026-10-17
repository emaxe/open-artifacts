(function () {
  if (window.__oaReveal) return;
  // Content that was hidden (tab panel, closed accordion item, off-screen slide) has no size yet:
  // give charts and diagrams a chance to lay out once it becomes visible.
  window.__oaReveal = function (el) {
    window.dispatchEvent(new Event('resize'));
    if (window.__renderMermaid) {
      window.__renderMermaid(el);
    } else if (window.mermaid && el && el.querySelectorAll) {
      try { window.mermaid.run({ nodes: el.querySelectorAll('.mermaid') }); } catch (e) {}
    }
  };
  window.__oaReady = function (fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  };
}());

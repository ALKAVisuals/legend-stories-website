/* ═══════════════════════════════════════════════════════════════
   Hover Expand — Image Gallery (extracted from skipper.js)
   ═══════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  (function initHoverExpand() {
    var container = document.querySelector('.skp-hover-expand');
    if (!container) return;
    var items = container.querySelectorAll('.skp-hover-expand__item');
    if (!items.length) return;

    items.forEach(function(item) {
      item.addEventListener('mouseenter', function() {
        items.forEach(function(el) {
          el.classList.remove('skp-hover-expand__item--active');
          el.classList.add('skp-hover-expand__item--default');
        });
        this.classList.remove('skp-hover-expand__item--default');
        this.classList.add('skp-hover-expand__item--active');
      });
    });

    container.addEventListener('mouseleave', function() {
      items.forEach(function(el) {
        el.classList.remove('skp-hover-expand__item--active');
        el.classList.add('skp-hover-expand__item--default');
      });
      var mid = Math.floor(items.length / 2);
      items[mid].classList.remove('skp-hover-expand__item--default');
      items[mid].classList.add('skp-hover-expand__item--active');
    });
  })();

})();
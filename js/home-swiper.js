document.addEventListener('DOMContentLoaded', function() {
  new Swiper('.legend-card-swiper', {
    effect: 'cards',
    grabCursor: true,
    cardsEffect: {
      perSlideOffset: 8,
      perSlideRotate: 2,
      rotate: true,
      slideShadows: false,
      perSlideClip: false,
    },
    loop: false,
    autoplay: {
      delay: 4000,
      disableOnInteraction: true,
    },
    pagination: {
      el: '.swiper-pagination',
      clickable: true,
    },
    navigation: {
      prevEl: '.swiper-button-prev',
      nextEl: '.swiper-button-next',
    },
    on: {
      init: function() {
        this.slides.forEach(function(slide, i) {
          var dist = Math.abs(i - this.activeIndex);
          slide.style.zIndex = String(100 - dist);
          if (i === this.activeIndex) {
            slide.style.opacity = '1';
            slide.style.filter = 'none';
            slide.style.pointerEvents = 'auto';
          } else if (dist === 1) {
            slide.style.opacity = '0.3';
            slide.style.filter = 'blur(2px)';
            slide.style.pointerEvents = 'none';
          } else if (dist === 2) {
            slide.style.opacity = '0.12';
            slide.style.filter = 'blur(5px)';
            slide.style.pointerEvents = 'none';
          } else {
            slide.style.opacity = '0';
            slide.style.filter = 'blur(8px)';
            slide.style.pointerEvents = 'none';
          }
        }.bind(this));
      },
      slideChange: function() {
        this.slides.forEach(function(slide, i) {
          var dist = Math.abs(i - this.activeIndex);
          slide.style.zIndex = String(100 - dist);
          if (i === this.activeIndex) {
            slide.style.opacity = '1';
            slide.style.filter = 'none';
            slide.style.pointerEvents = 'auto';
          } else if (dist === 1) {
            slide.style.opacity = '0.3';
            slide.style.filter = 'blur(2px)';
            slide.style.pointerEvents = 'none';
          } else if (dist === 2) {
            slide.style.opacity = '0.12';
            slide.style.filter = 'blur(5px)';
            slide.style.pointerEvents = 'none';
          } else {
            slide.style.opacity = '0';
            slide.style.filter = 'blur(8px)';
            slide.style.pointerEvents = 'none';
          }
        }.bind(this));
      }
    }
  });
});

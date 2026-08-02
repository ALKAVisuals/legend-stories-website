import { readFile, writeFile } from 'node:fs/promises';

function replaceRequired(source, pattern, replacement, label) {
  const flags = pattern instanceof RegExp
    ? (pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
    : '';
  const matches = typeof pattern === 'string'
    ? source.split(pattern).length - 1
    : [...source.matchAll(new RegExp(pattern.source, flags))].length;
  if (matches !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${matches}.`);
  }
  return source.replace(pattern, replacement);
}

const appPath = 'js/app.js';
let app = await readFile(appPath, 'utf8');

app = replaceRequired(
  app,
  'function loadDialogAccessibilityModule() {\n',
  `let motionPreferencesModule = null;\nlet motionPreferencesModulePromise = null;\n\nfunction loadMotionPreferencesModule() {\n  if (!motionPreferencesModulePromise) {\n    motionPreferencesModulePromise = import('./motion-preferences.mjs')\n      .then((module) => {\n        motionPreferencesModule = module;\n        return module;\n      });\n  }\n  return motionPreferencesModulePromise;\n}\n\nfunction loadDialogAccessibilityModule() {\n`,
  'insert motion preferences loader',
);

app = replaceRequired(
  app,
  /  function initTestimonials\(\) \{[\s\S]*?  function nextTestimonial\(\) \{\n    goToTestimonial\(0\);\n  \}/,
  `  function initTestimonials() {\n    if (!dom.testimonialTrack || !motionPreferencesModule) return;\n    nextTestimonial();\n    let timer = null;\n    const testimonialMotionGate = motionPreferencesModule.createAutomaticMotionGate({\n      element: dom.testimonialTrack,\n      windowRef: window,\n      documentRef: document,\n    });\n\n    function clearTestimonialTimer() {\n      if (timer !== null) {\n        window.clearTimeout(timer);\n        timer = null;\n      }\n    }\n\n    function scheduleTestimonial() {\n      clearTestimonialTimer();\n      if (!testimonialMotionGate.isAllowed()) return;\n      timer = window.setTimeout(() => {\n        state.testimonialIndex = (state.testimonialIndex + 1) % state.totalTestimonials;\n        goToTestimonial(state.testimonialIndex);\n        scheduleTestimonial();\n      }, 5000);\n    }\n\n    testimonialMotionGate.subscribe(({ allowed }) => {\n      if (allowed) scheduleTestimonial();\n      else clearTestimonialTimer();\n    });\n\n    if (dom.testimonialDots) {\n      dom.testimonialDots.forEach((dot) => {\n        dot.addEventListener('click', () => {\n          goToTestimonial(Number.parseInt(dot.dataset.index, 10));\n          scheduleTestimonial();\n        });\n      });\n    }\n  }\n  function nextTestimonial() {\n    goToTestimonial(0);\n  }`,
  'replace testimonial autoplay',
);

app = replaceRequired(
  app,
  /  function initParticleCanvas\(\) \{[\s\S]*?  \}\n\n  \/\/ ==========================================\n  \/\/ SKIPER34: Scroll Reveal Animation/,
  `  function initParticleCanvas() {\n    const canvas = document.getElementById('particle-canvas');\n    if (!canvas || !motionPreferencesModule) return;\n    const ctx = canvas.getContext('2d');\n    if (!ctx) return;\n\n    let width, height;\n    let particles = [];\n    let frameId = null;\n    const particleCount = 60;\n    const connectionDistance = 150;\n\n    function resize() {\n      const rect = canvas.parentElement.getBoundingClientRect();\n      width = rect.width;\n      height = rect.height;\n      canvas.width = width;\n      canvas.height = height;\n    }\n\n    class Particle {\n      constructor() {\n        this.x = Math.random() * width;\n        this.y = Math.random() * height;\n        this.vx = (Math.random() - 0.5) * 0.5;\n        this.vy = (Math.random() - 0.5) * 0.5;\n        this.radius = Math.random() * 2 + 1;\n        this.opacity = Math.random() * 0.5 + 0.2;\n      }\n      update() {\n        this.x += this.vx;\n        this.y += this.vy;\n        if (this.x < 0 || this.x > width) this.vx *= -1;\n        if (this.y < 0 || this.y > height) this.vy *= -1;\n      }\n      draw() {\n        ctx.beginPath();\n        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);\n        ctx.fillStyle = \`rgba(42, 138, 74, \${this.opacity})\`;\n        ctx.fill();\n      }\n    }\n\n    function initParticles() {\n      particles = [];\n      for (let i = 0; i < particleCount; i++) particles.push(new Particle());\n    }\n\n    function renderFrame(advance) {\n      ctx.clearRect(0, 0, width, height);\n      for (let i = 0; i < particles.length; i++) {\n        if (advance) particles[i].update();\n        particles[i].draw();\n        for (let j = i + 1; j < particles.length; j++) {\n          const dx = particles[i].x - particles[j].x;\n          const dy = particles[i].y - particles[j].y;\n          const dist = Math.sqrt(dx * dx + dy * dy);\n          if (dist < connectionDistance) {\n            ctx.beginPath();\n            ctx.moveTo(particles[i].x, particles[i].y);\n            ctx.lineTo(particles[j].x, particles[j].y);\n            ctx.strokeStyle = \`rgba(42, 138, 74, \${0.08 * (1 - dist / connectionDistance)})\`;\n            ctx.lineWidth = 0.5;\n            ctx.stroke();\n          }\n        }\n      }\n    }\n\n    const particleMotionGate = motionPreferencesModule.createAutomaticMotionGate({\n      element: canvas,\n      windowRef: window,\n      documentRef: document,\n    });\n\n    function stopAnimation() {\n      if (frameId !== null) {\n        window.cancelAnimationFrame(frameId);\n        frameId = null;\n      }\n      renderFrame(false);\n    }\n\n    function startAnimation() {\n      if (frameId !== null || !particleMotionGate.isAllowed()) return;\n      function animate() {\n        if (!particleMotionGate.isAllowed()) {\n          frameId = null;\n          renderFrame(false);\n          return;\n        }\n        renderFrame(true);\n        frameId = window.requestAnimationFrame(animate);\n      }\n      frameId = window.requestAnimationFrame(animate);\n    }\n\n    resize();\n    initParticles();\n    renderFrame(false);\n    particleMotionGate.subscribe(({ allowed }) => {\n      if (allowed) startAnimation();\n      else stopAnimation();\n    });\n    window.addEventListener('resize', () => {\n      resize();\n      initParticles();\n      renderFrame(false);\n    });\n  }\n\n  // ==========================================\n  // SKIPER34: Scroll Reveal Animation`,
  'replace particle animation loop',
);

app = replaceRequired(
  app,
  "      var next = el.querySelector('.related-next');\n\n      function smoothScrollTo(targetX, duration) {\n",
  `      var next = el.querySelector('.related-next');\n      var relatedMotionGate = motionPreferencesModule.createAutomaticMotionGate({\n        element: track,\n        windowRef: window,\n        documentRef: document,\n      });\n\n      function smoothScrollTo(targetX, duration) {\n`,
  'insert related-products motion gate',
);

app = replaceRequired(
  app,
  /      function smoothScrollTo\(targetX, duration\) \{[\s\S]*?      \}\n\n      if \(track && previous\) \{/,
  `      function smoothScrollTo(targetX, duration) {\n        if (!track) return;\n        duration = duration || 800;\n        if (relatedMotionGate.prefersReducedMotion() || duration <= 0) {\n          track.scrollLeft = targetX;\n          return;\n        }\n        var start = track.scrollLeft;\n        var distance = targetX - start;\n        if (Math.abs(distance) < 1) return;\n        var startTime = null;\n        function ease(progress) { return progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress; }\n        function step(timestamp) {\n          if (!startTime) startTime = timestamp;\n          var elapsed = timestamp - startTime;\n          var progress = Math.min(elapsed / duration, 1);\n          track.scrollLeft = start + distance * ease(progress);\n          if (progress < 1) window.requestAnimationFrame(step);\n        }\n        window.requestAnimationFrame(step);\n      }\n\n      if (track && previous) {`,
  'replace related-products smooth scrolling',
);

app = replaceRequired(
  app,
  "          smoothScrollTo(track.scrollLeft - track.clientWidth * 0.66, 600);\n",
  "          smoothScrollTo(track.scrollLeft - track.clientWidth * 0.66, 600);\n          deferAutoScroll();\n",
  'defer autoplay after previous click',
);
app = replaceRequired(
  app,
  "          smoothScrollTo(track.scrollLeft + track.clientWidth * 0.66, 600);\n",
  "          smoothScrollTo(track.scrollLeft + track.clientWidth * 0.66, 600);\n          deferAutoScroll();\n",
  'defer autoplay after next click',
);

app = replaceRequired(
  app,
  /      var autoTimer = null;[\s\S]*?      if \(next\) next\.addEventListener\('click', stopAutoScroll\);/,
  `      var autoTimer = null;\n      var interactionPaused = false;\n\n      function clearAutoTimer() {\n        if (autoTimer) {\n          window.clearTimeout(autoTimer);\n          autoTimer = null;\n        }\n      }\n\n      function scheduleAutoScroll(delay) {\n        clearAutoTimer();\n        if (interactionPaused || !relatedMotionGate.isAllowed()) return;\n        autoTimer = window.setTimeout(doAutoScroll, delay || 1500);\n      }\n\n      function doAutoScroll() {\n        if (!track || interactionPaused || !relatedMotionGate.isAllowed()) return;\n        var maxScroll = track.scrollWidth - track.clientWidth;\n        if (maxScroll <= 1) return;\n        var target = track.scrollLeft + track.clientWidth * 0.66;\n        if (target >= maxScroll - 5) target = 0;\n        smoothScrollTo(target, 900);\n        scheduleAutoScroll(3900);\n      }\n\n      function pauseAutoScroll() {\n        interactionPaused = true;\n        clearAutoTimer();\n      }\n\n      function resumeAutoScroll() {\n        interactionPaused = false;\n        scheduleAutoScroll(1500);\n      }\n\n      function deferAutoScroll() {\n        if (!interactionPaused) scheduleAutoScroll(5000);\n      }\n\n      function handleRelatedFocusOut(event) {\n        if (!track.contains(event.relatedTarget)) resumeAutoScroll();\n      }\n\n      relatedMotionGate.subscribe(({ allowed }) => {\n        if (allowed && !interactionPaused) scheduleAutoScroll(1500);\n        else clearAutoTimer();\n      });\n      track.addEventListener('mouseenter', pauseAutoScroll);\n      track.addEventListener('mouseleave', resumeAutoScroll);\n      track.addEventListener('focusin', pauseAutoScroll);\n      track.addEventListener('focusout', handleRelatedFocusOut);\n      track.addEventListener('touchstart', pauseAutoScroll, { passive: true });\n      track.addEventListener('touchend', resumeAutoScroll);`,
  'replace related-products autoplay',
);

app = replaceRequired(
  app,
  '    await loadDialogAccessibilityModule();\n',
  '    await loadDialogAccessibilityModule();\n    await loadMotionPreferencesModule();\n',
  'load motion preferences during initialization',
);

await writeFile(appPath, app, 'utf8');

const packagePath = 'package.json';
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
packageJson.scripts['validate:motion-preferences'] = 'node scripts/validate-motion-preferences.mjs';
const qualityMarker = 'npm run validate:mobile-navigation &&';
if (!packageJson.scripts.quality.includes(qualityMarker)) {
  throw new Error('package quality chain is missing the mobile-navigation marker.');
}
if (!packageJson.scripts.quality.includes('npm run validate:motion-preferences')) {
  packageJson.scripts.quality = packageJson.scripts.quality.replace(
    qualityMarker,
    `${qualityMarker} npm run validate:motion-preferences &&`,
  );
}
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

console.log('Motion preference migration completed.');

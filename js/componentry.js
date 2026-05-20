/* ═══════════════════════════════════════════════════════════════
   CLOSING PLASMA — WebGL Shader Background
   ═══════════════════════════════════════════════════════════════
   Full WebGL implementation matching the original GLSL shader.
   Features: FBM noise, flow field, ridges, sparkle, grain,
   vignette, mouse interaction, theme support.
   ═══════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  function initComponentry() {
  const container = document.getElementById('crp-demo');
  if (!container) return;

  // ── Create canvas ──
  const canvas = document.createElement('canvas');
  canvas.id = 'crpCanvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  // Insert before overlay
  const overlay = container.querySelector('.crp-overlay');
  container.insertBefore(canvas, overlay);

  const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false });
  if (!gl) {
    // Fallback: show gradient background
    container.style.background = 'linear-gradient(135deg, #0d0d14 0%, #1f2540 50%, #4a6191 100%)';
    return;
  }

  // ── Shader sources ──
  const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

  const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_isDark;
uniform float u_speed;
uniform float u_turbulence;
uniform float u_mouseInfluence;
uniform float u_grain;
uniform float u_sparkle;
uniform float u_vignette;
uniform float u_opacity;

uniform vec3 u_darkA;
uniform vec3 u_darkB;
uniform vec3 u_darkC;
uniform vec3 u_lightA;
uniform vec3 u_lightB;
uniform vec3 u_lightC;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p, float turbulence) {
  float total = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  mat2 rot = mat2(cos(0.45), sin(0.45), -sin(0.45), cos(0.45));
  for (int i = 0; i < 5; i++) {
    total += snoise(p * freq) * amp;
    p = rot * p;
    freq *= mix(1.85, 2.35, clamp(turbulence, 0.0, 2.0) * 0.5);
    amp *= 0.5;
  }
  return total;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / max(u_res.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float t = u_time * (0.15 * u_speed);

  vec2 mouse = (u_mouse - 0.5) * vec2(aspect, 1.0);
  float dMouse = length(p - mouse);
  p += (mouse - p) * 0.02 * u_mouseInfluence * smoothstep(0.45, 0.0, dMouse);

  vec2 flow = vec2(
    fbm(p + vec2(t * 0.2, t * 0.1), u_turbulence),
    fbm(p + vec2(-t * 0.1, t * 0.3), u_turbulence)
  );

  float n = fbm(p * 2.0 + flow * 1.45, u_turbulence);
  float ridges = 1.0 - abs(snoise(p * 4.0 + n) * 2.0);
  ridges = pow(ridges, 3.0);

  vec3 colorA = mix(u_lightA, u_darkA, u_isDark);
  vec3 colorB = mix(u_lightB, u_darkB, u_isDark);
  vec3 colorC = mix(u_lightC, u_darkC, u_isDark);

  vec3 col = mix(colorA, colorB, smoothstep(-0.5, 0.5, n));
  col = mix(col, colorC, smoothstep(0.25, 1.0, n * 0.52 + ridges * 0.48));

  float sparkle = pow(max(0.0, snoise(gl_FragCoord.xy * 0.2 + t * 2.0)), 18.0) * 0.5 * u_sparkle;
  vec3 sparkleColor = mix(vec3(0.56, 0.58, 0.72), vec3(0.8, 0.9, 1.0), u_isDark);
  col += sparkleColor * sparkle;

  float vigDark = 1.0 - smoothstep(0.5, mix(1.8, 1.55, u_isDark), length(p));
  col = mix(col, col * vigDark, u_isDark * u_vignette);
  float vigLight = 1.0 - smoothstep(0.4, 1.45, length(p));
  col = mix(mix(vec3(1.0), col, vigLight), col, u_isDark);

  float grain = (fract(sin(dot(gl_FragCoord.xy + t * 50.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * (0.06 * u_grain);
  col += grain;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), u_opacity);
}
`;

  // ── Compile shaders ──
  function compileShader(type, source) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vs || !fs) return;

  const program = gl.createProgram();
  if (!program) return;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

  // ── Geometry ──
  const posLoc = gl.getAttribLocation(program, 'position');
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  // ── Uniform locations ──
  const uRes = gl.getUniformLocation(program, 'u_res');
  const uTime = gl.getUniformLocation(program, 'u_time');
  const uMouse = gl.getUniformLocation(program, 'u_mouse');
  const uIsDark = gl.getUniformLocation(program, 'u_isDark');
  const uSpeed = gl.getUniformLocation(program, 'u_speed');
  const uTurbulence = gl.getUniformLocation(program, 'u_turbulence');
  const uMouseInfluence = gl.getUniformLocation(program, 'u_mouseInfluence');
  const uGrain = gl.getUniformLocation(program, 'u_grain');
  const uSparkle = gl.getUniformLocation(program, 'u_sparkle');
  const uVignette = gl.getUniformLocation(program, 'u_vignette');
  const uOpacity = gl.getUniformLocation(program, 'u_opacity');
  const uDarkA = gl.getUniformLocation(program, 'u_darkA');
  const uDarkB = gl.getUniformLocation(program, 'u_darkB');
  const uDarkC = gl.getUniformLocation(program, 'u_darkC');
  const uLightA = gl.getUniformLocation(program, 'u_lightA');
  const uLightB = gl.getUniformLocation(program, 'u_lightB');
  const uLightC = gl.getUniformLocation(program, 'u_lightC');

  // ── Settings ──
  const settings = {
    speed: 1,
    turbulence: 1,
    mouseInfluence: 1,
    grain: 1,
    sparkle: 1,
    vignette: 1,
    opacity: 1,
  };

  let isDark = 1;
  let mouseX = 0.5, mouseY = 0.5;
  let targetMouseX = 0.5, targetMouseY = 0.5;
  let currentPalette = 'default';
  let animFrame = 0;
  let startTime = performance.now();

  // Color palettes [r, g, b] normalized 0-1
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255,
    ];
  }

  const palettes = {
    default: { dA: '#0a1a10', dB: '#0d2a1a', dC: '#2a8a4a', lA: '#f0f2f7', lB: '#d7ece0', lC: '#a0d8b8' },
    neon:    { dA: '#050708', dB: '#0a2a1a', dC: '#2a8a4a', lA: '#f0f2f7', lB: '#d7dceb', lC: '#bcc5e0' },
    sunset:  { dA: '#1a0a2e', dB: '#3c141e', dC: '#ff6b6b', lA: '#fff0e6', lB: '#ffc8b4', lC: '#ffaa96' },
    ocean:   { dA: '#0a1628', dB: '#143250', dC: '#4facfe', lA: '#e6f0ff', lB: '#c8dcfa', lC: '#aaf0f0' },
    gold:    { dA: '#1a0a0a', dB: '#3c280a', dC: '#c9a84c', lA: '#fff8e6', lB: '#f0dcc0', lC: '#dcc896' },
    purple:  { dA: '#2d1b69', dB: '#501e78', dC: '#e879f9', lA: '#f5ebff', lB: '#dcc8fa', lC: '#c8aaf0' },
    inferno: { dA: '#000000', dB: '#4a0000', dC: '#ff4500', lA: '#fff5e6', lB: '#ffcc99', lC: '#ff9966' },
    aurora:  { dA: '#0a1a1a', dB: '#0a3a3a', dC: '#00ff88', lA: '#e6fff0', lB: '#b3ffcc', lC: '#66ffaa' },
  };

  function applyPalette(name) {
    const pal = palettes[name] || palettes.default;
    const dA = hexToRgb(pal.dA), dB = hexToRgb(pal.dB), dC = hexToRgb(pal.dC);
    const lA = hexToRgb(pal.lA), lB = hexToRgb(pal.lB), lC = hexToRgb(pal.lC);
    gl.uniform3f(uDarkA, dA[0], dA[1], dA[2]);
    gl.uniform3f(uDarkB, dB[0], dB[1], dB[2]);
    gl.uniform3f(uDarkC, dC[0], dC[1], dC[2]);
    gl.uniform3f(uLightA, lA[0], lA[1], lA[2]);
    gl.uniform3f(uLightB, lB[0], lB[1], lB[2]);
    gl.uniform3f(uLightC, lC[0], lC[1], lC[2]);
  }

  applyPalette('default');

  // ── Resize ──
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = container.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  }

  resize();
  window.addEventListener('resize', resize);

  // ── Mouse / Touch ──
  function setTarget(x, y) {
    targetMouseX = x;
    targetMouseY = 1.0 - y;
  }

  container.addEventListener('pointermove', function(e) {
    const rect = container.getBoundingClientRect();
    setTarget((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
  });
  container.addEventListener('pointerleave', function() {
    setTarget(0.5, 0.5);
  });
  container.addEventListener('pointerdown', function(e) {
    const rect = container.getBoundingClientRect();
    // Ripple effect: briefly boost mouse influence
    const prev = settings.mouseInfluence;
    settings.mouseInfluence = Math.min(3, prev * 2);
    setTimeout(function() { settings.mouseInfluence = prev; }, 300);
  });

  // ── Render loop ──
  function render(now) {
    const elapsed = (now - startTime) / 1000;

    // Smooth mouse
    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;

    gl.uniform1f(uTime, elapsed);
    gl.uniform2f(uMouse, mouseX, mouseY);
    gl.uniform1f(uIsDark, isDark);
    gl.uniform1f(uSpeed, settings.speed);
    gl.uniform1f(uTurbulence, settings.turbulence);
    gl.uniform1f(uMouseInfluence, settings.mouseInfluence);
    gl.uniform1f(uGrain, settings.grain);
    gl.uniform1f(uSparkle, settings.sparkle);
    gl.uniform1f(uVignette, settings.vignette);
    gl.uniform1f(uOpacity, settings.opacity);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    animFrame = requestAnimationFrame(render);
  }

  animFrame = requestAnimationFrame(render);

  // ── Controls ──
  function bindSlider(id, key) {
    const el = document.getElementById(id);
    const valEl = document.getElementById('crp-val-' + id.replace('crp-', ''));
    if (!el) return;
    el.addEventListener('input', function() {
      settings[key] = parseFloat(this.value);
      if (valEl) valEl.textContent = parseFloat(this.value).toFixed(2);
    });
  }

  bindSlider('crp-speed', 'speed');
  bindSlider('crp-turbulence', 'turbulence');
  bindSlider('crp-mouse', 'mouseInfluence');
  bindSlider('crp-grain', 'grain');
  bindSlider('crp-sparkle', 'sparkle');
  bindSlider('crp-vignette', 'vignette');
  bindSlider('crp-opacity', 'opacity');

  // Theme buttons
  function setTheme(theme) {
    isDark = (theme === 'dark' || theme === 'neon') ? 1 : 0;
    if (theme === 'neon') { currentPalette = 'neon'; applyPalette('neon'); }
    else if (theme === 'dark') { currentPalette = 'default'; applyPalette('default'); }
    else { currentPalette = 'default'; applyPalette('default'); }

    document.querySelectorAll('.crp-theme-btn').forEach(function(btn) { btn.classList.remove('active'); });
    const btn = document.getElementById('crp-theme-' + theme);
    if (btn) btn.classList.add('active');
  }

  document.getElementById('crp-theme-dark')?.addEventListener('click', function() { setTheme('dark'); });
  document.getElementById('crp-theme-light')?.addEventListener('click', function() { setTheme('light'); });
  document.getElementById('crp-theme-neon')?.addEventListener('click', function() { setTheme('neon'); });

  // Color presets
  document.querySelectorAll('.crp-color-swatch .swatch').forEach(function(swatch) {
    swatch.addEventListener('click', function() {
      const preset = this.getAttribute('data-preset');
      if (preset && palettes[preset]) {
        currentPalette = preset;
        isDark = 1;
        applyPalette(preset);
        document.querySelectorAll('.crp-theme-btn').forEach(function(btn) { btn.classList.remove('active'); });
      }
    });
  });

  // Visibility cleanup
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      cancelAnimationFrame(animFrame);
    } else {
      startTime = performance.now();
      animFrame = requestAnimationFrame(render);
    }
  });

  } // end initComponentry

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initComponentry);
  } else {
    initComponentry();
  }

})();

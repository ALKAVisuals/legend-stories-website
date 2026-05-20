# Legend Stories Website — Uitgebreide Analyse v0.1

**Datum:** 20 mei 2026  
**Versie:** 0.1 (Eerste volledige grondige analyse)  
**Status:** Live op https://alkavisuals.github.io/legend-stories-website/  
**Gegenereerd door:** OWL — Legend Stories AI Assistant

---

## INHOUD

1. [Project Overzicht](#1-project-overzicht)
2. [Bestanden Inventaris](#2-bestanden-inventaris)
3. [Pagina Analyse](#3-pagina-analyse)
4. [Kleurenpalet](#4-kleurenpalet)
5. [Componenten Inventaris](#5-componenten-inventaris)
6. [CSS Analyse](#6-css-analyse)
7. [JavaScript Analyse](#7-javascript-analyse)
8. [Toegankelijkheid Audit](#8-toegankelijkheid-audit)
9. [SEO Audit](#9-seo-audit)
10. [Performance Audit](#10-performance-audit)
11. [Content Inventaris](#11-content-inventaris)
12. [Bevindingen & Problemen](#12-bevindingen--problemen)
13. [Aanbevelingen](#13-aanbevelingen)
14. [Roadmap](#14-roadmap)

---

## 1. PROJECT OVERZICHT

### 1.1 Basis Informatie
| Item | Waarde |
|------|--------|
| Naam | Legend Stories |
| Type | E-commerce website (muurstickers) |
| Tech Stack | HTML5 + Tailwind CSS CDN + Vanilla JS |
| Hosting | GitHub Pages |
| Build | Geen (statisch) |
| Domein | github.io (legendmurals.nl onbevestigd) |
| Talen | Engels (mix met Nederlands op sommige pagina's) |
| Responsive | Ja (mobile-first) |
| Browser Support | Modern browsers (WebGL optioneel) |

### 1.2 Pagina Overzicht
| Pagina | Bestand | Regels | Status |
|--------|---------|--------|--------|
| Home | `index.html` | 573 | ✅ Compleet |
| Shop | `shop.html` | 445 | ✅ Compleet |
| About | `about.html` | 334 | ✅ Compleet |
| Portfolio | `portfolio.html` | 313 | ✅ Compleet |

### 1.3 Externe Dependencies
| Dependency | Type | CDN/Lokaal | Gebruikt op |
|------------|------|------------|-------------|
| Tailwind CSS | CSS | CDN | Alle pagina's |
| Google Fonts (Inter) | Font | CDN | Alle pagina's |
| Google Fonts (Playfair Display) | Font | CDN | Alle pagina's |
| GSAP | JS | ❌ Niet geladen | skipper.js (broken) |
| Swiper.js | JS | ❌ Niet geladen | skipper.js (broken) |

---

## 2. BESTANDEN INVENTARIS

### 2.1 HTML Bestanden (4 stuks, 1.665 regels totaal)

#### index.html (573 regels)
```
Head (63 regels)
  - Meta tags, fonts, Tailwind CDN
  - 10 CSS links
  - Tailwind config (inline <script>)
  - Lege <script> tag (regel 60-61)

Body (510 regels)
  - Announcement bar (3 regels)
  - Header/Nav (57 regels)
    - Logo, nav links, theme toggle, cart, mobile menu btn
    - Mobile menu div
  <main> (380 regels)
    - Hero section (88 regels)
      - ClosingPlasma container
      - 2-column grid
        - Left: badge, h1, description, CTAs (metal-fx), stats
        - Right: placeholder img, dot matrix, badge, floating card
    - Stats section (23 regels)
    - Before/After section (25 regels)
    - How it Works section (28 regels)
    - Portfolio section (55 regels) — Hover Expand Gallery
    - Testimonials section (48 regels)
    - Shop Preview section (65 regels) — Carousel + Grid
    - Value Props section (12 regels)
    - Social Proof section (20 regels)
    - CTA section (18 regels)
    - Contact section (35 regels)
  - Footer (45 regels)
  - Cart Drawer (30 regels)
  - Floating CTA (1 regel)
  - WhatsApp button (1 regel)
  - Scripts (2 regels): componentry.js, skipper.js, app.js
```

#### shop.html (445 regels)
```
Head (43 regels)
  - Meta tags, fonts, Tailwind CDN
  - 8 CSS links (mist componentry.css en skipper.css!)
  - Tailwind config (inline <script>)

Body (402 regels)
  - Announcement bar
  - Header/Nav (55 regels)
    - Zelfde structuur als index.html
  <main> (280 regels)
    - Shop Header (40 regels) — Dot matrix + titel
    - Filters (10 regels) — 6 filter buttons
    - Product Grid (180 regels) — 9 producten
    - Info Section (50 regels) — Sizes, shipping, returns
  - Footer (65 regels)
  - Cart Drawer (30 regels)
  - Floating CTA + WhatsApp
  - Scripts: ALLEEN app.js (mist componentry.js en skipper.js!)
```

#### about.html (334 regels)
```
Head (43 regels)
  - 8 CSS links (mist componentry.css en skipper.css!)

Body (291 regels)
  - Announcement bar
  - Header/Nav
  <main> (220 regels)
    - Hero (40 regels) — Dot matrix + titel
    - Story (35 regels) — 2-column tekst + placeholder
    - Values (30 regels) — 3 kaarten
    - Team (35 regels) — 3 personen met emoji's
    - Video (20 regels) — Placeholder (skiper-video-player)
    - CTA (15 regels)
  - Footer
  - Cart Drawer
  - Scripts: ALLEEN app.js
```

#### portfolio.html (313 regels)
```
Head (43 regels)
  - 8 CSS links (mist componentry.css en skipper.css!)

Body (270 regels)
  - Announcement bar
  - Header/Nav
  <main> (200 regels)
    - Header (40 regels) — Dot matrix + titel
    - Portfolio Grid (120 regels) — 9 projecten
    - CTA (15 regels)
  - Footer
  - Cart Drawer
  - Scripts: ALLEEN app.js
```

### 2.2 CSS Bestanden (10 stuks, 4.092 regels totaal)

| Bestand | Regels | Grootte | Doel | Herkomst |
|---------|--------|---------|------|----------|
| `shared.css` | 297 | ~18KB | Basis styles, nav, buttons, cards, light mode | Eigen |
| `main.css` | 78 | ~2KB | Tailwind directives, custom utilities | Eigen |
| `axis-upgrades.css` | 246 | ~6KB | Axis upgrades (glow, buttons, inputs, badges) | Webdesign repo |
| `axis-patterns.css` | 764 | ~15KB | Axis patterns (navbar, hero, stats, features, testimonials) | Webdesign repo |
| `skiper-upgrades.css` | 472 | ~11KB | Skiper effects (hover, carousel, video, metal) | Webdesign repo |
| `matrix.css` | 437 | ~22KB | Dot matrix loader (5×5 grid, 100+ animations) | Webdesign repo |
| `metal-fx.css` | 424 | ~10KB | Liquid metal effects (button, circle, shimmer) | Webdesign repo |
| `axis.css` | 198 | ~4KB | Axis CRM components (cards, badges, pricing) | Webdesign repo |
| `componentry.css` | 213 | ~4KB | ClosingPlasma container styles | Webdesign repo |
| `skipper.css` | 626 | ~15KB | Skiper UI (hover expand, sticky cards, carousel) | Webdesign repo |

### 2.3 JavaScript Bestanden (3 stuks, 1.305 regels totaal)

| Bestand | Regels | Grootte | Doel | Dependencies |
|---------|--------|---------|------|--------------|
| `app.js` | 522 | ~20KB | Cart, menu, slider, scroll, testimonials, filters, theme, particles | Geen |
| `componentry.js` | 381 | ~14KB | ClosingPlasma WebGL shader | WebGL |
| `skipper.js` | 402 | ~15KB | Hover expand, sticky cards, carousel, video player | GSAP, Swiper |

---

## 3. PAGINA ANALYSE

### 3.1 Homepage (index.html)

**Secties (14 secties):**

| # | Sectie | Regels | Componenten | Problemen |
|---|--------|--------|-------------|-----------|
| 1 | Announcement bar | 3 | Gradient bar | — |
| 2 | Navigatie | 57 | Logo, links, theme toggle, cart, mobile menu | — |
| 3 | Hero | 88 | ClosingPlasma, 2-column, CTAs, stats | Particle canvas code in JS maar niet in HTML |
| 4 | Stats | 23 | 3 kolommen, border grid | — |
| 5 | Before/After | 25 | Drag slider, clip-path | — |
| 6 | How it Works | 28 | 3 stappen, gradient circles | — |
| 7 | Portfolio | 55 | Hover Expand gallery (6 items) | Werkt niet op touch (geen hover) |
| 8 | Testimonials | 48 | Carousel, dots, auto-rotate | — |
| 9 | Shop Preview | 65 | Carousel (mobiel) + grid (desktop) | Carousel heeft geen autoplay |
| 10 | Value Props | 12 | 4 iconen | — |
| 11 | Social Proof | 20 | TikTok/IG grid | — |
| 12 | CTA | 18 | Metal-fx button | — |
| 13 | Contact | 35 | Form + contact info | Form werkt niet |
| 14 | Footer | 45 | 4 kolommen, social | — |

**Hero Sectie Detail:**
```
<section> (88 regels)
  ├── ClosingPlasma container (3 regels)
  │   └── <div id="crp-demo" class="crp-container">
  │       └── <div class="crp-overlay">
  │
  └── Content overlay (85 regels)
      ├── Grid: 2 columns (lg:grid-cols-2)
      │   ├── Left column:
      │   │   ├── Badge: "Wall art with a story"
      │   │   ├── H1: "Gods, myths, and galaxies on your wall"
      │   │   ├── Description paragraph
      │   │   ├── CTAs: "Shop the collection" (metal-fx) + "See the work"
      │   │   └── Stats: 1K+ customers | 4.9★ | 100+ designs
      │   │
      │   └── Right column:
      │       ├── Placeholder image (aspect-[4/5])
      │       ├── Dot matrix loader (top-right)
      │       ├── "New drop" badge (top-right, overlaps dot matrix!)
      │       └── Floating card: "+1K sold" (bottom-left)
```

### 3.2 Shop (shop.html)

**Secties (6 secties):**

| # | Sectie | Regels | Componenten | Problemen |
|---|--------|--------|-------------|-----------|
| 1 | Announcement bar | 3 | Gradient bar | — |
| 2 | Navigatie | 55 | Zelfde als home | — |
| 3 | Header | 40 | Dot matrix + titel | — |
| 4 | Filters | 10 | 6 filter buttons | Mix NL/EN categorieën |
| 5 | Product Grid | 180 | 9 product cards | Geen size selector, geen quick view |
| 6 | Info Section | 50 | 3 kolommen | — |

**Product Cards (9 stuks):**
| # | Naam | Categorie | Prijs | Badge | Problemen |
|---|------|-----------|-------|-------|-----------|
| 1 | Greek Gods Mural | mythologie | €49,95 (was €69,95) | Best seller | — |
| 2 | Viking Mural | geschiedenis | €44,95 | — | Categorie is NL |
| 3 | Space Nebula Mural | abstract | €54,95 | New | — |
| 4 | Gamer Room Mural | popculture | €39,95 | — | — |
| 5 | Egyptian Temple | geschiedenis | €47,95 | — | Categorie is NL |
| 6 | Japanese Garden Mural | mythologie | €42,95 | — | Categorie is NL |
| 7 | Comic Book Heroes | popculture | €44,95 | — | — |
| 8 | Geometric Art | abstract | €37,95 | — | — |
| 9 | Custom Mural | custom | From €59,95 | — | Geen add-to-cart, link naar contact |

**Filter Categorieën (inconsistent):**
```
data-filter="all"         → "All"           ✅ Engels
data-filter="mythologie"  → "Mythology"     ⚠️ NL data, EN label
data-filter="geschiedenis"→ "History"       ⚠️ NL data, EN label
data-filter="popculture"  → "Pop Culture"   ✅ Engels
data-filter="abstract"    → "Abstract"      ✅ Engels
data-filter="custom"      → "Custom"        ✅ Engels
```

### 3.3 About (about.html)

**Secties (8 secties):**

| # | Sectie | Regels | Componenten | Problemen |
|---|--------|--------|-------------|-----------|
| 1 | Announcement bar | 3 | — | — |
| 2 | Navigatie | 55 | — | — |
| 3 | Hero | 40 | Dot matrix + titel | — |
| 4 | Story | 35 | 2-column tekst + placeholder | Placeholder in plaats van echte foto |
| 5 | Values | 30 | 3 kaarten | — |
| 6 | Team | 35 | 3 personen | Emoji's in plaats van foto's |
| 7 | Video | 20 | Placeholder | Skiper video player werkt niet |
| 8 | CTA | 15 | 2 buttons | — |

**Team Sectie:**
```
3 teamleden:
  - K (Founder & Designer) — emoji: 👨‍🎨
  - Compagnon (Co-owner & Operations) — emoji: 👩‍💻
  - OWL (AI Assistant) — emoji: 🤖
```

### 3.4 Portfolio (portfolio.html)

**Secties (4 secties):**

| # | Sectie | Regels | Componenten | Problemen |
|---|--------|--------|-------------|-----------|
| 1 | Header | 40 | Dot matrix + titel | — |
| 2 | Grid | 120 | 9 projecten | Geen filter, geen detail pagina |
| 3 | CTA | 15 | 2 buttons | — |
| 4 | Footer | 65 | — | Mix NL/EN ("Bedrijf", "Betaalmethoden") |

**Projecten (9 stuks):**
| # | Naam | Categorie | Grootte | Beschrijving |
|---|------|-----------|---------|--------------|
| 1 | Viking Bedroom | History | Medium | A Viking theme for a calm bedroom |
| 2 | Greek Gods Living Room | Mythology | Mural | The gods of Olympus in a living room |
| 3 | Japanese Garden | Nature | Large | A quiet Japanese garden with cherry blossoms |
| 4 | Gamer Setup | Pop Culture | Medium | Level up your gaming setup |
| 5 | Space Nebula | Abstract | Mural | A cosmic journey through galaxies |
| 6 | Egyptian Temple | History | Medium | Ancient Egypt in a modern style |
| 7 | Comic Book Kids Room | Pop Culture | Large | Superheroes for the smallest fans |
| 8 | Geometric Office | Abstract | Medium | Modern geometric patterns for focus |
| 9 | Ocean Waves | Nature | Mural | Deep sea adventure on a bathroom wall |

---

## 4. KLEURENPALET

### 4.1 Primaire Kleuren (Dark Mode)

| Naam | Hex | RGB | Gebruikt in |
|------|-----|-----|-------------|
| Void | `#0B0B0C` | 11,11,12 | Body background |
| Surface | `#161618` | 22,22,24 | Cards, sections |
| Surface Light | `#1E1E22` | 30,30,34 | Hover states |
| Surface Border | `#2A2A30` | 42,42,48 | Borders |
| **Mint (accent)** | **`#2a8a4a`** | **42,138,74** | **Buttons, links, gradients** |
| Mint Light | `#3da86a` | 61,168,106 | Gradient variant |
| Mint Dark | `#1e6b38` | 30,107,56 | Gradient variant |
| Text Primary | `#F5F5F7` | 245,245,247 | Headings |
| Text Secondary | `#A0A0B0` | 160,160,176 | Body text |
| Text Muted | `#6B6B7B` | 107,107,123 | Muted text |

### 4.2 Light Mode Kleuren

| Naam | Hex | Gebruikt in |
|------|-----|-------------|
| Background | `#F5F5F7` | Body |
| Surface | `#F5F5F7` | Cards |
| Surface Border | `rgba(0,0,0,.08)` | Borders |
| Accent | `#22c55e` | Buttons, links |
| Accent Light | `#4ade80` | Gradient |
| Accent Dark | `#16a34a` | Gradient |
| Text Primary | `#1A1A1A` | Headings |
| Text Secondary | `#555` | Body text |
| Text Muted | `#888` | Muted text |

### 4.3 Oude Kleuren (nog aanwezig in sommige bestanden)

| Naam | Hex | Waar nog aanwezig | Moet worden |
|------|-----|-------------------|-------------|
| Gold (oud) | `#c9a84c` | matrix.css (dot fill default), skipper.css (carousel arrows, dots), metal-fx.css (legend preset) | `#2a8a4a` |
| Indigo | `#6366f1` | skipper.css (carousel arrows) | `#2a8a4a` |
| Violet | `#8b5cf6` | skipper.css | `#3da86a` |

### 4.4 Kleur Problemen

1. **"Gold" naamgeving:** De Tailwind klasse `text-gold`, `bg-gold`, `border-gold` bevat nu groen (`#2a8a4a`). Dit is verwarrend.
2. **Inconsistentie:** Sommige bestanden gebruiken noude hex codes, andere de nieuwe.
3. **Geen CSS custom properties:** Kleuren zijn hardcoded in elk bestand afzonderlijk.
4. **rgba bug in app.js:** Lijn 366 en 391 gebruiken `rgba(c9,a8,4c,...)` wat ongeldig is.

---

## 5. COMPONENTEN INVENTARIS

### 5.1 Werkt Correct ✅

| Component | Type | Locatie | Beschrijving |
|-----------|------|---------|--------------|
| Announcement bar | UI | Alle pagina's | Gradient bar met promotie tekst |
| Navigatie | UI | Alle pagina's | Sticky, glass effect, responsive |
| Logo | UI | Alle pagina's | Gradient square + tekst |
| Nav links | UI | Alle pagina's | Hover underline effect |
| Theme toggle | Interactief | Alle pagina's | Dark/light met localStorage |
| Cart button | UI | Alle pagina's | Met count badge |
| Mobile menu | Interactief | Alle pagina's | Hamburger toggle |
| Cart drawer | Interactief | Alle pagina's | Slide-in met items |
| Before/After slider | Interactief | Homepage | Drag met clip-path |
| Testimonial carousel | Interactief | Homepage | Auto-rotate, dots |
| Scroll animations | Visueel | Alle pagina's | IntersectionObserver reveal |
| Product filters | Interactief | Shop | Category filter |
| Add to cart | Interactief | Shop + Homepage | Cart functionaliteit |
| Metal-fx buttons | Visueel | Homepage | Liquid metal ring + shimmer |
| Dot matrix loader | Visueel | Alle pagina's | 5×5 ripple animation |
| Hover Expand gallery | Visueel | Homepage portfolio | CSS-only hover expand |
| Footer | UI | Alle pagina's | 4 kolommen, social links |
| Floating CTA | UI | Alle pagina's | Fixed position button |
| WhatsApp button | UI | Alle pagina's | Fixed position |

### 5.2 Gedeeltelijk Werkt ⚠️

| Component | Probleem | Impact | Prioriteit |
|-----------|----------|--------|------------|
| Particle canvas | Code in app.js maar niet in HTML | Geen particles, maar ook geen error | Laag |
| Shop preview carousel | Geen autoplay, alleen touch drag | Beperkte functionaliteit | Laag |
| Video player (about) | Skiper class maar JS werkt niet | Placeholder zonder interactie | Laag |
| ClosingPlasma | Werkt alleen met WebGL | Fallback nodig voor oudere browsers | Medium |

### 5.3 Werkt Niet ❌

| Component | Reden | Prioriteit |
|-----------|-------|------------|
| Contact form | Geen backend | **Hoog** |
| GSAP animations | GSAP niet geladen | Laag |
| Swiper carousel | Swiper niet geladen | Laag |
| Sticky card stack | GSAP ScrollTrigger nodig | Laag |
| Perspective carousel | Swiper nodig | Laag |
| Crowd canvas | Alleen standalone | Laag |
| Video popover | GSAP nodig | Laag |

### 5.4 Niet Geïmplementeerd (in CSS maar niet in HTML)

| Component | CSS Class | Beschrijving |
|-----------|-----------|--------------|
| Axis navbar | `.axis-navbar` | Floating pill navbar |
| Axis card | `.axis-card` | Card met border |
| Axis badge | `.axis-badge` | Muted badge/tag |
| Axis input | `.axis-input` | Styled form input |
| Axis floating label | `.axis-floating-label` | Animated label |
| Axis pricing | `.axis-price` | Pricing display |
| Axis feature list | `.axis-feature-list` | Checkmark list |
| Axis popular badge | `.axis-popular-badge` | "Most popular" tag |
| Axis team tooltip | `.axis-team-tooltip` | Hover tooltip |
| Axis logo cloud | `.axis-logo-cloud` | Grayscale logo grid |
| Axis tools | `.axis-tools` | Overlapping icons |
| Skiper scroll reveal | `.skp-scroll-reveal` | Sticky scroll image |
| Skiper card swipe | `.skp-carousel-cards` | Cards effect carousel |
| Skiper perspective | `.skp-carousel-perspective` | 3D coverflow |
| Skiper crowd | `.skp-crowd-canvas` | Canvas animation |
| Skiper video | `.skp-video-zone` | Video player |
| Metal-fx circle | `.metal-fx--circle` | Circle variant |
| Metal-fx legend | `.metal-fx--legend` | Custom brand preset |

---

## 6. CSS ANALYSE

### 6.1 Bestandsgrootte & Lijnen

| Bestand | Regels | Categorie |
|---------|--------|-----------|
| axis-patterns.css | 764 | Grootste — veel herhaling |
| skipper.css | 626 | Groot — veel varianten |
| skiper-upgrades.css | 472 | Middel |
| matrix.css | 437 | Middel — veel keyframes |
| metal-fx.css | 424 | Middel |
| shared.css | 297 | Basis |
| componentry.css | 213 | Klein |
| axis-upgrades.css | 246 | Klein |
| axis.css | 198 | Klein |
| main.css | 78 | Kleinst |

### 6.2 Overlap Tussen Bestanden

**Grote overlap tussen:**
- `axis-upgrades.css` + `axis-patterns.css` + `axis.css` — veel dezelfde componenten
- `skiper-upgrades.css` + `skipper.css` — hover expand dubbel gedefinieerd
- `shared.css` + `axis-patterns.css` — buttons, cards, typography

**Aanbeveling:** Samenvoegen tot 3-4 bestanden:
1. `base.css` — Tailwind + custom properties + basis elementen
2. `components.css` — Alle UI componenten (samengevoegd)
3. `effects.css` — Animaties, shaders, speciale effecten
4. `light-mode.css` — Light mode overrides

### 6.3 CSS Problemen

1. **Geen custom properties:** Kleuren hardcoded in elk bestand
2. **Geen CSS reset/normalize:** Afhankelijk van Tailwind's preflight
3. **Veel `!important`:** In skiper-upgrades.css en axis-upgrades.css
4. **Geen BEM naming:** Inconsistente class naming
5. **Inline styles in HTML:** Veel `style="..."` attributen in HTML
6. **Geen media query strategie:** Tailwind breakpoints maar ook custom media queries

---

## 7. JAVASCRIPT ANALYSE

### 7.1 app.js (522 regels) — Werkt

**Functies:**
| Functie | Regels | Doel | Status |
|---------|--------|------|--------|
| `openCart()` | 10 | Open cart drawer | ✅ |
| `closeCart()` | 11 | Close cart drawer | ✅ |
| `formatPrice()` | 2 | Format EUR price | ✅ |
| `addToCart()` | 16 | Add product to cart | ✅ |
| `removeFromCart()` | 4 | Remove from cart | ✅ |
| `updateCartQuantity()` | 5 | Change quantity | ✅ |
| `updateCartCount()` | 6 | Update badge | ✅ |
| `getCartTotal()` | 2 | Calculate total | ✅ |
| `renderCart()` | 14 | Render cart HTML | ✅ |
| `toggleMobileMenu()` | 6 | Toggle menu | ✅ |
| `closeMobileMenu()` | 7 | Close menu | ✅ |
| `initBeforeAfter()` | 26 | Slider logic | ✅ |
| `initScrollAnimations()` | 14 | IntersectionObserver | ✅ |
| `goToTestimonial()` | 10 | Carousel nav | ✅ |
| `initTestimonials()` | 12 | Auto-rotate | ✅ |
| `initFilters()` | 19 | Product filters | ✅ |
| `initAddToCart()` | 14 | Bind buttons | ✅ |
| `initThemeToggle()` | 23 | Dark/light mode | ✅ |
| `initEventListeners()` | 16 | Event binding | ✅ |
| `initParticleCanvas()` | 74 | Particle animation | ⚠️ Niet in HTML |
| `initScrollReveal()` | 11 | Image reveal | ✅ |
| `initCarousel()` | 47 | Touch carousel | ✅ |
| `initVideoPlayer()` | 12 | Video click | ⚠️ Geen video's |

**Bugs:**
- Lijn 366: `ctx.fillStyle = \`rgba(c9,a8,4c, ${this.opacity})\`` — ongeldig
- Lijn 391: `ctx.strokeStyle = \`rgba(c9,a8,4c, ${0.08 * ...})\`` — ongeldig

### 7.2 componentry.js (381 regels) — Werkt Gedeeltelijk

**Functie:** ClosingPlasma WebGL shader
**Status:** Werkt alleen als WebGL beschikbaar is
**Fallback:** Gradient background als WebGL niet beschikbaar
**Probleem:** Controls (sliders, theme buttons) worden gebonden maar bestaan niet in HTML

### 7.3 skipper.js (402 regels) — Werkt Niet

**Functies:**
| Functie | Doel | Dependencies | Status |
|---------|------|--------------|--------|
| `initHoverExpand()` | Hover expand gallery | Geen | ✅ Werkt (CSS-only) |
| `initStickyCards()` | Card stack scroll | GSAP + ScrollTrigger | ❌ GSAP niet geladen |
| `initScrollReveal()` | Image reveal | GSAP + ScrollTrigger | ❌ GSAP niet geladen |
| `initCardSwipeCarousel()` | Cards carousel | Swiper.js | ❌ Swiper niet geladen |
| `initPerspectiveCarousel()` | Coverflow | Swiper.js | ❌ Swiper niet geladen |
| `initCrowdCanvas()` | Canvas animation | Geen | ⚠️ Alleen als element bestaat |
| `initVideoPlayer()` | Video popover | GSAP | ❌ GSAP niet geladen |

---

## 8. TOEGANKELIJKHEID AUDIT

### 8.1 Wat Goed Is ✅
- ARIA labels op navigatie (`aria-label="Main navigation"`)
- `aria-expanded` op mobiel menu en cart
- `aria-hidden` op cart drawer
- Semantische HTML (`<header>`, `<main>`, `<section>`, `<footer>`, `<nav>`)
- `role="banner"` op announcement bar
- `role="contentinfo"` op footer
- `role="dialog"` op cart drawer

### 8.2 Problemen ❌

| Probleem | Beschrijving | Prioriteit |
|----------|--------------|------------|
| Geen skip-to-content link | Geen "skip to main content" link | Medium |
| Geen focus-visible styles | Focus states niet zichtbaar | Medium |
| Geen alt teksten | Alle afbeeldingen zijn placeholders | Laag |
| Kleurcontrast niet getest | Light mode contrast onbekend | Medium |
| Geen lang attribuut | `<html lang="en">` maar content is mix NL/EN | Laag |
| Geen aria-live regions | Cart updates niet aangekondigd | Laag |
| Geen form labels | Contact form heeft labels maar geen for/id binding | Medium |
| Geen error states | Form validatie ontbreekt | Medium |

---

## 9. SEO AUDIT

### 9.1 Wat Goed Is ✅
- Meta descriptions aanwezig op alle pagina's
- Semantische HTML structuur
- `<title>` tags aanwezig
- `viewport` meta tag aanwezig
- `theme-color` meta tag aanwezig

### 9.2 Problemen ❌

| Probleem | Beschrijving | Prioriteit |
|----------|--------------|------------|
| Geen Open Graph tags | Geen og:title, og:description, og:image | **Hoog** |
| Geen Twitter Card tags | Geen twitter:card, twitter:title | Medium |
| Geen structured data | Geen JSON-LD voor Organization, Product, etc. | Medium |
| Geen sitemap.xml | Geen sitemap voor zoekmachines | Medium |
| Geen robots.txt | Geen robots.txt bestand | Laag |
| Geen canonical URLs | Geen `<link rel="canonical">` | Laag |
| Geen hreflang | Meertalig maar geen hreflang tags | Laag |
| Titel te generiek | "Shop All Murals — Legend Stories" — geen unieke titels | Medium |

---

## 10. PERFORMANCE AUDIT

### 10.1 HTTP Requests

| Type | Aantal | Bestanden |
|------|--------|-----------|
| HTML | 4 | index, shop, about, portfolio |
| CSS | 10 | shared, main, axis-*, skiper-*, matrix, metal-fx, componentry, skipper |
| JS | 3 | app, componentry, skipper |
| Fonts | 2 | Inter, Playfair Display |
| **Totaal** | **19** | — |

### 10.2 Problemen

| Probleem | Impact | Prioriteit |
|----------|--------|------------|
| 10 CSS bestanden | 10 HTTP requests | Medium |
| Geen CSS/JS minification | Grotere bestanden | Laag |
| Geen lazy loading | Alle content laadt direct | Medium |
| Geen image optimization | Alle afbeeldingen zijn placeholders | Laag |
| Geen caching headers | GitHub Pages handelt dit af | Laag |
| Geen CDN voor eigen bestanden | Alleen Tailwind via CDN | Laag |
| Tailwind CDN (niet gebouwd) | Volle Tailwind library (~350KB) | **Hoog** |
| Geen service worker | Geen offline support | Laag |
| Geen preconnect voor eigen domein | — | Laag |

### 10.3 Aanbevelingen

1. **Tailwind bouwen:** Gebruik `tailwindcss --minify` om alleen gebruikte classes mee te nemen
2. **CSS samenvoegen:** 10 → 3-4 bestanden
3. **JS samenvoegen:** 3 → 1-2 bestanden
4. **Lazy loading:** Voeg `loading="lazy"` toe aan afbeeldingen
5. **Preconnect:** Voeg `preconnect` toe voor eigen domein

---

## 11. CONTENT INVENTARIS

### 11.1 Tekst Content per Pagina

| Pagina | Secties | Woorden (geschat) | Taal | Kwaliteit |
|--------|---------|-------------------|------|-----------|
| Home | 14 | ~500 | Engels | Goed |
| Shop | 6 | ~300 | Engels/NL mix | Matig |
| About | 8 | ~400 | Engels | Goed |
| Portfolio | 4 | ~200 | Engels | Goed |

### 11.2 Placeholders

| Type | Locatie | Aantal | Prioriteit |
|------|---------|--------|------------|
| Product afbeeldingen | Shop + Homepage | 11 | **Hoog** |
| Portfolio afbeeldingen | Portfolio + Homepage | 15 | **Hoog** |
| Team foto's | About | 3 | Medium |
| Studio foto | About | 1 | Medium |
| Video | About | 1 | Laag |
| Hero afbeelding | Homepage | 1 | **Hoog** |

### 11.3 Taal Problemen

| Locatie | Probleem | Huidig | Gewenst |
|---------|----------|--------|---------|
| Shop filters | NL data-attribute | `mythologie`, `geschiedenis` | `mythology`, `history` |
| Portfolio footer | NL labels | `Bedrijf`, `Betaalmethoden` | `Company`, `Payments` |
| Shop footer | NL labels | `Betaalmethoden` | `Payments` |
| About footer | NL labels | `Bedrijf` | `Company` |

---

## 12. BEVINDINGEN & PROBLEMEN

### 12.1 Kritieke Problemen (Moet Fixen)

| # | Probleem | Bestand | Lijn | Fix |
|---|----------|---------|------|-----|
| 1 | Ongeldige rgba waarden | `js/app.js` | 366, 391 | `rgba(42,138,74,...)` |
| 2 | Contact form werkt niet | `index.html` | 467-474 | Backend toevoegen |
| 3 | CSS mist op shop/about/portfolio | `shop.html`, `about.html`, `portfolio.html` | Head | componentry.css + skipper.css links toevoegen |
| 4 | JS mist op shop/about/portfolio | `shop.html`, `about.html`, `portfolio.html` | Einde body | componentry.js + skipper.js script tags toevoegen |
| 5 | Filter categorieën inconsistent | `shop.html` | 150-155 | Alles Engels |

### 12.2 Belangrijke Problemen (Moet Verbeteren)

| # | Probleem | Impact | Aanbeveling |
|---|----------|--------|-------------|
| 6 | 10 CSS bestanden | 10 HTTP requests | Samenvoegen tot 3-4 |
| 7 | Geen Open Geen social preview | Voeg OG tags toe |
| 8 | Geen product detail pagina | Beperkte e-commerce | Maak product-detail.html |
| 9 | Geen echte afbeeldingen | Onprofessioneel | Foto's toevoegen |
| 10 | Tailwind CDN (niet gebouwd) | ~350KB onnodig | Bouw Tailwind |
| 11 | "Gold" naamgeving voor groen | Verwarrend | Hernoemen naar "mint" of "accent" |
| 12 | Geen focus-visible styles | Toegankelijkheid | CSS toevoegen |
| 13 | Geen sitemap.xml | SEO | Genereren |
| 14 | Video player werkt niet | About pagina | Verwijderen of fixen |
| 15 | Skipper JS doet niets | 402 regels dead code | Verwijderen of libraries laden |

### 12.3 Minder Belangrijk (Nice to Have)

| # | Probleem | Aanbeveling |
|---|----------|-------------|
| 16 | Geen 404 pagina | Maak 404.html |
| 17 | Geen loading states | Voeg skeleton loaders toe |
| 18 | Geen micro-animaties | Page transitions |
| 19 | Geen cookie consent | GDPR compliance |
| 20 | Geen analytics | Google Analytics / Plausible |
| 21 | Geen PWA manifest | Progressive Web App |
| 22 | Geen service worker | Offline support |
| 23 | Geen dark mode icon animatie | Toggle transition |
| 24 | Geen scroll progress bar | Visuele feedback |
| 25 | Geen related products | Cross-selling |

---

## 13. AANBEVELINGEN

### 13.1 Hoge Prioriteit (Direct Fixen)

1. **Fix rgba bug in app.js** — `rgba(c9,a8,4c,...)` → `rgba(42,138,74,...)`
2. **Voeg CSS/JS links toe aan shop/about/portfolio** — componentry.css, skipper.css, componentry.js, skipper.js
3. **Maak taal consistent** — Alles Engels (of alles Nederlands waar relevant)
4. **Maak contact form functioneel** — Formspree, Netlify Forms, of eigen backend
5. **Voeg Open Graph tags toe** — Social media preview
6. **Fix filter categorieën** — `mythologie` → `mythology`, `geschiedenis` → `history`

### 13.2 Medium Prioriteit (Binnenkort)

7. **Voeg product detail pagina toe** — Size selector, gallery, reviews
8. **Voeg sitemap.xml toe** — SEO
9. **Voeg focus-visible styles toe** — Toegankelijkheid
10. **Voeg fallback toe voor ClosingPlasma** — Gradient background
11. **Verwijder of fix skipper.js** — Dead code of libraries laden
12. **Maak video sectie werkend** — Of verwijder placeholder
13. **Voeg pagination toe aan shop** — Voor toekomstige groei
14. **Voeg lightbox toe aan portfolio** — Detail weergave

### 13.3 Lage Prioriteit (Toekomst)

15. **Voeg GSAP + Swiper toe** — Geavanceerde animaties
16. **Bouw Tailwind** — Reduceer CSS grootte
17. **Voeg echte foto's toe** — Product, team, studio
18. **Voeg analytics toe** — Bewustzijn van bezoekers
19. **Voeg PWA manifest toe** — Installable
20. **Voeg cookie consent toe** — GDPR
21. **Voeg multi-language toe** — NL/EN toggle
22. **Voeg order tracking toe** — Post-purchase
23. **Voeg wishlist toe** — Product opslaan
24. **Voeg search toe** — Product zoeken
25. **Voeg reviews toe** — Social proof

---

## 14. ROADMAP

### v0.2 — Bug Fixes (Deze week)
- [ ] Fix rgba bug in app.js
- [ ] Voeg CSS/JS links toe aan shop/about/portfolio
- [ ] Maak taal consistent (alles Engels)
- [ ] Fix filter categorieën
- [ ] Voeg Open Graph tags toe
- [ ] Maak contact form functioneel

### v0.3 — Product Detail (Week 2)
- [ ] Maak product-detail.html
- [ ] Voeg size selector toe
- [ ] Voeg product gallery toe
- [ ] Voeg related products toe
- [ ] Voeg reviews sectie toe

### v0.4 — Content (Week 3)
- [ ] Voeg echte productfoto's toe
- [ ] Voeg team foto's toe
- [ ] Voeg studio foto toe
- [ ] Voeg video content toe
- [ ] Schrijf FAQ content

### v0.5 — Animaties (Week 4)
- [ ] Voeg GSAP + Swiper toe
- [ ] Maak perspective carousel werkend
- [ ] Voeg page transitions toe
- [ ] Voeg micro-animaties toe

### v0.6 — SEO & Performance (Week 5)
- [ ] Bouw Tailwind (reduceer CSS)
- [ ] Voeg sitemap.xml toe
- [ ] Voeg structured data toe
- [ ] Voeg lazy loading toe
- [ ] Voeg preconnect hints toe

### v0.7 — Toegankelijkheid (Week 6)
- [ ] Voeg focus-visible styles toe
- [ ] Voeg skip-to-content link toe
- [ ] Test kleurcontrast
- [ ] Voeg aria-live regions toe
- [ ] Test met screen reader

### v0.8 — Nieuwe Pagina's (Week 7)
- [ ] Maak 404.html
- [ ] Maak faq.html
- [ ] Maak shipping.html
- [ ] Maak returns.html
- [ ] Maak privacy.html
- [ ] Maak terms.html

### v0.9 — Polish (Week 8)
- [ ] Voeg analytics toe
- [ ] Voeg cookie consent toe
- [ ] Voeg PWA manifest toe
- [ ] Voeg service worker toe
- [ ] Performance audit
- [ ] Cross-browser testing

### v1.0 — Launch (Week 9+)
- [ ] Domein koppelen (legendmurals.nl?)
- [ ] SSL certificaat
- [ ] Final QA
- [ ] Launch!

---

## APPENDIX A: BESTANDEN REFERENTIE

### A.1 HTML Structuur (Template)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="...">
  <title>... — Legend Stories</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="...fonts..." rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="css/shared.css">
  <link rel="stylesheet" href="css/axis-upgrades.css">
  <link rel="stylesheet" href="css/skiper-upgrades.css">
  <link rel="stylesheet" href="css/axis-patterns.css">
  <link rel="stylesheet" href="css/matrix.css">
  <link rel="stylesheet" href="css/metal-fx.css">
  <link rel="stylesheet" href="css/axis.css">
  <link rel="stylesheet" href="css/componentry.css">
  <link rel="stylesheet" href="css/skipper.css">
  <script>tailwind.config = { ... }</script>
</head>
<body>
  <!-- Announcement bar -->
  <!-- Header/Nav -->
  <main>
    <!-- Page-specific sections -->
  </main>
  <!-- Footer -->
  <!-- Cart Drawer -->
  <!-- Floating CTA -->
  <!-- WhatsApp -->
  <script src="js/componentry.js"></script>
  <script src="js/skipper.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

### A.2 CSS Volgorde (Optimalisatie Aanbevolen)

```css
/* 1. base.css — @tailwind + custom properties + reset */
/* 2. components.css — Alle UI componenten (samengevoegd) */
/* 3. effects.css — Animaties, shaders, speciale effecten */
/* 4. light-mode.css — Light mode overrides */
```

### A.3 JavaScript Volgorde

```javascript
// 1. app.js — Alle functionaliteit (cart, menu, slider, etc.)
// Optioneel: gsap.js + swiper.js (als nodig)
```

---

## APPENDIX B: QUICK REFERENCE

### B.1 Tailwind Config Kleuren
```
void:         #0B0B0C
surface:      #161618
surface-light:#1E1E22
surface-border:#2A2A30
gold:         #2a8a4a    ← HERNOEMEN naar mint
gold-light:   #3da86a    ← HERNOEMEN naar mint-light
gold-dark:    #1e6b38    ← HERNOEMEN naar mint-dark
text-primary: #F5F5F7
text-secondary:#A0A0B0
text-muted:   #6B6B7B
```

### B.2 Font Families
```
display:  'Playfair Display', Georgia, serif
body:     'Inter', system-ui, sans-serif
```

### B.3 Breakpoints (Tailwind default)
```
sm:  640px
md:  768px
lg:  1024px
xl:  1280px
2xl: 1536px
```

### B.4 Nuttige Links
- Website: https://alkavisuals.github.io/legend-stories-website/
- Webdesign repo: https://github.com/ALKAVisuals/webdesign
- GitHub Pages: https://pages.github.com/
- Tailwind CSS: https://tailwindcss.com/
- Formspree (form backend): https://formspree.io/

---

*Document gegenereerd door OWL — Legend Stories AI Assistant*  
*Laatste update: 20 mei 2026*

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
13. [Aanbevelingen & Roadmap](#13-aanbevelingen--roadmap)

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
| Talen | Engels |
| Responsive | Ja (mobile-first) |
| Browser Support | Modern browsers (WebGL optioneel) |

### 1.2 Pagina Overzicht
| Pagina | Bestand | Regels | Status |
|--------|---------|--------|--------|
| Home | `index.html` | 573 | ✅ Compleet |
| Shop | `shop.html` | 447 | ✅ Compleet |
| About | `about.html` | 336 | ✅ Compleet |
| Portfolio | `portfolio.html` | 317 | ✅ Compleet |

### 1.3 Externe Dependencies
| Dependency | Type | CDN/Lokaal | Gebruikt op |
|------------|------|------------|-------------|
| Tailwind CSS | CSS | CDN | Alle pagina's |
| Google Fonts (Inter) | Font | CDN | Alle pagina's |
| Google Fonts (Playfair Display) | Font | CDN | Alle pagina's |

**Noot:** GSAP en Swiper werden eerder gebruikt door skipper.js maar zijn niet geladen. De skipper.js is nu verwijderd en vervangen door een versie zonder externe dependencies.

---

## 2. BESTANDEN INVENTARIS

### 2.1 HTML Bestanden (4 stuks, 1.743 regels totaal)

#### index.html (573 regels)
```
Head (65 regels)
  - Meta tags, fonts, Tailwind CDN
  - 10 CSS links (alle aanwezig ✅)
  - Tailwind config (inline <script>)

Body (508 regels)
  - Announcement bar
  - Header/Nav (57 regels)
  <main> (380 regels)
    - Hero (ClosingPlasma shader, 2-column, CTAs, stats)
    - Stats (3 kolommen)
    - Before/After (drag slider)
    - How it Works (3 stappen)
    - Portfolio (Hover Expand gallery)
    - Testimonials (carousel)
    - Shop Preview (carousel + grid)
    - Value Props (4 iconen)
    - Social Proof (TikTok/IG grid)
    - CTA (metal-fx button)
    - Contact (form + info)
  - Footer
  - Cart Drawer
  - Floating CTA + WhatsApp
  - Scripts: componentry.js, app.js
```

#### shop.html (447 regels)
```
Head (45 regels)
  - 10 CSS links (alle aanwezig ✅)
  - Tailwind config

Body (402 regels)
  - Announcement bar
  - Header/Nav
  <main>
    - Shop Header (dot matrix + titel)
    - Filters (6 buttons, allemaal Engels ✅)
    - Product Grid (9 producten, categorieën consistent ✅)
    - Info Section
  - Footer (Engels ✅)
  - Cart Drawer
  - Scripts: componentry.js, app.js
```

#### about.html (336 regels)
```
Head (45 regels)
  - 10 CSS links (alle aanwezig ✅)

Body (291 regels)
  - Announcement bar
  - Header/Nav
  <main>
    - Hero (dot matrix + titel)
    - Story (2-column + placeholder)
    - Values (3 kaarten)
    - Team (3 personen)
    - Video (placeholder)
    - CTA
  - Footer (Engels ✅)
  - Cart Drawer
  - Scripts: componentry.js, app.js
```

#### portfolio.html (317 regels)
```
Head (47 regels)
  - 10 CSS links (alle aanwezig ✅)

Body (270 regels)
  - Announcement bar
  - Header/Nav
  <main>
    - Header (dot matrix + titel)
    - Portfolio Grid (9 projecten)
    - CTA
  - Footer (Engels ✅)
  - Cart Drawer
  - Scripts: componentry.js, app.js
```

### 2.2 CSS Bestanden (10 stuks, 4.092 regels totaal)

| Bestand | Regels | Grootte | Doel | Herkomst |
|---------|--------|---------|------|----------|
| `shared.css` | 297 | ~18KB | Basis styles, nav, buttons, cards, light mode | Eigen |
| `main.css` | 78 | ~2KB | Tailwind directives, custom utilities | Eigen |
| `axis-upgrades.css` | 246 | ~6KB | Axis upgrades (glow, buttons, inputs, badges) | Webdesign repo |
| `axis-patterns.css` | 764 | ~15KB | Axis patterns (navbar, hero, stats, features) | Webdesign repo |
| `skiper-upgrades.css` | 472 | ~11KB | Skiper effects (hover, carousel, video, metal) | Webdesign repo |
| `matrix.css` | 437 | ~22KB | Dot matrix loader (5×5 grid, 100+ animations) | Webdesign repo |
| `metal-fx.css` | 424 | ~10KB | Liquid metal effects (button, circle, shimmer) | Webdesign repo |
| `axis.css` | 198 | ~4KB | Axis CRM components (cards, badges, pricing) | Webdesign repo |
| `componentry.css` | 213 | ~4KB | ClosingPlasma container styles | Webdesign repo |

**Noot:** skipper.css is verwijderd — de hover-expand styles zijn al aanwezig in skiper-upgrades.css. De overige skipper componenten (sticky cards, perspective carousel) vereisen GSAP/Swiper en zijn niet nodig voor de huidige site.

### 2.3 JavaScript Bestanden (2 stuks, 903 regels totaal)

| Bestand | Regels | Grootte | Doel | Dependencies |
|---------|--------|---------|------|--------------|
| `app.js` | 522 | ~20KB | Cart, menu, slider, scroll, testimonials, filters, theme | Geen |
| `componentry.js` | 381 | ~14KB | ClosingPlasma WebGL shader | WebGL |

**Noot:** skipper.js is verwijderd — bevatte alleen code die afhankelijk was van GSAP/Swimmer. De hover-expand gallery werkt via CSS-only.

---

## 3. PAGINA ANALYSE

### 3.1 Homepage (index.html)

**Secties (14 secties):**

| # | Sectie | Componenten | Status |
|---|--------|-------------|--------|
| 1 | Announcement bar | Gradient bar | ✅ |
| 2 | Navigatie | Logo, links, theme toggle, cart, mobile menu | ✅ |
| 3 | Hero | ClosingPlasma, 2-column, CTAs (metal-fx), stats | ✅ |
| 4 | Stats | 3 kolommen, border grid | ✅ |
| 5 | Before/After | Drag slider, clip-path | ✅ |
| 6 | How it Works | 3 stappen, gradient circles | ✅ |
| 7 | Portfolio | Hover Expand gallery (6 items) | ✅ |
| 8 | Testimonials | Carousel, dots, auto-rotate | ✅ |
| 9 | Shop Preview | Carousel (mobiel) + grid (desktop) | ✅ |
| 10 | Value Props | 4 iconen | ✅ |
| 11 | Social Proof | TikTok/IG grid | ✅ |
| 12 | CTA | Metal-fx button | ✅ |
| 13 | Contact | Form + contact info | ⚠️ Form werkt niet |
| 14 | Footer | 4 kolommen, social | ✅ |

### 3.2 Shop (shop.html)

**Secties (6 secties):**

| # | Sectie | Componenten | Status |
|---|--------|-------------|--------|
| 1 | Announcement bar | Gradient bar | ✅ |
| 2 | Navigatie | Volledig | ✅ |
| 3 | Header | Dot matrix + titel | ✅ |
| 4 | Filters | 6 filter buttons (allemaal Engels) | ✅ |
| 5 | Product Grid | 9 producten | ✅ |
| 6 | Info Section | Sizes, shipping, returns | ✅ |

**Product Cards (9 stuks):**
| # | Naam | Categorie | Prijs | Badge |
|---|------|-----------|-------|-------|
| 1 | Greek Gods Mural | mythology | €49,95 (was €69,95) | Best seller |
| 2 | Viking Mural | history | €44,95 | — |
| 3 | Space Nebula Mural | abstract | €54,95 | New |
| 4 | Gamer Room Mural | popculture | €39,95 | — |
| 5 | Egyptian Temple | history | €47,95 | — |
| 6 | Japanese Garden Mural | mythology | €42,95 | — |
| 7 | Comic Book Heroes | popculture | €44,95 | — |
| 8 | Geometric Art | abstract | €37,95 | — |
| 9 | Custom Mural | custom | From €59,95 | — |

### 3.3 About (about.html)

**Secties (8 secties):**

| # | Sectie | Componenten | Status |
|---|--------|-------------|--------|
| 1 | Announcement bar | — | ✅ |
| 2 | Navigatie | Volledig | ✅ |
| 3 | Hero | Dot matrix + titel | ✅ |
| 4 | Story | 2-column + placeholder | ⚠️ Placeholder |
| 5 | Values | 3 kaarten | ✅ |
| 6 | Team | 3 personen | ⚠️ Emoji's |
| 7 | Video | Placeholder | ⚠️ Geen video |
| 8 | CTA | 2 buttons | ✅ |

### 3.4 Portfolio (portfolio.html)

**Secties (4 secties):**

| # | Sectie | Componenten | Status |
|---|--------|-------------|--------|
| 1 | Header | Dot matrix + titel | ✅ |
| 2 | Grid | 9 projecten | ⚠️ Alleen emoji's |
| 3 | CTA | 2 buttons | ✅ |
| 4 | Footer | Volledig | ✅ |

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
| Accent | `#22c55e` | Buttons, links |
| Accent Light | `#4ade80` | Gradient |
| Accent Dark | `#16a34a` | Gradient |
| Text Primary | `#1A1A1A` | Headings |
| Text Secondary | `#555` | Body text |
| Text Muted | `#888` | Muted text |

### 4.3 Tailwind Config Kleuren
```
void:         #0B0B0C
surface:      #161618
surface-light:#1E1E22
surface-border:#2A2A30
gold:         #2a8a4a    ← Bevat nu mint groen
gold-light:   #3da86a
gold-dark:    #1e6b38
text-primary: #F5F5F7
text-secondary:#A0A0B0
text-muted:   #6B6B7B
```

**Noot:** De Tailwind class `gold` bevat nu mint groen. In een toekomstige versie kan dit hernoemd worden naar `mint` voor duidelijkheid.

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
| ClosingPlasma | Werkt alleen met WebGL | Fallback nodig voor oudere browsers | Medium |
| Shop preview carousel | Geen autoplay, alleen touch drag | Beperkte functionaliteit | Laag |

### 5.3 Niet Geïmplementeerd (in CSS maar niet in HTML)

| Component | CSS Class | Beschrijving |
|-----------|-----------|--------------|
| Axis navbar | `.axis-navbar` | Floating pill navbar |
| Axis card | `.axis-card` | Card met border |
| Axis badge | `.axis-badge` | Muted badge/tag |
| Axis input | `.axis-input` | Styled form input |
| Axis pricing | `.axis-price` | Pricing display |
| Metal-fx circle | `.metal-fx--circle` | Circle variant |

---

## 6. CSS ANALYSE

### 6.1 Bestandsgrootte & Lijnen

| Bestand | Regels | Categorie |
|---------|--------|-----------|
| axis-patterns.css | 764 | Grootste — veel herhaling |
| skiper-upgrades.css | 472 | Middel |
| matrix.css | 437 | Middel — veel keyframes |
| metal-fx.css | 424 | Middel |
| shared.css | 297 | Basis |
| axis-upgrades.css | 246 | Klein |
| componentry.css | 213 | Klein |
| axis.css | 198 | Klein |
| main.css | 78 | Kleinst |

### 6.2 Overlap Tussen Bestanden

**Grote overlap tussen:**
- `axis-upgrades.css` + `axis-patterns.css` + `axis.css` — veel dezelfde componenten
- `skiper-upgrades.css` + `shared.css` — hover effects, cards

**Aanbeveling:** Samenvoegen tot 3-4 bestanden in een toekomstige versie.

### 6.3 CSS Problemen

1. **Geen custom properties:** Kleuren hardcoded in elk bestand
2. **Geen CSS reset/normalize:** Afhankelijk van Tailwind's preflight
3. **Inline styles in HTML:** Veel `style="..."` attributen in HTML
4. **"Gold" class naamgeving:** Bevat nu groen — verwarrend

---

## 7. JAVASCRIPT ANALYSE

### 7.1 app.js (522 regels) — Werkt

**Functies:**
| Functie | Doel | Status |
|---------|------|--------|
| `openCart()` / `closeCart()` | Cart drawer | ✅ |
| `addToCart()` / `removeFromCart()` | Cart CRUD | ✅ |
| `renderCart()` | Cart HTML | ✅ |
| `toggleMobileMenu()` / `closeMobileMenu()` | Mobiel menu | ✅ |
| `initBeforeAfter()` | Slider | ✅ |
| `initScrollAnimations()` | Scroll reveal | ✅ |
| `initTestimonials()` | Carousel | ✅ |
| `initFilters()` | Product filters | ✅ |
| `initAddToCart()` | Bind buttons | ✅ |
| `initThemeToggle()` | Dark/light | ✅ |
| `initEventListeners()` | Events | ✅ |

**Bugs opgelost in v0.1:**
- ✅ `rgba(c9,a8,4c,...)` → `rgba(42,138,74,...)` (lijn 366, 391)

### 7.2 componentry.js (381 regels) — Werkt Gedeeltelijk

**Functie:** ClosingPlasma WebGL shader
**Status:** Werkt alleen als WebGL beschikbaar is
**Fallback:** Gradient background als WebGL niet beschikbaar

---

## 8. TOEGANKELIJKHEID AUDIT

### 8.1 Wat Goed Is ✅
- ARIA labels op navigatie
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

---

## 10. PERFORMANCE AUDIT

### 10.1 HTTP Requests

| Type | Aantal | Bestanden |
|------|--------|-----------|
| HTML | 4 | index, shop, about, portfolio |
| CSS | 9 | shared, main, axis-*, skiper-*, matrix, metal-fx, componentry |
| JS | 2 | app, componentry |
| Fonts | 2 | Inter, Playfair Display |
| **Totaal** | **17** | — |

### 10.2 Problemen

| Probleem | Impact | Prioriteit |
|----------|--------|------------|
| 9 CSS bestanden | 9 HTTP requests | Medium |
| Geen CSS/JS minification | Grotere bestanden | Laag |
| Geen lazy loading | Alle content laadt direct | Medium |
| Tailwind CDN (niet gebouwd) | Volle Tailwind library (~350KB) | **Hoog** |

---

## 11. CONTENT INVENTARIS

### 11.1 Placeholders

| Type | Locatie | Aantal | Prioriteit |
|------|---------|--------|------------|
| Product afbeeldingen | Shop + Homepage | 11 | **Hoog** |
| Portfolio afbeeldingen | Portfolio + Homepage | 15 | **Hoog** |
| Team foto's | About | 3 | Medium |
| Studio foto | About | 1 | Medium |
| Video | About | 1 | Laag |
| Hero afbeelding | Homepage | 1 | **Hoog** |

---

## 12. BEVINDINGEN & PROBLEMEN

### 12.1 Opgelost in v0.1 ✅

| # | Probleem | Fix |
|---|----------|-----|
| 1 | `rgba(c9,a8,4c,...)` ongeldig in app.js | → `rgba(42,138,74,...)` |
| 2 | CSS mist op shop/about/portfolio | → componentry.css + skipper.css links toegevoegd |
| 3 | JS mist op shop/about/portfolio | → componentry.js + app.js script tags toegevoegd |
| 4 | Filter categorieën inconsistent (NL/EN) | → Alles Engels |
| 5 | Product data-categorieën NL | → Alles Engels |
| 6 | Footer taal NL op portfolio | → Alles Engels |
| 7 | skipper.js met GSAP/Swimmer dependencies | → Verwijderd, hover-expand werkt via CSS |

### 12.2 Niet Opgelost (Backlog) ⚠️

| # | Probleem | Prioriteit | Aanbeveling |
|---|----------|------------|-------------|
| 1 | Contact form werkt niet | **Hoog** | Backend toevoegen (Formspree) |
| 2 | Geen Open Graph tags | **Hoog** | OG tags toevoegen |
| 3 | Geen echte afbeeldingen | **Hoog** | Foto's toevoegen |
| 4 | Tailwind CDN (niet gebouwd) | **Hoog** | Bouw Tailwind |
| 5 | Geen sitemap.xml | Medium | Genereren |
| 6 | Geen focus-visible styles | Medium | CSS toevoegen |
| 7 | Geen skip-to-content link | Medium | Link toevoegen |
| 8 | 9 CSS bestanden | Medium | Samenvoegen |
| 9 | "Gold" class naamgeving | Laag | Hernoemen naar "mint" |

---

## 13. AANBEVELINGEN & ROADMAP

### v0.2 — Bug Fixes (Deze week)
- [x] Fix rgba bug in app.js
- [x] Voeg CSS/JS links toe aan shop/about/portfolio
- [x] Maak taal consistent (alles Engels)
- [x] Fix filter categorieën
- [x] Verwijder skipper.js (GSAP/Swimmer dependencies)
- [ ] Voeg Open Graph tags toe
- [ ] Maak contact form functioneel

### v0.3 — Product Detail (Week 2)
- [ ] Maak product-detail.html
- [ ] Voeg size selector toe
- [ ] Voeg product gallery toe
- [ ] Voeg related products toe

### v0.4 — Content (Week 3)
- [ ] Voeg echte productfoto's toe
- [ ] Voeg team foto's toe
- [ ] Voeg studio foto toe
- [ ] Voeg video content toe

### v0.5 — SEO & Performance (Week 4)
- [ ] Voeg sitemap.xml toe
- [ ] Voeg structured data toe
- [ ] Voeg lazy loading toe
- [ ] Voeg preconnect hints toe

### v0.6 — Toegankelijkheid (Week 5)
- [ ] Voeg focus-visible styles toe
- [ ] Voeg skip-to-content link toe
- [ ] Test kleurcontrast
- [ ] Test met screen reader

### v0.7 — Nieuwe Pagina's (Week 6)
- [ ] Maak 404.html
- [ ] Maak faq.html
- [ ] Maak shipping.html
- [ ] Maak returns.html
- [ ] Maak privacy.html
- [ ] Maak terms.html

### v0.8 — Polish (Week 7)
- [ ] Voeg analytics toe
- [ ] Voeg cookie consent toe
- [ ] Performance audit
- [ ] Cross-browser testing

### v1.0 — Launch (Week 8+)
- [ ] Domein koppelen (legendmurals.nl?)
- [ ] SSL certificaat
- [ ] Final QA
- [ ] Launch!

---

*Document gegenereerd door OWL — Legend Stories AI Assistant*  
*Laatste update: 20 mei 2026*

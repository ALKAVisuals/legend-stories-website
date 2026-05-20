# Legend Stories Website — Uitgebreide Analyse v0.1

**Datum:** 20 mei 2026  
**Versie:** 0.1 (Eerste volledige analyse)  
**Status:** Live op https://alkavisuals.github.io/legend-stories-website/

---

## 1. OVERZICHt

### 1.1 Pagina's
| Pagina | Bestand | Status | Opmerkingen |
|--------|---------|--------|-------------|
| Home | `index.html` | ✅ Compleet | Hero, stats, before/after, how it works, portfolio, testimonials, shop preview, value props, social proof, CTA, contact, footer |
| Shop | `shop.html` | ✅ Compleet | Header, filters, 9 producten, info section, footer |
| About | `about.html` | ✅ Compleet | Hero, story, values, team, video placeholder, CTA, footer |
| Portfolio | `portfolio.html` | ✅ Compleet | Header, 9 projecten, CTA, footer |

### 1.2 Tech Stack
- **Frontend:** HTML5 + Tailwind CSS (CDN) + Vanilla JavaScript
- **Build:** Geen (statische site, GitHub Pages)
- **Fonts:** Inter + Playfair Display (Google Fonts)
- **Kleuren:** Mint groen (#2a8a4a) als accent, zwart (#0B0B0C) als achtergrond

---

## 2. BESTANDEN STRUCTUUR

### 2.1 CSS Bestanden (10 stuks)
| Bestand | Grootte | Doel | Herkomst |
|---------|---------|------|----------|
| `css/shared.css` | ~18KB | Gedeelde styles (nav, buttons, cards, light mode) | Eigen |
| `css/main.css` | ~2KB | Tailwind directives + custom utilities | Eigen |
| `css/axis-upgrades.css` | ~6KB | Axis template upgrades (cards, buttons, inputs) | Webdesign repo |
| `css/axis-patterns.css` | ~15KB | Axis design patterns (hero, stats, features) | Webdesign repo |
| `css/skiper-upgrades.css` | ~11KB | Skiper effects (hover, carousel, video) | Webdesign repo |
| `css/matrix.css` | ~22KB | Dot matrix loader animations | Webdesign repo |
| `css/metal-fx.css` | ~10KB | Liquid metal button effects | Webdesign repo |
| `css/axis.css` | ~4KB | Axis component styles | Webdesign repo |
| `css/componentry.css` | ~4KB | ClosingPlasma shader container | Webdesign repo |
| `css/skipper.css` | ~15KB | Skiper UI components (hover expand, carousel) | Webdesign repo |

**⚠️ Probleem:** 10 CSS-bestanden is veel. Veel overlap tussen de bestanden. Aanbeveling: samenvoegen tot 3-4 bestanden.

### 2.2 JavaScript Bestanden (3 stuks)
| Bestand | Grootte | Doel |
|---------|---------|------|
| `js/app.js` | ~20KB | Cart, mobile menu, slider, scroll animaties, testimonials, filters, theme toggle |
| `js/componentry.js` | ~14KB | ClosingPlasma WebGL shader |
| `js/skipper.js` | ~15KB | Skiper UI interacties (hover expand, sticky cards, carousel) |

**⚠️ Probleem:** `js/skipper.js` heeft GSAP/Swiper dependencies die niet geladen worden. De meeste functies doen niets op de site.

---

## 3. KLEURENPALET

### 3.1 Huidige Kleuren
| Naam | Hex | Gebruik |
|------|-----|---------|
| Void (achtergrond) | `#0B0B0C` | Body background |
| Surface | `#161618` | Cards, sections |
| Surface Light | `#1E1E22` | Hover states |
| Surface Border | `#2A2A30` | Borders |
| **Gold (accent)** | **`#2a8a4a`** | **Buttons, links, gradients** |
| Gold Light | `#3da86a` | Gradient variant |
| Gold Dark | `#1e6b38` | Gradient variant |
| Text Primary | `#F5F5F7` | Headings |
| Text Secondary | `#A0A0B0` | Body text |
| Text Muted | `#6B6B7B` | Muted text |

### 3.2 Light Mode Kleuren
| Naam | Hex | Gebruik |
|------|-----|---------|
| Background | `#F5F5F7` | Body |
| Accent | `#22c55e` | Emerald groen |
| Accent Light | `#4ade80` | Lichter groen |
| Accent Dark | `#16a34a` | Donker groen |

### 3.3 Problemen
- **Inconsistentie:** Sommige bestanden gebruiken nog oude kleurcodes (`#c9a84c`, `#6366f1`)
- **CSS variabele mist:** Geen custom properties voor kleuren, alles hardcoded
- **Gold naamgeving:** De variabele `gold` bevat nu groen — verwarrend

---

## 4. COMPONENTEN INVENTARIS

### 4.1 Werkt ✅
| Component | Locatie | Beschrijving |
|-----------|---------|--------------|
| Announcement bar | Alle pagina's | Gradient bar met promotie |
| Navigatie | Alle pagina's | Sticky, glass effect, responsive |
| Mobiel menu | Alle pagina's | Hamburger, slide-in |
| Theme toggle | Alle pagina's | Dark/light mode met localStorage |
| Cart drawer | Alle pagina's | Slide-in winkelwagen |
| Before/After slider | Homepage | Drag slider met clip-path |
| Testimonial carousel | Homepage | Auto-rotate, dots |
| Scroll animations | Alle pagina's | IntersectionObserver reveal |
| Product filters | Shop | Category filter buttons |
| Add to cart | Shop + Homepage | Cart functionaliteit |
| Metal-fx buttons | Homepage | Liquid metal ring effect |
| Dot matrix loader | Alle pagina's | 5×5 ripple animation |
| Hover Expand gallery | Homepage portfolio | CSS-only hover expand |
| Footer | Alle pagina's | 4 kolommen, social links |

### 4.2 Deeltjeswerkt / Problemen ⚠️
| Component | Probleem | Prioriteit |
|-----------|---------|------------|
| Particle canvas | `rgba(c9,a8,4c,...)` ongeldig in app.js lijn 366, 391 | **Hoog** — particles zien er raar uit |
| Skipper JS | GSAP/Swiper niet geladen — carousel, sticky cards, video player werken niet | **Medium** — valt weg zonder libraries |
| Shop preview carousel | Werkt alleen met touch drag, geen autoplay | **Laag** — functioneel beperkt |
| Video player | Placeholder, geen echte video | **Laag** — intekenen |
| Contact form | Geen backend, form doet niets | **Hoog** — moet werken |

### 4.3 Niet Geïmplementeerd ❌
| Component | Beschrijving | Prioriteit |
|-----------|--------------|------------|
| ClosingPlasma shader | WebGL achtergrond in hero — werkt alleen als WebGL beschikbaar is | **Medium** — mooie fallback nodig |
| Sticky Card Stack | GSAP ScrollTrigger nodig | **Laag** — nice to have |
| Perspective Carousel | Swiper.js nodig | **Laag** — nice to have |
| Crowd Canvas | Canvas animatie — werkt alleen standalone | **Laag** — nice to have |

---

## 5. PAGINA-PAGINA ANALYSE

### 5.1 Homepage (index.html) — 573 regels

**Secties (in volgorde):**
1. Announcement bar
2. Navigatie (sticky, glass)
3. **Hero** — ClosingPlasma shader + 2-column layout + dot matrix + metal-fx CTA
4. **Stats** — 3 kolommen met border grid
5. **Before/After** — Drag slider
6. **How it Works** — 3 stappen
7. **Portfolio** — Hover Expand gallery (6 items)
8. **Testimonials** — Carousel (4 reviews)
9. **Shop Preview** — 3 producten + carousel mobiel
10. **Value Props** — 4 iconen
11. **Social Proof** — TikTok/IG grid
12. **CTA** — Metal-fx button
13. **Contact** — Form + contact info
14. **Footer**

**Problemen:**
- Hero heeft geen particle canvas meer (verwijderd bij plasma update) maar app.js probeert er nog naar te refereren
- ClosingPlasma container heeft geen fallback voor niet-WebGL browsers
- "New drop" badge overlapt met dot matrix loader in hero

### 5.2 Shop (shop.html) — 445 regels

**Secties:**
1. Announcement bar
2. Navigatie
3. **Header** — Dot matrix + titel
4. **Filters** — 6 categorieën (mix van NL/EN)
5. **Product Grid** — 9 producten (3×3)
6. **Info Section** — Sizes, shipping, returns
7. **Footer**

**Problemen:**
- Filter categorieën zijn mix van Nederlands en Engels (`mythologie`/`geschiedenis` vs `popculture`/`abstract`)
- Product 9 (Custom) heeft geen add-to-cart button maar een link naar contact
- Geen pagination of "load more" voor toekomstige producten
- Geen product detail pagina
- Geen size selector op product cards
- Geen prijs filter of sortering

### 5.3 About (about.html) — 334 regels

**Secties:**
1. Announcement bar
2. Navigatie
3. **Hero** — Dot matrix + titel
4. **Story** — 2-column tekst + placeholder afbeelding
5. **Values** — 3 kaarten (quality, custom, passion)
6. **Team** — 3 personen (K, Compagnon, OWL)
7. **Video** — Placeholder voor how-to-apply video
8. **CTA**
9. **Footer**

**Problemen:**
- Video sectie heeft een `skiper-video-player` class maar de JS werkt niet (GSAP dependency)
- Team sectie heeft emoji's in plaats van echte foto's
- Story sectie heeft een placeholder in plaats van echte studio foto
- Geen social links in hero

### 5.4 Portfolio (portfolio.html) — 313 regels

**Secties:**
1. Announcement bar
2. Navigatie
3. **Header** — Dot matrix + titel
4. **Grid** — 9 projecten (3×3)
5. **CTA**
6. **Footer**

**Problemen:**
- Geen filter op categorieën
- Geen lightbox of detail pagina per project
- Alle projecten zijn placeholders (emoji's)
- Minder rijke content dan de homepage portfolio sectie

---

## 6. PERFORMANCE & TECHNISCHE PROBLEMEN

### 6.1 CSS
- **10 CSS-bestanden** = 10 HTTP requests (opgelost door GitHub Pages caching, maar nog steeds suboptimaal)
- **Veel overlap** tussen axis-upgrades, axis-patterns, en axis.css
- **Geen CSS custom properties** — kleuren hardcoded in elk bestand
- **Geen CSS minification**

### 6.2 JavaScript
- **3 JS-bestanden** = 3 HTTP requests
- **Slaapt JS:** skipper.js doet bijna niets zonder GSAP/Swiper
- **Ongeldige rgba waarden** in app.js (lijn 366, 391) — `rgba(c9,a8,4c,...)` moet `rgba(42,138,74,...)`
- **Geen error handling** voor WebGL fallback
- **Geen lazy loading** voor afbeeldingen (allemaal placeholders)

### 6.3 Toegankelijkheid
- ✅ ARIA labels op navigatie
- ✅ aria-expanded op mobiel menu
- ✅ aria-hidden op cart drawer
- ❌ Geen skip-to-content link
- ❌ Geen focus-visible styles
- ❌ Klecontrast niet gemeten
- ❌ Geen alt teksten op afbeeldingen (allemaal placeholders)

### 6.4 SEO
- ✅ Meta descriptions aanwezig
- ✅ Semantische HTML (header, main, section, footer, nav)
- ❌ Geen Open Graph tags
- ❌ Geen Twitter Card tags
- ❌ Geen structured data (JSON-LD)
- ❌ Geen sitemap.xml
- ❌ Geen robots.txt

### 6.5 Mobile
- ✅ Responsive design met Tailwind breakpoints
- ✅ Mobiel menu werkt
- ✅ Touch support op carousel en slider
- ❌ Viewport hoogte (85vh) kan problematisch zijn op kleine schermen
- ❌ Hover-expand werkt niet op touch (geen hover)

---

## 7. CONTENT PROBLEMEN

### 7.1 Taal
- **Mix van Nederlands en Engels** op shop pagina (filter labels)
- **Footer** van portfolio pagina is in Nederlands ("Bedrijf", "Betaalmethoden")
- **Overige pagina's** zijn consistent Engels

### 7.2 Placeholders
- Alle productafbeeldingen zijn emoji's
- Alle portfolio afbeeldingen zijn emoji's
- Team foto's zijn emoji's
- Studio afbeelding is placeholder
- Video is placeholder

### 7.3 Contact Form
- Geen backend — form submit doet niets
- Geen validatie feedback
- Geen success/error states

---

## 8. AANBEVELINGEN PER PRIORITEIT

### 🔴 Hoog (Moet gefixt worden)
1. Fix `rgba(c9,a8,4c,...)` in app.js → `rgba(42,138,74,...)`
2. Maak contact form functioneel (Formspree, Netlify Forms, of eigen backend)
3. Voeg Open Graph tags toe voor social sharing
4. Maak taal consistent (alles Engels behalve waar Nederlands gewenst)
5. Voeg fallback toe voor ClosingPlasma (gradient background)

### 🟠 Medium (Moet verbeterd worden)
6. Voeg componentry.css en skipper.css toe aan de HTML van shop/about/portfolio
7. Voeg skipper.js toe aan shop/about/portfolio HTML
8. Maak shop filters consistent (allemaal Engels)
9. Voeg product detail pagina toe
10. Voeg size selector toe aan product cards
11. Voeg pagination toe aan shop
12. Voeg lightbox toe aan portfolio
13. Voeg focus-visible styles toe voor toegankelijkheid
14. Voeg skip-to-content link toe

### 🟢 Laag (Nice to have)
15. Voeg GSAP + Swiper toe voor geavanceerde animaties
16. Voeg echte productfoto's toe
17. Voeg team foto's toe
18. Voeg video content toe
19. Voeg structured data (JSON-LD) toe
20. Voeg sitemap.xml toe
21. Voeg robots.txt toe
22. Voeg 404 pagina toe
23. Voeg loading states toe
24. Voeg micro-animaties toe (page transitions)
25. Voeg cookie consent toe (GDPR)
26. Voeg analytics toe (Google Analytics / Plausible)
27. Voeg service worker toe voor offline support
28. Voeg PWA manifest toe
29. Voeg dark mode toggle icon animatie toe
30. Voeg scroll progress bar toe

---

## 9. GEWENSTE NIEUWE PAGINA'S

| Pagina | Doel | Prioriteit |
|--------|------|------------|
| `product-detail.html` | Individueel product met size selector, gallery, reviews | **Hoog** |
| `cart.html` | Volledige winkelwagen pagina | **Medium** |
| `checkout.html` | Checkout flow | **Medium** |
| `404.html` | Not found pagina | **Laag** |
| `faq.html` | Veelgestelde vragen | **Laag** |
| `shipping.html` | Shipping informatie | **Laag** |
| `returns.html` | Retourbeleid | **Laag** |
| `privacy.html` | Privacy policy | **Laag** |
| `terms.html` | Algemene voorwaarden | **Laag** |

---

## 10. GEWENSTE NIEUWE FEATURES

| Feature | Beschrijving | Prioriteit |
|---------|--------------|------------|
| Product detail pagina | Size selector, gallery, reviews, related products | **Hoog** |
| Werkend contact form | Formspree of Netlify Forms | **Hoog** |
| Echte productfoto's | Vervang emoji's door echte afbeeldingen | **Hoog** |
| Product reviews | Klantreviews per product | **Medium** |
| Wishlist | Producten opslaan voor later | **Medium** |
| Search | Product zoekfunctie | **Medium** |
| Related products | "Je misschien ook leuk" sectie | **Laag** |
| Recently viewed | Recent bekeken producten | **Laag** |
| Newsletter signup | Email collectie | **Laag** |
| Live chat | WhatsApp integratie | **Laag** |
| Order tracking | Bestelling volgen | **Laag** |
| Multi-language | NL/EN toggle | **Laag** |

---

## 11. BESTANDEN DIE MOETEN WORDEN BIJGEWERKT

### Shop pagina
- `shop.html` — Filters consistent maken (allemaal Engels)
- `shop.html` — Product cards verbeteren (size selector, quick view)
- `shop.html` — Pagination toevoegen

### About pagina
- `about.html` — Video sectie werkend maken of verwijderen
- `about.html` — Team foto's toevoegen
- `about.html` — Studio foto toevoegen

### Portfolio pagina
- `portfolio.html` — Filters toevoegen
- `portfolio.html` — Lightbox toevoegen
- `portfolio.html` — Detail pagina's toevoegen

### Alle pagina's
- `*.html` — Open Graph tags toevoegen
- `*.html` — componentry.css en skipper.css links toevoegen (shop, about, portfolio missen deze)
- `*.html` — skipper.js script tag toevoegen (shop, about, portfolio missen deze)

### JavaScript
- `js/app.js` — Fix rgba waarden (lijn 366, 391)
- `js/app.js` — Verwijder particle canvas code (niet meer in HTML)
- `js/skipper.js` — Verwijder GSAP/Swiper dependencies of laad ze in

### CSS
- Voeg alle CSS samen tot 3-4 bestanden
- Voeg CSS custom properties toe voor kleuren
- Voeg focus-visible styles toe

---

## 12. VERSIE BEHEER

| Versie | Datum | Wijzigingen |
|--------|-------|-------------|
| v0.1 | 20-05-2026 | Eerste volledige analyse. Basis site met 4 pagina's, mint groen kleurenschema, metal-fx effects, dot matrix loaders, hover expand gallery, ClosingPlasma shader. |

---

## 13. VOLGENDE STAPPEN

1. **v0.2** — Fix hoge prioriteit bugs (rgba, contact form, taal consistentie)
2. **v0.3** — Product detail pagina + werkende winkelwagen
3. **v0.4** — Echte foto's + video content
4. **v0.5** — GSAP + Swiper integratie voor geavanceerde animaties
5. **v0.6** — SEO optimalisatie + structured data
6. **v0.7** — Toegankelijkheid audit + fixes
7. **v0.8** — Performance optimalisatie (CSS/JS bundling, lazy loading)
8. **v0.9** — Nieuwe pagina's (FAQ, shipping, returns, privacy, terms)
9. **v1.0** — Launch ready

---

*Document gegenereerd door OWL — Legend Stories AI Assistant*

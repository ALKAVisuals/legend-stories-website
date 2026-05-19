# Legend Murals — Premium Wall Stickers & Murals

![Legend Murals](https://img.shields.io/badge/Legend-Murals-%23D4AF37)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC)
![Vite](https://img.shields.io/badge/Vite-5.1-646CFF)

Een **mobile-first**, snelle e-commerce storefront voor Legend Murals — een bedrijf dat premium muurstickers en murals ontwerpt en print, geïnspireerd door epische verhalen, geschiedenis en mythologie.

**Design:** Dark & Cinematic — diepzwart met gouden accenten, gebouwd voor conversie vanuit TikTok.

## 🚀 Quick Start

```bash
# 1. Clone de repository
git clone https://github.com/legendstories/legend-murals.git
cd legend-murals

# 2. Installeer dependencies
npm install

# 3. Start development server
npm run dev
```

De site draait nu op `http://localhost:3000`

## 📁 Project Structuur

```
legend-murals/
├── index.html              # Homepage
├── product-page.html       # Product detail pagina
├── css/
│   └── main.css            # Tailwind directives + custom styles
├── js/
│   └── app.js              # Cart, menu, size selector, quantity
├── images/                 # Product afbeeldingen (placeholder)
├── package.json            # Dependencies & scripts
├── tailwind.config.js      # Custom theme (colors, fonts, animations)
├── vite.config.js          # Vite configuratie
├── postcss.config.js       # PostCSS + Tailwind
└── README.md               # Dit bestand
```

## 🛠 Tech Stack

- **HTML5** — Semantische markup met ARIA attributen
- **Tailwind CSS 3.4** — Utility-first CSS framework
- **Vite 5.1** — Lightning-fast build tool
- **Vanilla JavaScript** — Geen frameworks, maximale performance

## 📦 Scripts

| Command            | Beschrijving                    |
|--------------------|---------------------------------|
| `npm run dev`      | Start development server        |
| `npm run build`    | Bouw productie-versie naar `dist/` |
| `npm run preview`  | Preview productie build lokaal  |

## 🎨 Design System

### Kleuren
| Naam       | Hex     | Gebruik              |
|------------|---------|----------------------|
| `void`     | `#0B0B0C` | Body background    |
| `surface`  | `#161618` | Cards, sections    |
| `gold`     | `#D4AF37` | Accents, CTA's     |
| `text-primary` | `#F5F5F7` | Headings       |
| `text-secondary` | `#A0A0B0` | Body text    |

### Typography
- **Display:** Playfair Display (serif) — Headlines
- **Body:** Inter (sans-serif) — Alle andere tekst

## 🌐 Deployment

### Vercel (aanbevolen)
```bash
npm i -g vercel
vercel
```

### Netlify
```bash
npm run build
# Upload de `dist/` folder naar Netlify
```

### Eigen server
```bash
npm run build
# Serveer de `dist/` folder met nginx/apache
```

## 📝 Features

- ✅ Volledig responsive (mobile-first)
- ✅ Cart drawer met slide-in animatie
- ✅ Mobile navigatie met hamburger menu
- ✅ Size selector met prijs update
- ✅ Quantity selector
- ✅ Sticky mobile CTA button
- ✅ ARIA attributen voor toegankelijkheid
- ✅ Custom scrollbar styling
- ✅ Gold gradient animations
- ✅ Glass morphism effects

## 📄 License

© 2026 Legend Murals. Alle rechten voorbehouden.

# Style Analyzer & Implementation Notes

## Huidige Site Status
- **Versie:** v2.0 (2026-05-19)
- **Framework:** Tailwind CSS (CDN) + Custom CSS
- **Kleuren:** void #0B0B0C, surface #161618, gold #D4AF37
- **Fonts:** Playfair Display (headings), Inter (body)
- **Live:** https://alkavisuals.github.io/legend-stories-website/

## Style Inspiratie Links
| Naam | Link | Status | Notities |
|------|------|--------|----------|
| Axis (StyleUI) | https://www.styleui.dev/template/axis | ⚠️ Geen goede match | Next.js CRM template, te verschillend in structuur. shadcn/ui based. |
| **BEHOEFTE:** Nieuwe link | - | ⬜ | Kies een streetwear/dark luxury template |

## Wat we uit Axis KUNNEN leren (shadcn/ui patterns)
Ondanks dat het een CRM is, zijn er universele designprincipes:

### Kleurenpalet (shadcn/ui dark mode)
- **background:** #0a0a0a (near black)
- **foreground:** #fafafa (near white)
- **muted:** #262626 (dark gray)
- **muted-foreground:** #a3a3a3 (light gray)
- **border:** #262626 (subtle)
- **primary:** #fafafa (inverted — white on dark)
- **accent:** #262626

### Typografie
- **Heading:** `text-2xl font-semibold tracking-tight` — tight, no-nonsense
- **Body:** `text-muted-foreground` — muted, not pure gray
- **Small:** `text-sm` / `text-xs` for metadata

### Spacing
- **Section padding:** `py-16` (64px) — generous but not excessive
- **Container:** `max-w-7xl mx-auto px-4` — standard
- **Card padding:** `p-4` / `p-6` — tight
- **Grid gap:** `gap-4` / `gap-6` — consistent

### Componenten
- **Buttons:** `h-9` (36px) — compact, `rounded-md`, `text-sm font-medium`
- **Cards:** `border` (1px solid), `rounded-lg`, no shadow
- **Inputs:** `h-9`, `rounded-md`, `border`, `bg-transparent`
- **Badges:** `text-xs`, `px-2`, `py-0.5`, `rounded-full`

### Effecten
- **Shadows:** Minimal — `shadow-sm` at most
- **Transitions:** `transition-colors` (not `all`), subtle
- **Hover:** `bg-muted/50` — very subtle background shift
- **Focus:** `ring-2 ring-ring ring-offset-2` — accessible focus rings

### Specifieke Elementen om Over te Nemen
1. **Compacte buttons** — h-9 (36px) i.p.v. onze huidige grote buttons
2. **Muted text kleuren** — #a3a3a3 i.p.v. #A0A0B0
3. **Dunnere borders** — 1px solid #262626
4. **Minder border-radius** — rounded-md (6px) i.p.v. rounded-lg (8px)
5. **Tighter letter-spacing** — tracking-tight op headings
6. **Subtielere hover states** — background shift i.p.v. glow

## Aanbevolen Volgende Stijlen om te Analysen
1. **Corteiz / Supreme style** — Bold, minimal, high contrast
2. **Aesop** — Quiet luxury, warm neutrals, serif headings
3. **Byredo** — Clean, geometric, monochrome
4. **Acne Studios** — Playful minimalism, pastel accents
5. **Comme des Garçons** — Deconstructed, asymmetric

## Implementatie Checklist
- [ ] Nieuwe style link ontvangen van K
- [ ] Style analyseren en noteren
- [ ] Kleuren bijwerken
- [ ] Typografie aanpassen
- [ ] Componenten herschrijven
- [ ] Mobiel testen
- [ ] Pushen naar GitHub

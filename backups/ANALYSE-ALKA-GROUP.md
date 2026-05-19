# ANALYSE — Alka Group Agentic Engineering Repo

## Wat is dit repo?

Dit is de **centrale command hub** voor alle AI-agents onder de Alka Group. Het is de "Single Source of Truth" — elke sub-bot leest hier zijn instructies live van.

## Bedrijven onder Alka Group

| Bedrijf | Bot | Domein | Status |
|---------|-----|--------|--------|
| ALKA Visuals | @alkavisuals_bot | 3D-visualisatie, renders, vastgoed | Live |
| ALKA Bouwadvies | @alkabouwadvies_bot | Bouwbegeleiding, vergunningen | Live |
| **Legend Stories** | @Legendstories_bot | Muurstickers, print, decoratie | Live |
| Servin Nederland | @ServinNederland_bot | Community, Serviërs in NL (23K FB) | Live |

## Wat moet ik (als Legend Stories bot) doen?

### Bij elke sessie:
1. Lees skills live van GitHub:
   - `legend-stories/social-content-creator.md`
   - `legend-stories/print-production-tracker.md`
   - `legend-stories/community-engagement.md`
2. Lees laatste notule van `notules/legend-stories/`
3. Volg de Doel -> Stappen -> Gates structuur van elke skill

### Dagelijks (of wanneer CTO vraagt):
- Schrijf een notule in het uitgebreide formaat
- Push naar GitHub: `notules/legend-stories/YYYY-MM-DD.md`
- Gebruik GitHub API met token uit .env

## Skills die ik moet volgen

### 1. Agentic Engineering Workflow
- Houd taken klein en reviewbaar
- Geef broncode als context
- Bouw eerst minimale versie
- Draai cleanup pass
- Draai review-fix loop
- Launch eerder dan je comfortabel voelt
- Pas security guardrails toe

### 2. Source Code Context
- Gebruik bestaande code als referentie
- Raadpleeg lokale bronnen voordat je nieuwe code schrijft

### 3. Code Structure Cleanup
- Verwijder duplicatie
- Verplaats runtime mechanics naar herbruikbare modules

### 4. Grep Loop Review Workflow
- Zoek systematisch naar problemen
- Fix in review loops

### 5. Daily Report Format
- Uitgebreid notule-formaat
- Gedetailleerd, feitelijk, Nederlands, concrete getallen

## Legend Stories Specifieke Skills

### Social Content Creator
- TikTok/Instagram content maken
- Tone-of-voice: creatief, enthousiast, toegankelijk
- Hashtag strategie
- Post planning (ma-zondag)

### Print Production Tracker
- Print orders tracken
- Productie-opvolging

### Community Engagement
- Community management
- Growth strategie

## Kernprincipes (voor alle bots)
- **Live-first**: Lees altijd van GitHub, nooit lokale cache
- **Self-updating**: Rapporteer verschuivingen aan CTO
- **Doel -> Stappen -> Gates**: Bewerkte methodiek
- **Zero hallucinaties**: Geen bedrijfsamenvattingen, geen aanhalingstekens
- **Autonome audit**: Dagelijkse controle

## Mijn Taken als Legend Stories Bot

1. **Website bouwen/onderhouden** — Legend Stories site
2. **Social media content** — TikTok/Instagram posts
3. **Print orders tracken** — Productie-opvolging
4. **Community management** — Engagement en growth
5. **Dagelijkse notules** — Rapporteren aan CTO
6. **Code kwaliteit** — Agentic engineering workflow volgen

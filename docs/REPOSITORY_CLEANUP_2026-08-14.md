# Repository cleanup — 14 augustus 2026

Deze notitie legt de gecontroleerde cleanup vast waarmee de repository in lijn is gebracht met de huidige LegendMural launcharchitectuur.

## Architectuur die nu als bron van waarheid geldt

- Netlify is de enige beoogde production host.
- PayPal is de enige beoogde payment provider voor launch.
- Neon Postgres blijft de duurzame LegendMural orderdatabase.
- Stripe blijft tijdelijk als legacy/fallback aanwezig totdat PayPal Sandbox + Neon inclusief webhook/reconciliation volledig is bewezen.

## Uitgevoerde cleanup

- actuele README, architectuur-, checkout-, persistence-, return-, security-, release- en projectstatusdocumentatie bijgewerkt;
- PayPal Sandbox + Neon stagingdocument toegevoegd;
- oude Stripe-first PR #82 gesloten als superseded zonder merge;
- obsolete `.nojekyll` verwijderd omdat GitHub Pages geen production target meer is;
- Netlify-configuratiecomments verduidelijkt zonder runtimegedrag te veranderen;
- package metadata bijgewerkt;
- tijdelijke one-shot workflow voor lockfileherstel heeft zichzelf na uitvoering verwijderd.

## Dependency hygiene

De quality gate wees op de bestaande high-severity advisory voor `nanoid 3.3.16` (`<3.3.18`). De transitive lockfile-entry is gecontroleerd bijgewerkt naar `nanoid 3.3.18`, passend binnen de bestaande PostCSS semver-range.

De one-shot update heeft daarna `npm audit --audit-level=high` succesvol doorlopen en heeft geen permanente write-enabled workflow achtergelaten.

## Bewust nog niet verwijderd

- Stripe payment/server modules;
- Stripe Netlify fallbackroutes;
- Stripe validators/tests;
- provider-neutrale order-, database- en securitycomponenten.

Deze worden pas in een aparte cleanup-PR beoordeeld nadat de PayPal paymentflow inclusief webhook/reconciliation end-to-end groen is.

## Geen productie-impact

Deze cleanup activeert geen PayPal Live, wijzigt geen Netlify secrets/environment variables, verandert geen Neon productiedata en past geen productprijzen, catalogus of storefrontcheckoutgedrag aan.

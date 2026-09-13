# WireFactory

WireFactory on FretFactory-kokonaisuuden erillinen sähkösuunnittelueditori. Se on itsenäinen React/TypeScript/Vite/Zustand/pdf-lib-sovellus, jonka tuotantoreitti on `/wirefactory/`. Sovelluksella voi rakentaa kitaran mikrofonikytkennän, tarkistaa sen topologian ja tuottaa rakennettavan johdotuskuvan.

## Nykyinen v1

Starterina on kaksi humbuckeria, kaksi 500 kΩ audio-taper -volume-potentiometriä, yksi 500 kΩ audio-taper -master-tone, 22 nF:n tone-kondensaattori, kolmiasentoinen pickup-valitsin ja mono-jakki. Kytkennässä on yhteinen maa. Starteri on muokattava.

Editorin olennaiset toiminnot:

- komponenttien raahaus ja valinta
- johtimen lisääminen pääteterminaalien välille sekä komponentin tai johtimen poistaminen
- undo/redo
- valitsimen neck-, middle- ja bridge-asennot
- volume 0-, mid- ja full-tilat topologisina kytkentätiloina
- BFS-pohjainen netlistin ratkaisu ja aktiivisen signaalipolun näyttö
- johdotuksen virheiden näyttö ja virheellisen viennin esto
- SVG-, PDF- ja BOM-vienti samasta tilasnapshotista

Volume 0/mid/full eivät simuloi potentiometrin vastuskäyrää tai taajuusvastetta; ne ovat v1:n topologisia kytkentätiloja. Katalogissa on laaja joukko komponentteja. Jokaisella komponentilla on perustiedot, käyttötarkoitusesimerkki ja lähdeviite. Osalla katalogin komponenteista on vain geneerinen pinout; valmistajakohtaista väriä tai fyysistä lug-/nastajärjestystä ei päätellä ilman varmistettua lähdettä. CTS 450G:n virallinen URL on tarkistettu.

## Projektitiedosto

Projektitiedosto on `.wirefactory`-JSON, jonka formaattitunniste on `wirefactory-project` v1. Tiedosto parsitaan ja validoidaan ennen nykyisen tilan korvaamista. Virheellinen tai tukematon tiedosto hylätään säilyttäen aktiivisen projektin.

## Kehitys

```text
npm ci
npm run dev       # 127.0.0.1:5175, strictPort
npm run preview   # 127.0.0.1:4175, strictPort
```

Tarkistukset ajetaan järjestyksessä:

```text
npm run typecheck
npm run test:run
npm run format:check
npm run test:port-conflict
npm run build
npm run test:e2e
```

## Rajaus

V1 ei mallinna aktiivielektroniikkaa, taajuus- tai SPICE-simulaatiota, potentiometrin vastuskäyrää, valmistajakohtaisia värejä tai liitinten fyysistä lug-/nastajärjestystä. Tämä varmennus ei ole fyysisen sähköturvallisuuden, valmistettavuuden tai laite-/kenttäkokeen todiste.

WireFactoryn v1-lähtöversio tallennetaan Gitin `main`-haaran ensimmäiseen paikalliseen committiin. Pushia, deployta tai FretFactoryn landing page -linkitystä ei ole tehty.

## Verification ledger

| Tarkistus | Menetelmä | Tulos | Todistettava asia |
|---|---|---|---|
| TypeScript | `npm run typecheck` | PASS | lähdekoodi tyypittyy |
| Vitest | `npm run test:run` | 17/17 PASS | mallin, parserin, resolverin ja viennin yksikkötarkistukset |
| Format | `npm run format:check` | PASS | seurattu lähdekoodi on muotoiltu |
| Portit | `npm run test:port-conflict` | PASS | dev- ja preview-portit ovat strictPort-konfiguraation mukaiset |
| Build | `npm run build` | PASS, chunkit 39.16 / 145.19 / 428.60 kB, ei varoitusta | tuotantobundle muodostuu |
| E2E | virallinen 4/4 | PASS, desktop Edge + iPhone 13 Chromium | starter, editorin käyttö ja vientipolku toimivat selaimessa |
| Selainkuvat | tuoreet desktop/mobile-snapshotit | console 0, body overflow 0 | selainruntime ja responsiivinen pinta |
| SVG | ladattu vienti | 16 johtoa / 9 komponenttia | johdotuskuva ja BOM vastaavat snapshotia |
| PDF | ladattu vienti ja renderöinti | 2 A4 landscape -sivua | PDF-rakenne ja sivutus |
| Pinout-regressio | P1 unknown pinout -korjaus + browser regression | PASS | tuntematon pinout ei muutu varmistetuksi tiedoksi |
| Lähde | CTS 450G official URL | VERIFIED | katalogin lähdeviite on tarkistettu |

Varmennus on paikallinen automaattinen, selain- ja ladatun artefaktin näyttö. Julkista ympäristöä tai fyysistä koetta ei ole tehty.

## Lähtöversion varmennus 2026-09-13

Nykyiselle työpuulle ajettiin typecheck, test:run (17/17), format:check, test:port-conflict ja test:e2e (sisältää buildin; 4/4). Kaikki läpäisivät. Selainkokeet kattavat projektin tallennuksen sekä SVG/PDF/BOM-lataukset. Yllä olevan ledgerin aiempia erillisiä kuvatarkistuksia ja lähdeviitetarkistusta ei uusittu tällä kierroksella. Release-check: READY WITH WARNINGS paikalliselle lähtöversion commitille; ei julkaisuympäristön eikä fyysisen kokeen näyttöä.

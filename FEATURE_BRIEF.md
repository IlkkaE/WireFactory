# FEATURE BRIEF — WireFactory v1

## Tavoite

Tarjota FretFactory-kokonaisuuteen erillinen editori, jolla kitaran mikrofonien ja passiivisten komponenttien johdotus voidaan rakentaa, tarkistaa ja viedä rakennettavaksi kuvaksi.

## Toteutunut rajaus

WireFactory on itsenäinen React/TypeScript/Vite/Zustand/pdf-lib-sovellus. Se ei tuo runtime-riippuvuuksia FretFactorysta tai GTRFactorystä. Base path on `/wirefactory/`. Projektin v1-lähtöversio tallennetaan oman Git-repositorion `main`-haaran ensimmäiseen paikalliseen committiin.

## Käyttäjän vahvistama starter

Starterissa on kaksi humbuckeria, kaksi 500 kΩ audio-taper -volumea, 500 kΩ audio-taper -master-tone, 22 nF:n kondensaattori, kolmiasentoinen pickup-valitsin ja mono-jakki. Ground-solmut ovat yhteiset. Starteri voidaan muuttaa editorissa.

## Malli ja käyttäytyminen

Projektiformaatti on `.wirefactory`, formaattitunniste `wirefactory-project` ja versio 1. Parseri validoi sisällön ennen replace-operaatiota; virheellinen avaus ei tuhoa nykyistä tilaa.

Resolver muodostaa todellisen netlistin BFS-haulla. Aktiivinen signaalipolku lasketaan valitsimen neck-, middle- ja bridge-asennoille sekä volume-potentiometrin 0-, mid- ja full-tiloille. Volume-tilat ovat topologisia kytkentätiloja: v1 ei simuloi potentiometrin vastuskäyrää, taajuusvastetta tai SPICE-mallia. Selectorin sisäiset kontaktit, tone-haara ja maa kuuluvat malliin.

Käyttöpolkuun kuuluvat komponenttien raahaus, terminal-to-terminal-johtimet, komponentin ja johtimen poisto sekä undo/redo. Rikkinäinen tai puutteellinen johto estää viennin. SVG, PDF ja BOM muodostetaan samasta snapshotista, jotta kuva ja osaluettelo eivät voi eriytyä toisistaan.

## Catalog

Catalogissa on laaja komponenttivalikoima ja jokaisesta merkintä perustiedoille, käyttötarkoitusesimerkille ja lähdeviitteelle. Geneerinen pinout ilmoitetaan sellaisena; sitä ei saa tulkita valmistajakohtaiseksi väriksi tai fyysiseksi lug-/nastajärjestykseksi. P1-korjauksessa unknown pinout säilyy tuntemattomana, ja CTS 450G:n official URL on erikseen verified.

## Ei-tavoitteet ja varmennuksen rajat

V1 ei sisällä aktiivielektroniikan mallia, taajuusvastetta tai SPICE-simulaatiota, potentiometrin vastuskäyrän simulointia, valmistajakohtaisia värikoodeja, fyysistä lug-/nastajärjestystä eikä fyysisen komponentin turvallisuus- tai valmistuslupausta. Automaattinen testi, selainkoe ja vienti kokevat eri asioita; mikään niistä ei ole fyysinen laite- tai kenttäkoe.

## Verification ledger

| Kriteeri / tarkistus | Tulos | Näyttö |
|---|---|---|
| Typecheck | PASS | `npm run typecheck` |
| Unit/integration | 17/17 PASS | Vitest `npm run test:run` |
| Formatting | PASS | `npm run format:check` |
| Port policy | PASS | dev 5175 ja preview 4175, strictPort |
| Production build | PASS | chunkit 39.16 / 145.19 / 428.60 kB, ei varoitusta |
| Official browser E2E | 4/4 PASS | desktop Edge + iPhone 13 Chromium |
| UI runtime | PASS | screenshots: console 0, body overflow 0 |
| SVG artifact | PASS | 16 wires ja 9 components |
| PDF artifact | PASS | 2 A4 landscape -sivua renderöity |
| P1 pinout regression | PASS | unknown pinout -korjaus ja browser regression |
| CTS 450G source | VERIFIED | official URL tarkistettu |
| QA | VERIFIED | riippumaton QA |

Ledgerin näyttö koskee paikallista runtimea ja ladattuja artefakteja. Fyysistä johdotus-, turvallisuus- tai valmistuskoetta ei ole tehty.

## Dokumentaatio- ja julkaisutila

WireFactoryn dokumentit kuvaavat toteutunutta v1:tä. Tämä v1 on ensimmäisen paikallisen commitin lähtöversio. Pushia, deployta tai landing page -linkkiä ei ole tehty. Landing-linkin lisääminen kuuluu erilliseen julkaisuaskeleeseen, kun tämän editoriversion julkaisu päätetään.

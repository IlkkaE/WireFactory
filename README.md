# WireFactory

WireFactory on passiivisten kitarakytkentöjen editori. React/TypeScript/Vite/Zustand/pdf-lib-sovelluksen reitti on /wirefactory/. Editori näyttää komponentit alkuperäisinä vektorikuvina, tarkistaa kytkennän yleisen rakenteellisen toimivuuden eksplisiittisellä Check wiring -toiminnolla ja tuottaa SVG-, PDF- ja BOM-viennit.

Paikallinen versio sisältää 15.9.2026 alkaen valittavat tarkistushavainnot, kohteiden korostuksen ja kuusi presettiä. Tämä lisäys on varmennettu paikallisesti, mutta sitä ei ole julkaistu. Osoitteessa https://www.fretfactory.fi/wirefactory/ on aiempi 14.9.2026 julkaistu analyysi- ja työhuonetaustaversio; sen julkaisun näyttö on jäljempänä historiassa.

Catalog info näyttää komponentin nimen, kuvauksen ja rajoitukset. Example-laatikkoa ja ulkoisia dokumentaatiolinkkejä ei näytetä komponenttitiedoissa.

## Komponenttikuvat ja kytkimet

Katalogissa on 32 valittavaa komponenttimääritelmää: single-coil, P90 ja kaksi humbucker-tyyppiä; tavalliset audio- ja lineaariset potikat, no-load, stacked/concentric, push-pull ja push-push; 3- ja 5-asentoiset valitsimet, minikytkimet ja 24-liittiminen superswitch; jakit, passiiviosat ja maadoitusosat.

Kuvat on tehty tätä projektia varten. Yhteinen geometria sisältää polut, ellipsit, tekstit ja liitäntäpisteet. Editori, SVG ja PDF käyttävät samoja muotoja. Valmistajien kuvia ei kopioida eikä kuvia ladata ulkoisesta palvelusta. Johdon lähtöreitti ohjataan erilleen viereisistä liittimistä; erilliset johtojen risteykset eivät luo sähköistä liitosta.

Valitun kytkimen Inspector näyttää sallitut kontaktitilat. Tavallisen 3-asentoisen blade-kytkimen jokainen asento valitsee yhden kontaktin per napa. 5-asentoisen mallin väliasennot yhdistävät viereiset kontaktit. Superswitchissa on neljä itsenäistä napaa ja viisi asentoa. DPDT on/on/on käyttää tässä määriteltyä geneeristä matriisia: keskellä A2–A1 ja B2–B3. Se ei ole kaikkien fyysisten kytkinten yhteinen liitinjärjestys.

Kytkintila tallennetaan Instance.controlState-kenttään ja kuuluu undo/redo-historiaan. Yhteinen Selector-ohjain ja sen komponentin Inspector pysyvät samassa tilassa; erikseen lisätty kytkin käyttää omaa tilaansa. Puuttuva tila käyttää määritelmän oletusta, virheellinen tila hylätään avattaessa. Volume ja tone ovat edelleen hetkellisiä säätötiloja. Avaus säilyttää tallennetut kytkintilat ja palauttaa volume/tone-oletukset; uusi projekti käyttää mallinsa oletuksia.

Virheellinen vanha tunniste spst-on-on säilyy tiedostojen luku- ja tallennusyhteensopivuuden vuoksi. Se näytetään SPST on/off -osana legacy-merkinnällä. Uudet lisäykset käyttävät tunnistetta spst-on-off.

## Rakenteellinen analyysi ja kytkentämallit

Aloitusmalleja on kuusi:

| Aloitusmalli | Komponentteja / johtoja | Toiminta |
|---|---:|---|
| 2HB / 2V / 1T | 9 / 16 | Kaksi volumea ja yhteinen tone |
| 2HB / 1V / 1T | 8 / 14 | Yhteinen volume ja tone |
| Dual split / push-pull | 8 / 20 | Molempien HB4-mikrofonien puolitus tone-potikan DPDT:llä |
| Dual split / push-push | 8 / 20 | Sama puolitus lukittuvalla painokytkimellä |
| 3S / 5-way / 1V / 1T | 9 / 17 | Kolme single-coilia; N, N+M, M, M+B, B |
| 2S / Parallel-Series / 1V / 1T | 8 / 16 | Kaksi single-coilia DPDT:n rinnakkais- tai sarjakytkennässä |

Kaikissa on 22 nF:n kondensaattori, mono-jakki ja yhteinen maa. Neljä alkuperäistä mallia käyttää kolmiasentoista valitsinta ja erillistä expectation-vertailua, jonka tunnistus perustuu komponenttimääritelmiin sekä values.position- ja values.control-rooleihin. Uudet 3S- ja 2S-mallit käyttävät yleistä rakenteellista analyysiä ja expectation=null-arvoa. Niissä on 250 kΩ:n master-volume ja tone. 3S:n viisi asentoa käyttävät blade-kytkimen a-puolta; b-puoli jää vapaaksi. DPDT:n Parallel (A) yhdistää mikrofonit rinnakkain ja Series (B) sarjaan. Mikrofonien suojat pysyvät erillään signaalin kylmästä johdosta ja maadoitettuina. Tilanimet tallentuvat presetin kuvaavana values-metadatana, eivätkä ne todista muokatun tai fyysisen kytkennän toimintaa. Molemmissa malleissa master-volumen nolla mykistää lähdön.

Dual split -mallissa full käyttää kahta sarjakelaa per humbucker. Split maadoittaa molempien mikrofonien sarjaliitokset, jolloin pohjoiskela jää käyttöön. Käyttöliittymä ja viennit näyttävät kytkennän kelamäärän. Valitsin toimii N / N+B / B -periaatteella ja master-volumen nolla mykistää lähdön kummassakin kytkintilassa. Kahden volumen mallin middle-asennossa yhden volumen nolla mykistää yhteisen lähdön.

Analyysi käyttää katalogin kaikille määritelmille runtime-sähkömallia: pickupit ja niiden kelat, potikkaradat ja wiperit, finite-passivet, kontaktimatriisit sekä mono- ja stereo-outputit. Se rakentaa wire- ja suljettujen kontaktien ideaaliverkon ja arvioi jokaisen lähteen vaikutusta jokaiseen outputiin usealla deterministisellä epäsymmetrisellä finite-probilla. Tämä on rakenteellinen mahdollisen lähdevaikutuksen tarkistus, ei ääni-, taso-, taajuus- tai SPICE-simulaatio.

Analyysi käy läpi kaikki tuettujen kytkimien yhdistelmät deduplikoituna. Taulukko näyttää kunkin tilan lähteet, outputin tilan ('active', 'muted', 'open' tai 'unknown') ja HB4:n 'split'-, 'series'-, 'parallel'- tai 'complex'-luokituksen silloin, kun se voidaan johtaa. Yksittäisen tarkistusajon current-rivi kertoo nykyiset kontrollit; taulukon lähdevertailu käyttää nimellisiä volume- ja tone-asetuksia, kun taas yläosan current-tulos käyttää nykyisiä säätöjä.

| Rakenteellinen tila | Merkitys | SVG / PDF / BOM |
|---|---|---|
| valid | Kaikki analysoidut rakenteelliset ehdot täyttyvät ja vähintään yksi tila tuottaa output-vaikutuksen | Sallittu tarkistetulla tuloksella |
| invalid | Syntaksivirhe, puuttuva output/source tai mikään analysoitu tila ei tuota output-vaikutusta | Estetty |
| unknown | Relevantti malli on tuntematon, probe-tulokset ovat ristiriidassa/singulaarisia tai rajat ylittyvät | Estetty |

Expectation-status ('matched', 'deviated', 'unavailable' tai 'none') raportoidaan erikseen rakenteellisesta tilasta. 'deviated' ei yksin estä rakenteellisesti validin kytkennän vientiä. Neljässä alkuperäisessä presetissä expectation-tarkistus säilyy, mutta yleinen analyysi ei vaadi presetin tarkkaa paria tai instanssien nimiä. Valinnaiset irtikytketyt osat eivät yksin tee kytkennästä invalidia; pickup, joka ei vaikuta mihinkään tilaan, raportoidaan varoituksena. Jos yksikään pickup ei vaikuta mihinkään outputiin missään analysoidussa tilassa, tila on invalid.

Check wiring käynnistää raskaan analyysin. Aluksi, avauksen jälkeen ja presetin vaihdon jälkeen tulos on 'NOT CHECKED'; sähkömuutos, kuten johto-, komponentti-, kontaktimatriisi-, kytkintila- tai relevantti transienttisäätömuutos, tekee tuloksesta vanhentuneen ja estää viennin. Pelkkä komponentin siirtäminen säilyttää tarkistetun sähkötilan, ja vienti käyttää viimeisintä vastaavaa tarkistustulosta ilman uutta resolver-ajoa. Epäonnistunut tai tuntematon tarkistus ei säilytä aiempaa validia tilaa.

Validation näyttää kaikki tarkistushavainnot vieritettävässä listassa. Havainnon valinta näyttää selkokielisen syyn ja varovaisen seuraavan toimenpiteen sekä korostaa siihen liittyvät komponentit, terminaalit ja johdot vaaleanpunaisella. Korostus näyttää asiaan liittyvät liitännät, ei varmaksi todettua fyysistä vikapaikkaa. Koko kytkentää koskevalle havainnolle ei keksitä yksittäistä kohdetta.

Show in diagram tuo kohteen näkyviin myös mobiilissa. Canvasin Back to diagnostic palauttaa samaan havaintoon ja näppäimistöfokukseen; Clear highlight poistaa korostuksen. Diagnostiikan valinta ei muuta Inspectoria, normaalia komponentti-/johtovalintaa tai keskeneräistä johdotusta eikä käynnistä analyysiä. Geometrian siirto säilyttää korostuksen. Sähkömuutos, uusi Check, onnistunut Open tai presetin lataus tyhjentää sen; undo/redo ei palauta jo vanhentunutta korostusta.

## Projektitiedosto ja laskennan rajat

.wirefactory on JSON, formaatti wirefactory-project, versio 1. Tunnetut expectation-tunnisteet ovat starter-2hb-2v-1t, 2hb-1v-1t, 2hb-1v-1t-split-push-pull ja 2hb-1v-1t-split-push-push; myös null sallitaan. Alkuperäisen version yhteensopivuutta varmentaa commitista b8d8e2d jäädytetty tests/fixtures/baseline-v1.json. Vanhan sovellusbuildin kykyä avata uusia määritelmiä tai expectationeja ei luvata.

Parseri tarkistaa tiedoston ennen avoimen työn korvaamista. Virheellinen avaus säilyttää työn ja näyttää ilmoituksen myös mobiilissa. Tuntemattomat määritelmät ja pinout-versiot hylätään. Rajat ovat 80 komponenttia, 180 johtoa ja 120 junction-tietuetta.

Kaikki johdot osallistuvat jatkuvuusgraafiin wire.role-merkinnästä riippumatta. Kondensaattori on mallissa finite-haara, ja HB4-keloja käsitellään finite-lähteinä, ei nollaohmisina johtimina. Volume- ja tone-arvot ovat rakenteellisia nominal/current-probe-asetuksia; ne eivät tuota laskennallista analogista tasoeroa eivätkä simuloi taajuusvastetta. Analyysin rajat ovat 80 komponenttia, 180 johtoa, enintään 120 junction-tietuetta, 512 switch-yhdistelmää, 140 analyysisolmua ja 35 000 000 work-arviota. Rajan ylitys tekee tuloksesta 'unknown' ja estää viennin.

SVG käyttää näyttöyksiköitä. PDF sisältää kaavion sekä tarvittaessa sivutetut osa- ja johtoluettelot; nykyiset aloitusmallit mahtuvat kahdelle A4-vaakasivulle (842 × 595 pt). Kuvat eivät määritä fyysistä mittakaavaa, valmistajan johtovärejä tai todellisen osan liitinjärjestystä. Tämän paikallisen lisäyksen julkaistua ympäristöä tai fyysistä juotoskoetta ei ole varmennettu; aiempien julkaisujen näyttö on päivätyissä historiakohdissa.
## Kehitys ja Git

~~~text
npm ci
npm run dev       # http://127.0.0.1:5175/wirefactory/, strictPort
npm run preview   # http://127.0.0.1:4175/wirefactory/, strictPort
npm run typecheck
npm run test:run
npm run format:check
npm run test:port-conflict
npm run build
npm run test:e2e   # sisältää buildin
~~~

Lähdekoodi julkaistaan [IlkkaE/WireFactory](https://github.com/IlkkaE/WireFactory)-repositoriossa. FretFactoryn yhteisjulkaisu sisältää vain `/wirefactory/`-selainbuildin; lähdekarttoja tai työtilan `output/`-kansiota ei julkaista siellä.

## Toimintaperiaatteiden lähteet

Lähteitä käytetään kytkentäperiaatteisiin, ei kuvien kopiointiin:

- [Bourns PDB183-GTR: DPDT push-pull](https://www.bourns.com/docs/product-datasheets/PDB183-GTR.pdf)
- [Bourns PDB185-GTR: DPDT latching-push](https://www.bourns.com/docs/product-datasheets/PDB185-GTR.pdf)
- [Seymour Duncan: humbuckerin kelat ja sarjaliitos](https://www.seymourduncan.com/blog/latest-updates/guitar-wiring-explored-humbucker-internals)
- [Seymour Duncan: tavallinen 5-way ja superswitch](https://www.seymourduncan.com/blog/latest-updates/guitar-wiring-explored-introducing-the-super-switch-part-1)
- [NKK M-series: minikytkimien kontaktityypit](https://www.nkkswitches.com/pdf/M_TogglesSections_DP.pdf)

## Historiallinen varmennus — 14.9.2026 ehdotus ennen käyttöönottoa

| Tarkistus | Menetelmä ja tulos | Todistettava asia | Lähtötila ja voimassaolo |
|---|---|---|---|
| Pre-task baseline | npm run test:run, 41/41 PASS | Live-version lähtötaso ennen ehdokasta | 2026-09-14; lähtötila ennen myöhemmin hyväksyttyä käyttöönottoa |
| Candidate unit/integration | npm run test:run, 62/62 PASS, 9 files; independent QA repeated | General analysis, check lifecycle, topology, controls, parser, exports and regressions | Full suite before final small fixes; targeted checks and browser evidence below cover later changes |
| Candidate targeted tests | 35/35 PASS + 3/3 adversarial checks | Ground spur, HB4 modes, output ports, limits/unknown and cache lifecycle | Independent QA; candidate only |
| Format / build / ports | npm run format:check PASS; npm run build PASS; npm run test:port-conflict PASS | Candidate formatting, build and strict ports | Candidate source; fresh build after current-row and notice fixes |
| Original E2E paths | npx playwright test, 18/20 PASS | Existing desktop/mobile paths that were retained | 18 paths passed; two new custom paths were separate, so this is not a 20/20 run |
| Custom analysis E2E | npx playwright test tests/e2e/custom-analysis.spec.ts, 2/2 PASS, 9.4 s | Custom 3-single-coil table, five switch states, stale/unknown export gates and downloads | Candidate browser run after final current-row and notice fix; fresh desktop/mobile run |
| Downloaded artifacts | pypdf + Poppler render + visual inspection, PASS | PDF 2 pages at 842×595 pt, SVG output metadata/BOM; text included ACTIVE Alpha+Beta | Candidate download; Poppler emitted a Symbol-font warning but rendered pages |
| Independent QA | Independent source review VERIFIED; parent fresh desktop/mobile inspection PASS | General resolver, explicit check, current row, nominal-control note, UI/download paths; no blocking findings after A10 fix | Candidate; no physical/deployed evidence |

QA:n A10-tarkistus havaitsi aiemmin taulukon current-rivin vertailuongelman; johdettu row.current ja nominal/current-ohjainten selite korjattiin. Viimeisin QA oli tämän jälkeen VERIFIED. Historiallinen varhainen prototyyppi (24 pass / 17 fail) ei kuvaa nykyistä ehdokasta eikä live-lähdettä. Koko 20 testin selainajoa ei ole esitetty: 18 alkuperäistä polkua ja kaksi uutta custom-polkuajoa varmennettiin erillisinä ajoina.

Näyttö koskee tätä paikallista kandidaattilähdettä, automaattisia testejä, paikallista selainta ja ladattuja artefakteja. Se ei todista live-sovelluksen aktivointia, julkaistua ympäristöä, ääntä tai fyysistä kitarajohdotusta.


Viimeinen open/muted-korjaus varmennettiin kohdennetulla 38/38-testiajolla ja riippumattomalla QA:lla (VERIFIED). Sen jälkeinen build onnistui (6,83 s). Avoin output ei näy mykistettynä. Aiempi selainnäyttö säilyy voimassa sen kattamille muuttumattomille aktiivisille kytkentäpoluille.

## Käyttöönoton varmennus — 14.9.2026

Käyttäjä hyväksyi uusimman version ja resolver.ts:n korvaamisen sekä nettiin julkaisun. Kaikki 21 hyväksytyn manifestin tiedostoa tarkistettiin SHA-256-tiivisteillä, nykyiset korvattavat tiedostot varmuuskopioitiin ja ehdotus aktivoitiin paikalliseen lähteeseen. Tuore yksikkö-/integraatioajo PASS 62/62 (9 tiedostoa), build PASS 4,62 s, pääbundle index-BC3oRqMa.js. Julkisen ympäristön tarkistus on vielä tekemättä.

Aktivoidun lähteen täysi Playwright-ajo läpäisi 20/20 testipolkua työpöytä- ja mobiilikoossa (2,7 min). Muotoilutarkistus PASS. Tämä korvaa aiemman ehdotusvaiheen osissa kootun selainnäytön nykytilan osalta.

## Julkaisu — 14.9.2026

Julkaistu FretFactoryn yhteisjulkaisussa commit8dfe215a698dbd1027d28fd8a07e78968f9f2a92; GitHub Pages34837173194 SUCCESS. Julkisen HTTPS-sivuston desktop/mobile-koe PASS: landing-linkki hiirellä/näppäimistöllä, suora lataus/uudelleenlataus, Check wiring, sähkömuutoksen stale/vientiestot sekä SVG/PDF/BOM-lataukset. Julkiset tiedostot vastaavat manifestia; SVG/BOM-lataukset paikallisia tavuja, PDF avautui lukijalla. Fyysistä johdotusta tai ääntä ei varmennettu. Aiemmat ehdotusvaiheen julkaisua odottavat merkinnät ovat historiallisia.
## Työhuonetausta — 14.9.2026

WireFactory käyttää samaan FretFactory-landingin huoneeseen perustuvaa uutta kuvakulmaa. Sisäänrakennetulla image_gen-työkalulla tehty kuva on paikallinen `src/assets/wirefactory-workshop-v1.webp` (1672 × 941 px, 157586 tavua). Piirustuspöytä näkyy toiselta puolelta ja etualalla on johdotustyöpiste. Tausta on staattinen, osoitintapahtumat ohittava CSS-kerros, ja canvasin sekä sivupaneelien tummennus säilyttää käyttöliittymän luettavana. Kuva ei sisälly SVG/PDF/BOM-vienteihin. Julkaisun näyttö on FretFactoryn `docs/shared-release.md`-ledgerissä.

Työhuonetausta julkaistiin 14.9.2026 (Pages34838501898 SUCCESS, commit07a0f7a). Julkisen WireFactoryn desktop/mobile-kuvalataus, kuuden sovellustiedoston tiivisteet sekä SVG/PDF-viennit tarkistettiin onnistuneesti. Ei sovellusvirheitä; kuva latautui kerran kummassakin näyttökoossa.

## Paikallinen varmennus — 15.9.2026

Diagnostiikka- ja preset-muutos: yksikkö-/integraatiotestit 71/71 PASS, tuoreen buildin Edge-E2E 24/24 PASS työpöytä- ja mobiilikoossa, tyyppitarkistus/build ja format PASS. Riippumaton QA: VERIFIED. Varmennus kattaa kymmenen havainnon listan, erikoismerkkejä sisältävän tunnisteen tuonnin, Show/Back-fokuksen, valinnan elinkaaren, molempien presetien kytkintilat sekä Save/Open- ja SVG/PDF/BOM-viennit. Ladatut PDF:t ovat kaksi 842 × 595 pt sivua. Sarja-/rinnankytkennän ideaaliverkot ja 5-way:n nykyinen lähdevaikutus on testattu erikseen. Kuvakatselmus tehty tuoreille paikallisille kuville.

Tunnisteen jakaminen viimeisestä kaksoispisteestä korjaa aiemman tuontikaatumisen, kun komponentin tunniste itse sisältää kaksoispisteen. Tiedostomuodon versio säilyy 1. Tarkka ledger ja artefaktit ovat paikallisessa output/diagnostics-presets-kansiossa. Muutosta ei ole julkaistu eikä fyysistä johdotusta tai ääntä varmennettu.

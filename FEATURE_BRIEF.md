# FEATURE BRIEF — general structural analysis

Tämä brief kuvaa käyttöön otettua yleistä rakenteellista analyysiä ja Check wiring -toimintoa. Käyttäjä hyväksyi 14.9.2026 nimenomaisesti uusimman version ja resolver.ts:n korvaamisen sekä julkaisun nettiin. Neljä nykyistä presetiä säilyy.

## Tavoite

Lisätä preset-riippumaton rakenteellinen analyysi passiivisille kitarakytkennöille: lähteiden ja kelojen mahdollinen vaikutus kuhunkin outputiin, tuettujen switch-yhdistelmien tilataulukko, outputin active/muted/open/unknown-havainto sekä HB4:n split/series/parallel/complex-luokitus. Rakenteellinen validiteetti ja presetin expectation-vertailu ovat erillisiä.

## Ei-tavoitteet

Ei uusia presetejä, analogista ääni-, taso- tai taajuusvastelaskentaa, SPICEä, fyysisiä pinout-väitteitä, formaattimigraatiota, ääni- tai fyysistä validointia, commitia, julkaisua tai deployta.

## Käyttäjän vahvistamat päätökset

Yleinen analyysi toteutetaan erillisenä Check wiring -toimintona, jotta raskas resolver ei vaikuta komponenttien siirtelyyn. Analyysi raportoi unknown-tilan rehellisesti ja säilyttää version 1 formaatin sekä nykyiset presetit.

## Sallitut paikalliset oletukset

Katalogin runtime-sähkömalli kattaa pickupit, kelat, potikkaradat ja wiperit, finite-passivet, kontaktimatriisit sekä mono- ja stereo-outputit. Finite-probet ovat deterministisiä rakenteellisia probeja, eivät fyysisiä tai auditiivisia parametreja. Reverse-phase ja series-rakenteet voivat olla valideja ilman pickupin kylmän johdon suoraa sleeve-yhteyttä. Valinnaiset irtikytketyt osat eivät yksin tee rakennetta invalidiksi.

## Käyttäytymispolut

1. Uusi, avattu, ladattu tai käsin rakennettu kytkentä on aluksi NOT CHECKED; Check wiring laskee ja tallentaa tuloksen nykyiselle sähköiselle fingerprintille.
2. Johto-, komponentti-, kontaktimatriisi-, kytkintila- tai relevantti volume/tone-muutos vanhentaa tuloksen ja estää viennin. Pelkkä komponentin siirtäminen säilyttää tarkistetun sähkötilan.
3. Vienti käyttää vastaavaa tallennettua tarkistustulosta ilman resolverin uutta ajoa. Tuntematon tai epäonnistunut tarkistus estää viennin eikä säilytä aiempaa validia tilaa.
4. Taulukko käy tuetut switch-yhdistelmät läpi deduplikoituna ja näyttää lähteet, outputin tilan sekä kelaluokituksen. Current-rivi seuraa nykyistä switch-tilaa; lähdevertailun volume/tone on nominal, yläosan tulos current.
5. Rakenteellinen validiteetti voi olla valid expectationin ollessa deviated tai none. Pickup, joka ei vaikuta missään tilassa, raportoidaan varoituksena; jos mikään pickup ei vaikuta mihinkään outputiin missään tilassa, rakenne on invalid.
6. Relevantti tuntematon sähkömalli, probejen ristiriita/singulaarisuus tai analyysiraja tekee tuloksesta unknown ja estää viennin.
7. SVG, PDF ja BOM käyttävät tarkistettua current-tulosta. PDF:n 842 × 595 pt A4-vaakasivut ja kuvat ovat näyttö- ja dokumentointigeometriaa, eivät fyysinen mittakaava.

## Muutettavat vastuualueet tai tiedostot kandidaatissa

catalog/model lisää runtime-only electricalModel- ja kela/kontaktimetadatan. structuralAnalysis toteuttaa union-find-verkon, finite-haarat, lähde/output-probet, HB4-luokituksen, yhdistelmät, rajat ja expectation-statusin. resolver välittää analyysin ja fingerprintin. store säilyttää tarkistetut tulokset; main/style näyttävät Check wiring -tilan, current-rivin ja taulukon; export käyttää vastaavaa tarkistustulosta. Testit kattavat analyysin ja elinkaaren. Tämä candidate-README ja brief ovat ainoat dokumentointimuutokset.

## Säilytettävät rajat

WireFactory project format version 1, parserin rajat, legacy spst-on-on -tunniste, expectation-tunnisteet, undo/redo, Save/Open, alkuperäinen geometria, editorin toiminnot ja neljä olemassa olevaa presetia säilyvät. wire.role ei muuta johtavuutta. Kelat, vastukset, potikkaradat ja kondensaattorit eivät ole ideaalijohtimia.

## Tietomalli- ja rajapintamuutokset

Definition.electricalModel ja muu sähkömetadata on katalogin runtime-dataa eikä uutta serialisoitua kenttää. ResolvedCircuit sisältää structuralStatus-arvon valid/invalid/unknown, buildReady- ja incomplete-liput, expectationStatus-arvon, functionTable-rivit, coilInfluence-tiedot, outputObservations-havainnot sekä nykyiset paths/outputs. electricalFingerprint sisältää analyysiin vaikuttavan sähkötilan ja kontrollit.

## Toteutusjärjestys

Toteutunut kandidaatissa: runtime-metadata ja katalogi → rakenteellinen finite-probe-analyysi → HB4- ja output-luokitukset → yhdistelmien rajaus → expectation-vertailun erottaminen → Check wiring -elinkaari ja stale/export-gating → UI/taulukko/status → SVG/PDF/BOM → testit ja riippumaton QA.

## Hyväksymiskriteerit

- Kaikki katalogin määritelmät saavat runtime-sähkömallin tai analyysi raportoi puuttuvan mallin unknown/varoituksena.
- Yksittäinen, mielivaltaisesti nimetty pickup/volume/output-rakenne voidaan analysoida ilman expectationia.
- Switch-yhdistelmät, useat outputit ja HB4:n split/series/parallel/complex erotellaan rakenteellisilla probeilla.
- Muted, open ja unused/disconnected optional -tapaukset eivät yksin tee validia rakennetta invalidiksi; ei lainkaan toimivaa output-vaikutusta tekee.
- 512 yhdistelmän, 140 solmun ja 35 000 000 work-arvion rajat johtavat unknown-tilaan ja vientiestoon.
- Expectation deviated ei estä rakenteellisesti validin ehdokkaan vientiä.
- Check wiring, sähkömuutoksen stale-tila, drag-säilyvyys, Save/Open ja undo/redo ovat yhdenmukaisia.
- Vienti käyttää viimeisintä vastaavaa checked-tulosta eikä aja resolveria uudelleen.
- Versio 1 ja nykyiset neljä presetia säilyvät.

## Testit ja muut varmennustasot

Kandidaatin yksikkö- ja integraatioajo oli 62/62 PASS yhdeksässä tiedostossa; riippumaton QA toisti saman. Kohdennettu QA oli 35/35 PASS ja kolme adversarial-tarkistusta 3/3 PASS. Format, fresh build ja porttien tarkistus olivat PASS. Alkuperäisistä selainpoluista 18/20 PASS; kaksi uutta custom-polkuajoa ajettiin erikseen, eikä tätä dokumentoida 20/20-ajona. Custom-analyysin desktop/mobile-ajo oli lopuksi 2/2 PASS, 9,4 s. Tuoreet desktop- ja mobile-kuvat sekä ladattu PDF tarkistettiin; PDF oli kaksi 842 × 595 pt A4-vaakasivua. SVG:n output-metadata ja BOM tarkistettiin.

Näyttö koskee paikallista kandidaattilähdettä. Julkaistua ympäristöä, live-aktivointia, ääntä, fyysistä laitetta tai kenttätestiä ei ole varmennettu. Popplerin Symbol-fonttivaroitus ei estänyt PDF:n renderöintiä.

## Dokumentaatiovaikutukset

Candidate README ja tämä brief kuvaavat yleisen rakenteellisen analyysin, eksplisiittisen Check wiring -elinkaaren, stale/export-gatingin, rajat, expectation-erottelun ja varmennustasot. Vanhentuneet väitteet preset-only-validoinnista, automaattisesta resolver-ajosta, unsupported-päätilasta ja 41/41-testin lopputuloksesta on poistettu tästä kandidaatista.

## Riskit

Finite-probet osoittavat mahdollista lähdevaikutusta rakenteellisissa olosuhteissa, eivät äänenvoimakkuutta, taajuusvastetta, hum-cancellationia tai fyysisen komponentin toimintaa. Resource-limit ja epävarmat/singulaariset relevantit verkot pysäytetään unknown-tilaan. Geneerinen logical pinout ei todista valmistajan lug-orientaatiota tai jatkuvuutta.

## Ratkaisematta jääneet asiat

Paikallinen käyttöönotto on tehty ja julkaisulupa on voimassa. Julkaistu ympäristö, fyysinen juotoskoe ja äänen toiminta ovat varmentamatta. Laajempi analoginen simulointi sekä uudet kokonaiskytkennät eivät kuulu tähän muutokseen.

## Toteutusvaltuutuksen tila ja peruste

Käyttäjän pyyntö “Tehdään muutokset.” valtuutti toteutuksen. Automaattisen hyväksyntätarkistuksen aiemman eston jälkeen käyttäjä hyväksyi 14.9.2026 nimenomaisesti uusimman version ja resolver.ts:n korvaamisen sekä nettiin julkaisun. Manifestin mukainen aktivointi on tehty varmuuskopiolla ja SHA-256-tarkistuksilla. Julkaisu toimitetaan FretFactoryn yhteisen GitHub Pages -paketin kautta, ja tämän käyttäjäpyynnön mukaisesti lähdekoodi julkaistaan erillisessä julkisessa GitHub-repositoriossa.


Viimeisen open/muted-erottelun jälkeen kohdennetut testit läpäisivät 38/38, riippumaton QA vahvisti VERIFIED-tilan ja build onnistui (6,83 s).

## Aktivoidun lähteen näyttö — 14.9.2026

Yllä oleva kandidaattilähteen näyttö on historiaa, jonka sama sähköinen toteutus säilyttää. Aktivoinnin jälkeen täysi yksikkö-/integraatioajo PASS 62/62 ja build PASS 4,62 s (index-BC3oRqMa.js). Julkaistu ympäristö on vielä varmentamatta.

Aktivoidun lähteen täysi Playwright-ajo PASS 20/20 (2,7 min); format:check PASS. Näyttö koskee samaa hyväksyttyä sähköistä toteutusta, eikä julkista ympäristöä vielä lasketa varmennetuksi.

## Toteutunut julkaisu — 14.9.2026

Käyttäjän nimenomaisesti hyväksymä versio on käytössä paikallisesti ja julkaistu https://www.fretfactory.fi/wirefactory/. Pages34837173194 SUCCESS commit8dfe215. Julkinen desktop/mobile linkki-, reload-, checked/stale- ja vientikoe PASS; kaikki5 sovellustiedostoa ja manifesti täsmäävät tarkistettuun buildiin. Edellä olevat julkaisua edeltävät varmentamatta-merkinnät ovat historiaa; fyysinen johdotus/ääni säilyvät varmentamatta.

## FEATURE BRIEF — työhuonetausta 14.9.2026

Tavoite: sama FretFactoryn työhuone toisesta kuvakulmasta WireFactoryn taustaksi ja julkaisu. Ei-tavoitteet: editorin logiikka, geometria, tiedostomuoto ja vientisisältö. Käyttäjän vahvistama päätös ja toteutusvaltuutus: “Tee Wirefactoryyn tausta ... sama huone ... eri kulmasta. Julkaise muutokset”. Sallitut oletukset: lämmin puinen työhuone, johdotustyöpiste ja tumma staattinen taustakerros. Käyttäytymispolut: avaus ja mobiilirajaus; osoitin, siirtely ja Check wiring taustasta riippumatta; vienti ilman huonekuvaa. Muutettavat vastuualueet: src/style.css, src/assets/wirefactory-workshop-v1.webp ja nykytiladokumentit; FretFactoryn julkaistava Wire-snapshot. Säilytettävät rajat: nykyinen sähköinen analyysi ja editorin layoutmitat. Tietomalli-/API-muutokset: ei. Toteutusjärjestys: referenssi → image_gen → WebP → CSS → build/selain/viennit → julkaisutarkistus → Pages/HTTPS. Hyväksymiskriteerit: huone tunnistettavissa eri kulmasta; tekstit ja johdot luettavissa; kuva latautuu kerran, ei tapahtumaesteitä tai animaatiota; vientisisältö ennallaan. Testit ja varmennus: build PASS3.79s, neljä desktop/mobile Check wiring/siirto/custom E2E:tä PASS16.5s; yhdistetyn snapshotin desktop/mobile taustakoe PASS, yksi onnistunut kuvalataus kummassakin, errors0, ei sivun vaakaylivuotoa; SVG täsmäsi edelliseen julkaisuun tavutasolla ja PDF oli kaksi sivua. Kuvat tarkistettu visuaalisesti. Dokumentaatiovaikutukset: README, tämä ledger ja FretFactory docs/shared-release.md. Riskit: cover-rajaus vaihtelee näytön suhteella; fyysisiä testejä ei tarvita tämän kosmeettisen muutoksen todistamiseksi. Ratkaisematta: tuotanto-HTTPS-varmennus julkaisun jälkeen.

Kuvan lopullinen prompt ja alkuperä ovat output/workshop-background/IMAGE_PROMPT.md-tiedostossa; alkuperäinen PNG säilyy samassa output-kansiossa. Runtimeen viedään vain WebP. Lähdekoodimuutos on pelkkä CSS ja kuva; vanhempi sähköisen analyysin näyttö säilyy voimassa.

Työhuonetaustan julkaisu valmis: Pages34838501898 SUCCESS (build22s/deploy10s), commit07a0f7a. Julkinen HTTPS-manifesti ja kaikki6 tiedostohashia PASS; desktop/mobile-kuvalataus kerran, errors0, no-overflow, SVG aiempaan tavutasolla identtinen ja PDF2sivua. Näyttö: output/workshop-background/live/results.json. Tuotantovarmennuksen avoin kohta suljettu.

## FEATURE BRIEF — diagnostiikka ja kaksi presettiä, 15.9.2026

### Tavoite
Kaikki tarkistushavainnot valittaviksi, selkokieliset syyt ja varovaiset korjausohjeet sekä liittyvien komponenttien, terminaalien ja johtojen korostukset. Kaksi uutta presettiä listaan.

### Ei-tavoitteet
Ei automaattista analyysiä, ääni-/taajuussimulaatiota, formaattimigraatiota tai julkaisua.

### Käyttäjän vahvistamat päätökset
“Toteuta kohta 1. Lisäksi tee kaksi presettiä lisää listaan.” Toteutusvaltuutus kattaa nämä paikalliset muutokset.

### Sallitut paikalliset oletukset
Uudet mallit ovat 3S / 5-way / 1V / 1T sekä 2S / Parallel-Series / 1V / 1T. Nämä tarkat mallit valittiin toteutuksessa. Molemmilla expectation=null; opasteiden kieli säilyy englanninkielisen UI:n mukaisena.

### Käyttäytymispolut
Check wiring laskee manuaalisesti kuten aiemmin. Kaikki havainnot näkyvät vieritettävässä listassa. Valinta näyttää opasteen ja asiaan liittyvät kohteet; globaalilla havainnolla ei ole tekaistua vikapaikkaa. Show in diagram tuo kohteen näkyviin ja canvasin Back to diagnostic palauttaa saman havaintopainikkeen fokuksen. Clear highlight tyhjentää korostuksen. Tavallinen valinta, Inspector ja keskeneräinen johdotus säilyvät. Geometriamuutos säilyttää tuloksen ja korostuksen; sähkömuutos, uusi tarkistus tai onnistunut projektin/presetin vaihto tyhjentää korostuksen. Sähköisen historian vaihto ei elvytä vanhaa korostusta.

Uusi preset ladataan Load preset -painikkeella ja tarkistetaan ennen vientiä. 3S tuottaa asennot N, N+M, M, M+B, B sekä nykyisen tilan mukaisen lähdön. 2S käyttää DPDT:n on-a-tilaa rinnankytkentään ja on-b-tilaa sarjakytkentään; shieldit pysyvät erillään kylmästä johdosta ja maadoitettuina. Master-volumen nolla mykistää molemmat. Save/Open säilyttää kontaktitilan ja palauttaa transienttien säätöjen oletukset kuten aiemmin.

### Muutettavat vastuualueet tai tiedostot
structuralAnalysis.ts: diagnostiikan opasteet ja kohteet; store.ts: transientti valinta ja elinkaari; main.tsx/style.css: lista, korostukset ja navigointi; template.ts/switchLabels.ts: uudet mallit ja kuvaavat tilanimet; model.ts: terminaaliavaimen turvallinen jako; relevantit unit-, parser- ja E2E-testit; README ja tämä dokumentti.

### Säilytettävät rajat
Neljä aiempaa presettiä, v1, manuaalinen tarkistus, sähköinen fingerprint, undo/redo, Save/Open, vientiportti, kuvat ja tausta säilyvät. Pickupin kylmää päätä ei yleissääntönä pakoteta maahan. Ei fyysisen pinoutin tai äänen toiminnan väitettä.

### Tietomalli- ja rajapintamuutokset
Diagnostic saa runtime-opasteet, kohde-ID:t ja listavaimen. Store säilyttää valinnan transienttina. DPDT:n kuvaavat tilanimet käyttävät olemassa olevaa values-metadatakenttää. JSON-version muutos ei ole tarpeen. splitTerminalKey erottaa terminaalin viimeisestä kaksoispisteestä, koska komponenttitunniste voi sisältää kaksoispisteen ja katalogin terminaalitunniste ei sisällä sitä.

### Toteutusjärjestys
Arkkitehtuurirajaus → workerin pohjatoteutus → pääagentin katselmointi ja puuttuvien UI-/tilapolkujen täydennys → unit- ja selainvarmennus → erikoismerkkituonnin riippumaton diagnoosi ja korjaus → lopulliset testit → riippumaton QA → dokumentaatio.

### Hyväksymiskriteerit
Kaikki havainnot näkyvät, myös yli kahdeksan; kohteet normalisoidaan vain olemassa oleviin tunnisteisiin. Globaalit havainnot eivät nimeä yksittäistä syyllistä. Diagnostiikan valinta ei käynnistä resolveria tai muuta normaalia valintaa. Show/Back/clear ja fokuksen palautus toimivat desktopilla/mobiilissa. Listalla kuusi presettiä; molemmat uudet mallit ovat rakenteellisesti valideja kytkinasennoissaan ja tuottavat oikean nykyisen lähdevaikutuksen. Sarja/rinnankytkentä varmennetaan ideaaliverkosta, ei pelkästä lähteiden määrästä. Tallennus/avaus ja vienti toimivat v1:n rajoissa. Kriteerit täyttyvät alla olevalla näytöllä.

### Testit ja muut varmennustasot — VERIFICATION LEDGER

| Tarkistus / kriteeri | Komento tai menetelmä | Tulos | Todistettava asia | Ajankohta ja voimassaolo |
|---|---|---|---|---|
| Yksikkö-/integraatiotestit | npm run test:run | PASS 71/71, 10 tiedostoa, 1,80 s | Vanhojen mallien säilyminen, kohdistus, valinnan elinkaari, ideaalinetit ja 5-way:n kaikki nykyiset tilat | 15.9.2026 10:58 EEST, lopullinen lähde |
| Tyypit ja build | npm run test:e2e → npm run build, tsc -b && vite build | PASS, build 3,17 s; index-Dzc_xLHd.js | Nykyinen lähde kääntyy tuotantopaketiksi | Sama lähde |
| Koko paikallinen Edge-E2E | npm run test:e2e | PASS 24/24, 1,5 min | Desktop/mobile, kymmenen havaintoa, poikkeava ID, Show/Back/fokus, stale, vanhat polut ja uudet presetit | Tuore preview4175, sama build |
| Oikeat vientitiedostot | E2E-lataukset ja QA:n erillinen SVG/PDF/BOM-luku | PASS | SVG-sisältö, BOM-osat ja molempien presetien PDF2sivua, 842 × 595 pt | output/diagnostics-presets/browser |
| Muotoilu | npm run format:check | PASS | Lähde-/testimuotoilu | 10:59 EEST |
| Riippumaton QA | Lähde- ja testikatselmointi sekä uusi Edge/dev5175-ajo | VERIFIED, ei estäviä löydöksiä | Molemmat presetit, tilanvaihdot, stale/build-ready, oikea live-lähde; ei konsoli-/sivuvirheitä | Samat 12 lähde-/testitiedoston hashit review-scope.jsonissa |
| Visuaalinen näyttö | Pääagentin tuore mobile-highlight- ja desktop-fiveway-kuvakatselmus | PASS | Näkyvät Back/Clear, erillinen korostus ja N+M-lähdetulos | Tuoreet läpäisseen E2E-ajon kuvat |

Ensimmäisen worker-ajon vanhoihin HB-malleihin osunut muokkausvirhe korjattiin. Ensimmäinen uusi E2E oli 2/4: kaksoispisteellinen komponenttitunniste kaatoi tuonnin; riippumaton diagnoosi vahvisti terminaaliavaimen jakovirheen ja se korjattiin. Kuvakatselmus havaitsi uuden 5-way:n legacy-selector-roolin aiheuttaman väärän nykyisen tilan; rooli poistettiin uudesta presetistä ja kaikki viisi live-tilaa lisättiin testeihin. Lopullinen yhtenäinen 71/71 + 24/24 näyttö korvaa nämä aiemmat epäonnistumiset.

QA:n oma kuvanavaustyökalu estyi hostin ACL-virheeseen; pääagentin kuvakatselmus onnistui. Täysiä testisarjoja ei uusittu QA:ssa ilman syytä, koska tuore näyttö kohdistuu samoihin lähdehasheihin. Dokumentaation päivitys ei muuta testattua sovelluskoodia.

### Dokumentaatiovaikutukset
README kuvaa kuusi presettiä, valittavat havainnot ja paikallisen version eron aiempaan julkaisuun. Tämä osio säilyttää toteutuneen rajauksen ja varmennusnäytön; aiemmat päivätyt osiot kuvaavat historiaa.

### Riskit
Korostus osoittaa asiaan liittyvät liitännät, ei varmaa fyysistä vikapaikkaa. Kuvaavat kytkintilanimet eivät todista muokatun kytkennän tai todellisen komponentin toimintaa. Rakenteellinen analyysi ei simuloi ääntä tai fyysistä mittakaavaa.

### Ratkaisematta jääneet asiat
Ei avoimia paikallisen toteutuksen esteitä. Uutta julkaisua, fyysistä johdotusta tai ääntä ei ole varmennettu eikä niitä pyydetty tässä työssä.

### Toteutusvaltuutuksen tila ja peruste
Toteutettu käyttäjän yllä lainatulla pyynnöllä. Tämä pyyntö ei valtuuta commitia, pushia tai deployta. Aiempi julkaistu versio säilyy ennallaan.

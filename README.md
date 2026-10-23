# TyömaaTunnit v0.2A.1 — naatti21/Tuntiseuranta

**Tila 22.10.2026:** Supabase-projekti on perustettu Frankfurtin EU-alueelle, viisi taulua ja RLS-käyttöoikeudet asennettu, SQL-transaktioissa tehdyt valtuutus- ja hyväksyntätestit läpäisty, selaimen julkinen Supabase-yhteys asetettu `config.js`:ään. Todellisia Supabase Auth -testikäyttäjiä ei vielä ole ja GitHub Pagesin aktivointi on vahvistamatta. **Ei vielä tuotantoon, palkanlaskentaan tai viralliseksi työaikakirjanpidoksi.**

## Toiminnot

- Työntekijä kirjautuu henkilökohtaisella tunnuksella ja kirjaa omat tunnit työmaittain.
- Työnjohto näkee **pilotissa kaikki saman yrityksen työntekijät** ja voi kirjata heidän puolestaan, palauttaa sekä hyväksyä kirjauksia.
- Pääkäyttäjä voi lisätä, arkistoida ja palauttaa työmaita. Arkistointi ei koskaan poista aiempia tuntikirjauksia; uudet kirjaukset estetään arkistoiduille työmaille. Vanhoja, vielä korjattavia merkintöjä voi oikaista alkuperäiselle arkistoidulle työmaalle.
- Hyväksytty merkintä lukitaan. Korjaus ja hyväksyntä tallentuvat tietokannan muutoslokiin.
- Työnjohto voi viedä CSV-raportin näkyvistä kirjauksista. Näytetään enintään 1000 uusinta kirjausta; täydet raportit ja sivutus seuraavassa versiossa.
- Työmaan vaihto kesken päivän: tee toinen erillinen kirjaus. Päällekkäiset aikavälit hylätään palvelimella.
- Offline: sovelluksen kuori voi aueta välimuistista, mutta tuntien tallennus ja haku **eivät** toimi ilman verkkoa.

## Repo ja julkaisuosoite

1. Repo on jo luotu: https://github.com/naatti21/Tuntiseuranta.
2. Käytä tätä yhtä repoa. Älä tee toista; kirjainkoko kuuluu GitHub Pages -osoitteeseen.
3. Valitse **Public** vain, jos haluat GitHub Pagesin ilmaisella julkaisutavalla. *Public koskee koodia, ei Supabase-tietokannan sisältöä.* Jos haluat pitää koodin yksityisenä, tarkista oman GitHub-tilisi Pages-saatavuus ennen valintaa.
4. Sovellustiedostot sijoitetaan repon juureen.
5. Tiedostot voidaan julkaista suoraan GitHub-yhteyden kautta; seuraavat päivitykset tehdään vain muuttuneina tiedostoina.
6. Settings → Pages → Deploy from a branch → `main` → `(root)`.
7. Osoite Pages-julkaisun jälkeen: `https://naatti21.github.io/Tuntiseuranta/`. Yhteysasetukset on jo asennettu, joten kirjautumisnäkymän pitäisi avautua. Pages-julkaisua ei ole vielä vahvistettu.

## Käyttöönoton seuraavat vaiheet (vain tekaistut testihenkilöt)

**Valmistunut 22.10.2026:** Supabase Authissa luodut kaksi ensimmäistä testikäyttäjää on liitetty pilottiyritykseen: ensimmäinen `admin`, toinen `employee`. Molempien sähköposti ja salasana on vahvistettu. RLS-testissä työntekijä näki yhden jäsenyyden ja pääkäyttäjä kaksi. Varsinainen selainkirjautuminen sekä tuntien luonti on vielä testattava.



**Supabase-projektia, yritystä tai tietokantamigraatiota ei pidä perustaa tai ajaa toistamiseen. Ne ovat jo olemassa.**

- Supabase Dashboard: https://supabase.com/dashboard/project/cnctirhpaxtaxtegnscq
- Organisaatio: Naatti äpps; projekti: Tuntiseuranta; EU Frankfurt.
- Tietokannassa on väliaikainen yritys **Pilottiyritys (testi)** ja työmaa **Testityömaa (TEST-001)**. Näillä ei tarkoiteta oikeaa asiakas- tai työnantajayritystä.
- Supabase URL ja **julkinen** `sb_publishable_...`-avain on jo lisätty GitHubin `config.js`-tiedostoon. Salaisia avaimia ei saa tallentaa sinne.

1. Kytke GitHub Pages: repon Settings → Pages → Deploy from a branch → `main` / `(root)` → Save.
2. **Tehty:** ensimmäinen pääkäyttäjätunnus ja työntekijätunnus on luotu Authiin. Älä luo samoja tunnuksia uudestaan.
3. Luo myöhemmin ainakin toinen testitunnus eri osoitteelle työntekijäroolia varten; erillinen toinen hyväksyjä tarvitaan, jos työnjohto kirjaa myös toisten tunnit.
4. **Tehty:** jäsenyydet `public.memberships`-taulussa on luotu ja tarkistettu; roolit `admin` ja `employee`.
5. Jos käytät kutsulinkkejä tai salasanan palautusta, määritä Supabase Dashboard → Authentication → URL Configuration → **Site URL / Redirect URLs** osoitteeseen `https://naatti21.github.io/Tuntiseuranta/`. Osoite on kirjainkokoriippuvainen.
6. Testaa kirjautuminen ja kirjaaminen kahdessa eri selainprofiilissa tai puhelimessa. Tee testit vain tekaistuilla tiedoilla, kunnes testauslista sekä tietosuojan ja varmuuskopioinnin käytännöt on hyväksytty.

**Ei tehdä tässä vaiheessa:** oikeiden työntekijätietojen käsittelyä tai virallista työaikakirjanpitoa. Supabasen automaattinen turvallisuustarkistus ei löytänyt huomautuksia, mutta täydellinen selaimen käyttötapaustestaus on vielä tehtävä.

## Repon tiedostot

| Polku | Käyttö |
|---|---|
| `index.html` | Mobiilikäyttöliittymä |
| `styles.css` | Tyylit |
| `app.js` | Supabase-kirjautuminen ja kirjaukset |
| `config.js` | Projektin URL + JULKINEN publishable key (asetettu) |
| `manifest.webmanifest` | PWA-asetukset |
| `sw.js` | Vain staattisen sovelluskuoren välimuisti |
| `icons/*` | PWA-kuvakkeet |
| `supabase/migrations/20261022_001_pilot.sql` | Tietokanta, RLS ja suojatut toiminnot |
| `TESTAUS.md` | Pakollinen pilotin tarkistuslista |

## Päätetyt rajaukset

- **Yksi yritys**, useita työntekijöitä ja työmaita.
- Työntekijä näkee vain omat merkintänsä; työnjohto ja pääkäyttäjä näkevät kaikki yrityksen kirjaukset.
- Työnjohtaja saa kirjata toisen puolesta. `created_by` tallennetaan eikä sitä voi huomaamatta peittää.
- Omaa luomaansa kirjausta ei voi itse hyväksyä. Pilotissa tarvitaan vähintään **kaksi hyväksymiseen kykenevää henkilöä**, jos työnjohto tekee myös tuntikirjauksia.
- Vain palautettu `needs_changes`-kirjaus on tavallisen työntekijän muokattavissa. Hyväksyttyä ei voi korjata v0.2A:ssa.
- Ei GPS:ää, palkanlaskentaa, ylityölaskentaa, työaikakorvauksia, automaattista offline-synkronointia tai työmaakohtaisia työnjohtajaoikeuksia.
- Ei asiakas- tai yritysdataa ennen tietoturvatestien läpäisyä, palvelusopimusten tarkistamista, varmuuskopiosuunnitelmaa ja hyväksyntää.

## Tietoturvahuomiot

- Käyttöoikeus tarkistetaan SQL-funktioissa Auth-tunnuksesta ja aktiivisesta jäsenyydestä, ei selaimen pudotusvalikosta. RLS suojaa lukua. Suorien kirjoitusoperaatioiden oikeuksia ei anneta selaimelle.
- Tietokantafunktioiden `security definer` -runko on `private`-skeemassa, jota ei saa lisätä Supabasen *Exposed schemas* -listaan. Julkiset RPC:t ovat `security invoker` -kuoria.
- Audit-loki on normaalikäyttäjille vain luettava. Palauttaminen/korjaaminen tallentaa uuden tapahtuman.
- Julkisen koodin jakelu ei tarkoita julkisia tuntitietoja. Todellinen tietosuoja riippuu myös Supabase-projektin asetuksista, SQL:n testauksesta, käyttöoikeuksista ja hallinnollisista käytännöistä.
- Tietokantaa vasten on tehty palautettavan SQL-transaktion sisällä RLS-, kirjaus- ja hyväksyntätestit; oikean Supabase Auth -istunnon ja selaimen läpi tehtävä käyttäjätestaus on silti avoinna.

## Päivitysten julkaisu

Päivityksissä toimitetaan käyttäjälle **vain muuttuneet tiedostot** sekä niiden täsmälliset polut. Puhelimella hankalat `.js`-tiedostot pakataan tarvittaessa pieneksi ZIP-paketiksi. Ei sekoiteta Osakevahdin, Palkka Betan tai KuvaAkatemian tiedostoja samaan repoon.

## Pilotin käyttöönoton tila

- Sovelluksen Supabase-konfiguraatio on asennettu; kirjautuminen vaatii, että käyttäjät luodaan Authissa ja liitetään jäsenyyksiin.
- **GitHub Pages** pitää kytkeä erikseen päälle, jos se ei ole jo käytössä.
- Todellisia työntekijätietoja ei syötetä ennen käyttöoikeus- ja varmuuskopiointitestien läpäisyä.
- Aikojen lomake käyttää tällä hetkellä laitteen paikallista aikavyöhykettä; suomalaisessa pilotissa laitteiden tulee olla Europe/Helsinki-asetuksessa. DST-rajan tarkistus on vielä avoin.
## Päivitys v0.2A.1 – 22.10.2026

- Työmaan arkistointi ja palautus: **Työmaat** → **Arkistoi** / **Palauta käyttöön**.
- Kummankaan toiminnon ei pidä poistaa tuntikirjauksia, muutoslokia tai raporttihistoriaa.
- Tietokanta estää uudet kirjaukset arkistoidulle työmaalle; palautetun kirjauksen korjaus alkuperäiseen kohteeseen pysyy sallittuna.
- CSV-vientiä tai palkanlaskijan yhteenvetoa ei muutettu: muotoilu päätetään yhdessä yrityksen kanssa.

## v0.2A.2 – raporttinäkymä

Työnjohto ja pääkäyttäjä saavat **Raportit**-välilehden. Oletuksena kuluva kuukausi, mutta aikarajaus on vapaasti muutettavissa enintään 366 päivään. Suodattimet: työntekijä, työmaa (myös arkistoidut), hyväksyntätila. Yhteenvetotaulukossa tunnit työntekijä–työmaa-pareittain sekä erikseen hyväksytyt ja käsiteltävät tunnit. Päiväkohtainen taulukko ja väliaikainen yhteenveto-CSV ovat mukana. Raporttikysely hakee jakson rivit sivutettuna, ei rajoitu vanhan Työnjohto-näkymän 1000 viimeiseen. Raportin päivärajat tulkitaan Suomen ajassa. Näkymä ei vielä käsittele päivärahoja, kilometrejä eikä matka-aikaa. Nämä määritellään erikseen palkanlaskennan tarkennusten jälkeen. Supabaseen ei tehdä muutoksia raportointia varten.

## v0.2A.4 – Matka-aika oikeasti tallentuvana tietona (23.10.2026)

- Työaikakirjaukseen lisätty **Matka-ajat (valinnainen)** -osio, jossa meno- ja paluumatkalle erikseen lähtö- ja saapumispäivämäärät ja kellonajat. Kesto lasketaan automaattisesti.
- Sekä ennen työpäivää että sen jälkeen tehdyt matkat tallentuvat samaan tuntikirjaukseen omiin `timestamptz`-kenttiinsä. Jokainen matka voidaan jättää myös kokonaan tyhjäksi.
- Matka-aika **EI** kuulu kirjattuihin työtunteihin, eikä siitä automaattisesti johdeta korvaus- tai palkkaoikeutta.
- Yhdellä kirjausrivillä matkavälit eivät saa mennä keskenään tai varsinaisen työajan kanssa päällekkäin. Yön yli voi kirjata valitsemalla seuraavan päivän.
- Matka-ajat näkyvät omissa ja työnjohdon kirjauksissa, työmaittaisessa/työntekijäkohtaisessa raportissa sekä molemmissa CSV-vienneissä.
- Raportit-välilehdessä on **Tulosta / Tallenna PDF** -toiminto selaimen tulostusvalinnan kautta (ei vielä omaa serveripuolen PDF-generaattoria).
- Uudet `create_entry_with_travel` ja `update_entry_with_travel` RPC:t pitävät vanhat funktiot käytettävissä taaksepäin yhteensopivasti ja valvovat samoja jäsenyys-, muokkaus- ja historiarajoituksia kuin tuntikirjaus. Tietokantamuutos: `supabase/migrations/20261023_003_travel_time.sql`.
- Vanhoille kirjauksille matka-ajat jäävät tyhjiksi, eikä kolmen testikirjauksen työaikoja muuteta.

Matkustusajan työaika- ja korvauskohtelu, kilometrikorvaukset sekä päivärahat ovat edelleen erillisiä tulevia määrityksiä. Asiakkaan näkemys on kerättävä ennen palkkalaskentakäyttöä.

## v0.2A.5 – kevyt käytettävyysparannus (23.10.2026)

- Pääkäyttäjällä oletusnäkymänä **Hyväksynnät**; hänen oma Kirjaa- ja Omat tunnit -valikkonsa on piilotettu. Työnjohtajan rooli säilyy erillisenä ja voi edelleen kirjata.
- Vanhaa pääkäyttäjän omaa kokeilukirjausta ei muuteta eikä poisteta. Se piilotetaan työntekijöiden yhteenvedoista ja viennistä. Tarvittaessa mitätöinti suunnitellaan erikseen audit-lokin kanssa.
- Työntekijän kirjaus käyttää viimeksi valittua aktiivista työmaata, mikäli sellainen löytyy viimeisimmistä kirjauksista. Muuten ainoa aktiivinen työmaa esivalitaan. Palkattoman tauon valinta ja lisätiedot ovat valinnaisen avattavan osion takana.
- Mobiiliraportissa näytetään ensin selkeät työntekijä/työmaa-kohtaiset yhteenvetokortit, joiden työ- ja matka-ajat pysyvät erillisinä. Tarkat taulukot voi avata erikseen ja ne avataan PDF-tulostukseen.
- Värit vaihdettu hillittyyn siniharmaaseen, ei puhtaaseen valkoiseen sovellusnäkymään.
- Sovellusta ei ole testattu käyttäjän oikealla puhelimella. Mitään tietokanta- tai palveluasetuksia ei muutettu.


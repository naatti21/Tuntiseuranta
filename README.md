# TyömaaTunnit v0.2A — naatti21/Tuntiseuranta

**Tila 22.10.2026:** ensimmäinen asennus- ja testipaketti. Käyttöliittymä on staattinen PWA, tietokanta ja käyttöoikeudet Supabasessa. Tarvitsee oman Supabase-projektin ja käyttäjät ennen kuin voi kirjautua. **Ei vielä tuotantoon, palkanlaskentaan tai viralliseksi työaikakirjanpidoksi.**

## Toiminnot

- Työntekijä kirjautuu henkilökohtaisella tunnuksella ja kirjaa omat tunnit työmaittain.
- Työnjohto näkee **pilotissa kaikki saman yrityksen työntekijät** ja voi kirjata heidän puolestaan, palauttaa sekä hyväksyä kirjauksia.
- Pääkäyttäjä voi lisätä työmaita.
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
7. Osoitteesta `https://naatti21.github.io/Tuntiseuranta/` aukeaa aluksi **Yhteys puuttuu** -sivu. Se on oikein, kunnes Supabase-konfiguraatio on annettu.

## Ensimmäinen Supabase-käyttöönotto (vain testitiedot)

1. Luo Supabase-projekti, valitse EU-alue (esimerkiksi Frankfurt) ja säästä tietokannan salasana turvallisesti. Projektia ei voi määrittää vain lähdekoodin perusteella.
2. Avaa SQL Editor ja suorita `supabase/migrations/20261022_001_pilot.sql` **kerran uuteen tyhjään projektiin**. Älä aja sitä vanhan tuotantotietokannan päälle.
3. Luo yritys SQL Editorissa:

   ```sql
   insert into public.organizations(name) values ('Testiyritys Oy') returning id;
   ```

   Kopioi palautunut `organization_id` (UUID).
4. Luo kaksi testikäyttäjää **Authentication → Users → Add user → Send invitation**. Käytä testisähköposteja, joihin on oikea pääsy; jotta käyttäjä voi käyttää kirjautumissivua, hänen on asetettava salasana kutsulinkin kautta. Lisää `https://naatti21.github.io/Tuntiseuranta/` Supabase Auth → URL Configuration → Redirect URLs -sivulle ja halutessasi Site URL -arvoksi.
5. Katso käyttäjien UUID-tunnukset Authentication → Users -näkymästä. Liitä testikäyttäjät yritykseen SQL Editorissa (korvaa paikkamerkit oikeilla UUID-arvoilla):

   ```sql
   insert into public.memberships(organization_id, user_id, display_name, role)
   values
     ('YRITYKSEN_UUID', 'ADMIN_KAYTTAJAN_UUID', 'Testipääkäyttäjä', 'admin'),
     ('YRITYKSEN_UUID', 'TYONTEKIJAN_UUID', 'Testityöntekijä', 'employee');
   ```

   Lisää halutessasi kolmas `supervisor`-testikäyttäjä.
6. Avaa Supabase Project Settings → API Keys ja kopioi **Project URL** sekä **publishable key** tiedostoon `config.js` (`window.APP_CONFIG`). `config.js`:n julkinen avain on sallittu selaimessa **vain RLS-suojausten kanssa**. Älä koskaan lisää `secret`, `service_role` tai tietokannan salasanaa GitHubiin.
7. Korvaa GitHubissa vain `config.js`, jonka polku on repon juuressa. Päivitä PWA ja kirjaudu testeihin.
8. Työmaat-välilehdellä pääkäyttäjä luo yhden testityömaan. Kokeile työntekijän ja pääkäyttäjän tunnuksia **eri puhelimilla tai eri selainprofiileissa**.

Huomaa: ensimmäisen kutsulinkin käsittely riippuu Supabasen Auth-asetuksista. Testaa itse, että kutsu tuo käyttäjän sovellukseen ja että salasanan asetus onnistuu; tarvittaessa alkuvaiheen testikäyttäjät voidaan luoda Supabase Dashboardissa salasanoineen. Älä lähetä salasanoja tavallisina viesteinä.

## Repon tiedostot

| Polku | Käyttö |
|---|---|
| `index.html` | Mobiilikäyttöliittymä |
| `styles.css` | Tyylit |
| `app.js` | Supabase-kirjautuminen ja kirjaukset |
| `config.js` | URL + JULKINEN publishable key (täydennetään käyttöönotossa) |
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
- Koodin staattinen tarkistus tai mock-selaintesti **ei ole** Supabase RLS:n integraatiotesti.

## Päivitysten julkaisu

Päivityksissä toimitetaan käyttäjälle **vain muuttuneet tiedostot** sekä niiden täsmälliset polut. Puhelimella hankalat `.js`-tiedostot pakataan tarvittaessa pieneksi ZIP-paketiksi. Ei sekoiteta Osakevahdin, Palkka Betan tai KuvaAkatemian tiedostoja samaan repoon.

## Pilotin käyttöönoton tila

- Repon lähdekoodi voidaan julkaista ilman Supabase-tunnuksia, mutta sovelluksessa näkyy silloin **Yhteys puuttuu**.
- **GitHub Pages** pitää kytkeä erikseen päälle, jos se ei ole jo käytössä.
- Todellisia työntekijätietoja ei syötetä ennen käyttöoikeus- ja varmuuskopiointitestien läpäisyä.
- Aikojen lomake käyttää tällä hetkellä laitteen paikallista aikavyöhykettä; suomalaisessa pilotissa laitteiden tulee olla Europe/Helsinki-asetuksessa. DST-rajan tarkistus on vielä avoin.
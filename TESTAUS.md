# TyömaaTunnit v0.2A – pilotin hyväksymistestit

**Tila 22.10.2026:** tietokantaskeema asennettu, Supabasen Security Advisors: 0 turvallisuushuomautusta. SQL-transaktion sisällä läpäisty omien tuntien kirjaaminen, työnjohdon kirjaaminen, luvaton puolesta kirjaaminen, hyväksymiskielto, hyväksyminen toisella henkilöllä, päällekkäisyysesto, lokimerkinnät ja suorien taulupäivitysten esto. Testidatat peruttiin ROLLBACKilla. Alla olevat selaimen ja oikeiden Auth-istuntojen testit ovat edelleen tekemättä.

- [ ] Käytä vain tekaistuja nimiä ja tunteja ensimmäisissä testeissä.
- [ ] Työntekijä A voi luoda omat tunnit ja nähdä ne toisessa saman tunnuksen puhelimessa.
- [ ] Työntekijä A ei voi lukea työntekijä B:n tietueita edes muokatuilla REST-pyynnöillä.
- [ ] Työntekijä A ei voi kutsua `create_entry`-RPC:tä ja asettaa `p_employee_id`-arvoksi B:n tunnusta.
- [ ] Työnjohtaja voi luoda A:lle kirjauksen; `created_by` tallentuu työnjohtajaksi.
- [ ] Työnjohtajan luoma rivi näkyy työntekijälle A, ja toinen esimies voi hyväksyä sen.
- [ ] Työnjohtaja ei voi hyväksyä itse lisäämäänsä kirjausta.
- [ ] Kirjaukselle ei voi lisätä saman työntekijän päällekkäistä aikaväliä, myöskään kahdelta puhelimelta samaan aikaan.
- [ ] Sama työntekijä voi kirjata samana päivänä kaksi eri työmaata, kun aikavälit eivät mene päällekkäin.
- [ ] Työntekijä ei voi muokata suoraan jo lähetettyä eikä hyväksyttyä kirjausta.
- [ ] Palautus tarvitsee perustelun; palautetun kirjauksen korjaus säilyttää lokin ja palauttaa tilan `submitted`.
- [ ] Henkilön jäsenyyden `active=false` poistaa pääsyn tietoihin ilman että historia katoaa.
- [ ] `entry_events`-taulun tietueita ei voi muuttaa eikä poistaa normaalilla työntekijän/työnjohdon API-tunnuksella.
- [ ] `anon`-roolilla ei pysty lukemaan yrityksen tietoja eikä kutsumaan kirjaus-RPC:tä.
- [ ] Ajanjakso yli vuorokauden vaihteen, tauko sekä kesä-/talviajan vaihtuminen tarkistetaan erikseen.
- [ ] CSV-rivien summa vastaa tehtyjen merkintöjen tunteja (huomioi 1000 rivin rajaus).
- [ ] Uloskirjautuminen ja kirjautuminen toisen käyttäjän tunnuksella eivät näytä edellisen tietoja.
- [ ] Määrittele yrityksen tietosuoja-/rekisterinpitäjäkäytännöt, tallenteiden säilytys ja palautettava varmuuskopio ennen oikeaa käyttöä.

V0.2A on käytännön kokeilu, **ei työaikakirjanpidon tai tietosuojan vaatimustenmukaisuussertifiointi**.
## v0.2A.1 – työmaan arkistointi

- [x] SQL-transaktiotesti: pääkäyttäjän arkistointi ja palautus toimivat.
- [x] SQL-transaktiotesti: arkistointi ei poista vanhaa kirjausta.
- [x] SQL-transaktiotesti: uusi kirjaus arkistoidulle työmaalle estetään.
- [x] SQL-transaktiotesti: vanhan palautettavissa olevan kirjauksen korjaus onnistuu arkistoinnin jälkeen.
- [x] SQL-transaktiotesti: työntekijä ei voi palauttaa työmaata.
- [ ] Selaintesti: arkistointi näkyy pääkäyttäjän puhelimessa ja poistuu työntekijän uusien tuntien valikosta.
- [ ] Selaintesti: vanha työmaa näkyy edelleen olemassa olevissa kirjauksissa ja CSV:ssä.
- [ ] Selaintesti: palautus näkyy molemmille käyttäjille uuden latauksen jälkeen.

## Tietoturvan avoin asetus

- [ ] Supabase Auth: **Leaked Password Protection** on poissa käytöstä (Security Advisor, 22.10.2026). Ota se käyttöön ennen oikeiden henkilötietojen ja työaikakirjausten käsittelyä: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## v0.2A.2 – raportointi (selaintesti vielä tekemättä)

- [x] JavaScriptin syntaksitarkistus, raportin DOM-tunnisteiden eheys ja GitHubissa julkaistun tiedostoversion tarkistus.
- [x] Supabase-tuntikirjausten määrä sama päivityksen jälkeen (3 aiempaa testimerkintää).
- [ ] Pääkäyttäjän ja työnjohdon Raportit-välilehti näkyy ja aukeaa, työntekijälle ei näy.
- [ ] Alku- ja loppupäivä oletuksena kuluva kalenterikuukausi.
- [ ] Työntekijä-, työmaa- ja hyväksyntäsuodatus muuttavat näytetyt summat oikein.
- [ ] Arkistoitu työmaa on edelleen raporttien suodattimessa.
- [ ] Hyväksytyt ja käsiteltävät työtunnit eivät sekoitu.
- [ ] CSV aukeaa mobiilissa ja Excelissä oikeina sarakkeina.
- [ ] Palkanlaskija hyväksyy lopullisen kenttä- ja tiedostomuodon ennen tuotantokäyttöä.

## v0.2A.3 – palkalliset ruokatauot

- [x] Uuden kirjauksen oletus `break_minutes=0` ohjelman tarkistuksessa.
- [x] Valinnainen palkaton tauko -kytkin, käytössä 30 minuutin aloitusarvo.
- [x] Vanhan kirjausrivin taukominutit säilyvät muokkauslomakkeelle ladattaessa.
- [ ] Mobiilissa 07–15 = 8 h, kun palkaton tauko ei ole valittuna.
- [ ] Mobiilissa 07–15 = 7 h 30 min, kun vähennettävä palkaton tauko on 30 min.
- [ ] Aiemmat 30 minuutin vähennykset eivät muutu eikä niitä muuteta takautuvasti automaattisesti.
- [ ] Kirjauksen korjauksessa kytkin näkyy vanhojen arvojen mukaan.

## v0.2A.4 – Matka-ajan tallennus ja raportointi

- [x] Supabase-transaktiotesti: 1 h menomatka, 1 h 30 min paluumatka tallentuvat oikein, rollback.
- [x] Tietokantatesti: työnjohto voi korjata matka-aikaa ja muutokset näkyvät audit-lokissa, rollback.
- [x] Tietokantatesti: työntekijä ei voi muokata hyväksymätöntä lähetettyä tuntiriviä eikä kirjata toisen tunteja.
- [x] Tietokanta estää työajan päälle menevät matka-ajat, osittaiset aikavälit ja matkojen keskinäisen päällekkäisyyden.
- [x] JavaScriptin laskentatestit: tyhjä matka 0, meno 60 + paluu 90 = 150 minuuttia, puuttuva aika estetään, päällekkäisyys estetään, yömatka toimii.
- [x] GitHub-tiedostojen JavaScript-syntaksi ja HTML-elementtien tunnisteet tarkistettu; 3 aiempaa kirjausta säilyi, matka-ajat NULL.
- [ ] Mobiilikoe: työntekijän tuntikirjaus, menomatka ja paluumatka tallentuvat.
- [ ] Mobiilikoe: vanhaa kirjausta muokattaessa matka-ajat näkyvät ja muutos onnistuu työnjohtoroolilla.
- [ ] Mobiilikoe: tuntiyhteenveto ja matka-aika näkyvät erillisinä myös arkistoidulla työmaalla.
- [ ] Mobiilikoe: päivärajojen, yömatkan ja aikavyöhykkeen oikeellisuus.
- [ ] Mobiilikoe: yhteenveto-CSV ja selaimen PDF-tulostus toimivat.
- [ ] Palkanlaskijan hyväksyntä lopulliselle PDF-asettelulle, matkustusajan luokitukselle ja korvauksille.

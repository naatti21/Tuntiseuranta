# TyömaaTunnit v0.2A – pilotin hyväksymistestit

**Tila:** Suunniteltu, ei vielä ajettu oikeaa Supabasea vasten.

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
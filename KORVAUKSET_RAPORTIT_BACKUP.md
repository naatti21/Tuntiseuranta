# Tuntiseuranta – v0.2A.2 jälkeen sovitut jatkokehitystarpeet

Päivitetty 23.10.2026. Tämä dokumentti erottaa **tehdyt toteutukset** ja **vielä avoimet määrittelyt**. Sovellusta ei ole hyväksytty viralliseen työaikakirjanpitoon.

## Valmis toteutus

- PWA GitHub Pagesissa, kirjautuminen ja Supabase-yhteys
- Työntekijän ja pääkäyttäjän kirjaukset; jäljitettävä hyväksyntä
- Työmaiden turvallinen arkistointi ja palautus historiatietoja menettämättä
- **Raportit**-välilehti työnjohdolle (v0.2A.2): kuluva kuukausi oletuksena, vapaasti säädettävät alku- ja loppupäivät (enintään 366 päivää), työntekijä-, työmaa- ja tilasuodattimet
- Raportti erottaa kaikki, hyväksytyt ja käsiteltävät tunnit; työmaittainen ja työntekijäkohtainen ryhmittely, päiväkohtaiset rivit
- Väliaikainen yhteenveto-CSV sekä vanha tuntikirjausten CSV (lopullista tiedostomuotoa ei ole sovittu)

## Kirjattavaksi halutut lisätiedot – vielä suunnitteilla

1. **Päivärahat:** ehdotettu tieto on korvausvaatimuksen tyyppi (ei / osapäivä / kokopäivä; ulkomaanmatkat ja ateriakorvaus erikseen tarpeen mukaan), määrä, peruste, tarvittaessa matkan kesto, kohde ja maksuttomat ateriat. **Ei automaattista verovapauden eikä euromäärän päätelmää.**
2. **Kilometrit:** matkakilometrit, ajoneuvotyyppi, tarkoitus / matkan reitti, työmaa, korvattavat kilometrit ja hyväksyntä. Erota omalla autolla tehdyt työkilometrit tavallisesta työmatkasta.
3. **Matka-aika:** kirjataan minuutteina tai alku–loppu, mutta **ei lasketa automaattisesti tehtyihin työtunteihin**. Palkallisuus/työaikaluokitus ratkaistaan työnantajan käytännön ja sovellettavan TES:n mukaisesti.
4. **Duplikaattien välttäminen:** sama työntekijä voi tehdä päivän aikana kirjauksia usealle työmaalle. Päivärahaa ei siksi saa kerryttää joka tuntikirjaukselta suoraan; suunnitellaan erillinen matkalasku-/korvausrivi, joka voidaan kohdistaa päivään ja tarvittaessa työmaahan.
5. **Hyväksyntä, korjaukset ja loki:** korvauksille samantasoinen jäljitettävyys ja oikeustarkistus kuin työtunneille.

**Toteutusta ei aloiteta ennen seuraavien määrittelyä:** kirjaako päivärahatyyppiä työntekijä vai hyväksyykö työnjohto? Kilometrit vai korvauseurot? Matka-aika korvauksena vai palkallisena työaikana? Tarvitaanko ajo- ja kohdetiedot? Sovellettava työehtosopimus? Usean päivän työmatkat?

Tausta: https://vero.fi/henkiloasiakkaat/vahennykset/kilometrikorvaus-ja-paivaraha/ ja https://www.finlex.fi/fi/lainsaadanto/saadoskokoelma/2019/872

## Raportoinnin jatkotarkennukset

- Oletusjakso **kalenterikuukausi**, mahdollisuus valita alkamis- ja päättymispäivä.
- Työnjohto: työntekijä / työmaa / tila; hyväksytyt erotetaan käsittelemättömistä.
- Yrityksen ja palkanlaskijan kanssa sovittava kenttien järjestys, hyväksyntästatus ja tiedostomuoto: selailtava näkymä, PDF, XLSX tai CSV.
- Väliaikainen CSV ei ole laskentakelpoinen palkanlaskennan peruste ennen sovittujen lisäkenttien ja validointien valmistumista.
- Nykyinen raportti kohdistaa merkinnän **aloituspäivään Suomen ajassa**. Palkkajaksojen rajan ylittävät yövuorot tarvitsevat erikseen päätöksen tuntien jaosta.

## Tallennus ja varmuuskopiointi – ehdotus

- **Ensisijainen tietolähde:** Supabase PostgreSQL Frankfurtin EU-alueella. Se on pilvitallennus, ei paikallinen tietokanta.
- **Ei pakollista raakadatavientiä jokaisen työntekijän puhelimelle.** Muuten henkilötietoja leviää turhaan useisiin laitteisiin, jotka voivat kadota tai rikkoutua.
- **Pakollinen yritystason palautettava, salattu varmuuskopio toiseen säilytyspaikkaan ennen oikeaa käyttöä.** Valvottu ajastus, ajantasaisuuden kuittaus, rajatut käyttöoikeudet, säilytysaika ja palautuksen koeajo.
- Supabase Free Plan -tason varmuuskopioita ei tule olettaa automaattisiksi; Supabasen ohje suosittelee Free-tasolla tietokannan säännöllistä vientiä ulkoiseen tallennukseen: https://supabase.com/docs/guides/platform/backups
- **Vapaaehtoinen paikallinen vienti** pääkäyttäjälle voi olla lisävarokeino, mutta sen pitää olla salattu ja selvästi merkitty; tavallinen CSV ei korvaa täyttä tietokannan palautusvarmuuskopiota.
- **Oma pilvi (esimerkiksi yrityksen Google Drive)** voi olla toissijainen salattujen backupien säilytyspaikka; ei korvaa Supabasen live-tietokantaa, eikä edellytä henkilökohtaisten Google-tilien yhdistämistä työntekijöille.
- Jos verkkokatkosten aikaiset kirjaukset tulevat tarpeellisiksi, toteutetaan erillinen **paikallinen luonnosjono + synkronointi + konfliktien hallinta**. Sitä ei pidä sekoittaa varmuuskopiointiin.
- Määrittele säilytysajat, sopimukset ja rekisterinpitäjän vastuut ennen oikeita henkilötietoja.

## Testattavat ennen käyttöönottoa

- Oikea kahden käyttäjän mobiilitestaus myös raportin osalta.
- Taustasynkronoinnin väittämiä ei anneta suljetulle PWA:lle.
- Päivärahojen, kilometrien ja matka-ajan ehdot sekä hyväksyntäsäännöt.
- Yli yön ja kesä-/talviajan vaihtuvan työvuoron käsittely.
- Tiedostovientien toimivuus suomalaisessa Excelissä ja mobiilissa.
- Palautettavan salatun varmuuskopion koeajo.
- Supabasen vuotaneiden salasanojen suojaus ja muut tietoturva-asetukset.

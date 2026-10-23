# Tuntiseuranta – v0.2A.2 jälkeen sovitut jatkokehitystarpeet

Päivitetty 23.10.2026. Tämä dokumentti erottaa **tehdyt toteutukset**, **käyttäjän vahvistamat vaatimukset** ja **vielä avoimet määrittelyt**. Sovellusta ei ole hyväksytty viralliseen työaikakirjanpitoon.

## Valmis toteutus

- PWA GitHub Pagesissa, kirjautuminen ja Supabase-yhteys
- Työntekijän ja pääkäyttäjän kirjaukset; jäljitettävä hyväksyntä
- Työmaiden turvallinen arkistointi ja palautus historiatietoja menettämättä
- **Raportit**-välilehti työnjohdolle (v0.2A.2): kuluva kuukausi oletuksena, vapaasti säädettävät alku- ja loppupäivät (enintään 366 päivää), työntekijä-, työmaa- ja tilasuodattimet
- Raportti erottaa kaikki, hyväksytyt ja käsiteltävät tunnit; työmaittainen ja työntekijäkohtainen ryhmittely, päiväkohtaiset rivit
- Väliaikainen yhteenveto-CSV sekä vanha tuntikirjausten CSV (lopullista tiedostomuotoa ei ole sovittu)

## Kirjattavaksi halutut lisätiedot – vielä suunnitteilla

1. **Päivärahat (päätetty työnkulku):** työntekijä voi kirjata itse korvausvaatimuksen, ja työnjohto saa tarvittaessa muokata sekä hyväksyä sen. Ehdotettu tieto on tyyppi (ei / osapäivä / kokopäivä; ulkomaanmatkat ja ateriakorvaus erikseen tarpeen mukaan), määrä, peruste, matkan kesto, kohde ja tarvittaessa maksuttomat ateriat. Muutoksista jää tekijän, ajan, ennen/jälkeen-arvojen ja syyn sisältävä loki. **Ei automaattista verovapauden eikä euromäärän päätelmää.**
2. **Kilometrit:** matkakilometrit, ajoneuvotyyppi, tarkoitus / matkan reitti, työmaa, korvattavat kilometrit ja hyväksyntä. Erota omalla autolla tehdyt työkilometrit tavallisesta työmatkasta.
3. **Matka-aika (23.10.2026 vahvistettu):** kirjataan lähtö- ja saapumiskellonaikoina, joiden välinen kesto lasketaan automaattisesti. Tarvittaessa meno- ja paluumatka erillisinä jaksoina, jotta työssäolotunnit eivät tule matkustusajaksi. Matka-aika näytetään raportissa erillään työtunneista. Palkallisuus/työaikaluokitus ratkaistaan yrityksen käytännön ja sovellettavan TES:n mukaan. Ei vielä toteutettu tietokantaan tai lomakkeeseen.
4. **Duplikaattien välttäminen:** sama työntekijä voi tehdä päivän aikana kirjauksia usealle työmaalle. Päivärahaa ei siksi saa kerryttää joka tuntikirjaukselta suoraan; suunnitellaan erillinen matkalasku-/korvausrivi, joka voidaan kohdistaa päivään ja tarvittaessa työmaahan.
5. **Hyväksyntä, korjaukset ja loki:** korvauksille samantasoinen jäljitettävyys ja oikeustarkistus kuin työtunneille.

**Avoimet määrittelyt ennen korvaustoiminnon toteutusta:** kilometrit vai korvauseurot, työnjohdon tarkat muokkaus- ja hyväksyntäsäännöt, matka-ajan käsittely korvauksena ja/tai työaikana, ajo- ja kohdetiedot, sovellettava työehtosopimus sekä usean päivän työmatkat. Päivärahojen oma kirjausoikeus ja työnjohdon muokkausoikeus on päätetty.

Tausta: https://vero.fi/henkiloasiakkaat/vahennykset/kilometrikorvaus-ja-paivaraha/ ja https://www.finlex.fi/fi/lainsaadanto/saadoskokoelma/2019/872

## Raportoinnin jatkotarkennukset

- Oletusjakso **kalenterikuukausi**, mahdollisuus valita alkamis- ja päättymispäivä.
- Työnjohto: työntekijä / työmaa / tila; hyväksytyt erotetaan käsittelemättömistä.
- **Päätetty:** ensisijainen ladattava/tulostettava raporttiformaatti on PDF. Excel (XLSX) on hyödyllinen lisä. Selailtava raporttinäkymä säilyy. Yrityksen ja palkanlaskijan kanssa sovitaan kenttien järjestys, sarakkeet, yhteenvetojen ryhmittely sekä hyväksyntästatus. CSV on väliaikainen vientimuoto.
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

## 23.10.2026: suunta kaupalliseksi ylläpidetyksi palveluksi

**Käyttäjän tavoite:** myydä Tuntiseuranta-palvelua, tarjota itse asiakastuki ja pilvitallennus. Tämä on kaupallinen tavoite, ei vielä valmis myynti- tai tietosuojaratkaisu. Nykyinen yksi yritys -pilotti pidetään erillään muista sovelluksista.

### Vahvistetut päätökset
- Työntekijä merkitsee päivärahat itse; työnjohdolla on muokkausoikeus. Kaikki muokkaukset on lokitettava.
- PDF on raportoinnin pääasiallinen tiedostomuoto; XLSX myöhemmin lisäarvona.
- Palveluntarjoaja huolehtii hostingista, varmuuskopioista, ylläpidosta ja erikseen sovitusta tuesta.

### Ehdotettu eteneminen (ei vielä toteutettu)
1. **Yksi hallittu maksava pilotti:** ensimmäiselle asiakkaalle erillinen Supabase-projekti EU-alueella. Testiyritystä ja sen dataa ei korvata asiakkaan aineistolla ilman käyttöoikeus-, tietosuoja-, backup- ja palautustestejä.
2. **Tuotantotaso:** Supabase Pro tai muu jatkuvan ylläpidon ja palautustavoitteen täyttävä maksullinen ratkaisu; Free-taso ei sovellu luvattuun jatkuvaan palveluun, koska projekti voi tauota eikä Free-sopimukseen kuulu käytettävä automaattinen palautusvarmuuskopio.
3. **Valvottu varmuuskopio erilliseen palveluntarjoajan hallinnoimaan EU-tallennukseen:** salaus, käyttöoikeuserottelu, kuittaus, hälytys, säilytysaika, palautustesti ja kirjallinen toimintaohje. CSV/PDF-export ei ole tietokannan palautuskelpoinen varmuuskopio. Työntekijöiden henkilökohtaisia Google Drive -tilejä ei vaadita.
4. **Sopimukset ja asiakkuuden lopetus:** työnantaja on tavallisesti henkilöstön työaikatietojen rekisterinpitäjä ja palveluntarjoaja käsittelijä. Tarvitaan palvelusopimus ja GDPR 28 artiklan mukainen käsittelysopimus, alikäsittelijäluettelo, tukikanava, häiriöviestintä, tiedon viennin/poiston prosessi sekä vastuut ja säilytysajat.
5. **Kasvu:** nykyinen tietokanta sisältää yrityserottelukenttiä, mutta sen nykyinen käyttöoikeuslogiikka ja tiedon palautus on tehty yhden yrityksen pilotiksi. Usean yrityksen yhteinen tietokanta vaatii erikseen toteutetun ja testatun tenant-eristyksen, ylläpitotyökalut, laskutuksen, käytönvalvonnan ja palautuksen. Älä lisää toista asiakasta samaan pilottitietokantaan vielä.
6. **Hinnoittelu:** erikseen päätettävä B2B-jatkuva maksu, joka kattaa palvelinkulut, backupin, valvonnan, päivitykset, asiakastuen ja kohtuullisen katteen. Ei luvata 24/7-tukea ilman valmiutta.

### Lähteet / myöhemmin tarkistettavat ehdot
- Supabase hinnasto: https://supabase.com/pricing
- Supabase varmuuskopiot: https://supabase.com/docs/guides/platform/backups
- Supabase tuotantotarkistuslista: https://supabase.com/docs/guides/deployment/going-into-prod
- EU GDPR, artikla 28: https://eur-lex.europa.eu/eli/reg/2016/679/oj

## v0.2A.3 – ruokataukokäytäntö 23.10.2026

**Päätetty:** käyttäjän pilottiyrityksessä ruokatauko on palkallinen, joten oletuksena työajasta ei vähennetä taukoa. Kirjauslomakkeessa on valinnainen **Vähennä palkaton tauko** -kytkin, joka on aluksi pois päältä. Kun kytkin otetaan käyttöön, vähennettävät minuutit voidaan asettaa. Taustalla säilyy alkuperäinen `break_minutes`-kenttä; uusi normaali kirjaus tallentaa `0`, ellei vähennys ole päällä. Vanhat kirjaukset **eivät muutu automaattisesti**, vaan aiemmat vähennykset jäävät talteen. Myyntituotteessa käytäntö on tehtävä yrityskohtaisesti määriteltäväksi.

**Matka-aika:** hyväksytty kellonaikaväli ja automaattinen keston laskenta. Toteutus myöhemmin, turvallisena erillisenä tietona; ei automaattisesti palkallista työaikaa.

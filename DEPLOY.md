# Julkaisu: naatti21/Tuntiseuranta

1. Sovelluksen lähdetiedostot ovat jo GitHub-repon `main`-haarassa. Älä lataa niitä toiseen repoon.
2. GitHub → Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save.
3. Julkinen sovellusosoite on **https://naatti21.github.io/Tuntiseuranta/** (iso T).
4. Supabase-yhteys ja julkinen avain on jo asetettu `config.js`-tiedostoon. Oikein julkaistu sovellus näyttää kirjautumisnäkymän.
5. SQL-migraatio, pilottiyritys ja testityömaa on jo luotu. Älä aja migraatiota tai yrityksen luontia uudestaan. Luo Auth-testitunnukset ja tee jäsenyysliitokset README.md:n mukaan.

**Tietoturva:** Älä vie Supabase secret-, service_role-avainta, tietokannan salasanaa tai henkilötietoja repoosi, vaikka se olisi yksityinen.

**TyömaaTunnit ei ole vielä tuotantokelpoinen työaikakirjanpito.**
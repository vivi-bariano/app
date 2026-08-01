# Vivi Bariano — app

PWA (sito web installabile, no App Store) per la newsletter "Vivi Bariano" —
Lista Civica di Maggioranza del Comune di Bariano. Mostra gli ultimi
articoli pubblicati su Substack, il calendario eventi del paese e una
pagina di link utili.

Questo repository è pubblico apposta: contiene solo il sito, così
GitHub Pages può pubblicarlo gratuitamente.

## Struttura

```
site/
  index.html, eventi.html, link-utili.html   pagine
  css/style.css                              stile
  js/app.js                                  rendering dati + logica PWA
  sw.js                                       service worker (offline + installabilità)
  manifest.webmanifest                        manifest PWA (nome, icona, colori)
  icons/icon.svg                              icona segnaposto — sostituiscila con il vero logo
  data/config.json                            indirizzo feed RSS Substack
  data/articles.json                          articoli (generato automaticamente, non modificarlo a mano)
  data/events.json                            eventi del paese (modifica qui)
  data/links.json                             link utili (modifica qui)
scripts/fetch-articles.mjs                    script che scarica il feed Substack e aggiorna articles.json
.github/workflows/update-articles.yml         esegue lo script ogni 6 ore
.github/workflows/deploy-pages.yml            pubblica site/ su GitHub Pages
```

## Verifica l'indirizzo Substack

In questo ambiente non ho potuto raggiungere substack.com per verificare
l'indirizzo esatto del feed RSS della pubblicazione. Ho impostato
`site/data/config.json` con il valore più probabile:

```json
"substackFeedUrl": "https://vivibariano.substack.com/feed"
```

Controlla che sia corretto aprendo quell'indirizzo nel browser: deve
mostrare del testo XML (non un errore 404). Se la tua pubblicazione usa un
dominio diverso (es. un dominio personalizzato collegato a Substack),
correggi il valore in quel file (lo script lo legge da lì, quindi basta
modificare il file di config).

## Modificare gli eventi

Apri `site/data/events.json` e modifica l'elenco. Ogni evento ha questa forma:

```json
{
  "title": "Festa di paese",
  "date": "2026-08-15",
  "time": "18:00",
  "location": "Piazza principale, Bariano",
  "description": "Descrizione breve (facoltativa)"
}
```

`date` deve essere in formato `AAAA-MM-GG`. Gli eventi con data futura
appaiono in "prossimi eventi", quelli passati in "eventi passati". Ho
lasciato due eventi di esempio (etichettati `[Esempio]`): sostituiscili o
eliminali.

## Modificare i link utili

Apri `site/data/links.json`, stessa logica:

```json
{
  "label": "Farmacia comunale",
  "url": "https://...",
  "description": "Orari e contatti"
}
```

Ho lasciato una voce segnaposto per il sito del Comune (etichettata
`[Da verificare]`): inserisci l'URL corretto.

## Aggiornamento automatico degli articoli

`scripts/fetch-articles.mjs` scarica il feed RSS e riscrive
`site/data/articles.json`. Il workflow `update-articles.yml` lo esegue
ogni 6 ore e fa commit automatico se ci sono nuovi articoli. Puoi anche
lanciarlo manualmente da GitHub: scheda **Actions** →
**Aggiorna articoli da Substack** → **Run workflow**.

## Pubblicare il sito (GitHub Pages)

1. Nelle impostazioni del repository: **Settings → Pages → Build and
   deployment → Source: GitHub Actions** (il repository è pubblico, quindi
   Pages è gratuito e disponibile subito).
2. Al primo push su `main`, il workflow `deploy-pages.yml` pubblica il sito
   automaticamente. Puoi anche avviarlo a mano da
   **Actions → Pubblica su GitHub Pages → Run workflow**.
3. L'indirizzo pubblico sarà del tipo
   `https://luigigastoldi-jpg.github.io/vivi-bariano-app/`. Se vuoi un
   dominio tuo (es. `www.vivibariano.it`), configuralo in
   **Settings → Pages → Custom domain**.

## Provare in locale

Serve un piccolo server HTTP (aprire `index.html` direttamente da file non
funziona, perché il caricamento dei file `data/*.json` viene bloccato dal
browser). Dalla cartella `site/`:

```bash
npx serve .
# oppure
python3 -m http.server 8000
```

Poi apri l'indirizzo indicato nel terminale (es. `http://localhost:8000`).

## Logo

`site/icons/icon.svg` è un'icona segnaposto (cerchio verde con "VB").
Sostituiscila con il logo vero di Vivi Bariano quando lo avrai, mantenendo
lo stesso nome file oppure aggiornando i riferimenti in
`manifest.webmanifest` e negli `<head>` delle pagine HTML.

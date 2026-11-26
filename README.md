# Asso è… La Strada ci Insegna ODV

Sito dell’associazione **Asso è… La Strada ci Insegna ODV**, dedicato a iniziative sociali, volontariato, eventi e racconti, con informazioni per associarsi e sostenere le attività.

Il frontend usa [Astro](https://astro.build/) e TypeScript; i contenuti sono gestiti con [Sanity](https://www.sanity.io/). Il repository comprende sia il sito sia lo Studio editoriale.

## Come funziona

Astro genera pagine statiche usando i contenuti pubblicati su Sanity. Le bozze restano escluse e il browser dei visitatori non interroga il CMS.

**Pubblicare un contenuto su Sanity e aggiornare il sito sono due operazioni distinte:** per rendere visibili le modifiche serve una nuova build. Lo Studio viene distribuito separatamente dal sito.

## Avvio locale

Servono **Node.js 24**, npm, l’identificativo del progetto Sanity e il nome del dataset. Sito e Studio hanno dipendenze e configurazioni separate.

Dalla radice del repository, installare entrambe le dipendenze:

```bash
npm ci
npm ci --prefix studio
```

Alla prima configurazione, creare i file di ambiente dagli esempi. Conservare quelli già esistenti:

```bash
cp .env.example .env
cp studio/.env.example studio/.env
```

Compilare le variabili nei rispettivi file:

| File | Variabili |
| --- | --- |
| `.env` | `PUBLIC_SANITY_PROJECT_ID`, `PUBLIC_SANITY_DATASET` |
| `studio/.env` | `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET` |

Il dataset predefinito è `production`. Per lavorare sugli stessi contenuti, sito e Studio devono usare lo stesso progetto e dataset.

Avviare il sito su `http://localhost:4322/`:

```bash
npm run dev
```

In un altro terminale, avviare lo Studio:

```bash
npm --prefix studio run dev
```

Lo Studio mostra nel terminale il proprio indirizzo locale. Le modifiche pubblicate anche dallo Studio locale aggiornano il dataset configurato: usare un dataset separato per le prove. Non modificare o cancellare contenuti di produzione per risolvere errori di build senza verificarne prima tipo, stato e dataset.

I file `.env` sono esclusi da Git. Non inserire token, credenziali o dati riservati nel repository o nelle variabili esposte al browser.

## Struttura

| Percorso | Contenuto |
| --- | --- |
| `src/pages/`, `src/layouts/` | Percorsi e struttura delle pagine |
| `src/components/`, `src/styles/` | Interfaccia e stili |
| `src/content/` | Modello dei contenuti e letture da Sanity |
| `src/config/`, `src/utils/`, `shared/` | Configurazione e funzioni di supporto |
| `studio/` | Schemi e interfaccia dello Studio Sanity |
| `scripts/`, `tests/` | Build, verifiche e test automatici |

Le pagine dipendono dal contratto in [src/content/types.ts](src/content/types.ts); query, validazione e mapping del CMS sono in [src/content/providers/](src/content/providers/). Le modifiche al modello devono mantenere coerenti schemi Studio, query, mapper e test.

## Gestione dei contenuti

Lo Studio gestisce informazioni dell’associazione, homepage e avvisi, iniziative nei due ambiti **Iniziative sociali** e **Volontariato**, articoli, eventi e persone. Articoli ed eventi possono essere collegati alle iniziative; gli articoli possono raccontare un evento.

L’ordine delle iniziative e delle sezioni della homepage è editoriale. La configurazione istituzionale delle iniziative è affidata a Danilo ed è accessibile dal menu secondario delle schede.

Per gli articoli si inserisce lo slug breve: il sito aggiunge la data all’URL quando disponibile. Cambiare data o slug può cambiare l’indirizzo pubblico; preservare i vecchi collegamenti attraverso gli alias previsti dal modello.

Per le immagini, escluso il logo, preferire JPG o WebP, circa 2000 px sul lato lungo e massimo 5 MB. Astro le ottimizza durante la build; gli originali restano su Sanity. Verificare diritti sulle immagini, consenso necessario per le foto e correttezza dei documenti prima di pubblicarli.

## Verifiche e build

I comandi seguenti si eseguono dalla radice. Anche i test richiedono le dipendenze dello Studio installate.

| Comando | Funzione |
| --- | --- |
| `npm run check` | Controlla tipi e componenti Astro |
| `npm test` | Esegue i test automatici |
| `npm run test:coverage` | Verifica copertura e soglie configurate |
| `npm run build` | Genera il sito statico in `dist/` |
| `npm run check:build` | Controlla HTML, collegamenti e struttura dell’ultima build |
| `npm run preview` | Serve la build su `http://localhost:4323/` |
| `npm audit --omit=dev --audit-level=high` | Verifica le dipendenze del sito |
| `npm run quality:report` | Raccoglie verifiche e report di sito e Studio |

La build richiede configurazione Sanity valida e accesso alla rete per contenuti e immagini. La preview legge `dist/` e cambia soltanto dopo una nuova build; per lo sviluppo usare `npm run dev`.

Per verificare lo Studio:

```bash
npm --prefix studio run build
npm --prefix studio run audit:high
```

I test usano `node:test`. La copertura richiede almeno il 95% delle righe, il 90% dei rami e il 100% delle funzioni nel [perimetro configurato](scripts/coverage-scope.mjs); componenti Astro e CSS sono esclusi da questa misura.

Il report locale si apre da `quality-reports/local/report.html`. La CI [Quality checks](.github/workflows/ci.yml) esegue i controlli e conserva report scaricabili. La scansione SonarQube Cloud è facoltativa e richiede configurazione esterna; il suo esito è distinto dai controlli obbligatori.

## Pubblicazione

`develop` raccoglie le modifiche da verificare; `main` è il ramo di pubblicazione. Completare i controlli prima di integrare su `main`, poi sincronizzare `develop`.

Il workflow [Publish Astro to GitHub Pages](.github/workflows/pages.yml) legge `main`, genera il sito e lo pubblica su push, avvio manuale o pianificazione quotidiana. Usa le variabili Actions `PUBLIC_SANITY_PROJECT_ID` e `PUBLIC_SANITY_DATASET`, con `production` come dataset predefinito. La build quotidiana aggiorna anche la distinzione fra eventi futuri e passati.

La configurazione attuale pubblica un’anteprima GitHub Pages sotto il percorso del repository, con `noindex,nofollow`. Il dominio personalizzato richiede configurazione DNS e aggiornamento di `SITE_URL`, `SITE_BASE` e `PUBLIC_SITE_PREVIEW` nel workflow. Gli indirizzi dipendono anche da [astro.config.mjs](astro.config.mjs).

Per distribuire lo Studio, da una sessione autenticata a Sanity:

```bash
npm --prefix studio run deploy
```

Le modifiche agli schemi o all’interfaccia editoriale richiedono questo deploy. Per aggiornare i contenuti del sito, pubblicarli in Sanity e verificare che una successiva build Pages termini correttamente. In caso di errore, consultare i log e ripetere il workflow dopo aver risolto il problema.

## File tecnici e privacy

La build genera `robots.txt` e una sitemap delle pagine indicizzabili, escludendo redirect e 404. Nell’anteprima la sitemap resta vuota. Le pagine includono canonical, descrizioni e Open Graph; gli indirizzi inesistenti riportano automaticamente alla home.

La pagina `/privacy/`, `humans.txt` e `/.well-known/security.txt` usano i dati dell’associazione pubblicati in Sanity. La scadenza di security viene rinnovata a 180 giorni dalla build. Dati obbligatori mancanti o recapiti non validi interrompono la generazione. Per la discovery standard, robots e security devono essere serviti alla radice del dominio.

Il sito non introduce cookie, tracker, embed o font remoti. Prima della pubblicazione definitiva verificare l’informativa con il titolare, in particolare posta, conservazione e trasferimenti dei dati. La data di revisione dei testi privacy resta esplicita.

## Diritti e licenze

Il codice e la documentazione originali, il nome, i loghi e i contenuti dell’associazione sono di titolarità di **Asso è… La Strada ci Insegna ODV**, con tutti i diritti riservati: vedere [LICENSE](LICENSE).

I componenti di terze parti mantengono le rispettive licenze. Gli avvisi sono descritti in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) e inclusi nelle build di sito e Studio.

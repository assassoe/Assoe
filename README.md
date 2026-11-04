# Asso è… La Strada ci Insegna ODV

Sito web statico dell’associazione, sviluppato con [Astro](https://astro.build/) e alimentato dai contenuti pubblicati su [Sanity](https://www.sanity.io/).

Astro genera tutte le pagine durante la build. Sanity conserva e gestisce i contenuti; non viene interrogato dal browser del visitatore. Il sito pubblico mostra quindi solo i documenti pubblicati al momento dell’ultima build.

## Requisiti

- Node.js 24
- npm
- accesso al progetto Sanity per lavorare sui contenuti o sullo Studio

Il progetto frontend e lo Studio Sanity hanno dipendenze e installazioni separate.

## Avvio del sito in locale

Dalla radice del repository:

```bash
cp .env.example .env
npm ci
npm run dev
```

Nel file `.env` impostare almeno:

```dotenv
PUBLIC_SANITY_PROJECT_ID=...
PUBLIC_SANITY_DATASET=production
```

Il server locale usa i contenuti pubblicati del dataset configurato. Le modifiche al codice fatte su `develop` non modificano il sito online; le modifiche pubblicate in Sanity, invece, appartengono allo stesso dataset usato dalla build pubblica.

Per verificare localmente il percorso usato da GitHub Pages:

```bash
SITE_URL=https://bickpenna.github.io SITE_BASE=/Assoe/ npm run build
SITE_BASE=/Assoe/ npm run check:build
```

## Avvio dello Studio Sanity

In un terminale separato:

```bash
cd studio
cp .env.example .env
npm ci
npm run dev
```

Configurare `studio/.env` con gli stessi valori del frontend:

```dotenv
SANITY_STUDIO_PROJECT_ID=...
SANITY_STUDIO_DATASET=production
```

Lo Studio locale non aggiorna automaticamente lo Studio online. Dopo una modifica a schemi o interfaccia, eseguire un deploy esplicito:

```bash
cd studio
npx sanity login
npm run deploy
```

Lo Studio online è [assoe.sanity.studio](https://assoe.sanity.studio/). Il deploy aggiorna gli schemi e l’interfaccia, ma non converte, elimina o pubblica i documenti esistenti.

## Struttura del progetto

| Percorso | Responsabilità |
| --- | --- |
| `src/pages/` | Pagine e routing Astro |
| `src/components/` | Componenti visuali riutilizzabili |
| `src/styles/` | Stili globali e responsive |
| `src/content/types.ts` | Modello dei contenuti usato dal frontend |
| `src/content/providers/` | Client Sanity, query, validazione e mapping |
| `studio/` | Studio Sanity e schemi dei documenti |
| `shared/` | Validazioni condivise tra frontend e Studio |
| `scripts/` | Controlli sull’output statico |
| `docs/class.puml` | Diagramma del modello dei contenuti |

Le pagine dipendono dal contratto applicativo in `src/content/types.ts`, non direttamente dalle strutture Sanity. L’adattamento del CMS resta concentrato nel provider.

## Contenuti Sanity

Il sito legge questi documenti:

- **Homepage**: documento singleton `homeSettings` con le schede **Ordine delle sezioni** e **Avvisi**. Nella prima si trascinano Avvisi, Prossimo appuntamento, Iniziative sociali, Volontariato, Articoli e 5×1000; la presentazione iniziale resta in alto. Nei documenti già esistenti premere **Configura l’ordine delle sezioni** per iniziare. Pubblicare e ricostruire il sito applica il nuovo ordine, senza cambiare la selezione o l’ordine dei contenuti interni. Se il campo non è configurato si conserva l’ordine attuale; dati incompleti o corrotti non nascondono sezioni: quelle mancanti sono aggiunte in fondo nell’ordine predefinito. Il nuovo pannello richiede il deploy dello Studio.
- **Avvisi**: nella scheda omonima di **Homepage**, fino a tre e riordinabili trascinandoli nello Studio. Titolo e testo non possono essere vuoti o composti solo da spazi. Il testo usa Markdown (massimo 500 caratteri di sorgente); un PDF e un link HTTPS sono facoltativi. Il testo del link è personalizzabile (massimo 80 caratteri); se vuoto, compare «Approfondisci». Ogni avviso può avere una data «Visibile fino al»: resta visibile per tutta quella data nel fuso italiano e scompare dal giorno successivo. Gli avvisi scaduti occupano ancora un posto nell’elenco dello Studio; rimuoverli quando non servono più. La sezione non compare se non ci sono avvisi visibili.
- **Informazioni associazione**: documento singleton con nome, testo breve della homepage (facoltativo, massimo 200 caratteri), logo, descrizione, contatti, social, donazioni, 5×1000 e documenti. Il nome e il testo breve alimentano la sezione iniziale della home.
- **Iniziative**: un solo tipo di documento con ambito obbligatorio **Iniziative sociali** o **Volontariato**. Nello Studio, “Iniziative” contiene i due ambiti, ciascuno con “Elenco e ricerca” e il proprio riordino trascinabile. La voce “Iniziative” del menu porta alla panoramica in `/iniziative/`, divisa in Sociali e Volontariato con due archivi distinti; la home mostra le prime due iniziative di ciascun ambito nell’ordine editoriale. Cambiare “Ambito”, pubblicare e ricostruire il sito sposta l’iniziativa mantenendo URL e collegamenti; la posizione si sceglie nel riordino del nuovo ambito. Il provider esclude iniziative senza un ambito valido, anche dai contenuti correlati.
- **Articoli**: contenuti editoriali con data, immagini, galleria e collegamenti opzionali alle iniziative.
- **Eventi**: oggi e futuri in `/eventi/`, passati in `/eventi/archivio/`, consultabile per anno con paginazione di sei elementi. L’archiviazione scatta dal giorno successivo nel fuso italiano, indipendentemente dallo stato, e si aggiorna alla build quotidiana o manuale. Gli annullamenti restano visibili; gli altri passati sono mostrati come conclusi. Sanity mantiene un elenco unico; documenti, URL e collegamenti restano invariati.
- **Persone**: profili mostrati nella pagina Associati e, quando previsto, in Chi siamo.

Le iniziative usano il tipo **`initiative`**; articoli ed eventi le collegano tramite il campo **`initiatives`**.

Gli URL pubblici sono:

- `/iniziative/`
- `/iniziative-sociali/`
- `/volontariato/`
- `/iniziative/<slug>/`
- `/articoli/`
- `/articoli/<data>-<slug>/`
- `/eventi/`
- `/eventi/archivio/` e `/eventi/archivio/<anno>/`
- `/eventi/<slug>/`

Per gli articoli, nello Studio si inserisce solo la parte breve dello slug, senza la data. La data viene aggiunta automaticamente dal sito. Cambiare data o slug dopo la pubblicazione cambia l’indirizzo pubblico.

Per gli eventi, lo slug `archivio` è riservato alla pagina del sito.

Il sito usa solo contenuti pubblicati. Una bozza Sanity non viene inclusa nella build.

## Immagini e documenti

Prima di caricare immagini diverse dal logo, preferire JPG o WebP, circa 2000 px sul lato lungo e massimo 5 MB. Le immagini vengono ottimizzate da Astro durante la build, ma gli originali restano archiviati su Sanity.

Le immagini del logo sono soggette a una regola separata nello Studio. Prima di pubblicare documenti o dati bancari verificare sempre che siano corretti e destinati alla pubblicazione. Per le foto delle persone occorre avere il consenso necessario.

## Controlli locali

Dalla radice del repository:

```bash
npm run check
npm test
npm run test:coverage
npm run build
npm run check:build
```

Per controllare anche lo Studio:

```bash
cd studio
npm run build
npm run audit:high
```

`npm run build` richiede un `PUBLIC_SANITY_PROJECT_ID` valido e una rete disponibile per leggere Sanity. `npm run check:build` controlla l’output statico dell’ultima build, compresi i link con il prefisso GitHub Pages.

## Test e copertura

Le suite in [`tests/`](tests/) usano `node:test`: verificano regole dei contenuti, separazione delle iniziative per ambito, provider Sanity, cache, upload dello Studio, gestione degli errori dell’audit e script di avvisi e galleria in un DOM simulato. Combinano verifiche black box sui risultati e white box su chiamate, stato e percorsi del codice. Le query delle iniziative sono eseguite anche localmente con groq-js, senza accedere al CMS o a un browser reale.

I test dell’ordine della homepage verificano validazione, compatibilità con i documenti esistenti, query GROQ e cache. Una build Astro temporanea con contenuti di prova controlla anche l’HTML delle sezioni in ordine predefinito e invertito, comprese le sezioni senza contenuti, senza interrogare Sanity.

`npm run test:coverage` misura con V8 righe, rami e funzioni eseguiti, con soglie complessive del **95%**, **90%** e **100%**. Il [perimetro](scripts/coverage-scope.mjs) comprende utilità, script, provider, moduli condivisi, struttura degli elenchi dello Studio e tre suoi moduli di logica; esclude componenti Astro, CSS e interfaccia React. Il [controllo](scripts/test-coverage.mjs) fallisce anche se un modulo previsto non compare nel report. Le percentuali descrivono l’esecuzione del codice incluso, non la copertura di tutti i requisiti.

`npm run audit:high` nello Studio richiede un report npm valido e fallisce anche per errori di rete o di esecuzione. L’override mirato di `undici` nel plugin dei tipi impone la versione corretta della serie 7; le eventuali eccezioni alle advisory restano definite nello script di audit.

## Branch e pubblicazione

- `develop`: sviluppo e verifiche.
- `main`: codice destinato alla pubblicazione.

Il workflow [`ci.yml`](.github/workflows/ci.yml) esegue i controlli frontend e Studio sui push e sulle pull request. Il workflow [`pages.yml`](.github/workflows/pages.yml) pubblica su GitHub Pages dopo un push su `main`, quando viene avviato manualmente da **Actions → Publish Astro to GitHub Pages → Run workflow**, oppure ogni giorno alle **00:17, ora italiana** (`Europe/Rome`, anche durante l’ora legale). La pianificazione funziona solo quando il workflow è presente sul branch predefinito (`main`); GitHub può ritardare o, in casi eccezionali, saltare un’esecuzione programmata. Nei repository pubblici GitHub disattiva i workflow programmati dopo 60 giorni senza attività nel repository: controllare periodicamente la cronologia in **Actions**.

L’anteprima pubblica corrente è:

<https://bickpenna.github.io/Assoe/>

In **Settings → Pages** la sorgente deve essere **GitHub Actions**. In **Settings → Secrets and variables → Actions → Variables** deve essere presente:

- `PUBLIC_SANITY_PROJECT_ID` — obbligatoria;
- `PUBLIC_SANITY_DATASET` — facoltativa, con valore predefinito `production`.

Il Project ID non è un segreto. Non inserire token Sanity nel frontend o nelle variabili usate per una build statica.

## Aggiornamento dei contenuti e build

Pubblicare un documento in Sanity e ricostruire il sito sono due operazioni distinte. Il sito si aggiorna solo dopo una nuova build Pages.

Per verificare che un aggiornamento sia arrivato online:

1. controllare che il documento sia **Published**, non solo Draft;
2. verificare che il tipo sia quello previsto dallo schema;
3. controllare in **GitHub → Actions** che `Publish Astro to GitHub Pages` sia partito e terminato con successo;
4. se necessario, avviare manualmente il workflow su `main`;
5. ricaricare la pagina senza cache dopo il deploy.

Un webhook Sanity può avviare automaticamente la build, ma questa integrazione va verificata nelle impostazioni del progetto Sanity e nei log di GitHub Actions: il solo salvataggio o la pubblicazione in Sanity non garantisce una nuova build.

Il passaggio automatico di un evento da futuro a passato non è una modifica in Sanity. La build quotidiana aggiorna questa distinzione e recepisce gli altri contenuti pubblicati dopo la build precedente. Un deploy non è però un backup dei dati Sanity: se la build fallisce, controllare il workflow e avviarlo nuovamente quando il problema è risolto.

Gli avvisi della homepage fanno eccezione: quelli già scaduti sono esclusi durante la build, mentre un piccolo script locale nasconde quelli che scadono dopo l’ultima build, senza interrogare Sanity. Senza JavaScript, una pagina già generata conserva gli avvisi fino alla build successiva.

## Routing e GitHub Pages

Il sito usa il prefisso configurato da `SITE_BASE` quando viene pubblicato in una sottocartella. Le pagine inesistenti usano `src/pages/404.astro` per reindirizzare alla home, così il visitatore non resta su una pagina 404 dell’applicazione.

Il workflow ricava il proprietario e il nome del repository da GitHub per configurare l’indirizzo Pages. Un dominio personalizzato richiede la configurazione DNS e l’aggiornamento di `SITE_URL` e `SITE_BASE` nel workflow.

## Note operative

- Non committare `.env`, token, sessioni Sanity o dati sensibili.
- Non modificare o cancellare documenti Sanity per risolvere un problema di build senza prima verificare tipo, stato di pubblicazione e dataset.
- Dopo modifiche agli schemi, distribuire lo Studio online prima di creare nuovi contenuti.
- Prima di un refactor del modello dati, aggiornare insieme schema Sanity, query, mapper, validazioni e documentazione.

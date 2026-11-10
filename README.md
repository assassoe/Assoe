# Asso è… La Strada ci Insegna ODV

Sito web dell’associazione **Asso è… La Strada ci Insegna ODV**. Presenta le attività, le iniziative, gli eventi e le notizie dell’associazione, con informazioni per associarsi e sostenerne i progetti.

Il sito è sviluppato con [Astro](https://astro.build/) e TypeScript. I contenuti sono gestiti con [Sanity](https://www.sanity.io/) attraverso uno Studio dedicato, incluso nel repository.

## Come funziona

Astro genera il sito statico usando i contenuti pubblicati su Sanity. Il browser dei visitatori riceve le pagine già generate, senza interrogare il CMS.

Lo Studio permette di gestire informazioni dell’associazione, avvisi della homepage, iniziative, articoli, eventi e profili delle persone. Le bozze restano escluse dal sito pubblico. Per rendere visibili gli aggiornamenti pubblicati nel CMS è necessaria una nuova build del sito.

## Requisiti

- Node.js 24 e npm.
- Identificativo del progetto Sanity e nome del dataset.
- Accesso al progetto Sanity per utilizzare lo Studio e modificare i contenuti.

Il sito e lo Studio hanno dipendenze e file di configurazione separati.

## Sviluppo locale

### Sito

Dalla radice del repository:

```bash
cp .env.example .env
npm ci
```

Configurare `.env` con l’identificativo del progetto Sanity e il dataset da utilizzare:

```dotenv
PUBLIC_SANITY_PROJECT_ID=<id-progetto>
PUBLIC_SANITY_DATASET=production
```

Avviare il server di sviluppo:

```bash
npm run dev
```

### Studio Sanity

In un terminale separato:

```bash
cd studio
cp .env.example .env
npm ci
```

Configurare `studio/.env` con il progetto e il dataset da gestire:

```dotenv
SANITY_STUDIO_PROJECT_ID=<id-progetto>
SANITY_STUDIO_DATASET=production
```

Avviare lo Studio:

```bash
npm run dev
```

Per lavorare sugli stessi contenuti, sito e Studio devono puntare allo stesso progetto e dataset. Le modifiche pubblicate dallo Studio locale aggiornano il dataset configurato: utilizzare un dataset separato per contenuti di prova.

I file `.env` sono esclusi da Git. Credenziali, token e dati riservati devono restare fuori dal repository e dalle variabili esposte al browser.

## Struttura del repository

| Percorso | Contenuto |
| --- | --- |
| `src/pages/` | Pagine e percorsi del sito |
| `src/layouts/` | Struttura condivisa delle pagine |
| `src/components/` | Componenti dell’interfaccia |
| `src/styles/` | Stili globali e responsive |
| `src/config/` | Configurazione del sito e della navigazione |
| `src/content/` | Modello dei contenuti e integrazione con Sanity |
| `src/utils/` | Funzioni di supporto al frontend |
| `shared/` | Funzioni e validazioni condivise con lo Studio |
| `studio/` | Configurazione, schemi e interfaccia dello Studio Sanity |
| `scripts/` | Verifiche dell’output e generazione degli avvisi di licenza |
| `tests/` | Test automatici |

Il modello dei contenuti è definito in [`src/content/types.ts`](src/content/types.ts). Query, validazione e conversione dei documenti Sanity sono raccolte in [`src/content/providers/`](src/content/providers/).

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

## Verifiche e build

I comandi seguenti si eseguono dalla radice del repository, dopo aver installato le dipendenze.

| Comando | Funzione |
| --- | --- |
| `npm run check` | Controlla tipi e componenti Astro |
| `npm test` | Esegue i test automatici |
| `npm run test:coverage` | Verifica la copertura dei test e le soglie configurate |
| `npm run build` | Genera il sito statico in `dist/` |
| `npm run check:build` | Verifica pagine, collegamenti e struttura dell’ultima build |
| `npm run preview` | Serve in locale l’ultima build |

La generazione del sito richiede la configurazione Sanity e una connessione di rete per leggere i contenuti e scaricare le immagini. Le immagini sono ottimizzate durante la build.

Per verificare lo Studio, con le sue dipendenze già installate:

```bash
npm --prefix studio run build
npm --prefix studio run audit:high
```

## Test e copertura

Le suite in [`tests/`](tests/) usano `node:test`: verificano regole dei contenuti, separazione delle iniziative per ambito, provider Sanity, cache, upload dello Studio, gestione degli errori dell’audit e script di avvisi e galleria in un DOM simulato. Combinano verifiche black box sui risultati e white box su chiamate, stato e percorsi del codice. Le query delle iniziative sono eseguite anche localmente con groq-js, senza accedere al CMS o a un browser reale.

I test dell’ordine della homepage verificano validazione, compatibilità con i documenti esistenti, query GROQ e cache. Una build Astro temporanea con contenuti di prova controlla anche l’HTML delle sezioni in ordine predefinito e invertito, comprese le sezioni senza contenuti, senza interrogare Sanity.

`npm run test:coverage` misura con V8 righe, rami e funzioni eseguiti, con soglie complessive del **95%**, **90%** e **100%**. Il [perimetro](scripts/coverage-scope.mjs) comprende utilità, script, provider, moduli condivisi, struttura degli elenchi dello Studio e tre suoi moduli di logica; esclude componenti Astro, CSS e interfaccia React. Il [controllo](scripts/test-coverage.mjs) fallisce anche se un modulo previsto non compare nel report. Le percentuali descrivono l’esecuzione del codice incluso, non la copertura di tutti i requisiti.

`npm run audit:high` nello Studio richiede un report npm valido e fallisce anche per errori di rete o di esecuzione. L’override mirato di `undici` nel plugin dei tipi impone la versione corretta della serie 7; le eventuali eccezioni alle advisory restano definite nello script di audit.

## Pubblicazione

`develop` raccoglie le modifiche da verificare; `main` contiene la versione pubblicata. Integrare i branch di funzionalità in `develop`, completare i controlli e portare il risultato in `main`. Dopo il rilascio, sincronizzare `develop` con `main`, includendo anche le eventuali correzioni applicate direttamente a `main`.

Il workflow [Quality checks](.github/workflows/ci.yml) esegue le verifiche del sito e dello Studio sui push e sulle pull request.

Il workflow [Publish Astro to GitHub Pages](.github/workflows/pages.yml) genera e pubblica il sito dai contenuti di `main`, su push, avvio manuale o pianificazione quotidiana. Usa le variabili GitHub Actions `PUBLIC_SANITY_PROJECT_ID` e `PUBLIC_SANITY_DATASET`, con `production` come dataset predefinito. La configurazione degli indirizzi di pubblicazione è definita nel workflow e in [`astro.config.mjs`](astro.config.mjs).

Lo Studio viene distribuito separatamente. Da una sessione autenticata a Sanity:

```bash
npm --prefix studio run deploy
```

Le modifiche agli schemi e all’interfaccia dello Studio richiedono un nuovo deploy dello Studio; la pubblicazione del sito resta gestita dal workflow GitHub Pages.

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

## Diritti e licenze

Il codice originale, la documentazione originale, il nome, i loghi e i contenuti dell’associazione sono di titolarità di **Asso è… La Strada ci Insegna ODV**, con tutti i diritti riservati. Le condizioni sono riportate in [LICENSE](LICENSE).

I componenti di terze parti mantengono le rispettive licenze. I relativi avvisi sono descritti in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) e inclusi nelle build del sito e dello Studio.

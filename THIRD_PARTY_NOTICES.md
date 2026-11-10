# Componenti di terze parti

Gli avvisi in questo documento riguardano esclusivamente componenti e materiali di terze parti. Il codice originale, la documentazione originale, il nome, i loghi e i contenuti dell’associazione restano soggetti a [LICENSE](LICENSE), con tutti i diritti riservati.

## Avvisi distribuiti con il sito e lo Studio

Ogni build genera `licenses/third-party.txt` nel proprio output:

- `dist/licenses/third-party.txt` per il sito Astro;
- `studio/dist/licenses/third-party.txt` per lo Studio Sanity, anche durante il deploy con `npm run deploy`.

Gli avvisi accompagnano i file pubblicati senza aggiungere collegamenti al footer. Lo Studio distribuisce il proprio file allo stesso percorso relativo alla sua radice. Non sono necessarie pagine separate per ogni libreria: i testi identici sono riportati una sola volta, con un riferimento per ciascun componente.

Il generatore [scripts/third-party-notices.mjs](scripts/third-party-notices.mjs) include le dipendenze presenti nei bundle, anche transitive, e conserva i testi originali di licenza, copyright e NOTICE forniti dai pacchetti. Include esplicitamente anche i font, che vengono distribuiti come asset anziché come JavaScript:

| Font | Autori e copyright | Licenza |
| --- | --- | --- |
| Epilogue | Copyright 2020 The Epilogue Project Authors — <https://github.com/Etcetera-Type-Co/Epilogue> | SIL Open Font License 1.1 |
| Plus Jakarta Sans | Copyright 2020 The Plus Jakarta Sans Project Authors — <https://github.com/tokotype/PlusJakartaSans> | SIL Open Font License 1.1 |

I testi integrali dei font sono letti dai pacchetti Fontsource installati e inseriti negli avvisi distribuiti. Le condizioni ufficiali sono disponibili su <https://openfontlicense.org/open-font-license-official-text/>.

## Pacchetti con avvisi mancanti

Alcuni pacchetti npm non includono un file di licenza. Un unico file [supplemental.json](docs/licenses/supplemental.json) conserva gli avvisi recuperati dai repository ufficiali, le versioni dei pacchetti e le fonti consultate. I componenti con lo stesso avviso condividono il testo.

Quando il pacchetto dichiara soltanto MIT o ISC e un autore nei metadati, il generatore riporta tali dichiarazioni con i termini integrali della licenza, senza attribuire anni di copyright non documentati. Questi termini riguardano esclusivamente il pacchetto indicato, non il progetto dell’associazione. I pacchetti dichiarati di pubblico dominio o sotto 0BSD non richiedono un avviso separato e sono esclusi dalla raccolta.

La build si interrompe se un componente senza testo di licenza non rientra in questi casi: occorre reperire e verificare l’avviso prima della pubblicazione.

## Aggiornamento delle dipendenze

Dopo un aggiornamento, ricostruire sia sito sia Studio e controllare gli avvisi generati. Le copie integrative sono associate alla versione esatta: verificarle nuovamente quando cambia quella versione. Conservare eventuali avvisi aggiuntivi e rispettare le condizioni della singola licenza; la presenza di questo documento non sostituisce tali condizioni.

Lo Studio include anche `@vercel/stega`, dichiarato MPL-2.0. Il testo MPL è incluso negli avvisi. La [sezione 3.2 della MPL](https://www.mozilla.org/en-US/MPL/2.0/#distribution-of-executable-form) richiede inoltre, quando si distribuisce il codice compilato, di indicare come ottenere il corrispondente codice sorgente sotto MPL: il pacchetto installato non indica un repository e non contiene il sorgente TypeScript. Questo riferimento deve essere chiarito con il fornitore prima della distribuzione dello Studio; il solo testo della licenza non risolve tale punto. Questa condizione riguarda quel componente, senza estendere la MPL al codice originale dell’associazione.

La sola presenza di una dipendenza nei `package-lock.json` non richiede di copiarne la licenza nell’output del sito. I pacchetti usati soltanto per eseguire la build mantengono le proprie licenze nelle installazioni npm. Il sito distribuisce gli avvisi dei due font; lo Studio ha una raccolta separata per le librerie effettivamente incluse nei suoi bundle.

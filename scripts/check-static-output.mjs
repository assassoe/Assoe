import fs from 'node:fs';
import path from 'node:path';

const outputDirectory = path.resolve('dist');
const siteBase = process.env.SITE_BASE || '/';
const redirectBase = siteBase === '/' ? '' : `/${siteBase.replace(/^\/+|\/+$/g, '')}`;
const allowedRedirects = new Map([
  [path.join('dist', '404.html'), `${redirectBase}/`],
  [path.join('dist', '5x1000', 'index.html'), `${redirectBase}/sostienici/`],
  [path.join('dist', 'contatti', 'index.html'), `${redirectBase}/chi-siamo/#contatti`],
]);

function expectedRedirect(relativePath, target) {
  const staticRedirect = allowedRedirects.get(relativePath);
  if (staticRedirect) return staticRedirect;
  if (/^dist\/(?:eventi\/[a-z0-9-]+|articoli\/[a-z0-9-]+)\/index\.html$/.test(relativePath)
    && target.startsWith(`${redirectBase}/articoli/`)
    && outputFileForHref(target, path.resolve(relativePath))) return target;

  return undefined;
}

function htmlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(filePath);
    return entry.name.endsWith('.html') ? [filePath] : [];
  });
}

function outputCandidates(relativeUrlPath) {
  const normalized = path.posix.normalize(relativeUrlPath.replace(/^\/+/, ''));
  if (normalized === '..' || normalized.startsWith('../')) return [];
  if (!normalized) return [path.join(outputDirectory, 'index.html')];
  if (normalized.endsWith('/')) return [path.join(outputDirectory, normalized, 'index.html')];
  return [
    path.join(outputDirectory, normalized),
    path.join(outputDirectory, normalized, 'index.html'),
    path.join(outputDirectory, `${normalized}.html`),
  ];
}

function outputFileForHref(href, currentFilePath) {
  const [hrefWithoutFragment] = href.split('#', 1);
  const [pathname] = hrefWithoutFragment.split('?', 1);
  if (!pathname) return currentFilePath;
  if (!pathname.startsWith('/')) return undefined;

  if (redirectBase && pathname !== redirectBase && !pathname.startsWith(`${redirectBase}/`)) {
    throw new Error(`${path.relative(process.cwd(), currentFilePath)}: link interno senza base GitHub Pages: ${href}`);
  }

  const relativeUrlPath = redirectBase ? pathname.slice(redirectBase.length) : pathname;
  return outputCandidates(relativeUrlPath).find((candidate) => fs.existsSync(candidate));
}

function assertFragmentExists(href, targetFilePath, currentFilePath) {
  const fragment = href.split('#')[1]?.split('?', 1)[0];
  if (!fragment || !targetFilePath?.endsWith('.html')) return;

  let decodedFragment;
  try {
    decodedFragment = decodeURIComponent(fragment);
  } catch {
    throw new Error(`${path.relative(process.cwd(), currentFilePath)}: ancora non valida: ${href}`);
  }

  const targetHtml = fs.readFileSync(targetFilePath, 'utf8');
  const ids = new Set([...targetHtml.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  if (!ids.has(decodedFragment)) {
    throw new Error(`${path.relative(process.cwd(), currentFilePath)}: ancora inesistente: ${href}`);
  }
}

function assertInternalLinks(html, filePath) {
  for (const match of html.matchAll(/\bhref="([^"]+)"/g)) {
    const href = match[1];
    if (!href || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) continue;
    if (href.startsWith('#')) {
      assertFragmentExists(href, filePath, filePath);
      continue;
    }
    const targetFilePath = outputFileForHref(href, filePath);
    if (!targetFilePath) {
      throw new Error(`${path.relative(process.cwd(), filePath)}: destinazione interna mancante: ${href}`);
    }
    assertFragmentExists(href, targetFilePath, filePath);
  }
}

function assertCriticalMarkup(html, filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  const header = html.match(/<header\b[^>]*class="site-header"[^>]*>[\s\S]*?<\/header>/)?.[0];
  if (!header?.includes('class="brand__wordmark"')) {
    throw new Error(`${relativePath}: nome dell'associazione mancante nell'header.`);
  }
  if (!/<footer\b[^>]*class="site-footer"/.test(html)) {
    throw new Error(`${relativePath}: footer mancante.`);
  }
  if (!/<nav\b[^>]*class="desktop-nav"[^>]*aria-label="Navigazione principale"/.test(html)) {
    throw new Error(`${relativePath}: navigazione desktop mancante.`);
  }
  if (!/<nav\b[^>]*aria-label="Navigazione mobile"/.test(html)) {
    throw new Error(`${relativePath}: navigazione mobile mancante.`);
  }

  const openers = [...html.matchAll(/data-gallery-open="([^"]+)"/g)].map((match) => match[1]);
  const dialogs = [...html.matchAll(/<dialog\b[^>]*\bid="([^"]+)"/g)].map((match) => match[1]);
  if (openers.length !== dialogs.length || openers.some((id) => !dialogs.includes(id))) {
    throw new Error(`${relativePath}: galleria con pulsanti e dialog non corrispondenti.`);
  }
}

if (!fs.existsSync(outputDirectory)) {
  throw new Error('Output statico assente: esegui prima npm run build.');
}

const pages = htmlFiles(outputDirectory);
if (pages.length === 0) throw new Error('Nessuna pagina HTML trovata nell’output statico.');

for (const filePath of pages) {
  const html = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  const h1Count = (html.match(/<h1\b/g) ?? []).length;
  const redirectTarget = html.match(/<meta http-equiv="refresh" content="0;url=([^"]+)"/i)?.[1];

  if (redirectTarget) {
    const destination = expectedRedirect(relativePath, redirectTarget);
    if (destination !== redirectTarget) {
      throw new Error(`${relativePath}: redirect non previsto.`);
    }
    if (!/<meta name="robots" content="noindex"/i.test(html)) {
      throw new Error(`${relativePath}: redirect indicizzabile.`);
    }
    continue;
  }

  if (!/<title>[^<]+<\/title>/i.test(html)) throw new Error(`${relativePath}: title mancante.`);
  if (!/<meta name="description" content="[^"]+"/i.test(html)) {
    throw new Error(`${relativePath}: meta description mancante.`);
  }
  if (process.env.PUBLIC_SITE_PREVIEW === 'true' && !/<meta name="robots" content="noindex,nofollow"/i.test(html)) {
    throw new Error(`${relativePath}: il sito di anteprima deve restare non indicizzabile.`);
  }
  if (h1Count !== 1) throw new Error(`${relativePath}: attesi 1 H1, trovati ${h1Count}.`);
  assertCriticalMarkup(html, filePath);
  assertInternalLinks(html, filePath);
  if (redirectBase) {
    const rootAssetsAndLinks = [...html.matchAll(/\b(?:href|src|srcset)="(\/[^"]*)"/g)].map((match) => match[1]);
    if (rootAssetsAndLinks.some((url) => !url.startsWith(`${redirectBase}/`))) {
      throw new Error(`${relativePath}: link o risorsa interna senza base GitHub Pages.`);
    }
  }
  const oldSupportHref = `${redirectBase}/5x1000`;
  if (html.includes(`href="${oldSupportHref}/"`) || html.includes(`href="${oldSupportHref}"`)) {
    throw new Error(`${relativePath}: link al vecchio percorso 5x1000.`);
  }
  if (/(?:href|src)="(?:javascript:|data:)/i.test(html)) throw new Error(`${relativePath}: URL non sicuro.`);
  if (/target="_blank"(?![^>]*rel="[^"]*(?:noopener|noreferrer))/i.test(html)) {
    throw new Error(`${relativePath}: link _blank senza protezione rel.`);
  }
}

console.log(`Output statico valido: ${pages.length} pagine HTML.`);

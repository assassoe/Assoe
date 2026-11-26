import fs from 'node:fs/promises';

async function htmlFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    return entry.isDirectory() ? htmlFiles(url) : entry.name.endsWith('.html') ? [url] : [];
  }));
  return files.flat();
}

/** Genera gli indici dai file effettivamente prodotti, senza duplicare le route del CMS. */
/** @returns {import('astro').AstroIntegration} */
export function publicationFiles() {
  let site;
  let base;
  return {
    name: 'assoe-publication-files',
    hooks: {
      'astro:config:done': ({ config }) => {
        site = config.site;
        base = config.base;
      },
      'astro:build:done': async ({ dir }) => {
        if (!site) throw new Error('Configurare site per generare gli indici pubblici.');
        const locations = new Set();
        for (const file of await htmlFiles(dir)) {
          const html = await fs.readFile(file, 'utf8');
          if (/<meta\b[^>]*(?:name="robots"[^>]*content="[^"]*noindex|http-equiv="refresh")/i.test(html)) continue;
          const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];
          if (!canonical) throw new Error(`Canonical mancante: ${file.pathname}`);
          // Gli attributi HTML sono già escapati anche per XML.
          locations.add(canonical);
        }
        const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
          + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
          + [...locations].sort((left, right) => left.localeCompare(right, 'en'))
            .map((url) => `  <url><loc>${url}</loc></url>\n`).join('')
          + '</urlset>\n';
        const sitemapUrl = new URL(`${base.replace(/\/$/, '')}/sitemap.xml`, site);
        // Lascia il crawler libero di leggere il noindex dell'anteprima.
        const robots = 'User-agent: *\nAllow: /\n'
          + (locations.size ? `\nSitemap: ${sitemapUrl.href}\n` : '');
        await fs.writeFile(new URL('sitemap.xml', dir), sitemap);
        await fs.writeFile(new URL('robots.txt', dir), robots);
      },
    },
  };
}

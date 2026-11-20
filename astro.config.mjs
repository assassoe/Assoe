import { defineConfig } from 'astro/config';
import { liveInitiativeArchives } from './scripts/live-initiative-archives.mjs';
import { thirdPartyNotices } from './scripts/third-party-notices.mjs';

const base = process.env.SITE_BASE || '/';
const redirectBase = base === '/' ? '' : `/${base.replace(/^\/+|\/+$/g, '')}`;

export default defineConfig({
  site: process.env.SITE_URL || 'https://assoe.it',
  base,
  integrations: [liveInitiativeArchives()],
  vite: {
    plugins: [thirdPartyNotices({
      additionalPackages: [
        new URL('./node_modules/@fontsource-variable/epilogue/', import.meta.url),
        new URL('./node_modules/@fontsource-variable/plus-jakarta-sans/', import.meta.url),
      ],
    })],
  },
  redirects: {
    '/5x1000': `${redirectBase}/sostienici/`,
    '/contatti': `${redirectBase}/chi-siamo/#contatti`,
  },
  image: {
    domains: ['cdn.sanity.io'],
    responsiveStyles: true,
  },
});

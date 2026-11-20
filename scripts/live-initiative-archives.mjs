/** @returns {import('astro').AstroIntegration} */
export function liveInitiativeArchives() {
  let development = false;
  const routes = new Set([
    'src/pages/[initiativeArea]/index.astro',
    'src/pages/[initiativeArea]/pagina/[page].astro',
    'src/pages/iniziative/[slug].astro',
  ]);
  return {
    name: 'assoe-live-initiative-archives',
    hooks: {
      'astro:config:setup': ({ command }) => { development = command === 'dev'; },
      'astro:route:setup': ({ route }) => {
        if (development && routes.has(route.component)) route.prerender = false;
      },
    },
  };
}

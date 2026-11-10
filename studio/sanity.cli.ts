import { defineCliConfig } from 'sanity/cli';
import { thirdPartyNotices } from '../scripts/third-party-notices.mjs';

export default defineCliConfig({
  vite: {
    plugins: [thirdPartyNotices()],
  },
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? '',
    dataset: process.env.SANITY_STUDIO_DATASET ?? 'production',
  },
  deployment: {
    appId: 'fhcfhdrty6jwygxqeac5jep4',
  },
});

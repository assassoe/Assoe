import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const noticesDirectory = fileURLToPath(new URL('../docs/licenses/', import.meta.url));
const { standardTerms, notices: supplementalNotices } = JSON.parse(fs.readFileSync(path.join(noticesDirectory, 'supplemental.json'), 'utf8'));
const supplements = new Map(supplementalNotices.flatMap((notice) => notice.packages.map((name) => [name, notice])));

function packageDirectory(moduleId) {
  const normalized = moduleId.replaceAll('\\', '/');
  const marker = '/node_modules/';
  const index = normalized.lastIndexOf(marker);
  if (index < 0 || normalized.startsWith('\0')) return undefined;
  const parts = normalized.slice(index + marker.length).split('/');
  const name = parts[0].startsWith('@') ? parts.slice(0, 2) : parts.slice(0, 1);
  return normalized.slice(0, index + marker.length) + name.join('/');
}

function legalFiles(directory, insideLegalDirectory = false) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (!insideLegalDirectory && !/^(?:licen[cs]e|copying|copyright|notice|third[-_]?party)/i.test(entry.name)) return [];
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return legalFiles(file, true);
    return entry.isFile() ? [{ name: entry.name, text: fs.readFileSync(file, 'utf8').trim() }] : [];
  });
}

function packageNotice(directory) {
  const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const key = `${metadata.name}@${metadata.version}`;
  const supplement = supplements.get(key);
  const license = metadata.license ?? metadata.licenses?.map((item) => item.type).join(' OR ');
  // These declarations do not require a separate attribution or license notice.
  if (license === '0BSD' || license === 'Public Domain') return undefined;
  const files = legalFiles(directory);
  const author = typeof metadata.author === 'string' ? metadata.author : metadata.author?.name;
  const source = supplement?.source ?? `https://www.npmjs.com/package/${metadata.name}/v/${metadata.version}`;
  const lines = [`## ${key}`, `License: ${license ?? 'see original notices'}`, `Package: ${source}`];
  if (author) lines.push(`Author (package.json): ${author}`);

  if (supplement) {
    files.push({ name: 'Original upstream notice', text: supplement.text.trim() });
  }
  if (!files.length) {
    // Some publishers only ship a license identifier and author in package.json.
    // Include those declarations with the full terms, without inventing copyright years.
    if (standardTerms[license] && author) {
      files.push({ name: `${license} terms (license declared in package.json)`, text: standardTerms[license].trim() });
    } else {
      throw new Error(`Missing third-party license text: ${key}. Add a verified notice in docs/licenses/.`);
    }
  }

  return { key, lines, files };
}

export function thirdPartyNotices({ additionalPackages = [] } = {}) {
  return {
    name: 'assoe-third-party-notices',
    generateBundle(_options, bundle) {
      const directories = new Set(additionalPackages.map((directory) => fileURLToPath(directory)));
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        for (const id of chunk.moduleIds) {
          const directory = packageDirectory(id);
          if (directory) directories.add(directory);
        }
      }
      const notices = new Map([...directories].map((directory) => {
        const notice = packageNotice(directory);
        return notice ? [notice.key, notice] : undefined;
      }).filter(Boolean));
      const texts = new Map();
      const entries = [...notices].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([, notice]) => {
        for (const file of notice.files) {
          if (!texts.has(file.text)) texts.set(file.text, texts.size + 1);
          notice.lines.push(`${file.name}: notice [${texts.get(file.text)}]`);
        }
        return notice.lines.join('\n');
      });
      this.emitFile({
        type: 'asset',
        fileName: 'licenses/third-party.txt',
        source: [
          'THIRD-PARTY LICENSES AND NOTICES',
          'These notices apply only to the third-party components listed below.',
          'Original association code, documentation, branding and content remain all rights reserved.',
          ...entries,
          '# Notice texts',
          ...[...texts].map(([text, number]) => `--- Notice [${number}] ---\n\n${text}`),
        ].join('\n\n') + '\n',
      });
    },
  };
}

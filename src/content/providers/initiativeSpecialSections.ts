import type { InitiativeSpecialSection } from '../types';
import { httpsUrlOrUndefined, sanityAssetUrlOrUndefined } from '../../../shared/url.ts';
import { renderRichText } from './sanityMappers.ts';

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.flatMap((item): Record<string, unknown>[] => {
    const itemRecord = record(item);
    return itemRecord ? [itemRecord] : [];
  }) : [];
}

function isSectionBody(value: unknown): boolean {
  return Array.isArray(value) && value.every((raw) => {
    const block = record(raw);
    return block?._type === 'block'
      && Array.isArray(block.children)
      && block.children.every((rawSpan) => {
        const span = record(rawSpan);
        return span?._type === 'span' && typeof span.text === 'string'
          && (span.marks === undefined || (Array.isArray(span.marks) && span.marks.every((mark) => typeof mark === 'string')));
      })
      && (block.markDefs === undefined || (Array.isArray(block.markDefs) && block.markDefs.every((rawMark) => {
        const mark = record(rawMark);
        return typeof mark?._type === 'string' && typeof mark._key === 'string';
      })));
  });
}

/** Un elemento corrotto non nasconde il resto dell'iniziativa né introduce URL esterni non validi. */
export function toInitiativeSpecialSections(value: unknown): InitiativeSpecialSection[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((raw, index): InitiativeSpecialSection[] => {
    const section = record(raw);
    const title = text(section?.title);
    if (!section || !title) return [];
    const base = { id: `iniziativa-sezione-${index + 1}`, title };

    switch (section._type) {
      case 'initiativeTextSection':
      case 'initiativeInstitutionalSection': {
        if (!isSectionBody(section.body)) return [];
        const bodyHtml = renderRichText(section.body);
        if (!bodyHtml?.replace(/<[^>]*>/g, '').trim()) return [];
        return [{ ...base, kind: section._type === 'initiativeTextSection' ? 'text' : 'institutional', bodyHtml, period: text(section.period) }];
      }
      case 'initiativeLogosSection': {
        const logos = records(section.logos).flatMap((logo) => {
          const imageUrl = sanityAssetUrlOrUndefined(text(logo.imageUrl));
          const alt = text(logo.alt);
          if (!imageUrl || !alt) return [];
          return [{ imageUrl, alt, url: httpsUrlOrUndefined(text(logo.url)) }];
        });
        return logos.length ? [{ ...base, kind: 'logos', logos }] : [];
      }
      case 'initiativeDocumentsSection': {
        const documents = records(section.documents).flatMap((document) => {
          const title = text(document.title);
          const url = sanityAssetUrlOrUndefined(text(document.url));
          if (!title || !url || !new URL(url).pathname.toLowerCase().endsWith('.pdf')) return [];
          return [{ title, url, description: text(document.description) }];
        });
        return documents.length ? [{ ...base, kind: 'documents', documents }] : [];
      }
      case 'initiativeFactsSection': {
        const facts = records(section.facts).flatMap((fact) => {
          const label = text(fact.label);
          const value = text(fact.value);
          return label && value ? [{ label, value, unit: text(fact.unit) }] : [];
        });
        return facts.length ? [{ ...base, kind: 'facts', facts }] : [];
      }
      default: return [];
    }
  });
}

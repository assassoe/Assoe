import type { AssociationInfo } from '../content/types.ts';
import { emailAddressOrUndefined } from '../../shared/url.ts';

function associationContact(association: AssociationInfo | null) {
  const email = emailAddressOrUndefined(association?.contacts?.email);
  if (!email) throw new Error('Informazioni associazione: pubblicare un indirizzo email valido in Sanity.');
  return { email, emailHref: `mailto:${email.split('@').map(encodeURIComponent).join('@')}` };
}

/** Dati correnti del titolare: nessuna copia di riserva dei dati legali nel codice. */
export function legalInformation(association: AssociationInfo | null) {
  const contact = associationContact(association);
  const contacts = association?.contacts;
  const required = {
    name: association?.name?.trim() || '',
    taxCode: association?.taxCode?.trim() || '',
    street: contacts?.address?.trim() || '',
    postalCode: contacts?.postalCode?.trim() || '',
    city: contacts?.city?.trim() || '',
  };
  if (Object.values(required).some((value) => !value)) {
    throw new Error('Informativa privacy: pubblicare nome, codice fiscale e indirizzo completo in Sanity.');
  }
  const locality = [required.postalCode, required.city, contacts?.province?.trim()].filter(Boolean).join(' ');
  return {
    ...contact,
    name: required.name,
    taxCode: required.taxCode,
    address: `${required.street}, ${locality}`,
    registryInfo: association?.registryInfo?.trim() || '',
  };
}

/** Il recapito viene riletto dal CMS; la validità è di 180 giorni dalla generazione. */
export function renderSecurityText(association: AssociationInfo | null, generatedAt = new Date()): string {
  const { emailHref } = associationContact(association);
  if (!Number.isFinite(generatedAt.getTime())) throw new Error('Data di generazione security.txt non valida.');
  const expires = new Date(generatedAt.getTime() + 180 * 24 * 60 * 60 * 1000);
  return `Contact: ${emailHref}\nExpires: ${expires.toISOString()}\nPreferred-Languages: it, en\n`;
}

export function renderHumansText(association: AssociationInfo | null): string {
  const { email } = associationContact(association);
  const name = association?.name?.trim();
  if (!name || /[\r\n]/.test(name)) throw new Error('humans.txt: pubblicare un nome associazione valido in Sanity.');
  return `/* TEAM */\nSviluppo: bickpenna\nContenuti: ${name}\nContatto associazione: ${email}\n\n`
    + '/* SITE */\nLingua: Italiano\nTecnologie: Astro, TypeScript, Sanity\nFont locali: Epilogue, Plus Jakarta Sans\n';
}

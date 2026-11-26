import type { APIRoute } from 'astro';
import { contentRepository } from '@/content';
import { renderSecurityText } from '@/utils/legalInformation';

export const prerender = true;

export const GET: APIRoute = async () => new Response(
  renderSecurityText(await contentRepository.getAssociationInfo()),
  { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
);

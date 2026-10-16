import type { AudiencePage, MarketingPage } from '../types';

/** Nav tab order. About Us is deliberately absent: it is reached from the footer. */
export const AUDIENCE_PAGES: AudiencePage[] = ['learners', 'teachers', 'universities'];

export const MARKETING_PAGES: MarketingPage[] = [...AUDIENCE_PAGES, 'about'];

export function isMarketingPage(value: string): value is MarketingPage {
  return (MARKETING_PAGES as string[]).includes(value);
}

/**
 * Anchor of the About Us "Contact Us" section (`marketing.about.sections[].anchorId`).
 * Placeholder destination for enquiry CTAs until a real contact channel exists.
 */
export const CONTACT_ANCHOR = 'contact';

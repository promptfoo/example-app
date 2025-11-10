import { prompts as generalPrompts } from './general/prompts';
import { prompts as financePrompts } from './finance/prompts';
import { prompts as medicinePrompts } from './medicine/prompts';
import { prompts as vacationRentalPrompts } from './vacation-rental/prompts';
import { prompts as taxesPrompts } from './taxes/prompts';

type Domain = 'general' | 'finance' | 'medicine' | 'vacation-rental' | 'taxes';
type Level = 'insecure' | 'secure';

const domainPrompts: Record<Domain, { insecure: string; secure: string }> = {
  general: generalPrompts,
  finance: financePrompts,
  medicine: medicinePrompts,
  'vacation-rental': vacationRentalPrompts,
  taxes: taxesPrompts,
};

export function getSystemPrompt(domain: Domain = 'general', level: Level = 'insecure'): string {
  return domainPrompts[domain][level];
}

export function isValidDomain(domain: string): domain is Domain {
  return domain in domainPrompts;
}

export function isValidLevel(level: string): level is Level {
  return level === 'insecure' || level === 'secure';
}


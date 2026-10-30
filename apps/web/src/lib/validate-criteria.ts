import type { FieldError } from '@/lib/error-messages';
import type { SearchCriteria } from '@/lib/search-params';

export function validateCriteria(criteria: SearchCriteria): FieldError[] {
  throw new Error('not implemented');
}

import type { components } from '@/lib/api/generated/schema';

export type FieldError = components['schemas']['FieldError'];

export function errorMessage(error: FieldError): string {
  throw new Error('not implemented');
}

import { errorMessage } from '@/lib/error-messages';

export default function NoCity() {
  return <p role="alert">{errorMessage({ field: 'city', code: 'CITY_NOT_FOUND' })}</p>;
}

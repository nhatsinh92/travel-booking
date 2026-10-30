import { errorMessage, type FieldError } from '@/lib/error-messages';

export default function ErrorMessage({ errors }: { errors: FieldError[] }) {
  return (
    <div role="alert">
      <ul>
        {errors.map((error) => (
          <li key={`${error.field}:${error.code}`}>{errorMessage(error)}</li>
        ))}
      </ul>
    </div>
  );
}

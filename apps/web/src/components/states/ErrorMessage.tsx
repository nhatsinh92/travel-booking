import { errorMessage, type FieldError } from '@/lib/error-messages';

// The id of an error's list item, so an input can point to its message with aria-describedby.
export function errorItemId(prefix: string, error: FieldError) {
  return `${prefix}-${error.field}-${error.code}`;
}

export default function ErrorMessage({
  errors,
  idPrefix,
}: {
  errors: FieldError[];
  idPrefix?: string;
}) {
  return (
    <div role="alert">
      <ul>
        {errors.map((error) => (
          <li
            key={`${error.field}:${error.code}`}
            id={idPrefix ? errorItemId(idPrefix, error) : undefined}
          >
            {errorMessage(error)}
          </li>
        ))}
      </ul>
    </div>
  );
}

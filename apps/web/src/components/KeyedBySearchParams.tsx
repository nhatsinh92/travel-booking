'use client';

import { Fragment, Suspense, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';

function Keyed({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  return <Fragment key={searchParams.toString()}>{children}</Fragment>;
}

// Remounts its children whenever the search params change. Next.js keeps visited routes mounted
// but hidden, which would otherwise keep a child's local state across a change of search params.
export default function KeyedBySearchParams({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <Suspense fallback={fallback ?? null}>
      <Keyed>{children}</Keyed>
    </Suspense>
  );
}

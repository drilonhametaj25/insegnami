'use client';

import { SessionProvider } from 'next-auth/react';
import { QueryProvider } from '@/components/providers/QueryProvider';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      <SessionProvider>
        {children}
      </SessionProvider>
    </QueryProvider>
  );
}

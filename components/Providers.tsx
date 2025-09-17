'use client';

import { SessionProvider } from 'next-auth/react';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <SessionProvider>
          {children}
        </SessionProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}

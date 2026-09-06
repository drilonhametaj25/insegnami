'use client';

import { useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import { ModalsProvider } from '@mantine/modals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface AppProvidersProps {
  children: React.ReactNode;
}

/**
 * Provider client dell'app (sessione, react-query, modals).
 * MantineProvider + Notifications vivono nel root layout (app/layout.tsx):
 * qui non vanno duplicati. NextIntlClientProvider è montato dal layout
 * server di app/[locale]/layout.tsx con i messaggi risolti lato server.
 */
export function AppProviders({ children }: AppProvidersProps) {
  // Istanza stabile per client (evita ricreazioni in re-render/HMR)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 10, // 10 minutes
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ModalsProvider>{children}</ModalsProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

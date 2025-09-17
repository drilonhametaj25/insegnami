'use client';

import { SessionProvider } from 'next-auth/react';
import { NextIntlClientProvider } from 'next-intl';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

// Create a stable QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function LocaleLayout({
  children,
  params
}: LocaleLayoutProps) {
  const [locale, setLocale] = useState<string>('');
  const [messages, setMessages] = useState<any>({});

  useEffect(() => {
    const loadLocaleData = async () => {
      const resolvedParams = await params;
      setLocale(resolvedParams.locale);
      
      // Load messages dynamically
      try {
        const localeMessages = await import(`@/messages/${resolvedParams.locale}.json`);
        setMessages(localeMessages.default);
      } catch (error) {
        console.error('Failed to load messages:', error);
        setMessages({});
      }
    };
    
    loadLocaleData();
  }, [params]);

  if (!locale) {
    return <div>Loading...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <SessionProvider>
          <MantineProvider>
            <div data-locale={locale}>
              {children}
            </div>
          </MantineProvider>
        </SessionProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

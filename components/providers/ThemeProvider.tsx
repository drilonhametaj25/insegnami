'use client';

import { MantineProvider } from '@mantine/core';
import { appTheme } from '@/lib/theme';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <MantineProvider theme={appTheme} defaultColorScheme="light">
      {children}
    </MantineProvider>
  );
}

'use client';

import { useEffect } from 'react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Root error:', error);
  }, [error]);

  return (
    <html lang="it">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          backgroundColor: '#faf5ff',
          color: '#1a1a2e',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div
            style={{
              fontSize: '3rem',
              fontWeight: 700,
              color: '#7c3aed',
              marginBottom: '1rem',
            }}
          >
            Oops!
          </div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            Si è verificato un errore
          </h1>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            Qualcosa è andato storto. Riprova tra qualche istante.
          </p>
          <button
            onClick={reset}
            style={{
              backgroundColor: '#7c3aed',
              color: '#fff',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontSize: '1rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Riprova
          </button>
        </div>
      </body>
    </html>
  );
}

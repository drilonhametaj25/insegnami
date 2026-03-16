export default function RootNotFound() {
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
              fontSize: '5rem',
              fontWeight: 700,
              color: '#7c3aed',
              marginBottom: '0.5rem',
            }}
          >
            404
          </div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            Pagina non trovata
          </h1>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            La pagina che stai cercando non esiste o è stata spostata.
          </p>
          <a
            href="/"
            style={{
              display: 'inline-block',
              backgroundColor: '#7c3aed',
              color: '#fff',
              textDecoration: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 600,
            }}
          >
            Torna alla Home
          </a>
        </div>
      </body>
    </html>
  );
}

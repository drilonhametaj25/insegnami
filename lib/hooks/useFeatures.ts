import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import type { FeatureKey } from '@/lib/billing/feature-catalog';

/**
 * Feature effettive del tenant per il gating UI (Sidebar, upsell).
 *
 * Legge il campo `features` di GET /api/subscriptions (endpoint riservato ai
 * ruoli admin): per gli altri ruoli o su errore ritorna `features: null` —
 * la UI in quel caso NON applica gating (fail-open: l'enforcement vero è
 * nelle API con requireAuth({feature})).
 */

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'];

export interface UseFeaturesResult {
  /** mappa feature→bool; null = sconosciute (ruolo non admin o fetch fallito) */
  features: Record<string, boolean> | null;
  isLoading: boolean;
  /** true solo se le feature sono note E la chiave è attiva */
  hasFeature: (key: FeatureKey) => boolean;
  /** true se la feature è NOTA come mancante (per badge/upsell, mai fail-closed) */
  isMissingFeature: (key: FeatureKey) => boolean;
}

export function useFeatures(): UseFeaturesResult {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const enabled = status === 'authenticated' && !!role && ADMIN_ROLES.includes(role);

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-features'],
    enabled,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<Record<string, boolean> | null> => {
      const res = await fetch('/api/subscriptions');
      if (!res.ok) return null;
      const payload = await res.json();
      return payload?.features && typeof payload.features === 'object'
        ? (payload.features as Record<string, boolean>)
        : null;
    },
  });

  const features = enabled ? data ?? null : null;

  return {
    features,
    isLoading: enabled ? isLoading : false,
    hasFeature: (key) => features?.[key] === true,
    isMissingFeature: (key) => features !== null && features[key] !== true,
  };
}

export default useFeatures;

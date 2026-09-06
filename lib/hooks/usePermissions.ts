'use client';

import { useSession } from 'next-auth/react';
import { can, type Action, type Resource } from '@/lib/permissions/matrix';

/**
 * Hook minimo di gating UI sulla matrice permessi condivisa (lib/permissions/matrix).
 * Ritorna true se il ruolo della sessione corrente può eseguire action su resource.
 */
export function usePermission(action: Action, resource: Resource): boolean {
  const { data: session } = useSession();
  return can(session?.user?.role, action, resource);
}

/** Ruolo dell'utente autenticato (undefined se sessione non caricata). */
export function useRole(): string | undefined {
  const { data: session } = useSession();
  return session?.user?.role;
}

/** true se almeno una delle azioni è concessa sulla risorsa. */
export function usePermissionAny(actions: Action[], resource: Resource): boolean {
  const { data: session } = useSession();
  return actions.some((a) => can(session?.user?.role, a, resource));
}

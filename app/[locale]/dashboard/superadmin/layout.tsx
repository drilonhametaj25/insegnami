import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuth();

  // Redirect if not authenticated
  if (!session?.user) {
    redirect('/api/auth/signin');
  }

  // Redirect if not SUPERADMIN
  if (session.user.role !== 'SUPERADMIN') {
    redirect('/dashboard');
  }

  return <>{children}</>;
}

import { redirect } from 'next/navigation';

export default function RootPage() {
  // This should never be rendered due to middleware redirect
  // But as failsafe, redirect to dashboard
  redirect('/it/dashboard');
}

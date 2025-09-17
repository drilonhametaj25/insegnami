import { redirect } from 'next/navigation';

export default function RootPage() {
  // Redirect to Italian as default locale
  redirect('/it');
}

import { redirect } from 'next/navigation';

export default async function LocaleRootPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  
  // Always redirect to dashboard - this page should never be seen
  redirect(`/${locale}/dashboard`);
}

export default async function LocaleRootPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  
  return (
    <div>
      <h1>Welcome to InsegnaMi.pro</h1>
      <p>Current locale: {locale}</p>
      <p>This is the root page for locale routing.</p>
      <a href={`/${locale}/dashboard`}>Go to Dashboard</a>
      <br />
      <a href={`/${locale}/test`}>Go to Test Page</a>
    </div>
  );
}

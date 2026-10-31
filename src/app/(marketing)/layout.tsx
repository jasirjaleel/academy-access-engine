import { SiteHeader } from "@/components/site-header";
import { getUserId } from "@/lib/auth";

// Marketing chrome (pill nav) only for signed-out pages; students use the app shell instead.
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const signedIn = (await getUserId()) !== null;
  return (
    <>
      <SiteHeader signedIn={signedIn} />
      {children}
    </>
  );
}

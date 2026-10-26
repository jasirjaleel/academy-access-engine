import { SignedInRedirect } from "@/components/signed-in-redirect";
import { SiteHeader } from "@/components/site-header";

// Marketing chrome (pill nav) only for signed-out pages; students use the app shell instead.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedInRedirect />
      <SiteHeader />
      {children}
    </>
  );
}

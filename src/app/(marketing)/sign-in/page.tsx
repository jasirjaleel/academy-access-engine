import { AuthForm } from "@/components/auth-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <AuthForm mode="sign-in" next={redirect_url} />
    </div>
  );
}

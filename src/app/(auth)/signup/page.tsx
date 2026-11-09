import { CredentialsForm } from "@/components/auth/credentials-form";

export const metadata = { title: "Create account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="space-y-5">
      <div className="space-y-1 text-center">
        <h1 className="text-lg font-semibold">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Start organizing and analyzing research.
        </p>
      </div>
      <CredentialsForm mode="signup" next={next} />
    </div>
  );
}

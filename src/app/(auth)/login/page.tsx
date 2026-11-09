import { CredentialsForm } from "@/components/auth/credentials-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="space-y-5">
      <div className="space-y-1 text-center">
        <h1 className="text-lg font-semibold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your research workspace.
        </p>
      </div>
      <CredentialsForm mode="login" next={next} />
    </div>
  );
}

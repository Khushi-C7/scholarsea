import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware guarantees an authenticated session for these routes; we still
  // load the user here to render the account menu and to fail closed.
  const user = await getCurrentUser();
  return <AppShell user={user}>{children}</AppShell>;
}

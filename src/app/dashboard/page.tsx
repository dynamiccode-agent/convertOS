import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import DashboardContent from "@/components/dashboard/DashboardContent";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <ErrorBoundary>
      <DashboardContent 
        userEmail={session.user?.email}
        userName={session.user?.name}
      />
    </ErrorBoundary>
  );
}

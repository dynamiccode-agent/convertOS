import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import DashboardContent from "@/components/dashboard/DashboardContent";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

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

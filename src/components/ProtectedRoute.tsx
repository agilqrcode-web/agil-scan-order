import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUser } from "@clerk/clerk-react"; // Import useUser from Clerk

interface ProtectedRouteProps {
  children: ReactNode;
  requireCompleteProfile?: boolean; // Make it optional
}

export default function ProtectedRoute({ children, requireCompleteProfile = true }: ProtectedRouteProps) {
  const { isLoaded: clerkLoaded, isSignedIn } = useUser(); // Get Clerk's loading and signedIn state
  const { loading: profileLoading, profileComplete } = useUserProfile();

  // 1. Wait for Clerk to load
  if (!clerkLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // 2. If not signed in, redirect to login
  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  // 3. If profile completion is not required for this route, render children directly
  if (!requireCompleteProfile) {
    return <>{children}</>;
  }

  // 4. If profile completion is required, wait for profile data to load
  if (profileLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // 5. If profile completion is required and profile is not complete, redirect to onboarding
  if (!profileComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  // 6. If all checks pass, render children
  return <>{children}</>;
}
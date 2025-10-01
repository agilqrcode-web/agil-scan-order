import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUser } from "@clerk/clerk-react"; // Import useUser from Clerk
import { Spinner } from "./ui/spinner";

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
        <Spinner />
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

  // 4. If the profile is loading AND we have not yet determined that the profile is complete,
  // show a full-screen spinner. This only happens on the initial load.
  if (profileLoading && !profileComplete) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // 5. If, after loading, the profile is still not complete, redirect to onboarding.
  if (!profileComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  // 6. If the profile is complete, render the children.
  // This will now continue to render children even during background refetches,
  // preventing the unmounting issue that closed the Realtime channel.
  return <>{children}</>;
}
import { Navigate, useNavigate } from "react-router-dom";
import { ReactNode, useEffect } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUser } from "@clerk/clerk-react";
import { Spinner } from "./ui/spinner";

interface ProtectedRouteProps {
  children: ReactNode;
  requireCompleteProfile?: boolean;
}

export default function ProtectedRoute({ children, requireCompleteProfile = true }: ProtectedRouteProps) {
  const { isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { loading: profileLoading, profileComplete } = useUserProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (clerkLoaded && !profileLoading) {
      if (requireCompleteProfile && profileComplete) {
        if (window.location.pathname === "/onboarding") {
          navigate("/dashboard", { replace: true });
        }
      }
    }
  }, [clerkLoaded, profileLoading, profileComplete, requireCompleteProfile, navigate]);


  if (!clerkLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  if (!requireCompleteProfile) {
    return <>{children}</>;
  }

  if (profileLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!profileComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
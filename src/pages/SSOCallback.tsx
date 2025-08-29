import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import { Spinner } from "@/components/ui/spinner";

// This component renders a spinner while Clerk handles the OAuth redirect.
export default function SSOCallback() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner />
      <AuthenticateWithRedirectCallback />
    </div>
  );
}

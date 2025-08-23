import { SignIn, SignUp } from "@clerk/clerk-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export default function Auth() {
  const { pathname } = useLocation();
  const isLogin = pathname === "/login";

  // Common appearance settings for both SignIn and SignUp
  const appearance = {
    elements: {
      card: "shadow-none border-0 bg-transparent",
      headerTitle: "hidden",
      headerSubtitle: "hidden",
      formButtonPrimary:
        "bg-accent hover:bg-accent/90 text-accent-foreground",
      socialButtonsBlockButton:
        "border-border hover:bg-accent/10",
      formFieldInput:
        "focus:ring-2 focus:ring-accent/50 focus:border-accent",
      footerActionLink: "text-accent hover:text-accent/80",
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Ágil QR
          </h1>
          <p className="text-muted-foreground">
            {isLogin
              ? "Bem-vindo de volta! Acesse sua conta."
              : "Crie sua conta para começar a gerenciar."}
          </p>
        </div>

        {/* Auth Component Card */}
        <Card className="rounded-xl border">
          <CardContent className="p-6">
            {isLogin ? (
              <SignIn
                path="/login"
                routing="path"
                signUpUrl="/registro"
                forceRedirectUrl="/dashboard"
                appearance={appearance}
              />
            ) : (
              <SignUp
                path="/registro"
                routing="path"
                signInUrl="/login"
                fallbackRedirectUrl="/dashboard"
                appearance={appearance}
              />
            )}
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center">
          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao início
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}


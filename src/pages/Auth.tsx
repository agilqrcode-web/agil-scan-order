import { SignIn } from "@clerk/clerk-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function Auth() {
  // This unified component handles both login and sign-up flows,
  // reducing redundancy and simplifying the user experience.
  // The <SignIn> component from Clerk is configured to manage routing
  // between the sign-in and sign-up views.

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      {/* Back to Home Button - Placed at the top for easy access */}
      <div className="absolute top-4 left-4">
        <Button variant="ghost" asChild>
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Início
          </Link>
        </Button>
      </div>

      {/* Main Auth Card */}
      <Card className="w-full max-w-md border-border/50">
        <CardHeader className="text-center">
          <img src="/placeholder.svg" alt="Ágil QR Logo" className="mx-auto mb-4 h-12 w-auto" />
          <CardTitle className="text-2xl font-bold">
            Acesse a plataforma
          </CardTitle>
          <CardDescription>
            Faça login ou crie uma conta para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <SignIn
            path="/login"
            routing="path"
            signUpUrl="/registro"
            afterSignInUrl="/dashboard"
            afterSignUpUrl="/dashboard" // ProtectedRoute handles the /onboarding redirect
            appearance={{
              variables: {
                colorPrimary: "hsl(var(--primary))",
              },
              elements: {
                // Hide Clerk's default card and header
                card: "shadow-none border-0 p-0",
                header: "hidden",
                
                // Style the primary button to match shadcn's <Button>
                formButtonPrimary:
                  "bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-md",

                // Style social buttons to match shadcn's secondary button
                socialButtonsBlockButton:
                  "border-border h-10 rounded-md hover:bg-accent",
                
                // Style input fields to match shadcn's <Input>
                formFieldInput:
                  "h-10 border-input bg-transparent rounded-md",

                // Style the footer links for consistency
                footerActionLink: "text-primary hover:text-primary/80 font-medium",
                
                // Style the "or" separator
                dividerLine: "bg-border",
                dividerText: "text-muted-foreground text-sm",
              },
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}


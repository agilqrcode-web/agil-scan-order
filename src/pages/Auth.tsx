import { SignIn } from "@clerk/clerk-react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function Auth() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      {/* Back to Home Button */}
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
        <CardHeader className="text-center pt-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-qr-code h-8 w-8 text-primary"><rect width="5" height="5" x="3" y="3" rx="1"></rect><rect width="5" height="5" x="16" y="3" rx="1"></rect><rect width="5" height="5" x="3" y="16" rx="1"></rect><path d="M21 16h-3a2 2 0 0 0-2 2v3"></path><path d="M21 21v.01"></path><path d="M12 7v3a2 2 0 0 1-2 2H7"></path><path d="M3 12h.01"></path><path d="M12 3h.01"></path><path d="M12 16v.01"></path><path d="M16 12h1"></path><path d="M21 12v.01"></path><path d="M12 21v-1"></path></svg>
            <span className="text-3xl font-bold text-primary">Ágil</span>
          </div>
          <p className="text-muted-foreground">
            Faça login para continuar
          </p>
        </CardHeader>
        <CardContent className="px-6 pb-8">
          {/* This div constrains the width of the form elements, like in the Trello example */}
          <div className="mx-auto w-full max-w-xs">
            <SignIn
              path="/login"
              routing="path"
              signUpUrl="/registro"
              afterSignInUrl="/dashboard"
              afterSignUpUrl="/dashboard"
              localization={{
                dividerText: "Ou continue com",
                formButtonPrimary: "Continuar",
              }}
              appearance={{
                variables: {
                  colorPrimary: "hsl(var(--primary))",
                },
                elements: {
                  card: "shadow-none border-0 p-0",
                  header: "hidden",
                  formButtonPrimary:
                    "bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-md w-full", // w-full here is fine because the parent is constrained
                  socialButtonsBlockButton:
                    "border-border h-10 rounded-md hover:bg-accent w-full",
                  formFieldInput:
                    "h-10 border-input bg-transparent rounded-md w-full",
                  footerActionLink: "text-primary hover:text-primary/80 font-medium",
                  dividerLine: "bg-border",
                  dividerText: "text-muted-foreground text-sm",
                },
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


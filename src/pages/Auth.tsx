import { SignIn, SignUp } from "@clerk/clerk-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function Auth() {
  const pathname = window.location.pathname;
  const isLogin = pathname === "/login";

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Ágil QR
          </h1>
          <p className="text-muted-foreground">
            Acesse sua plataforma de pedidos
          </p>
        </div>

        {/* Auth Components */}
        {isLogin ? (
          <Card>
            <CardContent className="p-6">
              <SignIn 
                forceRedirectUrl="/dashboard"
                appearance={{
                  elements: {
                    formButtonPrimary: 
                      "bg-primary hover:bg-primary/90 text-primary-foreground",
                    card: "shadow-none border-0",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    socialButtonsBlockButton: 
                      "border border-border hover:bg-accent",
                    formFieldInput: 
                      "border border-border rounded-md focus:border-primary",
                    footerActionLink: "text-primary hover:text-primary/80"
                  }
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              <SignUp 
                fallbackRedirectUrl="/dashboard"
                appearance={{
                  elements: {
                    formButtonPrimary: 
                      "bg-primary hover:bg-primary/90 text-primary-foreground",
                    card: "shadow-none border-0",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    socialButtonsBlockButton: 
                      "border border-border hover:bg-accent",
                    formFieldInput: 
                      "border border-border rounded-md focus:border-primary",
                    footerActionLink: "text-primary hover:text-primary/80"
                  }
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            {isLogin ? "Não tem uma conta?" : "Já tem uma conta?"}
          </p>
          <Button variant="ghost" asChild>
            <Link to={isLogin ? "/registro" : "/login"}>
              {isLogin ? "Criar conta" : "Fazer login"}
            </Link>
          </Button>
        </div>

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


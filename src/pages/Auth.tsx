import React, { useState } from "react";
import { useSignIn, useSignUp } from "@clerk/clerk-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2 } from "lucide-react";

// A simple component for the Google icon to avoid adding a new dependency
const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path>
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path>
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.018 36.372 44 30.65 44 24c0-1.341-.138-2.65-.389-3.917z"></path>
  </svg>
);

export default function Auth() {
  const { isLoaded: isSignInLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp } = useSignUp();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isLogin = location.pathname === "/login";
  const isLoaded = isSignInLoaded && isSignUpLoaded;

  const handleOAuthGoogle = async () => {
    if (!isLoaded) return;
    try {
      setIsLoading(true);
      const strategy = isLogin ? signIn.authenticateWithRedirect : signUp.authenticateWithRedirect;
      await strategy({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/dashboard",
      });
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Ocorreu um erro no login com Google.");
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    setIsLoading(true);
    setError("");

    try {
      if (isLogin) {
        const result = await signIn.create({
          identifier: email,
          password,
        });
        if (result.status === "complete") {
          await setActive({ session: result.createdSessionId });
          navigate("/dashboard");
        } else {
          console.error(result);
          setError("Ocorreu um erro inesperado.");
        }
      } else {
        const result = await signUp.create({
          emailAddress: email,
          password,
        });
        if (result.status === "complete") {
          await setActive({ session: result.createdSessionId });
          navigate("/dashboard");
        } else {
          console.error(result);
          setError("Ocorreu um erro inesperado.");
        }
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "E-mail ou senha inválidos.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="absolute top-4 left-4">
        <Button variant="ghost" asChild>
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Início
          </Link>
        </Button>
      </div>

      <Card className="w-full max-w-sm rounded-2xl border-none shadow-2xl shadow-primary/10">
        <CardContent className="p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-qr-code h-8 w-8 text-primary"><rect width="5" height="5" x="3" y="3" rx="1"></rect><rect width="5" height="5" x="16" y="3" rx="1"></rect><rect width="5" height="5" x="3" y="16" rx="1"></rect><path d="M21 16h-3a2 2 0 0 0-2 2v3"></path><path d="M21 21v.01"></path><path d="M12 7v3a2 2 0 0 1-2 2H7"></path><path d="M3 12h.01"></path><path d="M12 3h.01"></path><path d="M12 16v.01"></path><path d="M16 12h1"></path><path d="M21 12v.01"></path><path d="M12 21v-1"></path></svg>
            <span className="text-3xl font-bold text-primary">Ágil</span>
          </div>
          <p className="mb-8 text-muted-foreground">
            {isLogin ? "Faça login para continuar" : "Crie sua conta para começar"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="email"
              type="email"
              placeholder="Digite seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12"
              disabled={isLoading}
            />
            <div>
              <Input
                id="password"
                type="password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12"
                disabled={isLoading}
              />
              {!isLogin && (
                <p className="text-xs text-muted-foreground mt-2 text-left px-1">
                  A senha deve conter no mínimo 8 caracteres.
                </p>
              )}
            </div>
            <Button type="submit" className="w-full h-12 bg-primary hover:bg-primary/90" disabled={isLoading || !isLoaded}>
              {isLoading ? <Loader2 className="animate-spin" /> : (isLogin ? "Continuar" : "Criar conta")}
            </Button>
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Ou continue com</span>
            </div>
          </div>

          <Button variant="outline" className="w-full h-12" onClick={handleOAuthGoogle} disabled={isLoading || !isLoaded}>
            <GoogleIcon />
            Google
          </Button>

          <p className="mt-8 text-xs text-muted-foreground">
            {isLogin ? "Não tem uma conta?" : "Já tem uma conta?"}
            <Link to={isLogin ? "/registro" : "/login"} className="text-primary hover:underline ml-1">
              {isLogin ? "Crie uma conta" : "Faça login"}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


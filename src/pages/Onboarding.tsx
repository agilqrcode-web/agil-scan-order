import { useState } from "react";
import { SignedIn, SignedOut, SignUp, useUser, useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";

export default function Onboarding() {
  const { user, isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const { refetch: refetchUserProfile, profileComplete } = useUserProfile();

  useEffect(() => {
    if (profileComplete && !loading) { // Ensure profile is complete and not still loading from the API call
      navigate("/dashboard", { replace: true });
    }
  }, [profileComplete, loading, navigate]);

  console.log("Onboarding.tsx: Onboarding component rendering.");
  console.log("Onboarding.tsx: Clerk user data - isLoaded:", isLoaded, "isSignedIn:", isSignedIn, "user:", user);
  
  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    restaurantName: user?.unsafeMetadata?.restaurantName as string || ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      console.error("Clerk user not available. Cannot proceed with onboarding.");
      return;
    }
    setLoading(true);

    try {
      const token = await getToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/profile?action=onboard-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          restaurantName: formData.restaurantName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save onboarding data via backend.");
      }

      // Se a requisição foi bem-sucedida, o código continua aqui
      toast({
        title: "Sucesso!",
        description: "Seu perfil foi criado.",
      });
      await queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      await refetchUserProfile(); // Explicitly refetch and wait for user profile to update

    } catch (error) {
      console.error("Erro no onboarding:", error);
      toast({
        title: "Erro",
        description: "Não foi possível completar seu cadastro. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <SignedIn>
        {console.log("Onboarding.tsx: SignedIn block rendering.")}
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Complete seu perfil
              </CardTitle>
              <CardDescription>
                Precisamos de algumas informações para finalizar sua conta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nome</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    placeholder="Seu primeiro nome"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Sobrenome</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    placeholder="Seu sobrenome"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="restaurantName">Nome do Restaurante</Label>
                  <Input
                    id="restaurantName"
                    value={formData.restaurantName}
                    onChange={(e) => handleInputChange("restaurantName", e.target.value)}
                    placeholder="Nome do seu restaurante"
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Finalizar cadastro
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </SignedIn>
      <SignedOut>
        {console.log("Onboarding.tsx: SignedOut block rendering.")}
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Faça seu cadastro para continuar</h2>
          <div className="flex justify-center">
             <SignUp signInUrl="/sign-in" redirectUrl="/onboarding" />
          </div>
          <Button variant="link" className="mt-4" onClick={() => navigate('/')}>
            Voltar para a página inicial
          </Button>
        </div>
      </SignedOut>
    </div>
  );
}
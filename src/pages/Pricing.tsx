import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, QrCode } from "lucide-react";

const Pricing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <QrCode className="h-8 w-8 text-accent" />
            <span className="text-2xl font-bold text-primary">Ágil</span>
          </div>
          <Button variant="ghost" asChild>
            <a href="/">Voltar</a>
          </Button>
        </div>
      </header>

      {/* Pricing Content */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-4 mb-16">
            <h1 className="text-4xl lg:text-5xl font-bold text-primary">
              Planos Simples e Transparentes
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Escolha o plano ideal para o seu restaurante. Comece grátis e escale conforme cresce.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Free Plan */}
            <Card className="border-2">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Gratuito</CardTitle>
                <CardDescription>Perfeito para começar</CardDescription>
                <div className="text-4xl font-bold text-primary mt-4">R$ 0</div>
                <div className="text-muted-foreground">/mês</div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Até 3 mesas</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Cardápio digital básico</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>QR Code ilimitado</span>
                  </div>
                </div>
                <Button className="w-full bg-accent hover:bg-accent/90" asChild>
                  <a href="/registro">Começar Grátis</a>
                </Button>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="border-2 border-accent relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-accent text-accent-foreground px-4 py-1 rounded-full text-sm font-semibold">
                  Mais Popular
                </span>
              </div>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Profissional</CardTitle>
                <CardDescription>Para restaurantes em crescimento</CardDescription>
                <div className="text-4xl font-bold text-primary mt-4">R$ 49</div>
                <div className="text-muted-foreground">/mês</div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Até 20 mesas</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Cardápio personalizado</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Relatórios avançados</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Suporte prioritário</span>
                  </div>
                </div>
                <Button className="w-full bg-accent hover:bg-accent/90" asChild>
                  <a href="/registro">Escolher Plano</a>
                </Button>
              </CardContent>
            </Card>

            {/* Enterprise Plan */}
            <Card className="border-2">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Empresarial</CardTitle>
                <CardDescription>Para redes de restaurantes</CardDescription>
                <div className="text-4xl font-bold text-primary mt-4">R$ 149</div>
                <div className="text-muted-foreground">/mês</div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Mesas ilimitadas</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Multi-restaurantes</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>API personalizada</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Suporte dedicado</span>
                  </div>
                </div>
                <Button className="w-full bg-accent hover:bg-accent/90" asChild>
                  <a href="/contato">Falar com Vendas</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Pricing;
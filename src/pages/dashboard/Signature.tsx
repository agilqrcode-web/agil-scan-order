import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap } from "lucide-react";

const plans = [
  {
    name: "Básico",
    price: "R$ 29",
    period: "/mês",
    description: "Perfeito para pequenos restaurantes",
    features: [
      "Até 5 mesas",
      "1 cardápio",
      "Suporte por email",
      "Relatórios básicos"
    ],
    current: true
  },
  {
    name: "Profissional",
    price: "R$ 79",
    period: "/mês",
    description: "Ideal para restaurantes em crescimento",
    features: [
      "Até 20 mesas",
      "Múltiplos cardápios",
      "Suporte prioritário",
      "Relatórios avançados",
      "Integração com delivery",
      "Personalização avançada"
    ],
    current: false,
    popular: true
  },
  {
    name: "Empresarial",
    price: "R$ 199",
    period: "/mês",
    description: "Para redes e grandes estabelecimentos",
    features: [
      "Mesas ilimitadas",
      "Múltiplos restaurantes",
      "Suporte 24/7",
      "API personalizada",
      "Manager dedicado",
      "Treinamento incluso"
    ],
    current: false
  }
];

export default function Signature() {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Assinatura</h1>
        <p className="text-muted-foreground">
          Escolha o plano ideal para o seu negócio
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                Plano Atual: Básico
              </CardTitle>
              <CardDescription>
                Renovação em 15 de fevereiro de 2024
              </CardDescription>
            </div>
            <Badge variant="secondary">Ativo</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">R$ 29/mês</p>
              <p className="text-sm text-muted-foreground">
                Próxima cobrança: R$ 29,00
              </p>
            </div>
            <div className="space-x-2">
              <Button variant="outline">Cancelar Assinatura</Button>
              <Button>Fazer Upgrade</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.name} className={`relative ${plan.popular ? 'border-primary' : ''}`}>
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground">
                  <Zap className="mr-1 h-3 w-3" />
                  Mais Popular
                </Badge>
              </div>
            )}
            
            <CardHeader className="text-center">
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center">
                    <Check className="mr-2 h-4 w-4 text-primary" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button 
                className="w-full" 
                variant={plan.current ? "secondary" : "default"}
                disabled={plan.current}
              >
                {plan.current ? "Plano Atual" : "Escolher Plano"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Pagamentos</CardTitle>
          <CardDescription>
            Seus últimos pagamentos e faturas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">Janeiro 2024</p>
                <p className="text-sm text-muted-foreground">Plano Básico</p>
              </div>
              <div className="text-right">
                <p className="font-medium">R$ 29,00</p>
                <Badge variant="secondary">Pago</Badge>
              </div>
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">Dezembro 2023</p>
                <p className="text-sm text-muted-foreground">Plano Básico</p>
              </div>
              <div className="text-right">
                <p className="font-medium">R$ 29,00</p>
                <Badge variant="secondary">Pago</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
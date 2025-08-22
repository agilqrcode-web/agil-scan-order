import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  Play, 
  CheckCircle, 
  Store, 
  QrCode, 
  Menu, 
  ShoppingCart,
  Users,
  BarChart3
} from "lucide-react";

const steps = [
  {
    id: 1,
    title: "Configurar Restaurante",
    description: "Crie o perfil do seu restaurante com informações básicas",
    icon: Store,
    completed: false,
    duration: "5 min"
  },
  {
    id: 2,
    title: "Criar Cardápio",
    description: "Adicione categorias e itens do seu cardápio",
    icon: Menu,
    completed: false,
    duration: "15 min"
  },
  {
    id: 3,
    title: "Configurar Mesas",
    description: "Defina as mesas e gere os QR Codes",
    icon: QrCode,
    completed: false,
    duration: "10 min"
  },
  {
    id: 4,
    title: "Testar Pedidos",
    description: "Faça um pedido teste para verificar o funcionamento",
    icon: ShoppingCart,
    completed: false,
    duration: "5 min"
  },
  {
    id: 5,
    title: "Treinar Equipe",
    description: "Capacite sua equipe para usar a plataforma",
    icon: Users,
    completed: false,
    duration: "20 min"
  }
];

const resources = [
  {
    title: "Como Configurar seu Primeiro Restaurante",
    description: "Tutorial passo a passo para começar",
    type: "video",
    duration: "8 min"
  },
  {
    title: "Guia Completo do Cardápio Digital",
    description: "Aprenda a criar cardápios atrativos",
    type: "article",
    duration: "12 min"
  },
  {
    title: "Melhores Práticas para QR Codes",
    description: "Como posicionar e divulgar seus QR codes",
    type: "article",
    duration: "6 min"
  },
  {
    title: "Análise de Relatórios",
    description: "Como interpretar os dados de vendas",
    type: "video",
    duration: "15 min"
  }
];

export default function PlatformGuide() {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Guia da Plataforma</h1>
        <p className="text-muted-foreground">
          Aprenda a usar o Ágil QR e maximize seus resultados
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Primeiros Passos
          </CardTitle>
          <CardDescription>
            Complete estes passos para começar a usar a plataforma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-4 p-4 border rounded-lg">
                <div className={`p-2 rounded-full ${step.completed ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {step.completed ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <step.icon className="h-5 w-5 text-gray-600" />
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold min-w-0">
                      {index + 1}. {step.title}
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      {step.duration}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>

                <Button 
                  size="sm" 
                  variant={step.completed ? "secondary" : "default"}
                  disabled={step.completed}
                >
                  {step.completed ? "Concluído" : "Iniciar"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Recursos de Aprendizado
            </CardTitle>
            <CardDescription>
              Tutoriais e guias para dominar a plataforma
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {resources.map((resource, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 cursor-pointer">
                  <div className="p-2 bg-primary/10 rounded">
                    {resource.type === 'video' ? (
                      <Play className="h-4 w-4 text-primary" />
                    ) : (
                      <BookOpen className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="font-medium mb-1">{resource.title}</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      {resource.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {resource.type === 'video' ? 'Vídeo' : 'Artigo'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {resource.duration}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Dicas de Sucesso
            </CardTitle>
            <CardDescription>
              Estratégias para maximizar seus resultados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">
                  📱 Posicionamento do QR Code
                </h4>
                <p className="text-sm text-blue-700">
                  Coloque os QR codes em locais visíveis e de fácil acesso nas mesas.
                </p>
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-900 mb-2">
                  🍽️ Fotos Atrativas
                </h4>
                <p className="text-sm text-green-700">
                  Use imagens de alta qualidade nos seus pratos para aumentar as vendas.
                </p>
              </div>

              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h4 className="font-medium text-purple-900 mb-2">
                  ⚡ Atualização Constante
                </h4>
                <p className="text-sm text-purple-700">
                  Mantenha o cardápio sempre atualizado com preços e disponibilidade.
                </p>
              </div>

              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <h4 className="font-medium text-orange-900 mb-2">
                  📊 Análise de Dados
                </h4>
                <p className="text-sm text-orange-700">
                  Use os relatórios para identificar pratos mais vendidos e otimizar o cardápio.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Precisa de Ajuda?</CardTitle>
          <CardDescription>
            Nossa equipe está pronta para te ajudar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <Button className="w-full sm:w-auto">
              <BookOpen className="mr-2 h-4 w-4" />
              Central de Ajuda
            </Button>
            <Button variant="outline" className="w-full sm:w-auto">
              Falar com Suporte
            </Button>
            <Button variant="outline" className="w-full sm:w-auto">
              Agendar Treinamento
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
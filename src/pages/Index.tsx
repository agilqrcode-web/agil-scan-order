import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode, Clock, BarChart3, Smartphone, Users, TrendingUp } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <QrCode className="h-8 w-8 text-accent" />
            <span className="text-2xl font-bold text-primary">Ágil</span>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-muted-foreground hover:text-primary transition-colors">Features</a>
            <a href="#como-funciona" className="text-muted-foreground hover:text-primary transition-colors">Como Funciona</a>
            <a href="/precos" className="text-muted-foreground hover:text-primary transition-colors">Preços</a>
            <a href="/contato" className="text-muted-foreground hover:text-primary transition-colors">Contato</a>
          </nav>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" asChild>
              <a href="/login">Login</a>
            </Button>
            <Button className="bg-accent hover:bg-accent/90" asChild>
              <a href="/registro">Começar Grátis</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-5xl lg:text-6xl font-bold text-primary leading-tight">
                  Digitalize seu Atendimento e Simplifique Pedidos com
                  <span className="text-accent"> QR Code</span>
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  Transforme seu restaurante com nossa plataforma de pedidos digitais. 
                  Clientes escaneiam, pedem e você gerencia tudo em tempo real.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="bg-accent hover:bg-accent/90 text-lg px-8 py-6" asChild>
                  <a href="/registro">Comece Gratuitamente</a>
                </Button>
                <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                  Ver Demo
                </Button>
              </div>
              <div className="flex items-center space-x-8 text-sm text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Setup em 5 minutos</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Sem taxas de instalação</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-accent/20 to-primary/20 rounded-3xl p-8 backdrop-blur-sm">
                <div className="bg-card rounded-2xl p-6 shadow-xl">
                  <Smartphone className="h-80 w-full text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-muted/50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl font-bold text-primary">
              Tudo que você precisa para modernizar seu restaurante
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Uma plataforma completa para digitalizar seu atendimento e aumentar a eficiência do seu negócio.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <QrCode className="h-12 w-12 text-accent mb-4" />
                <CardTitle>Cardápio Digital Fácil</CardTitle>
                <CardDescription>
                  Clientes acessam seu cardápio completo escaneando um QR Code. 
                  Sem app para baixar, sem complicação.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <Clock className="h-12 w-12 text-accent mb-4" />
                <CardTitle>Pedidos em Tempo Real</CardTitle>
                <CardDescription>
                  Receba pedidos instantaneamente em seu painel. 
                  Acompanhe o status e mantenha seus clientes informados.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <BarChart3 className="h-12 w-12 text-accent mb-4" />
                <CardTitle>Gestão de Mesas</CardTitle>
                <CardDescription>
                  Controle todas as mesas do seu restaurante, 
                  comandas abertas e histórico de pedidos em um só lugar.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="como-funciona" className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl font-bold text-primary">Como Funciona</h2>
            <p className="text-xl text-muted-foreground">
              Simples, rápido e eficiente - em apenas 3 passos
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center space-y-4">
              <div className="bg-accent text-accent-foreground rounded-full w-16 h-16 flex items-center justify-center text-2xl font-bold mx-auto">
                1
              </div>
              <h3 className="text-2xl font-semibold">Cliente Escaneia</h3>
              <p className="text-muted-foreground">
                O cliente escaneia o QR Code da mesa e acessa seu cardápio digital instantaneamente.
              </p>
            </div>
            
            <div className="text-center space-y-4">
              <div className="bg-accent text-accent-foreground rounded-full w-16 h-16 flex items-center justify-center text-2xl font-bold mx-auto">
                2
              </div>
              <h3 className="text-2xl font-semibold">Faz o Pedido</h3>
              <p className="text-muted-foreground">
                Escolhe os itens, personaliza o pedido e confirma. Tudo pelo celular, sem pressa.
              </p>
            </div>
            
            <div className="text-center space-y-4">
              <div className="bg-accent text-accent-foreground rounded-full w-16 h-16 flex items-center justify-center text-2xl font-bold mx-auto">
                3
              </div>
              <h3 className="text-2xl font-semibold">Você Recebe</h3>
              <p className="text-muted-foreground">
                O pedido aparece no seu painel em tempo real. Prepare e atualize o status facilmente.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-20 px-6 bg-muted/50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl font-bold text-primary">
              Restaurantes que confiam na Ágil
            </h2>
            <p className="text-xl text-muted-foreground">
              Depoimentos de clientes satisfeitos em breve
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex text-accent">
                      {[...Array(5)].map((_, j) => (
                        <span key={j}>★</span>
                      ))}
                    </div>
                    <p className="text-muted-foreground italic">
                      "Em breve, depoimentos reais de restaurantes que transformaram 
                      seu atendimento com a Ágil."
                    </p>
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-muted rounded-full"></div>
                      <div>
                        <p className="font-semibold">Restaurante #{i}</p>
                        <p className="text-sm text-muted-foreground">Proprietário</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="space-y-8">
            <h2 className="text-4xl lg:text-5xl font-bold text-primary">
              Pronto para digitalizar seu restaurante?
            </h2>
            <p className="text-xl text-muted-foreground">
              Junte-se aos restaurantes que já estão oferecendo uma experiência moderna aos seus clientes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-accent hover:bg-accent/90 text-lg px-8 py-6" asChild>
                <a href="/registro">Começar Gratuitamente</a>
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 py-6" asChild>
                <a href="/contato">Falar com Especialista</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground py-12 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <QrCode className="h-6 w-6" />
                <span className="text-xl font-bold">Ágil</span>
              </div>
              <p className="text-primary-foreground/80">
                Digitalizando restaurantes e simplificando pedidos com tecnologia QR Code.
              </p>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-semibold">Produto</h4>
              <div className="space-y-2">
                <a href="#features" className="block text-primary-foreground/80 hover:text-primary-foreground">Features</a>
                <a href="/precos" className="block text-primary-foreground/80 hover:text-primary-foreground">Preços</a>
                <a href="/ajuda" className="block text-primary-foreground/80 hover:text-primary-foreground">Ajuda</a>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-semibold">Empresa</h4>
              <div className="space-y-2">
                <a href="/sobre" className="block text-primary-foreground/80 hover:text-primary-foreground">Sobre</a>
                <a href="/blog" className="block text-primary-foreground/80 hover:text-primary-foreground">Blog</a>
                <a href="/contato" className="block text-primary-foreground/80 hover:text-primary-foreground">Contato</a>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-semibold">Legal</h4>
              <div className="space-y-2">
                <a href="/termos" className="block text-primary-foreground/80 hover:text-primary-foreground">Termos de Uso</a>
                <a href="/privacidade" className="block text-primary-foreground/80 hover:text-primary-foreground">Privacidade</a>
              </div>
            </div>
          </div>
          
          <div className="border-t border-primary-foreground/20 mt-8 pt-8 text-center text-primary-foreground/80">
            <p>&copy; 2024 Ágil. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;

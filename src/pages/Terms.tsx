import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";

const Terms = () => {
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

      {/* Terms Content */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-4xl prose prose-lg">
          <h1 className="text-4xl font-bold text-primary mb-8">Termos de Uso</h1>
          
          <div className="space-y-6 text-muted-foreground">
            <p className="text-sm text-muted-foreground">
              Última atualização: Janeiro de 2024
            </p>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">1. Aceite dos Termos</h2>
              <p>
                Ao acessar e usar a plataforma Ágil, você concorda em cumprir e estar vinculado 
                aos seguintes termos e condições de uso. Se você não concordar com qualquer 
                parte destes termos, não deve usar nosso serviço.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">2. Descrição do Serviço</h2>
              <p>
                O Ágil é uma plataforma de pedidos digitais que permite aos restaurantes 
                oferecer cardápios digitais através de códigos QR, facilitando o processo 
                de pedidos para clientes e gestão para estabelecimentos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">3. Contas de Usuário</h2>
              <p>
                Para usar certas funcionalidades do serviço, você deve registrar uma conta. 
                Você é responsável por manter a confidencialidade de suas credenciais de 
                acesso e por todas as atividades que ocorrem em sua conta.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">4. Uso Aceitável</h2>
              <p>
                Você concorda em usar o serviço apenas para fins legais e de acordo com 
                estes Termos. Você não deve usar o serviço de maneira que possa danificar, 
                desabilitar ou prejudicar o serviço.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">5. Pagamentos e Cancelamentos</h2>
              <p>
                Os termos de pagamento são especificados no momento da assinatura. 
                Cancelamentos podem ser feitos a qualquer momento através do painel 
                de controle da sua conta.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">6. Limitação de Responsabilidade</h2>
              <p>
                O Ágil não será responsável por quaisquer danos indiretos, incidentais, 
                especiais ou consequenciais resultantes do uso ou incapacidade de usar 
                o serviço.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">7. Modificações dos Termos</h2>
              <p>
                Reservamo-nos o direito de modificar estes termos a qualquer momento. 
                As mudanças entrarão em vigor imediatamente após a publicação no site.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">8. Contato</h2>
              <p>
                Se você tiver dúvidas sobre estes Termos de Uso, entre em contato conosco 
                através do email: contato@agil.com.br
              </p>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Terms;
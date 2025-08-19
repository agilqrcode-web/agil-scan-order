import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";

const Privacy = () => {
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

      {/* Privacy Content */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-4xl prose prose-lg">
          <h1 className="text-4xl font-bold text-primary mb-8">Política de Privacidade</h1>
          
          <div className="space-y-6 text-muted-foreground">
            <p className="text-sm text-muted-foreground">
              Última atualização: Janeiro de 2024
            </p>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">1. Informações que Coletamos</h2>
              <p>
                Coletamos informações que você nos fornece diretamente, como quando você 
                cria uma conta, configura seu restaurante, ou entra em contato conosco. 
                Isso pode incluir seu nome, email, informações do restaurante e preferências.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">2. Como Usamos Suas Informações</h2>
              <p>
                Usamos as informações coletadas para:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Fornecer e manter nosso serviço</li>
                <li>Processar transações e pedidos</li>
                <li>Enviar comunicações relacionadas ao serviço</li>
                <li>Melhorar nossos serviços</li>
                <li>Detectar e prevenir fraudes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">3. Compartilhamento de Informações</h2>
              <p>
                Não vendemos, comercializamos ou transferimos suas informações pessoais 
                para terceiros, exceto conforme descrito nesta política. Podemos 
                compartilhar informações com prestadores de serviços que nos ajudam 
                a operar nossa plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">4. Segurança dos Dados</h2>
              <p>
                Implementamos medidas de segurança adequadas para proteger suas 
                informações pessoais contra acesso não autorizado, alteração, 
                divulgação ou destruição.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">5. Cookies e Tecnologias Similares</h2>
              <p>
                Usamos cookies e tecnologias similares para melhorar sua experiência, 
                analisar o uso do site e personalizar conteúdo. Você pode controlar 
                o uso de cookies através das configurações do seu navegador.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">6. Seus Direitos</h2>
              <p>
                Você tem o direito de acessar, atualizar ou excluir suas informações 
                pessoais. Entre em contato conosco se desejar exercer esses direitos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">7. Retenção de Dados</h2>
              <p>
                Mantemos suas informações pessoais apenas pelo tempo necessário para 
                cumprir os propósitos descritos nesta política, a menos que um período 
                de retenção mais longo seja exigido por lei.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">8. Mudanças nesta Política</h2>
              <p>
                Podemos atualizar esta Política de Privacidade periodicamente. 
                Notificaremos você sobre mudanças significativas publicando a nova 
                política em nosso site.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">9. Contato</h2>
              <p>
                Se você tiver dúvidas sobre esta Política de Privacidade, entre em 
                contato conosco através do email: privacidade@agil.com.br
              </p>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Privacy;
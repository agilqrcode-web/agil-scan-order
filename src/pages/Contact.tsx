import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QrCode, Mail, Phone, MapPin } from "lucide-react";

const Contact = () => {
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

      {/* Contact Content */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-4 mb-16">
            <h1 className="text-4xl lg:text-5xl font-bold text-primary">
              Entre em Contato
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tem dúvidas? Quer uma demonstração? Nossa equipe está pronta para ajudar você.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <Card>
              <CardHeader>
                <CardTitle>Envie uma Mensagem</CardTitle>
                <CardDescription>
                  Preencha o formulário e entraremos em contato em até 24 horas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input id="name" placeholder="Seu nome completo" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="seu@email.com" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="restaurant">Nome do Restaurante</Label>
                  <Input id="restaurant" placeholder="Nome do seu restaurante" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" placeholder="(11) 99999-9999" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Mensagem</Label>
                  <Textarea 
                    id="message" 
                    placeholder="Como podemos ajudar você?" 
                    rows={4}
                  />
                </div>
                <Button className="w-full bg-accent hover:bg-accent/90">
                  Enviar Mensagem
                </Button>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <div className="space-y-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <Mail className="h-8 w-8 text-accent" />
                    <div>
                      <h3 className="font-semibold">Email</h3>
                      <p className="text-muted-foreground">contato@agil.com.br</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <Phone className="h-8 w-8 text-accent" />
                    <div>
                      <h3 className="font-semibold">Telefone</h3>
                      <p className="text-muted-foreground">(11) 3000-0000</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <MapPin className="h-8 w-8 text-accent" />
                    <div>
                      <h3 className="font-semibold">Endereço</h3>
                      <p className="text-muted-foreground">
                        São Paulo, SP<br />
                        Brasil
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-accent/5 border-accent/20">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-2">Horário de Atendimento</h3>
                  <div className="space-y-1 text-muted-foreground">
                    <p>Segunda a Sexta: 9h às 18h</p>
                    <p>Sábado: 9h às 14h</p>
                    <p>Domingo: Fechado</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
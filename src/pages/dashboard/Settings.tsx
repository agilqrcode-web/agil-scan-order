import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Label } from "@/components/ui/label";
// import { Switch } from "@/components/ui/switch";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Settings() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Configurações</h1>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Notificações</CardTitle>
            <CardDescription>
              Configure como você quer receber notificações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Temporarily removed interactive elements */}
            <p>Conteúdo estático de Notificações.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferências do Sistema</CardTitle>
            <CardDescription>
              Configure as preferências da plataforma
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Temporarily removed interactive elements */}
            <p>Conteúdo estático de Preferências do Sistema.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Zona de Perigo</CardTitle>
            <CardDescription>
              Ações irreversíveis para sua conta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Temporarily removed interactive elements */}
            <p>Conteúdo estático da Zona de Perigo.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
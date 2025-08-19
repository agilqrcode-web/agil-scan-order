import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Notificações por Email</Label>
                <p className="text-sm text-muted-foreground">
                  Receba notificações importantes por email
                </p>
              </div>
              <Switch />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Novos Pedidos</Label>
                <p className="text-sm text-muted-foreground">
                  Seja notificado quando um novo pedido chegar
                </p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Relatórios Semanais</Label>
                <p className="text-sm text-muted-foreground">
                  Receba um resumo semanal das suas vendas
                </p>
              </div>
              <Switch />
            </div>
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
            <div className="space-y-2">
              <Label>Idioma</Label>
              <Select defaultValue="pt-br">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-br">Português (Brasil)</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fuso Horário</Label>
              <Select defaultValue="america/sao_paulo">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="america/sao_paulo">São Paulo (UTC-3)</SelectItem>
                  <SelectItem value="america/new_york">New York (UTC-5)</SelectItem>
                  <SelectItem value="europe/london">London (UTC+0)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Som de Notificação</Label>
                <p className="text-sm text-muted-foreground">
                  Reproduzir som quando receber notificações
                </p>
              </div>
              <Switch defaultChecked />
            </div>
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
            <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg">
              <div>
                <h4 className="font-medium text-destructive">Excluir Conta</h4>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button variant="destructive">Excluir</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
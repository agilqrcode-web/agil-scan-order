import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, CheckCheck, Trash2, Settings } from "lucide-react";

const notifications = [
  {
    id: 1,
    title: "Novo pedido recebido",
    message: "Mesa 5 fez um pedido de R$ 45,90",
    time: "2 min atrás",
    read: false,
    type: "order"
  },
  {
    id: 2,
    title: "Pagamento aprovado",
    message: "Assinatura mensal renovada com sucesso",
    time: "1 hora atrás",
    read: false,
    type: "payment"
  },
  {
    id: 3,
    title: "Meta de vendas atingida",
    message: "Parabéns! Você superou a meta do mês",
    time: "3 horas atrás",
    read: true,
    type: "achievement"
  },
  {
    id: 4,
    title: "Novo recurso disponível",
    message: "Confira as novas funcionalidades de relatórios",
    time: "1 dia atrás",
    read: true,
    type: "feature"
  },
  {
    id: 5,
    title: "Pedido cancelado",
    message: "Mesa 3 cancelou o pedido #CMD001",
    time: "2 dias atrás",
    read: true,
    type: "order"
  }
];

const typeColors = {
  order: "bg-blue-100 text-blue-800",
  payment: "bg-green-100 text-green-800",
  achievement: "bg-purple-100 text-purple-800",
  feature: "bg-orange-100 text-orange-800"
};

const typeLabels = {
  order: "Pedido",
  payment: "Pagamento",
  achievement: "Conquista",
  feature: "Recurso"
};

export default function Notifications() {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notificações</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} não lidas` : "Todas as notificações foram lidas"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Configurar
          </Button>
          <Button variant="outline">
            <CheckCheck className="mr-2 h-4 w-4" />
            Marcar todas como lidas
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications.length}</div>
            <p className="text-xs text-muted-foreground">
              Notificações recebidas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Não Lidas</CardTitle>
            <Bell className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{unreadCount}</div>
            <p className="text-xs text-muted-foreground">
              Aguardando sua atenção
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hoje</CardTitle>
            <Bell className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {notifications.filter(n => n.time.includes('min') || n.time.includes('hora')).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Notificações recebidas hoje
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todas as Notificações</CardTitle>
          <CardDescription>
            Histórico completo das suas notificações
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-start gap-4 p-4 border rounded-lg transition-colors ${
                  notification.read ? 'bg-background' : 'bg-accent/50'
                }`}
              >
                <div className={`p-2 rounded-full ${notification.read ? 'bg-gray-100' : 'bg-primary/10'}`}>
                  <Bell className={`h-4 w-4 ${notification.read ? 'text-gray-500' : 'text-primary'}`} />
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-medium ${!notification.read ? 'font-semibold' : ''} min-w-0`}>
                      {notification.title}
                    </h3>
                    <Badge 
                      variant="outline" 
                      className={typeColors[notification.type as keyof typeof typeColors]}
                    >
                      {typeLabels[notification.type as keyof typeof typeLabels]}
                    </Badge>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    {notification.message}
                  </p>
                  
                  <p className="text-xs text-muted-foreground">
                    {notification.time}
                  </p>
                </div>

                <div className="flex gap-1">
                  {!notification.read && (
                    <Button size="sm" variant="ghost">
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center">
            <Button variant="outline">
              Carregar mais notificações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
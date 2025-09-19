import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, CheckCheck, Trash2, Settings } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationsContext";
import { OrderNotification } from "@/hooks/useRealtimeOrders";

export default function Notifications() {
  const { newOrderNotifications, unreadCount, markAsRead, clearAllNotifications } = useNotifications();

  const handleMarkAllAsRead = () => {
    newOrderNotifications.forEach(notif => {
      if (!notif.isRead) {
        markAsRead(notif.id);
      }
    });
  };

  const handleDeleteNotification = (id: string) => {
    // For now, clearAllNotifications will remove all. 
    // In a real app, you'd have a backend endpoint to delete a specific notification.
    // For this implementation, we'll just mark as read if it's an individual delete.
    markAsRead(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notificações</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} não lidas` : "Todas as notificações foram lidas"}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-end">
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Configurar</span>
          </Button>
          <Button variant="outline" onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
            <CheckCheck className="mr-2 h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Marcar todas como lidas</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{newOrderNotifications.length}</div>
            <p className="text-xs text-muted-foreground">
              Notificações recebidas
            </p>
          </CardContent>
        </Card>

        <Card className="min-w-0">
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

        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hoje</CardTitle>
            <Bell className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {/* For simplicity, we'll count all unread as 'today' for now */}
              {unreadCount}
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
            {newOrderNotifications.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <Bell className="mx-auto h-12 w-12" />
                <p className="mt-4">Nenhuma notificação de pedido no momento.</p>
              </div>
            ) : (
              newOrderNotifications.map((notification: OrderNotification) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-4 p-4 border rounded-lg transition-colors ${
                    notification.isRead ? 'bg-background' : 'bg-accent/50'
                  }`}
                >
                  <div className={`p-2 rounded-full ${notification.isRead ? 'bg-gray-100' : 'bg-primary/10'}`}>
                    <Bell className={`h-4 w-4 ${notification.isRead ? 'text-gray-500' : 'text-primary'}`} />
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`font-medium ${!notification.isRead ? 'font-semibold' : ''} min-w-0`}>
                        Novo Pedido - Mesa {notification.table_id || 'N/A'}
                      </h3>
                      <Badge 
                        variant="outline" 
                        className="bg-blue-100 text-blue-800"
                      >
                        Pedido
                      </Badge>
                      {!notification.isRead && (
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      Total: R$ {notification.total_amount.toFixed(2).replace('.', ',')}
                    </p>
                    
                    <p className="text-xs text-muted-foreground">
                      Recebido em: {new Date(notification.created_at).toLocaleTimeString()}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    {!notification.isRead && (
                      <Button size="sm" variant="ghost" className="w-full" onClick={() => markAsRead(notification.id)}>
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="w-full" onClick={() => handleDeleteNotification(notification.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 text-center">
            <Button variant="outline" onClick={clearAllNotifications} disabled={newOrderNotifications.length === 0}>
              Limpar todas as notificações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
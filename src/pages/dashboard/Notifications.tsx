import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, CheckCheck, Trash2, Settings, RefreshCw, XCircle } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { Spinner } from "@/components/ui/spinner";

export default function Notifications() {
  const {
    notificationsData,
    isLoading,
    error,
    updateNotification,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const stats = notificationsData?.stats;
  const notifications = notificationsData?.notifications || [];

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Spinner size="large" /></div>;
  }

  if (error) {
    return (
      <div className="text-center text-red-500 py-12">
        <XCircle className="mx-auto h-12 w-12" />
        <p className="mt-4">Falha ao carregar notificações.</p>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notificações</h1>
          <p className="text-muted-foreground">
            {stats?.unread ?? 0 > 0 ? `${stats?.unread} não lidas` : "Todas as notificações foram lidas"}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-end">
          <Button variant="outline" disabled>
            <Settings className="mr-2 h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Configurar</span>
          </Button>
          <Button variant="outline" onClick={() => markAllAsRead()} disabled={stats?.unread === 0}>
            <CheckCheck className="mr-2 h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Marcar todas como lidas</span>
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
            <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
            <p className="text-xs text-muted-foreground">Notificações recebidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Não Lidas</CardTitle>
            <Bell className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats?.unread ?? 0}</div>
            <p className="text-xs text-muted-foreground">Aguardando sua atenção</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hoje</CardTitle>
            <Bell className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.today ?? 0}</div>
            <p className="text-xs text-muted-foreground">Notificações recebidas hoje</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todas as Notificações</CardTitle>
          <CardDescription>Histórico completo das suas notificações</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {notifications.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <Bell className="mx-auto h-12 w-12" />
                <p className="mt-4">Nenhuma notificação no momento.</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-4 p-4 border rounded-lg transition-colors ${
                    notification.is_read ? 'bg-background text-muted-foreground' : 'bg-accent/50'
                  }`}
                >
                  <div className={`p-2 rounded-full ${notification.is_read ? 'bg-gray-100' : 'bg-primary/10'}`}>
                    <Bell className={`h-4 w-4 ${notification.is_read ? 'text-gray-500' : 'text-primary'}`} />
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`font-medium ${!notification.is_read ? 'font-semibold' : ''}`}>
                        Novo Pedido - Mesa {notification.data.table_number}
                      </h3>
                      <Badge variant="outline" className="bg-blue-100 text-blue-800">Pedido</Badge>
                      {!notification.is_read && <div className="w-2 h-2 bg-primary rounded-full"></div>}
                    </div>
                    
                    <p className="text-sm">
                      Cliente: <span className="font-semibold">{notification.data.customer_name}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Total: R$ {(notification.data.total_amount || 0).toFixed(2).replace('.', ',')}
                    </p>
                    
                    <p className="text-xs text-muted-foreground">
                      {new Date(notification.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    {notification.is_read ? (
                       <Button title="Marcar como não lida" size="sm" variant="ghost" className="w-full" onClick={() => updateNotification({ notificationId: notification.id, isRead: false })}>
                         <RefreshCw className="h-3 w-3" />
                       </Button>
                    ) : (
                      <Button title="Marcar como lida" size="sm" variant="ghost" className="w-full" onClick={() => updateNotification({ notificationId: notification.id, isRead: true })}>
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                    <Button title="Excluir notificação" size="sm" variant="ghost" className="w-full text-red-500 hover:text-red-600" onClick={() => deleteNotification(notification.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
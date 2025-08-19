import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Clock, CheckCircle, XCircle, Eye } from "lucide-react";

const mockOrders = [
  {
    id: "CMD001",
    table: 2,
    customer: "João Silva",
    items: ["Hambúrguer", "Batata Frita", "Coca-Cola"],
    total: 45.90,
    status: "preparing",
    time: "10 min",
    createdAt: "14:30"
  },
  {
    id: "CMD002",
    table: 5,
    customer: "Maria Santos",
    items: ["Pizza Margherita", "Suco de Laranja"],
    total: 32.50,
    status: "ready",
    time: "25 min",
    createdAt: "14:15"
  },
  {
    id: "CMD003",
    table: 1,
    customer: "Pedro Costa",
    items: ["Salada Caesar", "Água"],
    total: 18.90,
    status: "pending",
    time: "5 min",
    createdAt: "14:45"
  },
  {
    id: "CMD004",
    table: 3,
    customer: "Ana Lima",
    items: ["Lasanha", "Refrigerante"],
    total: 28.90,
    status: "delivered",
    time: "45 min",
    createdAt: "13:30"
  }
];

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  preparing: "bg-blue-100 text-blue-800",
  ready: "bg-green-100 text-green-800",
  delivered: "bg-gray-100 text-gray-800"
};

const statusLabels = {
  pending: "Pendente",
  preparing: "Preparando",
  ready: "Pronto",
  delivered: "Entregue"
};

export default function Commands() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Comandas</h1>
        <div className="flex gap-2">
          <Button variant="outline">
            <Clock className="mr-2 h-4 w-4" />
            Relatório
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {mockOrders.filter(o => o.status === 'pending').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preparando</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {mockOrders.filter(o => o.status === 'preparing').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prontos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {mockOrders.filter(o => o.status === 'ready').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {mockOrders.filter(o => o.status === 'delivered').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pedidos</CardTitle>
          <CardDescription>
            Gerencie todos os pedidos em tempo real
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por ID, cliente ou mesa..." className="pl-9" />
              </div>
              <Select>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="preparing">Preparando</SelectItem>
                  <SelectItem value="ready">Prontos</SelectItem>
                  <SelectItem value="delivered">Entregues</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              {mockOrders.map((order) => (
                <Card key={order.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">#{order.id}</h3>
                          <Badge 
                            className={statusColors[order.status as keyof typeof statusColors]}
                          >
                            {statusLabels[order.status as keyof typeof statusLabels]}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Mesa {order.table}
                          </span>
                        </div>
                        
                        <p className="text-sm">
                          <strong>{order.customer}</strong> • {order.createdAt} • {order.time}
                        </p>
                        
                        <p className="text-sm text-muted-foreground">
                          {order.items.join(", ")}
                        </p>
                        
                        <p className="font-semibold text-primary">
                          R$ {order.total.toFixed(2)}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Eye className="h-3 w-3" />
                        </Button>
                        
                        {order.status === 'pending' && (
                          <Button size="sm">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Aceitar
                          </Button>
                        )}
                        
                        {order.status === 'preparing' && (
                          <Button size="sm" variant="secondary">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Finalizar
                          </Button>
                        )}
                        
                        {order.status === 'ready' && (
                          <Button size="sm" variant="secondary">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Entregar
                          </Button>
                        )}

                        {order.status !== 'delivered' && (
                          <Button size="sm" variant="destructive">
                            <XCircle className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
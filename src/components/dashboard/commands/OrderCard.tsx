import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, CheckCircle, XCircle } from "lucide-react";
import { Order } from "@/types/order"; // Importando a interface Order

interface OrderCardProps {
  order: Order;
  // Futuras props para handlers de ação (ex: onAccept, onReady, onDelete)
}

const statusColors: { [key: string]: string } = {
  pending: "bg-yellow-100 text-yellow-800",
  preparing: "bg-blue-100 text-blue-800",
  ready: "bg-green-100 text-green-800",
  finalized: "bg-gray-100 text-gray-800",
};

const statusLabels: { [key: string]: string } = {
  pending: "Pendente",
  preparing: "Preparando",
  ready: "Pronto",
  finalized: "Finalizado",
};

export function OrderCard({ order }: OrderCardProps) {
  return (
    <Card key={order.id} className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="font-semibold">Pedido de {order.customer_name}</h3>
              <Badge className={statusColors[order.status]}>{statusLabels[order.status]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {new Date(order.created_at).toLocaleTimeString()}
            </p>
            <p className="text-sm font-semibold text-primary">
              Total do Pedido: R$ {order.total_amount.toFixed(2).replace('.', ',')}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap mt-2 sm:mt-0">
            <Button size="sm" variant="outline"><Eye className="h-3 w-3" /></Button>
            {order.status === 'pending' && <Button size="sm"><CheckCircle className="mr-1 h-3 w-3" />Aceitar</Button>}
            {order.status === 'preparing' && <Button size="sm" variant="secondary"><CheckCircle className="mr-1 h-3 w-3" />Pronto</Button>}
            {order.status === 'ready' && <Button size="sm" variant="secondary"><CheckCircle className="mr-1 h-3 w-3" />Entregar</Button>}
            {order.status !== 'finalized' && <Button size="sm" variant="destructive"><XCircle className="h-3 w-3" /></Button>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
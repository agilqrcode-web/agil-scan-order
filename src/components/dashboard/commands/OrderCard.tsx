import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, CheckCircle, XCircle } from "lucide-react";
import { Order } from "@/types/order";
import { useAuth } from "@clerk/clerk-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";

interface OrderCardProps {
  order: Order;
}

const statusColors: { [key: string]: string } = {
  pending: "bg-yellow-100 text-yellow-800",
  preparing: "bg-blue-100 text-blue-800",
  ready: "bg-green-100 text-green-800",
  finalized: "bg-gray-100 text-gray-800",
};

const statusLabels: { [key: string]: string } = {
  pending: "Pendente",
  preparing: "Em Preparação",
  ready: "Pronto",
  finalized: "Finalizado",
};

export function OrderCard({ order }: OrderCardProps) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus }: { orderId: string; newStatus: string }) => {
      const token = await getToken({ template: "agilqrcode" });
      if (!token) {
        throw new Error("Authentication token not available.");
      }

      const response = await fetch('/api/orders', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId, newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao atualizar status.');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({ title: "Status atualizado!", description: `O status do pedido foi alterado para ${statusLabels[variables.newStatus]}.` });
      queryClient.invalidateQueries({ queryKey: ['orders'] }); // Invalidate orders query to refetch data
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erro ao atualizar status", description: error.message });
    },
  });

  const handleAcceptOrder = () => {
    updateOrderStatusMutation.mutate({ orderId: order.id, newStatus: 'preparing' });
  };

  const handleReadyOrder = () => {
    updateOrderStatusMutation.mutate({ orderId: order.id, newStatus: 'ready' });
  };

  const handleDeliverOrder = () => {
    updateOrderStatusMutation.mutate({ orderId: order.id, newStatus: 'finalized' });
  };

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
            {order.status === 'pending' && (
              <Button
                size="sm"
                onClick={handleAcceptOrder}
                disabled={updateOrderStatusMutation.isPending}
              >
                {updateOrderStatusMutation.isPending ? 'Aceitando...' : <><CheckCircle className="mr-1 h-3 w-3" />Aceitar</>}
              </Button>
            )}
            {order.status === 'preparing' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleReadyOrder}
                disabled={updateOrderStatusMutation.isPending}
              >
                {updateOrderStatusMutation.isPending ? 'Pronto...' : <><CheckCircle className="mr-1 h-3 w-3" />Pronto</>}
              </Button>
            )}
            {order.status === 'ready' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleDeliverOrder}
                disabled={updateOrderStatusMutation.isPending}
              >
                {updateOrderStatusMutation.isPending ? 'Entregando...' : <><CheckCircle className="mr-1 h-3 w-3" />Entregar</>}
              </Button>
            )}
            {order.status !== 'finalized' && (
              <Button size="sm" variant="destructive"><XCircle className="h-3 w-3" /></Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
import { useAuth } from "@clerk/clerk-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Clock, Utensils } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";
import React, { useState } from "react";
import { OrderCard } from "@/components/dashboard/commands/OrderCard";
import { Order } from "@/types/order";
import { OrderSummary } from "@/components/dashboard/commands/OrderSummary";
import { OrderFilterBar } from "@/components/dashboard/commands/OrderFilterBar";
import { OrderDetailModal } from "@/components/dashboard/commands/OrderDetailModal";
import { useToast } from "@/components/ui/use-toast";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { useNotifications } from "@/hooks/useNotifications";


interface GroupedOrders {
  [tableNumber: string]: {
    orders: Order[];
    totalAmount: number;
    tableNumber: number;
  };
}

export default function Commands() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { notificationsData } = useNotifications();
  const unreadCount = notificationsData?.stats.unread ?? 0;

  React.useEffect(() => {
    if (unreadCount > 0) {
      toast({
        title: "Novos Pedidos!",
        description: `Você tem ${unreadCount} novo(s) pedido(s) aguardando.`, 
      });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  }, [unreadCount, queryClient, toast]);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Fetching
  const fetchOrders = async (): Promise<Order[]> => {
    const token = await getToken();
    const response = await fetch('/api/orders', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch orders');
    return response.json();
  };

  const { data: orders, isLoading, isError, error } = useQuery<Order[], Error>({
    queryKey: ['orders'],
    queryFn: fetchOrders,
  });

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus }: { orderId: string; newStatus: string }) => {
      const token = await getToken();
      const response = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderId, newStatus }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao atualizar status.');
      }
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
    onError: (err) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const token = await getToken();
      const response = await fetch(`/api/orders?orderId=${orderId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao excluir pedido.');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Pedido excluído com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  // Handlers
  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailModalOpen(true);
  };

  const handleDelete = (orderId: string) => {
    const orderToSelect = orders?.find(o => o.id === orderId);
    setSelectedOrder(orderToSelect || null);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (selectedOrder) {
      deleteOrderMutation.mutate(selectedOrder.id);
      setIsDeleteModalOpen(false);
      setSelectedOrder(null);
    }
  };

  const groupedOrders = React.useMemo(() => {
    if (!orders) return {};
    return orders.reduce((acc, order) => {
      const tableNum = order.restaurant_tables.table_number;
      if (!acc[tableNum]) {
        acc[tableNum] = { orders: [], totalAmount: 0, tableNumber: tableNum };
      }
      acc[tableNum].orders.push(order);
      acc[tableNum].totalAmount += order.total_amount;
      return acc;
    }, {} as GroupedOrders);
  }, [orders]);

  if (isLoading) return <div className="flex justify-center items-center h-64"><Spinner size="large" /><p className="ml-4">Carregando comandas...</p></div>;
  if (isError) return <div className="text-red-500 text-center">Erro ao carregar comandas: {error.message}</div>;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Comandas</h1>
          <Button variant="outline"><Clock className="mr-2 h-4 w-4" />Relatório</Button>
        </div>

        <OrderSummary orders={orders || []} />

        <Card>
          <CardHeader>
            <CardTitle>Contas Abertas por Mesa</CardTitle>
            <CardDescription>Gerencie os pedidos de cada mesa individualmente.</CardDescription>
          </CardHeader>
          <CardContent>
            <OrderFilterBar />
            {Object.keys(groupedOrders).length === 0 ? (
              <div className="text-center text-muted-foreground py-12"><Utensils className="mx-auto h-12 w-12" /><p className="mt-4">Nenhuma comanda ativa no momento.</p></div>
            ) : (
              <Accordion type="multiple" className="w-full">
                {Object.values(groupedOrders).map(({ tableNumber, orders, totalAmount }) => (
                  <AccordionItem value={`table-${tableNumber}`} key={tableNumber}>
                    <AccordionTrigger>
                      <div className="flex justify-between w-full pr-4">
                        <span className="font-bold text-lg">Mesa {tableNumber}</span>
                        <span className="font-semibold text-primary text-lg">R$ {totalAmount.toFixed(2).replace('.', ',')}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 p-2">
                      {orders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          onUpdateStatus={updateStatusMutation.mutate}
                          onViewDetails={handleViewDetails}
                          onDelete={handleDelete}
                          isUpdating={updateStatusMutation.isPending}
                        />
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>

      <OrderDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        order={selectedOrder}
      />

      <ConfirmationDialog
        isOpen={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        onConfirm={confirmDelete}
        title="Tem certeza?"
        description="Esta ação não pode ser desfeita. O pedido será excluído permanentemente."
        confirmText="Excluir"
      />
    </>
  );
}


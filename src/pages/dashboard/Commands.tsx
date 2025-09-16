import { useAuth } from "@clerk/clerk-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search, Clock, Utensils } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";
import React from "react";
import { OrderCard } from "@/components/dashboard/commands/OrderCard";
import { Order } from "@/types/order"; // Importando as interfaces centralizadas
import { OrderSummary } from "@/components/dashboard/commands/OrderSummary"; // Importando OrderSummary
import { OrderFilterBar } from "@/components/dashboard/commands/OrderFilterBar"; // Importando OrderFilterBar

interface GroupedOrders {
  [tableNumber: string]: {
    orders: Order[];
    totalAmount: number;
    tableNumber: number;
  };
}

export default function Commands() {
  const { getToken } = useAuth();

  const fetchOrders = async (): Promise<Order[]> => {
    const token = await getToken({ template: "agilqrcode" });
    const response = await fetch('/api/orders', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch orders');
    }
    return response.json();
  };

  const { data: orders, isLoading, isError, error } = useQuery<Order[], Error>({
    queryKey: ['orders'],
    queryFn: fetchOrders,
  });

  const groupedOrders = React.useMemo(() => {
    if (!orders) return {};

    return orders.reduce((acc, order) => {
      const tableNum = order.restaurant_tables.table_number;
      if (!acc[tableNum]) {
        acc[tableNum] = {
          orders: [],
          totalAmount: 0,
          tableNumber: tableNum,
        };
      }
      acc[tableNum].orders.push(order);
      acc[tableNum].totalAmount += order.total_amount;
      return acc;
    }, {} as GroupedOrders);
  }, [orders]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="large" />
        <p className="ml-4">Carregando comandas...</p>
      </div>
    );
  }

  if (isError) {
    return <div className="text-red-500 text-center">Erro ao carregar comandas: {error.message}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Comandas</h1>
        <Button variant="outline">
          <Clock className="mr-2 h-4 w-4" />
          Relatório
        </Button>
      </div>

      <OrderSummary orders={orders || []} /> {/* Usando o novo componente OrderSummary */}

      <Card>
        <CardHeader>
          <CardTitle>Contas Abertas por Mesa</CardTitle>
          <CardDescription>Gerencie os pedidos de cada mesa individualmente.</CardDescription>
        </CardHeader>
        <CardContent>
          <OrderFilterBar /> {/* Usando o novo componente OrderFilterBar */}

          {Object.keys(groupedOrders).length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
                <Utensils className="mx-auto h-12 w-12" />
                <p className="mt-4">Nenhuma comanda ativa no momento.</p>
            </div>
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
                      <OrderCard key={order.id} order={order} />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

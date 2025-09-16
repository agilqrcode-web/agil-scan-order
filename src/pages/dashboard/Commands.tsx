import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search, Clock, CheckCircle, XCircle, Eye, Utensils } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";
import React from "react";

// Tipos baseados na API e no schema
interface OrderItem {
  id: string;
  quantity: number;
  price_at_time: number;
  menu_items: {
    name: string;
    price: number;
  };
}

interface Order {
  id: string;
  customer_name: string;
  observations: string | null;
  status: string;
  total_amount: number;
  created_at: string;
  restaurant_tables: {
    table_number: number;
    restaurant_id: string;
  };
  order_items: OrderItem[];
}

interface GroupedOrders {
  [tableNumber: string]: {
    orders: Order[];
    totalAmount: number;
    tableNumber: number;
  };
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

// Função para buscar os pedidos
const fetchOrders = async (): Promise<Order[]> => {
  const response = await fetch('/api/orders');
  if (!response.ok) {
    throw new Error('Failed to fetch orders');
  }
  return response.json();
};

export default function Commands() {
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

  const summary = React.useMemo(() => {
    if (!orders) return { pending: 0, preparing: 0, ready: 0, finalized: 0 };
    return {
      pending: orders.filter(o => o.status === 'pending').length,
      preparing: orders.filter(o => o.status === 'preparing').length,
      ready: orders.filter(o => o.status === 'ready').length,
      finalized: orders.filter(o => o.status === 'finalized').length,
    };
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preparando</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary.preparing}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prontos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.ready}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Finalizados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{summary.finalized}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contas Abertas por Mesa</CardTitle>
          <CardDescription>Gerencie os pedidos de cada mesa individualmente.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por mesa ou cliente..." className="pl-9" />
            </div>
            <Select>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Com Pendências</SelectItem>
                <SelectItem value="ready">Com Itens Prontos</SelectItem>
              </SelectContent>
            </Select>
          </div>

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

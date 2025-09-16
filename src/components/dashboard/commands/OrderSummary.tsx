import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Order } from "@/types/order";
import React from "react";

interface OrderSummaryProps {
  orders: Order[];
}

const statusColors: { [key: string]: string } = {
  pending: "bg-yellow-100 text-yellow-800",
  preparing: "bg-blue-100 text-blue-800",
  ready: "bg-green-100 text-green-800",
  finalized: "bg-gray-100 text-gray-800",
};

export function OrderSummary({ orders }: OrderSummaryProps) {
  const summary = React.useMemo(() => {
    if (!orders) return { pending: 0, preparing: 0, ready: 0, finalized: 0 };
    return {
      pending: orders.filter(o => o.status === 'pending').length,
      preparing: orders.filter(o => o.status === 'preparing').length,
      ready: orders.filter(o => o.status === 'ready').length,
      finalized: orders.filter(o => o.status === 'finalized').length,
    };
  }, [orders]);

  return (
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
  );
}

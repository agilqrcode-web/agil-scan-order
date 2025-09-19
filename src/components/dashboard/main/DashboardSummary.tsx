import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Store, QrCode, ShoppingCart, Users } from "lucide-react";

interface DashboardSummaryProps {
    loading: boolean;
    error: string | null;
    restaurantCount: number;
    tableCount: number;
    dailyOrderCount: number;
    dailyCustomerCount: number;
}

export function DashboardSummary({
    loading,
    error,
    restaurantCount,
    tableCount,
    dailyOrderCount,
    dailyCustomerCount
}: DashboardSummaryProps) {

    const summaryCards = [
        {
            title: "Restaurantes",
            icon: Store,
            value: restaurantCount,
            description: "Total de restaurantes",
        },
        {
            title: "Mesas Ativas",
            icon: QrCode,
            value: tableCount,
            description: "Mesas com QR Code",
        },
        {
            title: "Pedidos Hoje",
            icon: ShoppingCart,
            value: dailyOrderCount,
            description: "Pedidos recebidos hoje",
        },
        {
            title: "Clientes Hoje",
            icon: Users,
            value: dailyCustomerCount,
            description: "Clientes atendidos hoje",
        }
    ];

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {summaryCards.map((card, index) => (
                <Card key={index}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                        <card.icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-8 w-1/2" />
                        ) : error ? (
                            <div className="text-red-500 text-sm">Erro</div>
                        ) : (
                            <div className="text-2xl font-bold">{card.value}</div>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {card.description}
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
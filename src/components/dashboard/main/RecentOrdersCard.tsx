import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";

export function RecentOrdersCard() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Pedidos Recentes</CardTitle>
                <CardDescription>
                    Seus últimos pedidos aparecerão aqui
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center py-6">
                    <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">
                        Nenhum pedido ainda
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
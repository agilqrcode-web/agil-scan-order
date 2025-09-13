import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RestaurantDetailsCard() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Detalhes do Restaurante</CardTitle>
                <CardDescription>Atualize o nome e outras informações básicas do seu restaurante.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="restaurant-name">Nome do Restaurante</Label>
                        <Input id="restaurant-name" placeholder="Ex: Cantina da Nona" defaultValue="Meu Restaurante (Estático)" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

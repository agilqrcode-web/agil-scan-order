import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Restaurant } from "@/pages/dashboard/EditRestaurant"; // Importando o tipo

interface RestaurantDetailsCardProps {
    restaurant: Restaurant;
    onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function RestaurantDetailsCard({ restaurant, onInputChange }: RestaurantDetailsCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Atualizar Detalhes do Restaurante</CardTitle>
                <CardDescription>Atualize o nome e outras informações básicas do seu restaurante.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="name">Nome do Restaurante</Label>
                        <Input 
                            id="name" 
                            placeholder="Ex: Cantina da Nona" 
                            value={restaurant.name || ''} 
                            onChange={onInputChange} 
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

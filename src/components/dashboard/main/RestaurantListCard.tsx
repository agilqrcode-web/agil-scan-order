import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Trash2 } from "lucide-react";

// Reutilizando a definição de tipo que já existe no Dashboard
interface Restaurant {
  id: string;
  name: string;
}

interface RestaurantListCardProps {
    loading: boolean;
    error: string | null;
    restaurants: Restaurant[];
    onEdit: (restaurantId: string) => void;
    onDelete: (restaurant: Restaurant) => void;
}

export function RestaurantListCard({ loading, error, restaurants, onEdit, onDelete }: RestaurantListCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Gerenciar Restaurantes</CardTitle>
                <CardDescription>
                    Edite ou exclua seus restaurantes existentes.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {loading ? (
                        Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
                    ) : error ? (
                        <div className="text-red-500 text-sm">{error}</div>
                    ) : restaurants.length > 0 ? (
                        restaurants.map(restaurant => (
                            <div key={restaurant.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary">
                                <div className="flex items-center gap-3">
                                    <img
                                        src="/placeholder.svg"
                                        alt={`Logo de ${restaurant.name}`}
                                        className="h-9 w-9 rounded-md object-cover"
                                    />
                                    <span className="font-medium">{restaurant.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onEdit(restaurant.id)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => onDelete(restaurant)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum restaurante encontrado.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
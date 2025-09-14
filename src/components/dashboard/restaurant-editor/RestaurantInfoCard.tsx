import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Restaurant } from "@/pages/dashboard/EditRestaurant"; // Importando o tipo

interface RestaurantInfoCardProps {
    restaurant: Restaurant;
    onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export function RestaurantInfoCard({ restaurant, onInputChange }: RestaurantInfoCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Informações Públicas</CardTitle>
                <CardDescription>Esses dados aparecerão na aba "Info" do seu cardápio público.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label htmlFor="address">Endereço</Label>
                    <Input id="address" placeholder="Rua Exemplo, 123" value={restaurant.address || ''} onChange={onInputChange} />
                </div>
                <div>
                    <Label htmlFor="phone">Telefone / Contato</Label>
                    <Input id="phone" placeholder="(XX) XXXX-XXXX" value={restaurant.phone || ''} onChange={onInputChange} />
                </div>
                <div>
                    <Label htmlFor="opening_hours">Horário de Funcionamento</Label>
                    <Input id="opening_hours" placeholder="Seg a Sex: 08:00 - 22:00" value={restaurant.opening_hours || ''} onChange={onInputChange} />
                </div>
                <div>
                    <Label htmlFor="about_us">Sobre Nós</Label>
                    <Textarea id="about_us" placeholder="Descreva brevemente seu restaurante..." value={restaurant.about_us || ''} onChange={onInputChange} />
                </div>
                <div>
                    <Label htmlFor="payment_methods">Métodos de Pagamento</Label>
                    <Input id="payment_methods" placeholder="Dinheiro, Cartão, Pix" value={restaurant.payment_methods || ''} onChange={onInputChange} />
                </div>
                 <div>
                    <Label htmlFor="reservations_info">Reservas</Label>
                    <Input id="reservations_info" placeholder="A combinar" value={restaurant.reservations_info || ''} onChange={onInputChange} />
                </div>
            </CardContent>
        </Card>
    );
}

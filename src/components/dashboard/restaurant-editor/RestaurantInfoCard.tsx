import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function RestaurantInfoCard() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Informações Públicas</CardTitle>
                <CardDescription>Esses dados aparecerão na aba "Info" do seu cardápio público.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label htmlFor="address">Endereço</Label>
                    <Input id="address" placeholder="Rua Exemplo, 123" />
                </div>
                <div>
                    <Label htmlFor="phone">Telefone / Contato</Label>
                    <Input id="phone" placeholder="(XX) XXXX-XXXX" />
                </div>
                <div>
                    <Label htmlFor="hours">Horário de Funcionamento</Label>
                    <Input id="hours" placeholder="Seg a Sex: 08:00 - 22:00" />
                </div>
                <div>
                    <Label htmlFor="about">Sobre Nós</Label>
                    <Textarea id="about" placeholder="Descreva brevemente seu restaurante..." />
                </div>
                <div>
                    <Label htmlFor="payment">Métodos de Pagamento</Label>
                    <Input id="payment" placeholder="Dinheiro, Cartão, Pix" />
                </div>
                 <div>
                    <Label htmlFor="reservations">Reservas</Label>
                    <Input id="reservations" placeholder="A combinar" />
                </div>
            </CardContent>
        </Card>
    );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { Checkbox } from "@/components/ui/checkbox";
import type { Restaurant, StructuredHours, DayHours } from "@/pages/dashboard/EditRestaurant";

interface RestaurantInfoCardProps {
    restaurant: Restaurant;
    structuredHours: StructuredHours;
    onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onPaymentMethodChange: (method: string) => void;
    onHoursChange: (day: keyof StructuredHours, field: keyof DayHours, value: string | boolean) => void;
}

export function RestaurantInfoCard({ 
    restaurant, 
    structuredHours,
    onInputChange, 
    onPaymentMethodChange, 
    onHoursChange 
}: RestaurantInfoCardProps) {
    const selectedMethods = restaurant.payment_methods ? restaurant.payment_methods.split(', ').filter(m => m) : [];

    const HoursRow = ({ day, label }: { day: keyof StructuredHours, label: string }) => (
        <div className="flex flex-col items-start gap-3 p-3 border rounded-md sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-4">
                <Checkbox
                    id={`check-${day}`}
                    checked={structuredHours[day].enabled}
                    onCheckedChange={(checked) => onHoursChange(day, 'enabled', !!checked)}
                />
                <Label htmlFor={`check-${day}`} className="whitespace-nowrap">{label}</Label>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-grow">
                <Input
                    type="time"
                    className="w-full"
                    value={structuredHours[day].open}
                    onChange={(e) => onHoursChange(day, 'open', e.target.value)}
                    disabled={!structuredHours[day].enabled}
                />
                <span className="mx-1">-</span>
                <Input
                    type="time"
                    className="w-full"
                    value={structuredHours[day].close}
                    onChange={(e) => onHoursChange(day, 'close', e.target.value)}
                    disabled={!structuredHours[day].enabled}
                />
            </div>
        </div>
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Informações Públicas</CardTitle>
                <CardDescription>Esses dados aparecerão na aba "Info" do seu cardápio público.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <Label htmlFor="address">Endereço</Label>
                    <Input id="address" placeholder="Rua Exemplo, 123" value={restaurant.address || ''} onChange={onInputChange} />
                </div>
                <div>
                    <Label htmlFor="phone">Telefone / Contato</Label>
                    <Input id="phone" placeholder="(XX) XXXX-XXXX" value={restaurant.phone || ''} onChange={onInputChange} />
                </div>
                
                <div className="space-y-3">
                    <Label>Horário de Funcionamento</Label>
                    <HoursRow day="weekday" label="Segunda a Sexta" />
                    <HoursRow day="saturday" label="Sábado" />
                    <HoursRow day="sunday" label="Domingo" />
                </div>

                <div>
                    <Label htmlFor="about_us">Sobre Nós</Label>
                    <Textarea id="about_us" placeholder="Descreva brevemente seu restaurante..." value={restaurant.about_us || ''} onChange={onInputChange} />
                </div>
                
                <div className="space-y-2">
                    <Label>Métodos de Pagamento</Label>
                    <div className="flex flex-wrap gap-2">
                        {["Dinheiro", "Cartão de Crédito", "Cartão de Débito", "Pix"].map((method) => (
                            <Toggle
                                key={method}
                                variant="outline"
                                pressed={selectedMethods.includes(method)}
                                onPressedChange={() => onPaymentMethodChange(method)}
                            >
                                {method}
                            </Toggle>
                        ))}
                    </div>
                    <Input 
                        id="payment_methods"
                        placeholder="Outros? Ex: Vale Refeição"
                        value={restaurant.payment_methods || ''}
                        onChange={onInputChange}
                        className="mt-2"
                    />
                </div>

                 <div>
                    <Label htmlFor="reservations_info">Reservas</Label>
                    <Input id="reservations_info" placeholder="A combinar" value={restaurant.reservations_info || ''} onChange={onInputChange} />
                </div>
            </CardContent>
        </Card>
    );
}
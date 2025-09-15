import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { Checkbox } from "@/components/ui/checkbox"; // Importar Checkbox
import { Restaurant } from "@/pages/dashboard/EditRestaurant";
import { useState, useEffect } from "react";

interface RestaurantInfoCardProps {
    restaurant: Restaurant;
    onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { id: string, value: string } }) => void;
    onPaymentMethodChange: (method: string) => void;
}

const COMMON_PAYMENT_METHODS = ["Dinheiro", "Cartão de Crédito", "Cartão de Débito", "Pix"];

type DayHours = { enabled: boolean; open: string; close: string };
type StructuredHours = { weekday: DayHours; saturday: DayHours; sunday: DayHours };

// Helper para montar a string de horário a partir do estado estruturado
const buildHoursString = (hours: StructuredHours): string => {
    const parts: string[] = [];
    if (hours.weekday.enabled) parts.push(`Seg-Sex: ${hours.weekday.open} - ${hours.weekday.close}`);
    if (hours.saturday.enabled) parts.push(`Sáb: ${hours.saturday.open} - ${hours.saturday.close}`);
    if (hours.sunday.enabled) parts.push(`Dom: ${hours.sunday.open} - ${hours.sunday.close}`);
    return parts.join(' | ');
};

// Helper para interpretar a string e preencher o estado estruturado
const parseHoursString = (hoursString: string | null): StructuredHours => {
    const initialState: StructuredHours = {
        weekday: { enabled: false, open: '09:00', close: '18:00' },
        saturday: { enabled: false, open: '09:00', close: '22:00' },
        sunday: { enabled: false, open: '10:00', close: '16:00' },
    };
    if (!hoursString) return initialState;

    const parts = hoursString.split('|').map(p => p.trim());
    parts.forEach(part => {
        const weekdayMatch = part.match(/Seg-Sex: (\d{2}:\d{2}) - (\d{2}:\d{2})/);
        if (weekdayMatch) {
            initialState.weekday = { enabled: true, open: weekdayMatch[1], close: weekdayMatch[2] };
            return;
        }
        const saturdayMatch = part.match(/Sáb: (\d{2}:\d{2}) - (\d{2}:\d{2})/);
        if (saturdayMatch) {
            initialState.saturday = { enabled: true, open: saturdayMatch[1], close: saturdayMatch[2] };
            return;
        }
        const sundayMatch = part.match(/Dom: (\d{2}:\d{2}) - (\d{2}:\d{2})/);
        if (sundayMatch) {
            initialState.sunday = { enabled: true, open: sundayMatch[1], close: sundayMatch[2] };
        }
    });
    return initialState;
};

export function RestaurantInfoCard({ restaurant, onInputChange, onPaymentMethodChange }: RestaurantInfoCardProps) {
    const selectedMethods = restaurant.payment_methods ? restaurant.payment_methods.split(', ').filter(m => m) : [];
    
    const [structuredHours, setStructuredHours] = useState<StructuredHours>(() => parseHoursString(restaurant.opening_hours));

    // Quando o estado estruturado local muda, atualiza o estado pai com a string formatada
    useEffect(() => {
        const newHoursString = buildHoursString(structuredHours);
        // Simula um evento de input para usar o handler do pai
        onInputChange({ target: { id: 'opening_hours', value: newHoursString } });
    }, [structuredHours]);

    const handleHoursChange = (day: keyof StructuredHours, field: keyof DayHours, value: string | boolean) => {
        setStructuredHours(prev => ({
            ...prev,
            [day]: { ...prev[day], [field]: value },
        }));
    };

    const HoursRow = ({ day, label }: { day: keyof StructuredHours, label: string }) => (
        <div className="flex flex-col items-start gap-3 p-3 border rounded-md sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-4">
                <Checkbox
                    id={`check-${day}`}
                    checked={structuredHours[day].enabled}
                    onCheckedChange={(checked) => handleHoursChange(day, 'enabled', !!checked)}
                />
                <Label htmlFor={`check-${day}`} className="whitespace-nowrap">{label}</Label>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-grow">
                <Input
                    type="time"
                    className="w-full"
                    value={structuredHours[day].open}
                    onChange={(e) => handleHoursChange(day, 'open', e.target.value)}
                    disabled={!structuredHours[day].enabled}
                />
                <span className="mx-1">-</span>
                <Input
                    type="time"
                    className="w-full"
                    value={structuredHours[day].close}
                    onChange={(e) => handleHoursChange(day, 'close', e.target.value)}
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
                
                {/* Novo formulário de Horário de Funcionamento */}
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
                        {COMMON_PAYMENT_METHODS.map((method) => (
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

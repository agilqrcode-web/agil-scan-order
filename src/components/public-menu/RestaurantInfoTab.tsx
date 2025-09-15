import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator"; // Importar Separator
import { BookOpen, Calendar, Clock, MapPin, Phone, Wallet } from "lucide-react";

// Definindo o tipo para os dados do restaurante que o componente espera
interface RestaurantData {
    name: string;
    address: string | null;
    phone: string | null;
    opening_hours: string | null;
    about_us: string | null;
    payment_methods: string | null;
    reservations_info: string | null;
}

interface RestaurantInfoTabProps {
    restaurant: RestaurantData;
}

export function RestaurantInfoTab({ restaurant }: RestaurantInfoTabProps) {
    // Transforma a string de métodos de pagamento em uma lista para exibição
    const paymentMethodsList = restaurant.payment_methods?.split(', ').filter(m => m) || [];

    // Transforma a string de horário de funcionamento em parágrafos
    const openingHoursParagraphs = restaurant.opening_hours?.split('|').map(line => line.trim()) || [];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 md:p-0">
            {/* Coluna da Esquerda */}
            <div className="flex flex-col gap-6">
                <Card className="shadow-md flex-1">
                    <CardHeader>
                        <CardTitle className="flex items-center text-xl font-semibold text-slate-800">
                            <MapPin className="h-5 w-5 mr-3 text-primary" />
                            Endereço e Contato
                        </CardTitle>
                        <Separator className="my-2" />
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-slate-600">
                        <div className="flex items-start">
                            <p>{restaurant.address || "Endereço não informado"}</p>
                        </div>
                        <div className="flex items-center">
                            <p>{restaurant.phone || "Contato não informado"}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-md flex-1">
                    <CardHeader>
                        <CardTitle className="flex items-center text-xl font-semibold text-slate-800">
                            <BookOpen className="h-5 w-5 mr-3 text-primary" />
                            Sobre Nós
                        </CardTitle>
                        <Separator className="my-2" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-600 leading-relaxed">{restaurant.about_us || "Nenhuma descrição fornecida."}</p>
                    </CardContent>
                </Card>
            </div>
            {/* Coluna da Direita */}
            <div className="flex flex-col gap-6">
                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center text-xl font-semibold text-slate-800">
                            <Clock className="h-5 w-5 mr-3 text-primary" />
                            Horário de Funcionamento
                        </CardTitle>
                        <Separator className="my-2" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {openingHoursParagraphs.length > 0 ? (
                            openingHoursParagraphs.map((line, index) => <p key={index} className="text-sm text-slate-600">{line}</p>)
                        ) : (
                            <p className="text-sm text-slate-500 italic">Não informado</p>
                        )}
                    </CardContent>
                </Card>
                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center text-xl font-semibold text-slate-800">
                            <Wallet className="h-5 w-5 mr-3 text-primary" />
                            Métodos de Pagamento
                        </CardTitle>
                        <Separator className="my-2" />
                    </CardHeader>
                    <CardContent>
                        {paymentMethodsList.length > 0 ? (
                            <div className="flex flex-wrap gap-3">
                                {paymentMethodsList.map(method => (
                                    <span key={method} className="bg-primary/10 text-primary font-semibold text-sm px-3 py-1 rounded-full">
                                        {method}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 italic">Não informado</p>
                        )}
                    </CardContent>
                </Card>
                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center text-xl font-semibold text-slate-800">
                            <Calendar className="h-5 w-5 mr-3 text-primary" />
                            Reservas
                        </CardTitle>
                        <Separator className="my-2" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-600">{restaurant.reservations_info || "Não informado"}</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
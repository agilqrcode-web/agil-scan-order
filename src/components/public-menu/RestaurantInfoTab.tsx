import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Calendar, Clock, MapPin, Wallet } from "lucide-react";

export function RestaurantInfoTab() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Coluna da Esquerda */}
            <div className="space-y-6">
                <Card className="p-6 shadow-lg bg-white">
                    <CardHeader className="p-0 pb-4">
                        <CardTitle className="flex items-center"><MapPin className="h-5 w-5 mr-3 text-primary" /> Endereço e Contato</CardTitle>
                    </CardHeader>
                    <div className="space-y-2 text-gray-700">
                        <p>Rua Exemplo, 123 - Bairro Fictício, Cidade - UF</p>
                        <p>(XX) XXXX-XXXX</p>
                    </div>
                </Card>
                <Card className="p-6 shadow-lg bg-white">
                    <CardHeader className="p-0 pb-4">
                        <CardTitle className="flex items-center"><BookOpen className="h-5 w-5 mr-3 text-primary" /> Sobre Nós</CardTitle>
                    </CardHeader>
                    <p className="text-gray-700">Um lugar aconchegante com a melhor comida da cidade!</p>
                </Card>
            </div>
            {/* Coluna da Direita */}
            <div className="space-y-6">
                <Card className="p-6 shadow-lg bg-white">
                    <CardHeader className="p-0 pb-4">
                        <CardTitle className="flex items-center"><Clock className="h-5 w-5 mr-3 text-primary" /> Horário de Funcionamento</CardTitle>
                    </CardHeader>
                    <p className="text-gray-700">Segunda a Domingo: 00:00 - 00:00</p>
                </Card>
                <Card className="p-6 shadow-lg bg-white">
                    <CardHeader className="p-0 pb-4">
                        <CardTitle className="flex items-center"><Wallet className="h-5 w-5 mr-3 text-primary" /> Métodos de Pagamento</CardTitle>
                    </CardHeader>
                    <ul className="list-disc list-inside text-gray-700">
                        <li>Dinheiro</li>
                        <li>Cartão</li>
                        <li>Pix</li>
                    </ul>
                </Card>
                <Card className="p-6 shadow-lg bg-white">
                    <CardHeader className="p-0 pb-4">
                        <CardTitle className="flex items-center"><Calendar className="h-5 w-5 mr-3 text-primary" /> Reservas</CardTitle>
                    </CardHeader>
                    <p className="text-gray-700">A combinar</p>
                </Card>
            </div>
        </div>
    );
}

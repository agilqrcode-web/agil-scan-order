import { Button } from "@/components/ui/button";
import { RestaurantDetailsCard } from "@/components/dashboard/restaurant-editor/RestaurantDetailsCard";
import { RestaurantInfoCard } from "@/components/dashboard/restaurant-editor/RestaurantInfoCard";
import { RestaurantLogoCard } from "@/components/dashboard/restaurant-editor/RestaurantLogoCard";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function EditRestaurant() {
    const navigate = useNavigate();

    // TODO: Adicionar lógica de busca de dados e salvamento

    return (
        <div className="space-y-6">
            <div>
                <Button variant="outline" onClick={() => navigate("/dashboard")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para o Dashboard
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Coluna da Esquerda */}
                <div className="lg:col-span-2 space-y-6">
                    <RestaurantDetailsCard />
                    <RestaurantInfoCard />
                </div>

                {/* Coluna da Direita */}
                <div className="lg:col-span-1">
                    <RestaurantLogoCard />
                </div>
            </div>

            <div className="flex justify-end">
                <Button size="lg">
                    Salvar Alterações
                </Button>
            </div>
        </div>
    );
}

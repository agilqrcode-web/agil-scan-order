import { Button } from "@/components/ui/button";
import { RestaurantDetailsCard } from "@/components/dashboard/restaurant-editor/RestaurantDetailsCard";
import { RestaurantInfoCard } from "@/components/dashboard/restaurant-editor/RestaurantInfoCard";
import { RestaurantLogoCard } from "@/components/dashboard/restaurant-editor/RestaurantLogoCard";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";

// Definição manual do tipo Restaurant, baseada no schema.sql
export interface Restaurant {
    id: string;
    name: string;
    description: string | null;
    logo_url: string | null;
    address: string | null;
    phone: string | null;
    opening_hours: string | null;
    about_us: string | null;
    payment_methods: string | null;
    reservations_info: string | null;
    owner_user_id: string;
    created_at: string | null;
}

export default function EditRestaurant() {
    const navigate = useNavigate();
    const { restaurantId } = useParams<{ restaurantId: string }>();
    const { toast } = useToast();

    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!restaurantId) {
            setError("ID do restaurante não encontrado.");
            setLoading(false);
            return;
        }

        const fetchRestaurant = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/restaurants?id=${restaurantId}`);
                if (!response.ok) {
                    throw new Error("Falha ao buscar os dados do restaurante.");
                }
                const data = await response.json();
                setRestaurant(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Ocorreu um erro desconhecido.");
                toast({
                    variant: "destructive",
                    title: "Erro ao carregar",
                    description: "Não foi possível buscar os dados do restaurante. Tente novamente.",
                });
            } finally {
                setLoading(false);
            }
        };

        fetchRestaurant();
    }, [restaurantId, toast]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        if (restaurant) {
            setRestaurant({ ...restaurant, [id]: value });
        }
    };

    const handleLogoUpdate = (newLogoUrl: string | null) => {
        if (restaurant) {
            setRestaurant({ ...restaurant, logo_url: newLogoUrl });
        }
    };

    const handleSave = async () => {
        if (!restaurant) return;

        setIsSaving(true);
        try {
            const response = await fetch('/api/restaurants', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: restaurant.id, ...restaurant }),
            });

            if (!response.ok) {
                throw new Error("Falha ao salvar as alterações.");
            }

            toast({
                title: "Sucesso!",
                description: "As informações do restaurante foram atualizadas.",
            });
        } catch (err) {
            toast({
                variant: "destructive",
                title: "Erro ao salvar",
                description: err instanceof Error ? err.message : "Não foi possível salvar. Tente novamente.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Spinner size="large" /></div>;
    }

    if (error) {
        return <div className="text-red-500 text-center">{error}</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <Button variant="outline" onClick={() => navigate("/dashboard")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para o Dashboard
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    {restaurant && (
                        <>
                            <RestaurantDetailsCard restaurant={restaurant} onInputChange={handleInputChange} />
                            <RestaurantInfoCard restaurant={restaurant} onInputChange={handleInputChange} />
                        </>
                    )}
                </div>

                <div className="lg:col-span-1">
                    {restaurant && <RestaurantLogoCard restaurant={restaurant} onLogoUpdate={handleLogoUpdate} />}
                </div>
            </div>

            <div className="flex justify-end">
                <Button size="lg" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Spinner size="small" className="mr-2" /> : null}
                    {isSaving ? "Salvando..." : "Salvar Alterações"}
                </Button>
            </div>
        </div>
    );
}
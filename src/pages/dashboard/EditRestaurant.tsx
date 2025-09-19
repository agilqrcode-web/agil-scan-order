import { Button } from "@/components/ui/button";
import { RestaurantDetailsCard } from "@/components/dashboard/restaurant-editor/RestaurantDetailsCard";
import { RestaurantInfoCard } from "@/components/dashboard/restaurant-editor/RestaurantInfoCard";
import { RestaurantLogoCard } from "@/components/dashboard/restaurant-editor/RestaurantLogoCard";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@clerk/clerk-react"; // <-- 1. IMPORTAÇÃO ADICIONADA

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
    const { getToken } = useAuth(); // <-- 1. USO DO HOOK

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
                // A busca inicial pode ser pública, mas a atualização precisa de autenticação.
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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { id: string, value: string } }) => {
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

    const handlePaymentMethodChange = (method: string) => {
        if (!restaurant) return;

        const currentMethods = restaurant.payment_methods ? restaurant.payment_methods.split(', ').filter(m => m) : [];
        const newMethods = currentMethods.includes(method)
            ? currentMethods.filter(m => m !== method)
            : [...currentMethods, method];
        
        setRestaurant({ ...restaurant, payment_methods: newMethods.join(', ') });
    };

    const handleSave = async () => {
        if (!restaurant) return;

        setIsSaving(true);
        try {
            const token = await getToken({ template: "agilqrcode" }); // <-- 2. OBTENÇÃO DO TOKEN
            const response = await fetch('/api/restaurants', {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // <-- 3. ENVIO DO TOKEN
                },
                body: JSON.stringify({ id: restaurant.id, ...restaurant }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Falha ao salvar as alterações.");
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
        <div className="space-y-6 pb-24"> 
            <div className="space-y-6 lg:grid lg:gap-6 lg:grid-cols-3 lg:space-y-0">
                <div className="lg:col-span-2 space-y-6">
                    {restaurant && (
                        <>
                            <RestaurantDetailsCard restaurant={restaurant} onInputChange={handleInputChange} />
                            <RestaurantInfoCard restaurant={restaurant} onInputChange={handleInputChange} onPaymentMethodChange={handlePaymentMethodChange} />
                        </>
                    )}
                </div>

                <div className="lg:col-span-1">
                    {restaurant && <RestaurantLogoCard restaurant={restaurant} onLogoUpdate={handleLogoUpdate} />}
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-sm p-4 z-50">
                <div className="flex items-center">
                    <div className="flex space-x-2 ml-auto">
                        <Button size="default" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Spinner size="small" className="mr-2" /> : null}
                            {isSaving ? "Salvando..." : "Salvar Alterações"}
                        </Button>
                        <Button onClick={() => window.location.href = 'https://agil-scan-order-neon.vercel.app/dashboard'} variant="outline" size="default">
                            Voltar
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

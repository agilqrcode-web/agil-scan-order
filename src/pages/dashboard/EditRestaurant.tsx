import { Button } from "@/components/ui/button";
import { RestaurantDetailsCard } from "@/components/dashboard/restaurant-editor/RestaurantDetailsCard";
import { RestaurantInfoCard } from "@/components/dashboard/restaurant-editor/RestaurantInfoCard";
import { RestaurantLogoCard } from "@/components/dashboard/restaurant-editor/RestaurantLogoCard";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, useCallback, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@clerk/clerk-react";
import { usePageHeader } from "@/contexts/PageHeaderContext";
import { Save } from "lucide-react";
import { useRestaurantLogoUpload } from "@/hooks/useRestaurantLogoUpload";

// Definição do tipo Restaurant
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

// Tipo para a ref do componente filho
interface InfoCardHandle {
    getOpeningHours: () => string;
}

export default function EditRestaurant() {
    const navigate = useNavigate();
    const { restaurantId } = useParams<{ restaurantId: string }>();
    const { toast } = useToast();
    const { getToken } = useAuth();
    const { setHeader, clearHeader } = usePageHeader();

    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const infoCardRef = useRef<InfoCardHandle>(null); // Ref para o componente filho

    const restaurantRef = useRef(restaurant);
    useEffect(() => {
        restaurantRef.current = restaurant;
    }, [restaurant]);

    const { 
        logoPreview, 
        handleFileChange, 
        handleRemovePreview, 
        processLogoChange 
    } = useRestaurantLogoUpload({
        initialLogoUrl: restaurant?.logo_url ?? null,
        restaurantId: restaurant?.id ?? '',
    });

    const fetchRestaurant = useCallback(async () => {
        if (!restaurantId || !getToken) return;
        try {
            setLoading(true);
            const token = await getToken();
            const response = await fetch(`/api/restaurants?id=${restaurantId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error("Falha ao buscar os dados do restaurante.");
            const data = await response.json();
            setRestaurant(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Ocorreu um erro desconhecido.");
        } finally {
            setLoading(false);
        }
    }, [restaurantId, getToken]);

    useEffect(() => {
        fetchRestaurant();
    }, [fetchRestaurant]);

    const handleSave = useCallback(async () => {
        const currentRestaurant = restaurantRef.current;
        if (!currentRestaurant || !infoCardRef.current) return;

        setIsSaving(true);
        try {
            const finalLogoUrl = await processLogoChange(currentRestaurant.logo_url);
            // Pega o valor final dos horários diretamente do filho no momento de salvar
            const finalOpeningHours = infoCardRef.current.getOpeningHours();

            const dataToSave = { 
                ...currentRestaurant, 
                logo_url: finalLogoUrl,
                opening_hours: finalOpeningHours, // Usa o valor obtido do filho
            };

            const token = await getToken();
            const response = await fetch('/api/restaurants', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(dataToSave),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Falha ao salvar as alterações.");
            }

            const updatedRestaurant = await response.json();
            setRestaurant(updatedRestaurant);

            toast({ title: "Sucesso!", description: "As informações do restaurante foram atualizadas." });
        } catch (err) {
            toast({ variant: "destructive", title: "Erro ao salvar", description: (err as Error).message });
        } finally {
            setIsSaving(false);
        }
    }, [getToken, processLogoChange, toast]);

    useEffect(() => {
        const saveAction = (
            <Button 
                size="icon" 
                onClick={() => console.log('TESTE: Botão Salvar clicado!')} 
                disabled={isSaving || loading}
            >
                <Save className="h-4 w-4" />
            </Button>
        );

        setHeader({
            title: `Editando: ${restaurant?.name ?? ''}`,
            backButtonHref: "/dashboard",
            headerActions: saveAction,
            fabAction: saveAction,
        });

        return () => clearHeader();
    }, [isSaving, loading, restaurant?.name, setHeader, clearHeader]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        // Este handler não mexe mais com opening_hours
        if (id === 'opening_hours') return;
        setRestaurant(prev => (prev ? { ...prev, [id]: value } : null));
    };

    const handlePaymentMethodChange = (method: string) => {
        if (!restaurant) return;
        const currentMethods = restaurant.payment_methods ? restaurant.payment_methods.split(', ').filter(m => m) : [];
        const newMethods = currentMethods.includes(method) ? currentMethods.filter(m => m !== method) : [...currentMethods, method];
        setRestaurant({ ...restaurant, payment_methods: newMethods.join(', ') });
    };

    if (loading) return <div className="flex justify-center items-center h-64">Carregando...</div>;
    if (error) return <div className="text-red-500 text-center">{error}</div>;

    return (
        <div className="space-y-6"> 
            <div className="space-y-6 lg:grid lg:gap-6 lg:grid-cols-3 lg:space-y-0">
                <div className="lg:col-span-2 space-y-6">
                    {restaurant && (
                        <>
                            <RestaurantDetailsCard restaurant={restaurant} onInputChange={handleInputChange} />
                            <RestaurantInfoCard 
                                ref={infoCardRef} // Passa a ref para o filho
                                restaurant={restaurant} 
                                onInputChange={handleInputChange} 
                                onPaymentMethodChange={handlePaymentMethodChange} 
                            />
                        </>
                    )}
                </div>
                <div className="lg:col-span-1">
                    {restaurant && (
                        <RestaurantLogoCard 
                            logoPreview={logoPreview}
                            isUploading={isSaving}
                            handleFileChange={handleFileChange}
                            handleRemovePreview={handleRemovePreview}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
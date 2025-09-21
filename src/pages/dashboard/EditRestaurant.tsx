import { Button } from "@/components/ui/button";
import { RestaurantDetailsCard } from "@/components/dashboard/restaurant-editor/RestaurantDetailsCard";
import { RestaurantInfoCard } from "@/components/dashboard/restaurant-editor/RestaurantInfoCard";
import { RestaurantLogoCard } from "@/components/dashboard/restaurant-editor/RestaurantLogoCard";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
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

    const { 
        logoPreview, 
        handleFileChange, 
        handleRemovePreview, 
        processLogoChange 
    } = useRestaurantLogoUpload({
        initialLogoUrl: restaurant?.logo_url ?? null,
        restaurantId: restaurant?.id ?? '',
    });

    useEffect(() => {
        if (!restaurantId) {
            setError("ID do restaurante não encontrado.");
            setLoading(false);
            return;
        }
        const fetchRestaurant = async () => {
            try {
                setLoading(true);
                const token = await getToken({ template: "agilqrcode" });
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
        };
        fetchRestaurant();
    }, [restaurantId, getToken]);

    useEffect(() => {
        const saveAction = (
            <Button size="icon" onClick={handleSave} disabled={isSaving || loading}>
                {isSaving ? <Spinner size="small" /> : <Save className="h-4 w-4" />}
            </Button>
        );

        setHeader({
            title: `Editando: ${restaurant?.name ?? ''}`,
            backButtonHref: "/dashboard",
            headerActions: saveAction,
            fabAction: saveAction,
        });

        return () => clearHeader();
    }, [isSaving, loading, restaurant, handleSave]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { id: string, value: string } }) => {
        const { id, value } = e.target;
        if (restaurant) setRestaurant({ ...restaurant, [id]: value });
    };

    const handlePaymentMethodChange = (method: string) => {
        if (!restaurant) return;
        const currentMethods = restaurant.payment_methods ? restaurant.payment_methods.split(', ').filter(m => m) : [];
        const newMethods = currentMethods.includes(method) ? currentMethods.filter(m => m !== method) : [...currentMethods, method];
        setRestaurant({ ...restaurant, payment_methods: newMethods.join(', ') });
    };

    const handleSave = async () => {
        if (!restaurant) return;
        setIsSaving(true);
        try {
            // 1. Process logo change (upload/delete from storage) and get the final URL
            const finalLogoUrl = await processLogoChange(restaurant.logo_url);

            // 2. Prepare the complete data to be saved
            const dataToSave = { 
                ...restaurant, 
                logo_url: finalLogoUrl 
            };

            // 3. Save everything to the database via the API
            const token = await getToken({ template: "agilqrcode" });
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
            setRestaurant(updatedRestaurant); // Update state with data from DB

            toast({ title: "Sucesso!", description: "As informações do restaurante foram atualizadas." });
        } catch (err) {
            toast({ variant: "destructive", title: "Erro ao salvar", description: (err as Error).message });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center items-center h-64"><Spinner size="large" /></div>;
    if (error) return <div className="text-red-500 text-center">{error}</div>;

    return (
        <div className="space-y-6"> 
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
                    {restaurant && (
                        <RestaurantLogoCard 
                            logoPreview={logoPreview}
                            isUploading={isSaving} // Use the main saving state
                            handleFileChange={handleFileChange}
                            handleRemovePreview={handleRemovePreview}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

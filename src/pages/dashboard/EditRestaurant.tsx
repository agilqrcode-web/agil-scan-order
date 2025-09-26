import { Button } from "@/components/ui/button";
import { RestaurantDetailsCard } from "@/components/dashboard/restaurant-editor/RestaurantDetailsCard";
import { RestaurantInfoCard } from "@/components/dashboard/restaurant-editor/RestaurantInfoCard";
import { RestaurantLogoCard } from "@/components/dashboard/restaurant-editor/RestaurantLogoCard";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@clerk/clerk-react";
import { usePageHeader } from "@/contexts/PageHeaderContext";
import { Save } from "lucide-react";
import { useRestaurantLogoUpload } from "@/hooks/useRestaurantLogoUpload";

// Tipos movidos para o componente pai
export type DayHours = { enabled: boolean; open: string; close: string };
export type StructuredHours = { weekday: DayHours; saturday: DayHours; sunday: DayHours };

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

// Funções helper movidas para o componente pai
const buildHoursString = (hours: StructuredHours): string => {
    const parts: string[] = [];
    if (hours.weekday.enabled) parts.push(`Seg-Sex: ${hours.weekday.open} - ${hours.weekday.close}`);
    if (hours.saturday.enabled) parts.push(`Sáb: ${hours.saturday.open} - ${hours.saturday.close}`);
    if (hours.sunday.enabled) parts.push(`Dom: ${hours.sunday.open} - ${hours.sunday.close}`);
    return parts.join(' | ');
};

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

export default function EditRestaurant() {
    const navigate = useNavigate();
    const { restaurantId } = useParams<{ restaurantId: string }>();
    const { toast } = useToast();
    const { getToken } = useAuth();
    const { setHeader, clearHeader } = usePageHeader();

    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [structuredHours, setStructuredHours] = useState<StructuredHours | null>(null);
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
            setStructuredHours(parseHoursString(data.opening_hours)); // Inicializa o estado dos horários
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
        if (!restaurant || !structuredHours) return;
        setIsSaving(true);
        try {
            const finalLogoUrl = await processLogoChange(restaurant.logo_url);
            const finalOpeningHours = buildHoursString(structuredHours); // Constrói a string final

            const dataToSave = { 
                ...restaurant, 
                logo_url: finalLogoUrl, 
                opening_hours: finalOpeningHours
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
            setStructuredHours(parseHoursString(updatedRestaurant.opening_hours)); // Re-sincroniza o estado

            toast({ title: "Sucesso!", description: "As informações do restaurante foram atualizadas." });
        } catch (err) {
            toast({ variant: "destructive", title: "Erro ao salvar", description: (err as Error).message });
        } finally {
            setIsSaving(false);
        }
    }, [restaurant, structuredHours, getToken, processLogoChange, toast]);

    useEffect(() => {
        const saveAction = (
            <Button size="icon" onClick={handleSave} disabled={isSaving || loading}>
                {isSaving ? 'Salvando...' : <Save className="h-4 w-4" />}
            </Button>
        );

        setHeader({
            title: `Editando: ${restaurant?.name ?? ''}`,
            backButtonHref: "/dashboard",
            headerActions: saveAction,
            fabAction: saveAction,
        });

        return () => clearHeader();
    }, [isSaving, loading, restaurant, handleSave, setHeader, clearHeader]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        if (restaurant) setRestaurant({ ...restaurant, [id]: value });
    };

    const handlePaymentMethodChange = (method: string) => {
        if (!restaurant) return;
        const currentMethods = restaurant.payment_methods ? restaurant.payment_methods.split(', ').filter(m => m) : [];
        const newMethods = currentMethods.includes(method) ? currentMethods.filter(m => m !== method) : [...currentMethods, method];
        setRestaurant({ ...restaurant, payment_methods: newMethods.join(', ') });
    };

    const handleHoursChange = (day: keyof StructuredHours, field: keyof DayHours, value: string | boolean) => {
        if (!structuredHours) return;
        setStructuredHours(prev => ({
            ...prev!,
            [day]: { ...prev![day], [field]: value },
        }));
    };

    if (loading) return <div className="flex justify-center items-center h-64">Carregando...</div>;
    if (error) return <div className="text-red-500 text-center">{error}</div>;

    return (
        <div className="space-y-6"> 
            <div className="space-y-6 lg:grid lg:gap-6 lg:grid-cols-3 lg:space-y-0">
                <div className="lg:col-span-2 space-y-6">
                    {restaurant && structuredHours && (
                        <>
                            <RestaurantDetailsCard restaurant={restaurant} onInputChange={handleInputChange} />
                            <RestaurantInfoCard 
                                restaurant={restaurant} 
                                onInputChange={handleInputChange} 
                                onPaymentMethodChange={handlePaymentMethodChange} 
                                structuredHours={structuredHours}
                                onHoursChange={handleHoursChange}
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

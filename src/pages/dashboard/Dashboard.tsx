import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useSupabase } from "@/contexts/SupabaseContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";


// Novos componentes importados
import { DashboardSummary } from "@/components/dashboard/main/DashboardSummary";
import { RestaurantListCard } from "@/components/dashboard/main/RestaurantListCard";
import { RecentOrdersCard } from "@/components/dashboard/main/RecentOrdersCard";

interface Restaurant {
  id: string;
  name: string;
  logo_url: string | null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { userId, getToken } = useAuth();
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [tableCounts, setTableCounts] = useState({ total_tables: 0 });
  const [dailyOrderCount, setDailyOrderCount] = useState(0);
  const [dailyCustomerCount, setDailyCustomerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [restaurantToDelete, setRestaurantToDelete] = useState<Restaurant | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!userId || !supabase) {
        setLoading(false);
        return;
      }
      try {
        // A lógica de busca de dados permanece a mesma
        const { data: restaurantData, error: restaurantError } = await supabase.from('restaurant_users').select('restaurants ( id, name, logo_url )').eq('user_id', userId);
        if (restaurantError) throw restaurantError;
        const fetchedRestaurants = restaurantData.map(item => item.restaurants).filter(Boolean) as Restaurant[];
        setRestaurants(fetchedRestaurants);

        if (fetchedRestaurants.length > 0) {
          const restaurantId = fetchedRestaurants[0].id;
          const [tableCountResult, dailyOrderResult, dailyCustomerResult] = await Promise.all([
            supabase.rpc('get_table_counts_for_restaurant', { p_restaurant_id: restaurantId }),
            supabase.rpc('get_daily_order_count', { p_restaurant_id: restaurantId }),
            supabase.rpc('get_daily_customer_count', { p_restaurant_id: restaurantId })
          ]);
          if (tableCountResult.error) throw tableCountResult.error;
          if (dailyOrderResult.error) throw dailyOrderResult.error;
          if (dailyCustomerResult.error) throw dailyCustomerResult.error;
          if (tableCountResult.data && tableCountResult.data.length > 0) {
            setTableCounts(tableCountResult.data[0]);
          }
          setDailyOrderCount(dailyOrderResult.data || 0);
          setDailyCustomerCount(dailyCustomerResult.data || 0);
        }
      } catch (err) {
        setError("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [userId, supabase]);

  const deleteRestaurantMutation = useMutation({
    mutationFn: async (restaurantId: string) => {
      const token = await getToken({ template: "agilqrcode" });
      const response = await fetch(`/api/restaurants?id=${restaurantId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to delete restaurant" }));
        throw new Error(errorData.error);
      }
      return;
    },
    onSuccess: () => {
      toast({ title: "Restaurante excluído com sucesso!" });
      window.location.reload(); // Recarrega a página para atualizar a lista
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    },
  });

  const handleDeleteClick = (restaurant: Restaurant) => {
    setRestaurantToDelete(restaurant);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (restaurantToDelete) {
      deleteRestaurantMutation.mutate(restaurantToDelete.id);
      setIsDeleteModalOpen(false);
      setRestaurantToDelete(null);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Novo Restaurante</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Novo Restaurante</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <DashboardSummary
            loading={loading}
            error={error}
            restaurantCount={restaurants.length}
            tableCount={tableCounts.total_tables}
            dailyOrderCount={dailyOrderCount}
            dailyCustomerCount={dailyCustomerCount}
        />

        <div className="grid gap-4 md:grid-cols-2">
            <RestaurantListCard
                loading={loading}
                error={error}
                restaurants={restaurants}
                onEdit={(restaurantId) => navigate(`/dashboard/restaurants/${restaurantId}/edit`)}
                onDelete={handleDeleteClick}
            />
            <RecentOrdersCard />
        </div>
      </div>

      <ConfirmationDialog
        isOpen={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        onConfirm={confirmDelete}
        title="Tem certeza?"
        description={`Esta ação não pode ser desfeita. O restaurante "${restaurantToDelete?.name}" será excluído permanentemente.`}
        confirmText="Excluir"
      />
    </>
  );
}
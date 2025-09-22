import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useSupabase } from "@/contexts/SupabaseContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [restaurantToDelete, setRestaurantToDelete] = useState<Restaurant | null>(null);

  // Query 1: Fetch restaurants
  const { data: restaurants = [], isLoading: isLoadingRestaurants, isError: isErrorRestaurants } = useQuery<Restaurant[]>({
    queryKey: ['restaurants', userId],
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase client is not available");
      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurant_users')
        .select('restaurants ( id, name, logo_url )')
        .eq('user_id', userId);

      if (restaurantError) throw restaurantError;
      return restaurantData.map(item => item.restaurants).filter(Boolean) as Restaurant[];
    },
    enabled: !!userId && !!supabase,
  });

  const mainRestaurantId = restaurants.length > 0 ? restaurants[0].id : null;

  // Query 2: Fetch dashboard summary data, dependent on the first restaurant
  const { data: summaryData, isLoading: isLoadingSummary, isError: isErrorSummary } = useQuery({
    queryKey: ['dashboardSummary', mainRestaurantId],
    queryFn: async () => {
      if (!supabase || !mainRestaurantId) return null;

      const [tableCountResult, dailyOrderResult, dailyCustomerResult] = await Promise.all([
        supabase.rpc('get_table_counts_for_restaurant', { p_restaurant_id: mainRestaurantId }),
        supabase.rpc('get_daily_order_count', { p_restaurant_id: mainRestaurantId }),
        supabase.rpc('get_daily_customer_count', { p_restaurant_id: mainRestaurantId })
      ]);

      if (tableCountResult.error) throw tableCountResult.error;
      if (dailyOrderResult.error) throw dailyOrderResult.error;
      if (dailyCustomerResult.error) throw dailyCustomerResult.error;

      return {
        tableCount: tableCountResult.data?.[0]?.total_tables ?? 0,
        dailyOrderCount: dailyOrderResult.data ?? 0,
        dailyCustomerCount: dailyCustomerResult.data ?? 0,
      };
    },
    enabled: !!supabase && !!mainRestaurantId,
  });

  const isLoading = isLoadingRestaurants || (!!mainRestaurantId && isLoadingSummary);
  const isError = isErrorRestaurants || isErrorSummary;

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
      queryClient.invalidateQueries({ queryKey: ['restaurants', userId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary', mainRestaurantId] });
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
            loading={isLoading}
            error={isError ? "Failed to load dashboard data." : null}
            restaurantCount={restaurants.length}
            tableCount={summaryData?.tableCount ?? 0}
            dailyOrderCount={summaryData?.dailyOrderCount ?? 0}
            dailyCustomerCount={summaryData?.dailyCustomerCount ?? 0}
        />

        <div className="grid gap-4 md:grid-cols-2">
            <RestaurantListCard
                loading={isLoadingRestaurants}
                error={isErrorRestaurants ? "Failed to load restaurants." : null}
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
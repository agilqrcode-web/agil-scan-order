import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { DashboardSummary } from "@/components/dashboard/main/DashboardSummary";
import { RestaurantListCard } from "@/components/dashboard/main/RestaurantListCard";
import { RecentOrdersCard } from "@/components/dashboard/main/RecentOrdersCard";

interface Restaurant {
  id: string;
  name: string;
  logo_url: string | null;
}

interface DashboardData {
  restaurants: Restaurant[];
  summary: {
    tableCount: number;
    dailyOrderCount: number;
    dailyCustomerCount: number;
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { userId, getToken } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [restaurantToDelete, setRestaurantToDelete] = useState<Restaurant | null>(null);

  const fetchDashboardData = async (): Promise<DashboardData> => {
    const token = await getToken(); // Usando o token padrão
    const response = await fetch('/api/restaurants', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch dashboard data');
    }
    return response.json();
  };

  const { data, isLoading, isError, error } = useQuery<DashboardData, Error>({
    queryKey: ['dashboardData', userId],
    queryFn: fetchDashboardData,
    enabled: !!userId, // A query depende apenas do userId agora
  });

  const deleteRestaurantMutation = useMutation({
    mutationFn: async (restaurantId: string) => {
      const token = await getToken();
      const response = await fetch(`/api/restaurants?id=${restaurantId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to delete restaurant" }));
        throw new Error(errorData.error);
      }
    },
    onSuccess: () => {
      toast({ title: "Restaurante excluído com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ['dashboardData', userId] });
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
            error={isError ? error.message : null}
            restaurantCount={data?.restaurants?.length ?? 0}
            tableCount={data?.summary?.tableCount ?? 0}
            dailyOrderCount={data?.summary?.dailyOrderCount ?? 0}
            dailyCustomerCount={data?.summary?.dailyCustomerCount ?? 0}
        />

        <div className="grid gap-4 md:grid-cols-2">
            <RestaurantListCard
                loading={isLoading}
                error={isError ? error.message : null}
                restaurants={data?.restaurants ?? []}
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
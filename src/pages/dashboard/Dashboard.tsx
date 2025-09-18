import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Store, QrCode, ShoppingCart, Users, Pencil, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupabase } from "@/contexts/SupabaseContext";

interface Restaurant {
  id: string;
  name: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const supabase = useSupabase();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [tableCounts, setTableCounts] = useState({ total_tables: 0 });
  const [dailyOrderCount, setDailyOrderCount] = useState(0);
  const [dailyCustomerCount, setDailyCustomerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!userId || !supabase) {
        setLoading(false);
        return;
      }

      try {
        const { data: restaurantData, error: restaurantError } = await supabase
          .from('restaurant_users')
          .select('restaurants ( id, name )')
          .eq('user_id', userId);

        if (restaurantError) throw restaurantError;

        const fetchedRestaurants = restaurantData.map(item => item.restaurants).filter(Boolean) as Restaurant[];
        setRestaurants(fetchedRestaurants);

        if (fetchedRestaurants.length > 0) {
          const restaurantId = fetchedRestaurants[0].id;

          const [
            tableCountResult,
            dailyOrderResult,
            dailyCustomerResult
          ] = await Promise.all([
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
        console.error("Error fetching dashboard data:", err);
        setError("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [userId, supabase]);

  return (
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Restaurantes</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-1/2" />
            ) : error ? (
              <div className="text-red-500 text-sm">{error}</div>
            ) : (
              <div className="text-2xl font-bold">{restaurants.length}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Total de restaurantes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mesas Ativas</CardTitle>
            <QrCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-1/2" />
            ) : error ? (
              <div className="text-red-500 text-sm">{error}</div>
            ) : (
              <div className="text-2xl font-bold">{tableCounts.total_tables}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Mesas com QR Code
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Hoje</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
                <Skeleton className="h-8 w-1/2" />
            ) : error ? (
                <div className="text-red-500 text-sm">{error}</div>
            ) : (
                <div className="text-2xl font-bold">{dailyOrderCount}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Pedidos recebidos hoje
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
                <Skeleton className="h-8 w-1/2" />
            ) : error ? (
                <div className="text-red-500 text-sm">{error}</div>
            ) : (
                <div className="text-2xl font-bold">{dailyCustomerCount}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Clientes atendidos hoje
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gerenciar Restaurantes</CardTitle>
            <CardDescription>
              Edite ou exclua seus restaurantes existentes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
              ) : error ? (
                 <div className="text-red-500 text-sm">{error}</div>
              ) : restaurants.length > 0 ? (
                restaurants.map(restaurant => (
                  <div key={restaurant.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary">
                    <div className="flex items-center gap-3">
                      <img 
                        src="/placeholder.svg" 
                        alt={`Logo de ${restaurant.name}`}
                        className="h-9 w-9 rounded-md object-cover" 
                      />
                      <span className="font-medium">{restaurant.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(`/dashboard/restaurants/${restaurant.id}/edit`)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" className="h-8 w-8">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum restaurante encontrado.</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pedidos Recentes</CardTitle>
            <CardDescription>
              Seus últimos pedidos aparecerão aqui
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhum pedido ainda
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
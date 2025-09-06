import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Store, QrCode, ShoppingCart, Users } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupabase } from "@/contexts/SupabaseContext";

export default function Dashboard() {
  const { userId } = useAuth();
  const supabase = useSupabase();
  const [restaurantCount, setRestaurantCount] = useState<number | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [tableCounts, setTableCounts] = useState({
    total_tables: 0,
    available_tables: 0,
    occupied_tables: 0,
    cleaning_tables: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!userId || !supabase) {
        console.log("Dashboard: userId or supabase not ready. userId:", userId, "supabase:", supabase);
        setLoading(false);
        return;
      }

      try {
        // Fetch restaurant count
        const { data: countData, error: countError } = await supabase
          .rpc('get_user_restaurant_count', { p_user_id: userId });

        if (countError) {
          throw countError;
        }
        setRestaurantCount(countData as number);

        // Fetch restaurant ID
        const { data: idData, error: idError } = await supabase
          .rpc('get_user_restaurant_id');

        if (idError) {
          throw idError;
        }
        const fetchedRestaurantId = idData as string;
        setRestaurantId(fetchedRestaurantId);

        // Fetch table counts if restaurantId is available
        if (fetchedRestaurantId) {
          const { data: tableCountData, error: tableCountError } = await supabase
            .rpc('get_table_counts_for_restaurant', { p_restaurant_id: fetchedRestaurantId });

          if (tableCountError) {
            throw tableCountError;
          }
          if (tableCountData && tableCountData.length > 0) {
            setTableCounts(tableCountData[0]);
          }
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
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Restaurante
        </Button>
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
              <div className="text-2xl font-bold">{restaurantCount}</div>
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
            <div className="text-2xl font-bold">0</div>
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
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Clientes atendidos
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bem-vindo ao Ágil QR!</CardTitle>
            <CardDescription>
              Comece criando seu primeiro restaurante
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Para começar a usar a plataforma, você precisa criar um restaurante,
              configurar suas mesas e cardápios.
            </p>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Criar Restaurante
            </Button>
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
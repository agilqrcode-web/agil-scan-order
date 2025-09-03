import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, QrCode, Download, Settings } from "lucide-react";
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@clerk/clerk-react";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors = {
  available: "bg-green-100 text-green-800",
  occupied: "bg-red-100 text-red-800",
  cleaning: "bg-yellow-100 text-yellow-800"
};

const statusLabels = {
  available: "Disponível",
  occupied: "Ocupada",
  cleaning: "Limpeza"
};

export default function Tables() {
  const { userId } = useAuth();
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
    async function fetchRestaurantId() {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .rpc('get_user_restaurant_id');

        if (error) {
          throw error;
        }
        setRestaurantId(data as string);
      } catch (err) {
        console.error("Error fetching restaurant ID:", err);
        setError("Failed to load restaurant data.");
        setLoading(false);
      }
    }
    fetchRestaurantId();
  }, [userId]);

  useEffect(() => {
    async function fetchTableCounts() {
      if (!restaurantId) {
        return;
      }
      try {
        const { data, error } = await supabase
          .rpc('get_table_counts_for_restaurant', { p_restaurant_id: restaurantId });

        console.log("RPC Data:", data);
        console.log("RPC Error:", error);

        if (error) {
          throw error;
        }
        if (data && data.length > 0) {
          setTableCounts(data[0]);
        } else {
          setTableCounts({ total_tables: 0, available_tables: 0, occupied_tables: 0, cleaning_tables: 0 });
        }
      } catch (err) {
        console.error("Error fetching table counts:", err);
        setError("Failed to load table counts.");
      } finally {
        setLoading(false);
      }
    }
    fetchTableCounts();
  }, [restaurantId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Mesas</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Mesa
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Mesas</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-1/2" />
            ) : error ? (
              <div className="text-red-500 text-sm">{error}</div>
            ) : (
              <div className="text-2xl font-bold">{tableCounts.total_tables}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponíveis</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-1/2" />
            ) : error ? (
              <div className="text-red-500 text-sm">{error}</div>
            ) : (
              <div className="text-2xl font-bold text-green-600">
                {tableCounts.available_tables}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ocupadas</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-1/2" />
            ) : error ? (
              <div className="text-red-500 text-sm">{error}</div>
            ) : (
              <div className="text-2xl font-bold text-red-600">
                {tableCounts.occupied_tables}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Limpeza</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-1/2" />
            ) : error ? (
              <div className="text-red-500 text-sm">{error}</div>
            ) : (
              <div className="text-2xl font-bold text-yellow-600">
                {tableCounts.cleaning_tables}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Mesas</CardTitle>
          <CardDescription>
            Visualize e gerencie todas as mesas do seu restaurante
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <Input placeholder="Buscar mesa..." className="max-w-sm" />
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Baixar QR Codes
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Table cards will be rendered here dynamically */}
              <p className="text-muted-foreground">Carregando mesas...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
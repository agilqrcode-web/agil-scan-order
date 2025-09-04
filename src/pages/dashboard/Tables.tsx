import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, QrCode, Download, Settings } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupabase } from "@/contexts/SupabaseContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

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
  const supabase = useSupabase();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [tableCounts, setTableCounts] = useState({
    total_tables: 0,
    available_tables: 0,
    occupied_tables: 0,
    cleaning_tables: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);

  const addTableSchema = z.object({
    table_number: z.preprocess(
      (val) => Number(val),
      z.number().int().positive("Número da mesa deve ser um número inteiro positivo.")
    ),
    qr_code_identifier: z.string().min(1, "Identificador do QR Code é obrigatório."),
  });

  type AddTableFormValues = z.infer<typeof addTableSchema>;

  const form = useForm<AddTableFormValues>({
    resolver: zodResolver(addTableSchema),
    defaultValues: {
      table_number: undefined,
      qr_code_identifier: "",
    },
  });

  const onSubmit = async (values: AddTableFormValues) => {
    if (!restaurantId) {
      setError("Restaurant ID not found. Cannot add table.");
      return;
    }

    try {
      const response = await fetch("/api/add-table", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          table_number: values.table_number,
          qr_code_identifier: values.qr_code_identifier,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add table");
      }

      // Table added successfully, close modal and refresh counts
      setIsAddTableModalOpen(false);
      form.reset();
      // Re-fetch counts to update the display
      fetchTableCounts(); 
    } catch (err) {
      console.error("Error adding table:", err);
      setError(err.message || "Failed to add table.");
    }
  };

  useEffect(() => {
    async function fetchRestaurantId() {
      if (!userId || !supabase) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .rpc('get_user_restaurant_id');

        console.log("Restaurant ID RPC Data:", data);
        console.log("Restaurant ID RPC Error:", error);

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
  }, [userId, supabase]);

  useEffect(() => {
    async function fetchTableCounts() {
      if (!restaurantId || !supabase) {
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
  }, [restaurantId, supabase]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Mesas</h1>
        <Button onClick={() => setIsAddTableModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Mesa
        </Button>
      </div>

      <Dialog open={isAddTableModalOpen} onOpenChange={setIsAddTableModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Adicionar Nova Mesa</DialogTitle>
            <DialogDescription>
              Preencha os detalhes para adicionar uma nova mesa ao seu restaurante.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="table_number" className="text-right">
                Número da Mesa
              </Label>
              <Input
                id="table_number"
                type="number"
                {...form.register("table_number")}
                className="col-span-3"
              />
              {form.formState.errors.table_number && (
                <p className="col-span-4 text-right text-red-500 text-sm">
                  {form.formState.errors.table_number.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="qr_code_identifier" className="text-right">
                Identificador QR Code
              </Label>
              <Input
                id="qr_code_identifier"
                {...form.register("qr_code_identifier")}
                className="col-span-3"
              />
              {form.formState.errors.qr_code_identifier && (
                <p className="col-span-4 text-right text-red-500 text-sm">
                  {form.formState.errors.qr_code_identifier.message}
                </p>
              )}
            </div>
          </form>
          <DialogFooter>
            <Button type="submit" form="add-table-form" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Adicionando..." : "Adicionar Mesa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
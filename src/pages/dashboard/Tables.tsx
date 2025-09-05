import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, QrCode, Download, Settings, Eye, EyeOff } from "lucide-react";
import * as QRCode from "qrcode.react";
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
  const [existingTableNumbers, setExistingTableNumbers] = useState<number[]>([]);
  const [tables, setTables] = useState<any[]>([]); // State to store fetched tables
  const [visibleQrCodeId, setVisibleQrCodeId] = useState<string | null>(null);
  const [isQrCodeModalOpen, setIsQrCodeModalOpen] = useState(false);
  const [selectedTableQrCodeIdentifier, setSelectedTableQrCodeIdentifier] = useState<string | null>(null);

  const fetchTables = async () => {
    if (!restaurantId || !supabase) {
      return;
    }
    try {
      const { data, error } = await supabase
        .rpc('get_all_restaurant_tables', { p_restaurant_id: restaurantId }); // Use the new RPC

      if (error) {
        throw error;
      }
      setTables(data || []);
    } catch (err) {
      console.error("Error fetching tables:", err);
      setError("Failed to load tables.");
    }
  };

  const addTableSchema = z.object({
    table_number: z.preprocess(
      (val) => Number(val),
      z.number().int().positive("Número da mesa deve ser um número inteiro positivo.")
    ).refine((val) => !existingTableNumbers.includes(val), {
      message: "Este número de mesa já está em uso.",
      path: ["table_number"],
    }),
    
  });

  type AddTableFormValues = z.infer<typeof addTableSchema>;

  const form = useForm<AddTableFormValues>({
    resolver: zodResolver(addTableSchema),
    defaultValues: {
      table_number: undefined,
      
    },
  });

  const fetchTableCounts = async () => {
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
  };

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
          qr_code_identifier: crypto.randomUUID(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add table");
      }

      // Table added successfully, close modal and refresh counts and tables
      setIsAddTableModalOpen(false);
      form.reset();
      fetchTableCounts(); 
      fetchTables(); // Re-fetch tables to update the display 
      fetchExistingTableNumbers(); // Re-fetch existing table numbers 
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
    if (restaurantId && supabase) {
      fetchTableCounts();
      fetchTables(); // Call fetchTables here
    }
  }, [restaurantId, supabase]);

  useEffect(() => {
    if (restaurantId && supabase) {
      fetchExistingTableNumbers();
    }
  }, [restaurantId, supabase]);

  const fetchExistingTableNumbers = async () => {
    if (!restaurantId || !supabase) {
      return;
    }
    try {
      const { data, error } = await supabase
        .rpc('get_existing_table_numbers_for_restaurant', { p_restaurant_id: restaurantId });

      if (error) {
        throw error;
      }
      if (data) {
        setExistingTableNumbers(data as number[]);
      }
    } catch (err) {
      console.error("Error fetching existing table numbers:", err);
      // Optionally set an error state for this specific fetch
    }
  };

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
          <form id="add-table-form" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
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
            {existingTableNumbers.length > 0 && (
              <div className="col-span-4 text-sm text-muted-foreground text-right">
                Números de mesa já em uso: {existingTableNumbers.join(', ')}
              </div>
            )}
            
          </form>
          <DialogFooter>
            <Button type="submit" form="add-table-form" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Adicionando..." : "Adicionar Mesa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isQrCodeModalOpen} onOpenChange={setIsQrCodeModalOpen}>
        <DialogContent className="sm:max-w-[425px] flex flex-col items-center">
          <DialogHeader>
            <DialogTitle>QR Code da Mesa</DialogTitle>
            <DialogDescription>
              Escaneie este QR Code para acessar o cardápio da mesa.
            </DialogDescription>
          </DialogHeader>
          {selectedTableQrCodeIdentifier && (
            <div className="p-4 border border-gray-200 rounded-lg">
              <QRCode.default
                value={`https://agil-scan-order-neon.vercel.app/order/${selectedTableQrCodeIdentifier}`}
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <Button onClick={() => {
              // Download functionality will go here
              const canvas = document.querySelector('canvas');
              if (canvas) {
                const url = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = `qrcode-${selectedTableQrCodeIdentifier}.png`;
                link.href = url;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }
            }}>
              <Download className="mr-2 h-4 w-4" />
              Baixar QR Code
            </Button>
            <Button variant="outline" onClick={() => setIsQrCodeModalOpen(false)}>
              Fechar
            </Button>
          </div>
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
              {loading ? (
                <p className="text-muted-foreground">Carregando mesas...</p>
              ) : error ? (
                <div className="text-red-500 text-sm">{error}</div>
              ) : tables.length === 0 ? (
                <p className="text-muted-foreground col-span-3">Nenhuma mesa encontrada. Adicione uma nova mesa para começar!</p>
              ) : (
                tables.map((table) => (
                  <Card key={table.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Mesa {table.table_number}</CardTitle>
                        <Badge
                          className={statusColors[table.status as keyof typeof statusColors]}
                        >
                          {statusLabels[table.status as keyof typeof statusLabels]}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Código: {visibleQrCodeId === table.id ? table.qr_code_identifier : '********'}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setVisibleQrCodeId(visibleQrCodeId === table.id ? null : table.id)
                          }
                        >
                          {visibleQrCodeId === table.id ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      {/* Assuming 'orders' is a property on the table object, if not, this part needs adjustment */}
                      {/* {table.orders > 0 && (
                        <p className="text-sm">
                          <strong>{table.orders}</strong> pedido(s) ativos
                        </p>
                      )} */}

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setSelectedTableQrCodeIdentifier(table.qr_code_identifier);
                            setIsQrCodeModalOpen(true);
                          }}
                        >
                          <QrCode className="mr-1 h-3 w-3" />
                          QR Code
                        </Button>
                        <Button size="sm" variant="outline">
                          <Settings className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
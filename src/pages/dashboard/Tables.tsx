import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, QrCode, Download, Settings, Eye, EyeOff } from "lucide-react";
import QRCode from "react-qr-code";
import QRCodeGenerator from 'qrcode';
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupabase } from "@/contexts/SupabaseContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
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
  const [selectedTableQrCodeIdentifier, setSelectedTableQrCodeIdentifier] = useState<{ qr_code_identifier: string; table_number: number } | null>(null);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [tableToDeleteId, setTableToDeleteId] = useState<string | null>(null);

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
      console.error("Raw error object for table counts:", JSON.stringify(err, null, 2));
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
      const response = await fetch("/api/tables", {
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
        let errorMessage = "Ocorreu um erro desconhecido.";
        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          errorMessage = errorData.error || JSON.stringify(errorData);
        } else {
          errorMessage = await response.text(); // Read as text if not JSON
        }
        throw new Error(errorMessage);
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

  const handleDeleteTable = async () => {
    if (!tableToDeleteId) return;

    try {
      const response = await fetch(`/api/tables?table_id=${tableToDeleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        let errorMessage = "Ocorreu um erro desconhecido.";
        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          errorMessage = errorData.error || JSON.stringify(errorData);
        } else {
          errorMessage = await response.text(); // Read as text if not JSON
        }
        throw new Error(errorMessage);
      }

      // Table deleted successfully, refresh tables and counts
      fetchTables();
      fetchTableCounts();
      setIsDeleteConfirmModalOpen(false); // Close the confirmation modal
      setTableToDeleteId(null); // Clear the ID of the table to delete
    } catch (err) {
      console.error("Error deleting table:", err);
      setError(err.message || "Failed to delete table.");
    }
  };

  useEffect(() => {
    async function fetchRestaurantData() { // Renamed function for clarity
      if (!userId || !supabase) {
        setLoading(false);
        return;
      }
      try {
        // Fetch restaurant ID
        const { data: restaurantIdData, error: restaurantIdError } = await supabase
          .rpc('get_user_restaurant_id');

        if (restaurantIdError) {
          throw restaurantIdError;
        }
        const fetchedRestaurantId = restaurantIdData as string;
        setRestaurantId(fetchedRestaurantId);

        // Fetch restaurant name using the new RPC function
        const { data: restaurantNameData, error: restaurantNameError } = await supabase
          .rpc('get_restaurant_name_by_id', { p_restaurant_id: fetchedRestaurantId });

        if (restaurantNameError) {
          throw restaurantNameError;
        }
        setRestaurantName(restaurantNameData as string);

      } catch (err) {
        console.error("Error fetching restaurant data:", err);
        setError("Failed to load restaurant data.");
        setLoading(false);
      }
    }
    fetchRestaurantData();
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
            <DialogTitle>QR Code da Mesa {selectedTableQrCodeIdentifier?.table_number}</DialogTitle>
            <DialogDescription>
              Este QR Code deve ficar visível para seus clientes.
            </DialogDescription>
          </DialogHeader>
          {selectedTableQrCodeIdentifier && (
            <div className="p-4 border border-gray-200 rounded-lg">
              <QRCode
                value={`https://agil-scan-order-neon.vercel.app/order/${selectedTableQrCodeIdentifier}`}
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <Button onClick={async () => {
              if (!selectedTableQrCodeIdentifier) return;

              const qrCodeValue = `https://agil-scan-order-neon.vercel.app/order/${selectedTableQrCodeIdentifier.qr_code_identifier}`;
              const instructionsText = 'Aponte a câmera do seu celular para este QR Code para acessar o cardápio digital e fazer seu pedido.';

              // Create a temporary canvas element for QR code rendering
              const qrCodeCanvas = document.createElement('canvas');
              // Set a higher resolution for better print quality
              const qrCodeSize = 200; // px
              qrCodeCanvas.width = qrCodeSize;
              qrCodeCanvas.height = qrCodeSize;

              await new Promise<void>((resolve, reject) => {
                QRCodeGenerator.toCanvas(qrCodeCanvas, qrCodeValue, {
                  width: qrCodeSize,
                  margin: 1, // Small margin around QR code
                  color: {
                    dark: '#000000FF', // Black dots
                    light: '#FFFFFFFF' // White background
                  }
                }, (error) => {
                  if (error) {
                    console.error("Error rendering QR code to canvas:", error);
                    reject(error);
                  } else {
                    resolve();
                  }
                });
              });

              const qrCodeDataUrl = qrCodeCanvas.toDataURL('image/png');

              const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm', // Use millimeters for better control over print layout
                format: 'a4' // Standard A4 size
              });

              const pageWidth = doc.internal.pageSize.getWidth();
              let yOffset = 20; // Initial Y offset from top

              // 1. QR Code (centralized, medium to small)
              const qrCodeImageWidth = 50; // mm
              const qrCodeImageHeight = 50; // mm
              const qrCodeX = (pageWidth - qrCodeImageWidth) / 2;
              doc.addImage(qrCodeDataUrl, 'PNG', qrCodeX, yOffset, qrCodeImageWidth, qrCodeImageHeight);
              yOffset += qrCodeImageHeight + 10; // Move Y offset down

              // 2. Restaurant Name
              doc.setFontSize(18);
              doc.text(restaurantName || 'Nome do Restaurante', pageWidth / 2, yOffset, { align: 'center' });
              yOffset += 10;

              // 3. Table Name
              doc.setFontSize(14);
              doc.text(`Mesa ${selectedTableQrCodeIdentifier.table_number}`, pageWidth / 2, yOffset, { align: 'center' });
              yOffset += 15;

              // 4. Instructions
              doc.setFontSize(10);
              const splitInstructions = doc.splitTextToSize(instructionsText, pageWidth - 40); // 20mm margin on each side
              doc.text(splitInstructions, pageWidth / 2, yOffset, { align: 'center' });

              doc.save(`mesa-${selectedTableQrCodeIdentifier.table_number}.pdf`);
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

      <AlertDialog open={isDeleteConfirmModalOpen} onOpenChange={setIsDeleteConfirmModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente a mesa e todos os dados associados a ela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDeleteConfirmModalOpen(false);
              setTableToDeleteId(null);
            }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTable}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                            setSelectedTableQrCodeIdentifier({ qr_code_identifier: table.qr_code_identifier, table_number: table.table_number });
                            setIsQrCodeModalOpen(true);
                          }}
                        >
                          <QrCode className="mr-1 h-3 w-3" />
                          QR Code
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline">
                              <Settings className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem
                              onClick={() => {
                                setTableToDeleteId(table.id);
                                setIsDeleteConfirmModalOpen(true);
                              }}
                            >
                              Excluir Mesa
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
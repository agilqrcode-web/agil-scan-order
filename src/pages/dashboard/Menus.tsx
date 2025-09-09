import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, QrCode, UtensilsCrossed, LayoutList, Package, Eye } from "lucide-react"; // Added icons
import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupabase } from "@/contexts/SupabaseContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";

// Define schema for menu form
const menuSchema = z.object({
  name: z.string().min(1, "Nome do cardápio é obrigatório."),
  is_active: z.boolean().default(true), // is_active will be handled by default in API for now
});

type MenuFormValues = z.infer<typeof menuSchema>;

export default function Menus() {
  const { userId } = useAuth();
  const supabase = useSupabase();
  const navigate = useNavigate();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [menus, setMenus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddMenuModalOpen, setIsAddMenuModalOpen] = useState(false);
  const [isDeleteMenuModalOpen, setIsDeleteMenuModalOpen] = useState(false);
  const [menuToDelete, setMenuToDelete] = useState<any | null>(null);

  // States for summary counts (will be dynamic later)
  const [totalMenus, setTotalMenus] = useState(0);
  const [totalCategories, setTotalCategories] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  const form = useForm<MenuFormValues>({
    resolver: zodResolver(menuSchema),
    defaultValues: {
      name: "",
      is_active: true,
    },
  });

  const fetchMenus = async () => {
    if (!restaurantId || !supabase) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('menus')
        .select('*')
        .eq('restaurant_id', restaurantId);

      if (error) {
        throw error;
      }
      setMenus(data || []);
      setTotalMenus(data?.length || 0); // Update total menus count
    } catch (err) {
      console.error("Error fetching menus:", err);
      console.error("Raw error object for menus:", JSON.stringify(err, null, 2));
      setError("Failed to load menus.");
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch summary counts (will be implemented later)
  const fetchSummaryCounts = async () => {
    if (!restaurantId || !supabase) return;
    try {
      const { data: categoriesCount, error: categoriesError } = await supabase.rpc('get_restaurant_category_count', { p_restaurant_id: restaurantId });
      if (categoriesError) throw categoriesError;
      setTotalCategories(categoriesCount || 0);

      const { data: itemsCount, error: itemsError } = await supabase.rpc('get_restaurant_item_count', { p_restaurant_id: restaurantId });
      if (itemsError) throw itemsError;
      setTotalItems(itemsCount || 0);
    } catch (err) {
      console.error("Error fetching summary counts:", err);
      setError("Failed to load summary counts.");
    }
  };

  const onSubmit = async (values: MenuFormValues) => {
    if (!restaurantId) {
      setError("Restaurant ID not found. Cannot add menu.");
      return;
    }

    try {
      const response = await fetch("/api/menus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          name: values.name,
          is_active: values.is_active,
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

      setIsAddMenuModalOpen(false);
      form.reset();
      fetchMenus(); // Refresh the list of menus
      fetchSummaryCounts(); // Refresh summary counts
    } catch (err) {
      console.error("Error adding menu:", err);
      setError(err.message || "Failed to add menu.");
    }
  };

  const handleDeleteMenu = async () => {
    if (!menuToDelete) return;

    try {
      const response = await fetch("/api/menus", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ menu_id: menuToDelete.id }),
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

      setIsDeleteMenuModalOpen(false);
      setMenuToDelete(null);
      fetchMenus(); // Refresh the list of menus
      fetchSummaryCounts(); // Refresh summary counts
    } catch (err) {
      console.error("Error deleting menu:", err);
      setError(err.message || "Failed to delete menu.");
    }
  };

  useEffect(() => {
    async function getRestaurantId() {
      if (!userId || !supabase || !supabase.auth.user()) {
        setLoading(false);
        return;
      }
      try {
        const { data: restaurantIdData, error: restaurantIdError } = await supabase
          .rpc('get_user_restaurant_id');

        if (restaurantIdError) {
          throw restaurantIdError;
        }
        const fetchedRestaurantId = restaurantIdData as string;
        setRestaurantId(fetchedRestaurantId);
      } catch (err) {
        console.error("Error fetching restaurant ID:", err);
        setError("Failed to load restaurant data.");
        setLoading(false);
      }
    }
    getRestaurantId();
  }, [userId, supabase]);

  useEffect(() => {
    if (restaurantId) {
      fetchMenus();
      fetchSummaryCounts(); // Fetch summary counts when restaurantId is available
    }
  }, [restaurantId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Cardápios</h1>
        <Button onClick={() => setIsAddMenuModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Cardápio
        </Button>
      </div>

      <Dialog open={isAddMenuModalOpen} onOpenChange={setIsAddMenuModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Adicionar Novo Cardápio</DialogTitle>
            <DialogDescription>
              Preencha os detalhes para adicionar um novo cardápio.
            </DialogDescription>
          </DialogHeader>
          <form id="add-menu-form" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nome
              </Label>
              <Input
                id="name"
                {...form.register("name")}
                className="col-span-3"
              />
              {form.formState.errors.name && (
                <p className="col-span-4 text-right text-red-500 text-sm">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            {/* is_active toggle can be added here later if needed */}
          </form>
          <DialogFooter>
            <Button type="submit" form="add-menu-form" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Adicionando..." : "Adicionar Cardápio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteMenuModalOpen} onOpenChange={setIsDeleteMenuModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja excluir o cardápio "{menuToDelete?.name}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteMenuModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteMenu}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Cardápios</CardTitle>
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" /> {/* Icon for Menus */}
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-1/2" />
            ) : error ? (
              <div className="text-red-500 text-sm">{error}</div>
            ) : (
              <div className="text-2xl font-bold">{totalMenus}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Cardápios cadastrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Categorias</CardTitle>
            <LayoutList className="h-4 w-4 text-muted-foreground" /> {/* Icon for Categories */}
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-1/2" />
            ) : error ? (
              <div className="text-red-500 text-sm">{error}</div>
            ) : (
              <div className="text-2xl font-bold">{totalCategories}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Categorias em todos os cardápios
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" /> {/* Icon for Menu Items */}
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-1/2" />
            ) : error ? (
              <div className="text-red-500 text-sm">{error}</div>
            ) : (
              <div className="text-2xl font-bold">{totalItems}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Itens em todos os cardápios
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Cardápios</CardTitle>
          <CardDescription>
            Visualize e gerencie todos os cardápios do seu restaurante
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <p className="text-muted-foreground">Carregando cardápios...</p>
            ) : error ? (
              <div className="text-red-500 text-sm">{error}</div>
            ) : menus.length === 0 ? (
              <p className="text-muted-foreground col-span-3">Nenhum cardápio encontrado. Adicione um novo cardápio para começar!</p>
            ) : (
              menus.map((menu) => (
                <Card key={menu.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{menu.name}</CardTitle>
                      {/* <Badge variant={menu.is_active ? "default" : "secondary"}>
                        {menu.is_active ? "Ativo" : "Inativo"}
                      </Badge> */}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {menu.is_active ? "Cardápio ativo" : "Cardápio inativo"}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/dashboard/menus/${menu.id}/edit`)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/menus/${menu.id}`)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setMenuToDelete(menu);
                        setIsDeleteMenuModalOpen(true);
                      }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
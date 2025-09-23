import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, UtensilsCrossed, LayoutList, Package, Eye, ImageIcon } from "lucide-react";
import React, { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";

const menuSchema = z.object({
  name: z.string().min(1, "Nome do cardápio é obrigatório."),
});
type MenuFormValues = z.infer<typeof menuSchema>;

interface Menu {
  id: string;
  name: string;
  is_active: boolean;
  banner_url: string | null;
  restaurant_id: string;
}

interface MenusPageData {
  menus: Menu[];
  summary: {
    total_categories: number;
    total_items: number;
  };
}

export default function Menus() {
  const { userId, getToken } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isAddMenuModalOpen, setIsAddMenuModalOpen] = useState(false);
  const [isDeleteMenuModalOpen, setIsDeleteMenuModalOpen] = useState(false);
  const [menuToDelete, setMenuToDelete] = useState<Menu | null>(null);

  const form = useForm<MenuFormValues>({ resolver: zodResolver(menuSchema), defaultValues: { name: "" } });

  // Única query para buscar todos os dados da página
  const { data, isLoading, isError, error } = useQuery<MenusPageData, Error>({
    queryKey: ['menusPageData', userId],
    queryFn: async () => {
      const token = await getToken();
      const response = await fetch('/api/menus', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch menus data');
      return response.json();
    },
    enabled: !!userId,
  });

  // Mutação para criar um cardápio
  const createMenuMutation = useMutation({
    mutationFn: async (values: MenuFormValues) => {
      const token = await getToken();
      // O restaurant_id é obtido no backend a partir do token
      const response = await fetch('/api/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create menu');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menusPageData', userId] });
      setIsAddMenuModalOpen(false);
      form.reset();
    },
  });

  // Mutação para excluir um cardápio
  const deleteMenuMutation = useMutation({
    mutationFn: async (menuId: string) => {
      const token = await getToken();
      const response = await fetch('/api/menus', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ menu_id: menuId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete menu');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menusPageData', userId] });
      setIsDeleteMenuModalOpen(false);
      setMenuToDelete(null);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Cardápios</h1>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => setIsAddMenuModalOpen(true)}>
                <Plus className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Novo Cardápio</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Novo Cardápio</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Add Menu Modal */}
      <Dialog open={isAddMenuModalOpen} onOpenChange={setIsAddMenuModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Adicionar Novo Cardápio</DialogTitle><DialogDescription>Preencha o nome para criar um novo cardápio.</DialogDescription></DialogHeader>
          <form id="add-menu-form" onSubmit={form.handleSubmit((formData) => createMenuMutation.mutate(formData))} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Nome</Label>
              <Input id="name" {...form.register("name")} className="col-span-3" />
              {form.formState.errors.name && <p className="col-span-4 text-right text-red-500 text-sm">{form.formState.errors.name.message}</p>}
            </div>
          </form>
          <DialogFooter><Button type="submit" form="add-menu-form" disabled={createMenuMutation.isPending}>{createMenuMutation.isPending ? "Adicionando..." : "Adicionar Cardápio"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Menu Modal */}
      <Dialog open={isDeleteMenuModalOpen} onOpenChange={setIsDeleteMenuModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Confirmar Exclusão</DialogTitle><DialogDescription>Tem certeza de que deseja excluir o cardápio "{menuToDelete?.name}"? Esta ação não pode ser desfeita.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteMenuModalOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteMenuMutation.mutate(menuToDelete!.id)} disabled={deleteMenuMutation.isPending}>{deleteMenuMutation.isPending ? "Excluindo..." : "Excluir"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total de Cardápios</CardTitle><UtensilsCrossed className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent>{isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{data?.menus?.length ?? 0}</div>}<p className="text-xs text-muted-foreground">Cardápios cadastrados</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total de Categorias</CardTitle><LayoutList className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent>{isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{data?.summary?.total_categories ?? 0}</div>}<p className="text-xs text-muted-foreground">Categorias em todos os cardápios</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total de Itens</CardTitle><Package className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent>{isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{data?.summary?.total_items ?? 0}</div>}<p className="text-xs text-muted-foreground">Itens em todos os cardápios</p></CardContent>
        </Card>
      </div>

      {/* Menu List Card */}
      <Card>
        <CardHeader><CardTitle>Gerenciar Cardápios</CardTitle><CardDescription>Visualize e gerencie todos os cardápios do seu restaurante</CardDescription></CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)
            ) : isError ? (
              <div className="text-red-500 col-span-3">Falha ao carregar cardápios: {error.message}</div>
            ) : data && data.menus.length > 0 ? (
              data.menus.map((menu) => (
                <Card key={menu.id} className="hover:shadow-lg transition-shadow flex flex-col">
                  <div className="w-full h-32 bg-muted/30 flex items-center justify-center">
                    {menu.banner_url ? (
                      <img src={menu.banner_url} alt={`Banner do ${menu.name}`} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
                    )}
                  </div>
                  <CardHeader className="pb-3 flex-grow">
                    <CardTitle className="text-lg">{menu.name}</CardTitle>
                    <p className="text-sm text-muted-foreground pt-1">
                      {menu.is_active ? "Cardápio ativo" : "Cardápio inativo"}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/dashboard/menus/${menu.id}/edit`)}><Edit className="h-3 w-3" /></Button>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/menus/${menu.id}`)}><Eye className="h-3 w-3" /></Button>
                      <Button size="sm" variant="destructive" onClick={() => { setMenuToDelete(menu); setIsDeleteMenuModalOpen(true); }}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-muted-foreground col-span-3">Nenhum cardápio encontrado. Adicione um novo para começar!</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

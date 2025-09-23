import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PREDEFINED_MENU_ITEMS, PREDEFINED_CATEGORIES } from '@/lib/menu-constants';
import { useMenuBannerUpload } from '@/hooks/useMenuBannerUpload';
import { usePageHeader } from '@/contexts/PageHeaderContext';
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from '@/components/ui/spinner';

// Import extracted components
import { MenuDetailsCard } from '@/components/dashboard/menu-editor/MenuDetailsCard';
import { CategoriesList } from '@/components/dashboard/menu-editor/CategoriesList';
import { AddCategoryModal } from '@/components/dashboard/menu-editor/AddCategoryModal';
import { AddMenuItemModal } from '@/components/dashboard/menu-editor/AddMenuItemModal';
import { EditMenuItemModal } from '@/components/dashboard/menu-editor/EditMenuItemModal';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';

// Schemas and Types
const menuSchema = z.object({
  name: z.string().min(1, "Nome do cardápio é obrigatório."),
  is_active: z.boolean().default(true),
});

const menuItemSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Nome do item é obrigatório."),
    description: z.string().optional(),
    price: z.preprocess(
      (val) => Number(String(val).replace(",", ".")),
      z.number().min(0.01, "Preço deve ser maior que zero.")
    ),
    image_url: z.string().url("URL da imagem inválida.").optional().or(z.literal("")),
    menu_id: z.string().optional(),
    category_id: z.string().optional(),
  });

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Nome da categoria é obrigatório"),
});

export type MenuFormValues = z.infer<typeof menuSchema>;
export type CategoryFormValues = z.infer<typeof categorySchema>;
export type MenuItemFormValues = z.infer<typeof menuItemSchema>;

export default function MenuEditor() {
  const { menuId } = useParams<{ menuId: string }>();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { setHeader, clearHeader } = usePageHeader();
  const { toast } = useToast();
  const navigate = useNavigate();

  // State for modals and selections
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [isAddMenuItemModalOpen, setIsAddMenuItemModalOpen] = useState(false);
  const [isEditMenuItemModalOpen, setIsEditMenuItemModalOpen] = useState(false);
  const [selectedCategoryIdForMenuItem, setSelectedCategoryIdForMenuItem] = useState<string | null>(null);
  const [itemSuggestions, setItemSuggestions] = useState<string[]>([]);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Forms
  const menuForm = useForm<MenuFormValues>({ resolver: zodResolver(menuSchema) });
  const addMenuItemForm = useForm<MenuItemFormValues>({ resolver: zodResolver(menuItemSchema), defaultValues: { name: "", description: "", price: undefined, image_url: "" } });
  const editMenuItemForm = useForm<MenuItemFormValues>({ resolver: zodResolver(menuItemSchema) });

  // Single Query to fetch all data for the editor
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['menuEditorData', menuId],
    queryFn: async () => {
      if (!menuId) throw new Error("Menu ID is required");
      const token = await getToken();
      const response = await fetch(`/api/menus?id=${menuId}`, { headers: { 'Authorization': `Bearer ${token}` } });

      if (!response.ok) {
        throw new Error("Failed to fetch menu data.");
      }

      try {
        return await response.json();
      } catch (e) {
        throw new Error("Failed to parse JSON response from server.");
      }
    },
    enabled: !!menuId && !!getToken,
    onSuccess: (data) => {
      console.log("[MenuEditor] Data received from API:", data);
      if (data?.menu) {
        menuForm.reset(data.menu);
        setCategories(data.categories || []);
      }
    }
  });

  const { bannerPreview, handleBannerChange, handleBannerRemove, uploadBanner } = useMenuBannerUpload({
    initialBannerUrl: data?.menu?.banner_url || null,
    menuId: menuId || '',
    restaurantId: data?.restaurant?.id || '',
    setSaveMessage: (msg) => toast({ title: msg.type === 'success' ? 'Sucesso!' : 'Erro', description: msg.text }),
  });

  const usedCategoryNames = React.useMemo(() => categories.map(cat => cat.name.toLowerCase()), [categories]);

  // Generic fetch helper for mutations
  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = await getToken();
    const headers = new Headers(options.headers);
    headers.append('Authorization', `Bearer ${token}`);
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }
    return response;
  }, [getToken]);

  // Invalidate query on mutation success
  const onMutationSuccess = () => queryClient.invalidateQueries({ queryKey: ['menuEditorData', menuId] });

  // Mutations
  const saveCategoryOrderMutation = useMutation({ mutationFn: () => fetchWithAuth("/api/categories", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categories: categories.map((cat, idx) => ({ id: cat.id, position: idx })) }) }), onSuccess: onMutationSuccess });
  const saveCategoryMutation = useMutation({ mutationFn: (category: any) => fetchWithAuth("/api/categories", { method: category.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(category) }), onSuccess: onMutationSuccess });
  const deleteCategoryMutation = useMutation({ mutationFn: (categoryId: string) => fetchWithAuth("/api/categories", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: categoryId }) }), onSuccess: onMutationSuccess });
  const saveMenuItemMutation = useMutation({ mutationFn: (item: any) => fetchWithAuth("/api/menu-items", { method: item.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) }), onSuccess: onMutationSuccess });
  const deleteMenuItemMutation = useMutation({ mutationFn: (itemId: string) => fetchWithAuth("/api/menu-items", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: itemId }) }), onSuccess: onMutationSuccess });

  const handleSaveMenu = useCallback(async (values: MenuFormValues) => {
    if (!menuId || !data?.menu) return;
    setIsSaving(true);
    try {
      const newBannerUrl = await uploadBanner();
      const updateData = { id: menuId, name: values.name, is_active: values.is_active, banner_url: newBannerUrl };
      await fetchWithAuth("/api/menus", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updateData) });
      await saveCategoryOrderMutation.mutateAsync();
      toast({ title: 'Sucesso!', description: 'Cardápio salvo com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['menusPageData', data.menu.restaurant_id] }); // Invalidate list view
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: (err as Error).message });
    } finally {
      setIsSaving(false);
    }
  }, [menuId, data, uploadBanner, saveCategoryOrderMutation, toast, fetchWithAuth, queryClient]);

  useEffect(() => {
    const saveAction = <Button size="icon" onClick={menuForm.handleSubmit(handleSaveMenu)} disabled={isSaving}>{isSaving ? <Spinner size="small" /> : <Save className="h-4 w-4" />}</Button>;
    setHeader({ title: `Editando: ${data?.menu?.name || 'Cardápio'}`, backButtonHref: "/dashboard/menus", headerActions: saveAction, fabAction: saveAction });
    return () => clearHeader();
  }, [isSaving, data, menuForm, handleSaveMenu, setHeader, clearHeader]);

  // Handlers that now use mutations
  const handleSaveCategory = (category: Partial<CategoryFormValues>) => saveCategoryMutation.mutateAsync(category.id ? category : { ...category, restaurant_id: data?.menu.restaurant_id, position: categories.length });
  const handleDeleteCategory = (categoryId: string) => deleteCategoryMutation.mutate(categoryId);
  const handleSaveMenuItem = (item: MenuItemFormValues) => saveMenuItemMutation.mutate(item.id ? item : { ...item, menu_id: menuId, category_id: selectedCategoryIdForMenuItem });
  const handleDeleteMenuItem = (itemId: string) => deleteMenuItemMutation.mutate(itemId);

  const handleMoveCategory = useCallback((index: number, direction: 'up' | 'down') => {
    const newCategories = [...categories];
    const to = direction === 'up' ? index - 1 : index + 1;
    if (to < 0 || to >= newCategories.length) return;
    [newCategories[index], newCategories[to]] = [newCategories[to], newCategories[index]]; // Swap
    setCategories(newCategories.map((cat, idx) => ({ ...cat, position: idx })));
  }, [categories]);

  const handleItemNameInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    addMenuItemForm.setValue("name", value);
    if (value.length > 1) {
      setItemSuggestions(PREDEFINED_MENU_ITEMS.filter(item => item.toLowerCase().includes(value.toLowerCase())).slice(0, 10));
    } else {
      setItemSuggestions([]);
    }
  }, [addMenuItemForm]);

  if (isLoading) return <div className="space-y-6 p-4"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-48 w-full" /><Skeleton className="h-32 w-full" /></div>;
  if (isError) return <div className="text-red-500 p-4">{error.message}</div>;
  if (!data?.menu) return <div className="text-muted-foreground p-4">Cardápio não encontrado.</div>;

  return (
    <div className="space-y-6">
      <MenuDetailsCard menuForm={menuForm} bannerPreview={bannerPreview} onBannerChange={handleBannerChange} onBannerRemove={handleBannerRemove} />
      <CategoriesList
        categories={categories}
        handleMoveCategory={handleMoveCategory}
        handleDeleteCategory={(id) => setCategoryToDelete(id)}
        handleEditMenuItem={(item) => { editMenuItemForm.reset(item); setIsEditMenuItemModalOpen(true); }}
        handleDeleteMenuItem={(id) => setItemToDelete(id)}
        handleAddMenuItem={(categoryId) => { setSelectedCategoryIdForMenuItem(categoryId); setIsAddMenuItemModalOpen(true); }}
        handleAddCategory={() => setIsAddCategoryModalOpen(true)}
      />
      <AddCategoryModal isOpen={isAddCategoryModalOpen} onOpenChange={setIsAddCategoryModalOpen} handleSaveCategory={handleSaveCategory} PREDEFINED_CATEGORIES={PREDEFINED_CATEGORIES} usedCategoryNames={usedCategoryNames} menu={data.menu} />
      <AddMenuItemModal isOpen={isAddMenuItemModalOpen} onOpenChange={(isOpen) => { if (!isOpen) setItemSuggestions([]); setIsAddMenuItemModalOpen(isOpen); }} addMenuItemForm={addMenuItemForm} handleSaveMenuItem={handleSaveMenuItem} handleItemNameInputChange={handleItemNameInputChange} itemSuggestions={itemSuggestions} setItemSuggestions={setItemSuggestions} restaurantId={data.menu.restaurant_id} />
      <EditMenuItemModal isOpen={isEditMenuItemModalOpen} onOpenChange={setIsEditMenuItemModalOpen} editMenuItemForm={editMenuItemForm} handleSaveMenuItem={handleSaveMenuItem} restaurantId={data.menu.restaurant_id} />
      <ConfirmationDialog isOpen={!!categoryToDelete} onOpenChange={() => setCategoryToDelete(null)} onConfirm={() => { if (categoryToDelete) handleDeleteCategory(categoryToDelete); setCategoryToDelete(null); }} title="Excluir Categoria?" description="Esta ação não pode ser desfeita. Isso excluirá permanentemente a categoria e todos os itens dentro dela." confirmText="Excluir" />
      <ConfirmationDialog isOpen={!!itemToDelete} onOpenChange={() => setItemToDelete(null)} onConfirm={() => { if (itemToDelete) handleDeleteMenuItem(itemToDelete); setItemToDelete(null); }} title="Excluir Item?" description="Esta ação não pode ser desfeita. Isso excluirá permanentemente o item do cardápio." confirmText="Excluir" />
    </div>
  );
}} onConfirm={() => { if (itemToDelete) handleDeleteMenuItem(itemToDelete); setItemToDelete(null); }} title="Excluir Item?" description="Esta ação não pode ser desfeita. Isso excluirá permanentemente o item do cardápio." confirmText="Excluir" />
    </div>
  );
}
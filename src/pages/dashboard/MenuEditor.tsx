import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSupabase } from '@/contexts/SupabaseContext';
import { useQueryClient } from '@tanstack/react-query';
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

export type MenuFormValues = z.infer<typeof menuSchema>;
export type CategoryFormValues = z.infer<typeof categorySchema>;
export type MenuItemFormValues = z.infer<typeof menuItemSchema>;

export default function MenuEditor() {
  const { menuId } = useParams();
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const { setHeader, clearHeader } = usePageHeader();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<any | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [isAddMenuItemModalOpen, setIsAddMenuItemModalOpen] = useState(false);
  const [isEditMenuItemModalOpen, setIsEditMenuItemModalOpen] = useState(false);
  const [selectedCategoryIdForMenuItem, setSelectedCategoryIdForMenuItem] = useState<string | null>(null);
  const [itemSuggestions, setItemSuggestions] = useState<string[]>([]);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const menuForm = useForm<MenuFormValues>({ resolver: zodResolver(menuSchema) });
  const addMenuItemForm = useForm<MenuItemFormValues>({ resolver: zodResolver(menuItemSchema), defaultValues: { name: "", description: "", price: undefined, image_url: "" } });
  const editMenuItemForm = useForm<MenuItemFormValues>({ resolver: zodResolver(menuItemSchema) });

  const { bannerPreview, handleBannerChange, handleBannerRemove, uploadBanner, resetBannerState } = useMenuBannerUpload({
    initialBannerUrl: menu?.banner_url || null,
    menuId: menuId || '',
    restaurantId: menu?.restaurant_id || '',
    setSaveMessage: (msg) => toast({ title: msg.type === 'success' ? 'Sucesso!' : 'Erro', description: msg.text }),
  });
  
  const usedCategoryNames = React.useMemo(() => {
    return categories.map(cat => cat.name.toLowerCase());
  }, [categories]);

  const fetchMenuData = useCallback(async () => {
    if (!menuId || !supabase) { setLoading(false); return; }
    setLoading(true);
    try {
      const menuResponse = await fetch(`/api/menus?id=${menuId}`);
      if (!menuResponse.ok) throw new Error("Failed to fetch menu details.");
      const menuData = await menuResponse.json();
      setMenu(menuData);
      menuForm.reset(menuData);
      
      const { data: categoriesData, error: categoriesError } = await supabase.from('categories').select('*').eq('restaurant_id', menuData.restaurant_id).order('position');
      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      const { data: menuItemsData, error: menuItemsError } = await supabase.from('menu_items').select('*').eq('menu_id', menuId);
      if (menuItemsError) throw menuItemsError;
      setMenuItems(menuItemsData || []);
    } catch (err: any) {
      setError(err.message || "Failed to load menu data.");
    } finally {
      setLoading(false);
    }
  }, [menuId, supabase, menuForm]);

  useEffect(() => { fetchMenuData(); }, [fetchMenuData]);

  const handleSaveCategoryOrder = useCallback(async () => {
    const response = await fetch("/api/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories: categories.map(cat => ({ id: cat.id, position: cat.position })) }),
    });
    if (!response.ok) throw new Error("Failed to save category order.");
  }, [categories]);

  const handleSaveMenu = useCallback(async (values: MenuFormValues) => {
    if (!menuId || !menu || !supabase) return;
    setIsSaving(true);
    
    const savePromise = (async () => {
        const newBannerUrl = await uploadBanner();
        const updateData = { id: menuId, name: values.name, is_active: values.is_active, banner_url: newBannerUrl };
        const response = await fetch("/api/menus", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updateData),
        });
        if (!response.ok) throw new Error((await response.json()).error || "Failed to update menu.");
        setMenu(prevMenu => ({ ...prevMenu, ...updateData }));
        await handleSaveCategoryOrder();
        await queryClient.invalidateQueries({ queryKey: ['menus', menu.restaurant_id] });
        resetBannerState();
    })();

    toast.promise(savePromise, {
        loading: 'Salvando cardápio...',
        success: 'Cardápio salvo com sucesso!',
        error: (err) => (err as Error).message || 'Falha ao salvar o cardápio.',
    });

    try {
        await savePromise;
    } catch (err) {
        console.error("Error saving menu:", err);
    } finally {
        setIsSaving(false);
    }
  }, [menuId, menu, supabase, queryClient, uploadBanner, resetBannerState, handleSaveCategoryOrder, toast]);

  useEffect(() => {
    const saveAction = (
        <Button size="icon" onClick={() => menuForm.handleSubmit(handleSaveMenu)()} disabled={isSaving}>
            {isSaving ? <Spinner size="small" /> : <Save className="h-4 w-4" />}
        </Button>
    );

    setHeader({
        title: `Editando: ${menu?.name || 'Cardápio'}`,
        backButtonHref: "/dashboard/menus",
        headerActions: saveAction,
        fabAction: saveAction,
    });

    return () => clearHeader();
  }, [isSaving, menu, menuForm, handleSaveMenu, setHeader, clearHeader]);

  const handleSaveCategory = useCallback(async (category: Partial<CategoryFormValues>) => {
    if (!menuId || !menu) return;
    try {
      const isNew = !category.id;
      const body = isNew ? { ...category, restaurant_id: menu.restaurant_id, position: categories.length } : { ...category };
      const response = await fetch("/api/categories", { method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error("Failed to save category.");
      fetchMenuData();
    } catch (err: any) {
      setError(err.message || "Failed to save category.");
    }
  }, [menuId, menu, categories.length, fetchMenuData]);

  const handleMoveCategory = useCallback((index: number, direction: 'up' | 'down') => {
    const newCategories = [...categories];
    const to = direction === 'up' ? index - 1 : index + 1;
    if (to < 0 || to >= newCategories.length) return;
    const from = index;
    const [movedCategory] = newCategories.splice(from, 1);
    newCategories.splice(to, 0, movedCategory);
    const updatedCategories = newCategories.map((cat, idx) => ({ ...cat, position: idx }));
    setCategories(updatedCategories);
  }, [categories]);

  const handleDeleteCategory = useCallback(async (categoryId: string) => {
    try {
      const response = await fetch("/api/categories", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: categoryId }) });
      if (!response.ok) throw new Error("Failed to delete category.");
      fetchMenuData();
    } catch (err: any) {
      setError(err.message || "Failed to delete category.");
    }
  }, [fetchMenuData]);

  const handleSaveMenuItem = useCallback(async (item: MenuItemFormValues) => {
    if (!menuId) return;
    try {
      const method = item.id ? "PUT" : "POST";
      const body = item.id ? item : { ...item, menu_id: menuId, category_id: selectedCategoryIdForMenuItem };
      const response = await fetch("/api/menu-items", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error("Failed to save menu item.");
      fetchMenuData();
    } catch (err: any) {
      setError(err.message || "Failed to save menu item.");
    }
  }, [menuId, selectedCategoryIdForMenuItem, fetchMenuData]);

  const handleDeleteMenuItem = useCallback(async (itemId: string) => {
    try {
      const response = await fetch("/api/menu-items", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: itemId }) });
      if (!response.ok) throw new Error("Failed to delete menu item.");
      fetchMenuData();
    } catch (err: any) {
      setError(err.message || "Failed to delete menu item.");
    }
  }, [fetchMenuData]);

  const handleItemNameInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    addMenuItemForm.setValue("name", value);
    if (value.length > 1) {
      const filteredSuggestions = PREDEFINED_MENU_ITEMS.filter(item => item.toLowerCase().includes(value.toLowerCase())).slice(0, 10);
      setItemSuggestions(filteredSuggestions);
    } else {
      setItemSuggestions([]);
    }
  }, [addMenuItemForm]);

  if (loading) return <div className="space-y-6 p-4"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-48 w-full" /><Skeleton className="h-32 w-full" /></div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;
  if (!menu) return <div className="text-muted-foreground p-4">Cardápio não encontrado.</div>;

  return (
    <div className="space-y-6">
      <MenuDetailsCard
        menuForm={menuForm}
        bannerPreview={bannerPreview}
        onBannerChange={handleBannerChange}
        onBannerRemove={handleBannerRemove}
      />
      <CategoriesList
        categories={categories}
        menuItems={menuItems}
        handleMoveCategory={handleMoveCategory}
        handleDeleteCategory={(id) => setCategoryToDelete(id)}
        handleEditMenuItem={(item) => {
          editMenuItemForm.reset(item);
          setIsEditMenuItemModalOpen(true);
        }}
        handleDeleteMenuItem={(id) => setItemToDelete(id)}
        handleAddMenuItem={(categoryId) => {
          setSelectedCategoryIdForMenuItem(categoryId);
          setIsAddMenuItemModalOpen(true);
        }}
        handleAddCategory={() => setIsAddCategoryModalOpen(true)}
      />
      <AddCategoryModal
        isOpen={isAddCategoryModalOpen}
        onOpenChange={setIsAddCategoryModalOpen}
        handleSaveCategory={handleSaveCategory}
        PREDEFINED_CATEGORIES={PREDEFINED_CATEGORIES}
        usedCategoryNames={usedCategoryNames}
        menu={menu}
      />
      <AddMenuItemModal
        isOpen={isAddMenuItemModalOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) { setItemSuggestions([]); }
          setIsAddMenuItemModalOpen(isOpen);
        }}
        addMenuItemForm={addMenuItemForm}
        handleSaveMenuItem={handleSaveMenuItem}
        handleItemNameInputChange={handleItemNameInputChange}
        itemSuggestions={itemSuggestions}
        setItemSuggestions={setItemSuggestions}
        restaurantId={menu?.restaurant_id}
      />
      <EditMenuItemModal
        isOpen={isEditMenuItemModalOpen}
        onOpenChange={setIsEditMenuItemModalOpen}
        editMenuItemForm={editMenuItemForm}
        handleSaveMenuItem={handleSaveMenuItem}
        restaurantId={menu?.restaurant_id}
      />
      <ConfirmationDialog
        isOpen={!!categoryToDelete}
        onOpenChange={() => setCategoryToDelete(null)}
        onConfirm={() => {
          if (categoryToDelete) handleDeleteCategory(categoryToDelete);
          setCategoryToDelete(null);
        }}
        title="Excluir Categoria?"
        description="Esta ação não pode ser desfeita. Isso excluirá permanentemente a categoria e todos os itens dentro dela."
        confirmText="Excluir"
      />
      <ConfirmationDialog
        isOpen={!!itemToDelete}
        onOpenChange={() => setItemToDelete(null)}
        onConfirm={() => {
          if (itemToDelete) handleDeleteMenuItem(itemToDelete);
          setItemToDelete(null);
        }}
        title="Excluir Item?"
        description="Esta ação não pode ser desfeita. Isso excluirá permanentemente o item do cardápio."
        confirmText="Excluir"
      />
    </div>
  );
}
import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
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
import { useMenuEditor, Category as HookCategory } from '@/hooks/useMenuEditor';

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

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Nome da categoria é obrigatório"),
});

export type MenuFormValues = z.infer<typeof menuSchema>;
export type CategoryFormValues = z.infer<typeof categorySchema>;
export type MenuItemFormValues = z.infer<typeof menuItemSchema>;

export default function MenuEditor() {
  const { menuId } = useParams<{ menuId: string }>();
  const { setHeader, clearHeader } = usePageHeader();
  const { toast } = useToast();

  const { 
    data, 
    isLoading, 
    isError, 
    error,
    saveMenu,
    saveCategoryOrder,
    saveCategory,
    deleteCategory,
    saveMenuItem,
    deleteMenuItem,
  } = useMenuEditor(menuId);

  const [isSaving, setIsSaving] = useState(false);
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

  useEffect(() => {
    if (data?.menu) {
      menuForm.reset(data.menu);
    }
  }, [data?.menu, menuForm]);

  const { bannerPreview, handleBannerChange, handleBannerRemove, uploadBanner, resetBannerState } = useMenuBannerUpload({
    initialBannerUrl: data?.menu?.banner_url || null,
    menuId: menuId || '',
    restaurantId: data?.menu?.restaurant_id || '',
    setSaveMessage: (msg) => toast({ title: msg.type === 'success' ? 'Sucesso!' : 'Erro', description: msg.text }),
  });
  
  const usedCategoryNames = React.useMemo(() => {
    return data?.categories.map(cat => cat.name.toLowerCase()) || [];
  }, [data?.categories]);

  const handleSaveAll = useCallback(async (values: MenuFormValues) => {
    if (!menuId) return;
    setIsSaving(true);
    
    try {
        const newBannerUrl = await uploadBanner();
        const updateData = { id: menuId, name: values.name, is_active: values.is_active, banner_url: newBannerUrl };
        await saveMenu(updateData);
        resetBannerState();
        toast({ title: 'Sucesso!', description: 'Cardápio salvo com sucesso!' });
    } catch (err) {
        console.error("Error saving menu:", err);
        toast({ variant: 'destructive', title: 'Erro', description: (err as Error).message || 'Falha ao salvar o cardápio.' });
    } finally {
        setIsSaving(false);
    }
  }, [menuId, saveMenu, uploadBanner, resetBannerState, toast]);

  const handleCategoriesReordered = useCallback(async (reorderedCategories: HookCategory[]) => {
    const payload = reorderedCategories.map((c, index) => ({ id: c.id, position: index }));
    try {
      await saveCategoryOrder(payload);
      toast({ title: 'Sucesso', description: 'Ordem das categorias salva.' });
    } catch (err) {
      toast({ variant: "destructive", title: 'Erro', description: 'Não foi possível salvar a ordem das categorias.' });
    }
  }, [saveCategoryOrder, toast]);

  const handleSaveCategoryConfirm = useCallback(async (category: Partial<CategoryFormValues>) => {
    if (!data?.menu) return;
    const isNew = !category.id;
    const payload = isNew ? { ...category, restaurant_id: data.menu.restaurant_id, position: data.categories.length } : { ...category };
    await saveCategory(payload);
    setIsAddCategoryModalOpen(false);
  }, [data, saveCategory]);

  const handleDeleteCategoryConfirm = useCallback(async () => {
    if (categoryToDelete) {
      await deleteCategory(categoryToDelete);
      setCategoryToDelete(null);
    }
  }, [categoryToDelete, deleteCategory]);

  const handleSaveMenuItemConfirm = useCallback(async (item: MenuItemFormValues) => {
    if (!menuId) return;
    const body = item.id ? item : { ...item, menu_id: menuId, category_id: selectedCategoryIdForMenuItem };
    await saveMenuItem(body);
    setIsAddMenuItemModalOpen(false);
    setIsEditMenuItemModalOpen(false);
  }, [menuId, selectedCategoryIdForMenuItem, saveMenuItem]);

  const handleDeleteMenuItemConfirm = useCallback(async () => {
    if (itemToDelete) {
      await deleteMenuItem(itemToDelete);
      setItemToDelete(null);
    }
  }, [itemToDelete, deleteMenuItem]);

  useEffect(() => {
    const saveAction = (
        <Button size="icon" onClick={() => menuForm.handleSubmit(handleSaveAll)()} disabled={isSaving}>
            {isSaving ? <Spinner size="small" /> : <Save className="h-4 w-4" />}
        </Button>
    );

    setHeader({
        title: `Editando: ${data?.menu?.name || 'Cardápio'}`,
        backButtonHref: "/dashboard/menus",
        headerActions: saveAction,
        fabAction: saveAction,
    });

    return () => clearHeader();
  }, [isSaving, data?.menu, menuForm, handleSaveAll, setHeader, clearHeader]);

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

  if (isLoading) return <div className="space-y-6 p-4"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-48 w-full" /><Skeleton className="h-32 w-full" /></div>;
  if (isError) return <div className="text-red-500 p-4">{error?.message}</div>;
  if (!data) return <div className="text-muted-foreground p-4">Cardápio não encontrado.</div>;

  return (
    <div className="space-y-6">
      <MenuDetailsCard
        menuForm={menuForm}
        bannerPreview={bannerPreview}
        onBannerChange={handleBannerChange}
        onBannerRemove={handleBannerRemove}
      />
      <CategoriesList
        categories={data.categories || []}
        onCategoriesReordered={handleCategoriesReordered}
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
        handleSaveCategory={handleSaveCategoryConfirm}
        PREDEFINED_CATEGORIES={PREDEFINED_CATEGORIES}
        usedCategoryNames={usedCategoryNames}
        menu={data.menu}
      />
      <AddMenuItemModal
        isOpen={isAddMenuItemModalOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) { setItemSuggestions([]); }
          setIsAddMenuItemModalOpen(isOpen);
        }}
        addMenuItemForm={addMenuItemForm}
        handleSaveMenuItem={handleSaveMenuItemConfirm}
        handleItemNameInputChange={handleItemNameInputChange}
        itemSuggestions={itemSuggestions}
        setItemSuggestions={setItemSuggestions}
        restaurantId={data.menu?.restaurant_id}
      />
      <EditMenuItemModal
        isOpen={isEditMenuItemModalOpen}
        onOpenChange={setIsEditMenuItemModalOpen}
        editMenuItemForm={editMenuItemForm}
        handleSaveMenuItem={handleSaveMenuItemConfirm}
        restaurantId={data.menu?.restaurant_id}
      />
      <ConfirmationDialog
        isOpen={!!categoryToDelete}
        onOpenChange={() => setCategoryToDelete(null)}
        onConfirm={handleDeleteCategoryConfirm}
        title="Excluir Categoria?"
        description="Esta ação não pode ser desfeita. Isso excluirá permanentemente a categoria e todos os itens dentro dela."
        confirmText="Excluir"
      />
      <ConfirmationDialog
        isOpen={!!itemToDelete}
        onOpenChange={() => setItemToDelete(null)}
        onConfirm={handleDeleteMenuItemConfirm}
        title="Excluir Item?"
        description="Esta ação não pode ser desfeita. Isso excluirá permanentemente o item do cardápio."
        confirmText="Excluir"
      />
    </div>
  );
}
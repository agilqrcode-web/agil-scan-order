import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/components/ui/use-toast";
import { usePageHeader } from '@/contexts/PageHeaderContext';
import { useMenuEditor } from '@/hooks/useMenuEditor'; // Importando o novo hook
import { useMenuBannerUpload } from '@/hooks/useMenuBannerUpload';

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Save } from "lucide-react";
import { Spinner } from '@/components/ui/spinner';
import { MenuDetailsCard } from '@/components/dashboard/menu-editor/MenuDetailsCard';
import { CategoriesList } from '@/components/dashboard/menu-editor/CategoriesList';
import { AddCategoryModal } from '@/components/dashboard/menu-editor/AddCategoryModal';
import { AddMenuItemModal } from '@/components/dashboard/menu-editor/AddMenuItemModal';
import { EditMenuItemModal } from '@/components/dashboard/menu-editor/EditMenuItemModal';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { PREDEFINED_MENU_ITEMS, PREDEFINED_CATEGORIES } from '@/lib/menu-constants';

// Schemas e Tipos (podem ser movidos para um arquivo de tipos)
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
});

export type MenuFormValues = z.infer<typeof menuSchema>;
export type MenuItemFormValues = z.infer<typeof menuItemSchema>;

export default function MenuEditor() {
  const { menuId } = useParams<{ menuId: string }>();
  const { toast } = useToast();
  const { setHeader, clearHeader } = usePageHeader();

  // Usando o novo hook para gerenciar todos os dados e mutações
  const { data, isLoading, isError, error, saveMenu, saveCategoryOrder, saveCategory, deleteCategory, saveMenuItem, deleteMenuItem } = useMenuEditor(menuId);

  // O estado das categorias agora é gerenciado localmente apenas para reordenação
  const [displayCategories, setDisplayCategories] = useState<any[]>([]);

  // Forms
  const menuForm = useForm<MenuFormValues>({ resolver: zodResolver(menuSchema) });
  const addMenuItemForm = useForm<MenuItemFormValues>({ resolver: zodResolver(menuItemSchema), defaultValues: { name: "", description: "", price: undefined, image_url: "" } });
  const editMenuItemForm = useForm<MenuItemFormValues>({ resolver: zodResolver(menuItemSchema) });

  // Efeito para resetar o formulário e o estado local quando os dados da query são carregados
  useEffect(() => {
    if (data?.menu) {
      menuForm.reset(data.menu);
    }
    // A fonte da verdade (data.categories) atualiza o estado de exibição
    if (data?.categories) {
      setDisplayCategories(data.categories);
    }
  }, [data, menuForm]);

  const { bannerPreview, handleBannerChange, handleBannerRemove, uploadBanner } = useMenuBannerUpload({
    initialBannerUrl: data?.menu?.banner_url || null,
    menuId: menuId || '',
    restaurantId: data?.restaurant?.id || '',
    setSaveMessage: (msg) => toast({ title: msg.type === 'success' ? 'Sucesso!' : 'Erro', description: msg.text }),
  });

  const usedCategoryNames = React.useMemo(() => (data?.categories || []).map(cat => cat.name.toLowerCase()), [data?.categories]);





  const handleSaveMenu = useCallback(async (values: MenuFormValues) => {
    if (!menuId || !data?.menu) return;
    setIsSaving(true);
    try {
      const newBannerUrl = await uploadBanner();
      await saveMenu({ id: menuId, name: values.name, is_active: values.is_active, banner_url: newBannerUrl });
      // Salva a ordem atual das categorias que estão na tela
      await saveCategoryOrderMutation.mutateAsync(displayCategories.map((cat, idx) => ({ id: cat.id, position: idx })));
      toast({ title: 'Sucesso!', description: 'Cardápio salvo com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['menusPageData', data.menu.restaurant_id] }); // Invalidate list view
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: (err as Error).message });
    } finally {
      setIsSaving(false);
    }
  }, [menuId, data, displayCategories, uploadBanner, saveMenu, saveCategoryOrderMutation, toast, queryClient]);

  useEffect(() => {
    const saveAction = <Button size="icon" onClick={menuForm.handleSubmit(handleSaveMenu)} disabled={isSaving}>{isSaving ? <Spinner size="small" /> : <Save className="h-4 w-4" />}</Button>;
    setHeader({ title: `Editando: ${data?.menu?.name || 'Cardápio'}`, backButtonHref: "/dashboard/menus", headerActions: saveAction, fabAction: saveAction });
    return () => clearHeader();
  }, [isSaving, data, menuForm, handleSaveMenu, setHeader, clearHeader]);

  // Handlers that now use mutations
  const handleSaveCategory = (category: Partial<CategoryFormValues>) => saveCategoryMutation.mutateAsync(category.id ? category : { ...category, restaurant_id: data?.menu.restaurant_id, position: displayCategories.length });
  const handleDeleteCategory = (categoryId: string) => deleteCategoryMutation.mutate(categoryId);
  const handleSaveMenuItem = (item: MenuItemFormValues) => saveMenuItemMutation.mutate(item.id ? item : { ...item, menu_id: menuId, category_id: selectedCategoryIdForMenuItem });
  const handleDeleteMenuItem = (itemId: string) => deleteMenuItemMutation.mutate(itemId);

  const handleCategoriesReordered = useCallback((reorderedCategories: any[]) => {
    setDisplayCategories(reorderedCategories);
  }, []);

  if (isLoading) return <div className="space-y-6 p-4"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-48 w-full" /><Skeleton className="h-32 w-full" /></div>;
  if (isError) return <div className="text-red-500 p-4">{error.message}</div>;
  if (!data || !data.menu || !data.restaurant) return <div className="text-muted-foreground p-4">Cardápio não encontrado ou dados incompletos.</div>;

  return (
    <div className="space-y-6">
      <MenuDetailsCard menuForm={menuForm} bannerPreview={bannerPreview} onBannerChange={handleBannerChange} onBannerRemove={handleBannerRemove} />
      
      <CategoriesList
        categories={orderedCategories} // Usa o estado local para permitir reordenação
        onCategoriesReordered={setOrderedCategories} // Atualiza o estado local ao reordenar
        handleDeleteCategory={(id) => setCategoryToDelete(id)}
        handleEditMenuItem={(item) => { setItemToEdit(item); editMenuItemForm.reset(item); setIsEditMenuItemModalOpen(true); }}
        handleDeleteMenuItem={(id) => setItemToDelete(id)}
        handleAddMenuItem={(categoryId) => { setSelectedCategoryIdForMenuItem(categoryId); addMenuItemForm.reset(); setIsAddMenuItemModalOpen(true); }}
        handleAddCategory={() => setIsAddCategoryModalOpen(true)}
      />

      <AddCategoryModal 
        isOpen={isAddCategoryModalOpen} 
        onOpenChange={setIsAddCategoryModalOpen} 
        handleSaveCategory={handleSaveCategory} 
        PREDEFINED_CATEGORIES={PREDEFINED_CATEGORIES} 
        usedCategoryNames={orderedCategories.map(c => c.name.toLowerCase())}
      />

      <AddMenuItemModal 
        isOpen={isAddMenuItemModalOpen} 
        onOpenChange={setIsAddMenuItemModalOpen} 
        addMenuItemForm={addMenuItemForm} 
        handleSaveMenuItem={handleSaveMenuItem} 
        restaurantId={data.restaurant.id}
      />

      {itemToEdit && (
        <EditMenuItemModal 
          isOpen={isEditMenuItemModalOpen} 
          onOpenChange={setIsEditMenuItemModalOpen} 
          editMenuItemForm={editMenuItemForm} 
          handleSaveMenuItem={handleUpdateMenuItem} 
          restaurantId={data.restaurant.id}
        />
      )}

      <ConfirmationDialog isOpen={!!categoryToDelete} onOpenChange={() => setCategoryToDelete(null)} onConfirm={() => { if (categoryToDelete) deleteCategory(categoryToDelete); setCategoryToDelete(null); }} title="Excluir Categoria?" description="Esta ação não pode ser desfeita. Isso excluirá permanentemente a categoria e todos os itens dentro dela." confirmText="Excluir" />
      <ConfirmationDialog isOpen={!!itemToDelete} onOpenChange={() => setItemToDelete(null)} onConfirm={() => { if (itemToDelete) deleteMenuItem(itemToDelete); setItemToDelete(null); }} title="Excluir Item?" description="Esta ação não pode ser desfeita. Isso excluirá permanentemente o item do cardápio." confirmText="Excluir" />
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSupabase } from '@/contexts/SupabaseContext';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { X, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PREDEFINED_MENU_ITEMS, PREDEFINED_CATEGORIES } from '@/lib/menu-constants';

// Import extracted components
import { MenuDetailsCard } from '@/components/dashboard/menu-editor/MenuDetailsCard';
import { CategoriesList } from '@/components/dashboard/menu-editor/CategoriesList';
import { AddCategoryModal } from '@/components/dashboard/menu-editor/AddCategoryModal';
import { AddMenuItemModal } from '@/components/dashboard/menu-editor/AddMenuItemModal';
import { EditMenuItemModal } from '@/components/dashboard/menu-editor/EditMenuItemModal';
import { DeleteConfirmationDialog } from '@/components/dashboard/menu-editor/DeleteConfirmationDialog';

// Define schemas for validation
const menuSchema = z.object({
  name: z.string().min(1, "Nome do cardápio é obrigatório."),
  is_active: z.boolean().default(true),
});

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Nome da categoria é obrigatório."),
  menu_id: z.string().optional(),
  position: z.number().optional(),
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
  const navigate = useNavigate();
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  // State management
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<any | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [isBannerMarkedForDeletion, setIsBannerMarkedForDeletion] = useState(false);

  // Modal states
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [isAddMenuItemModalOpen, setIsAddMenuItemModalOpen] = useState(false);
  const [isEditMenuItemModalOpen, setIsEditMenuItemModalOpen] = useState(false);

  // State for actions
  const [selectedCategoryIdForMenuItem, setSelectedCategoryIdForMenuItem] = useState<string | null>(null);
  const [itemSuggestions, setItemSuggestions] = useState<string[]>([]);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Form hooks
  const menuForm = useForm<MenuFormValues>({ resolver: zodResolver(menuSchema) });
  const addMenuItemForm = useForm<MenuItemFormValues>({ resolver: zodResolver(menuItemSchema), defaultValues: { name: "", description: "", price: undefined, image_url: "" } });
  const editMenuItemForm = useForm<MenuItemFormValues>({ resolver: zodResolver(menuItemSchema) });

  
  const usedCategoryNames = React.useMemo(() => {
    return categories.map(cat => cat.name.toLowerCase());
  }, [categories]);

  // Data fetching and handlers
  const fetchMenuData = async () => {
    if (!menuId || !supabase) { setLoading(false); return; }
    setLoading(true);
    try {
      const menuResponse = await fetch(`/api/menus?id=${menuId}`);
      if (!menuResponse.ok) throw new Error("Failed to fetch menu details.");
      const menuData = await menuResponse.json();
      setMenu(menuData);
      menuForm.reset(menuData);
      setBannerPreview(menuData.banner_url || null);

      const { data: categoriesData, error: categoriesError } = await supabase.from('categories').select('*').eq('restaurant_id', menuData.restaurant_id).order('position');
      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      const { data: menuItemsData, error: menuItemsError } = await supabase.from('menu_items').select('*').eq('menu_id', menuId);
      if (menuItemsError) throw menuItemsError;
      setMenuItems(menuItemsData || []);
    } catch (err: any) {
      console.error("Error fetching menu data:", err);
      setError(err.message || "Failed to load menu data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMenuData(); }, [menuId, supabase]);

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setSaveMessage({ text: 'Formato de arquivo inválido. Use PNG ou JPG.', type: 'error' });
      setTimeout(() => setSaveMessage(null), 5000);
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setSaveMessage({ text: 'O arquivo é muito grande. O tamanho máximo é 2MB.', type: 'error' });
      setTimeout(() => setSaveMessage(null), 5000);
      return;
    }

    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
    setIsBannerMarkedForDeletion(false);
  };

  const handleBannerRemove = () => {
    setBannerFile(null);
    setBannerPreview(null);
    setIsBannerMarkedForDeletion(true);
  };

  useEffect(() => {
    return () => {
      if (bannerPreview && bannerPreview.startsWith('blob:')) {
        URL.revokeObjectURL(bannerPreview);
      }
    };
  }, [bannerPreview]);

  const handleSaveCategoryOrder = async () => {
    try {
      const response = await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: categories.map(cat => ({ id: cat.id, position: cat.position })) }),
      });
      if (!response.ok) throw new Error("Failed to save category order.");
      console.log("Category order saved successfully!");
    } catch (err: any) {
      console.error("Error saving category order:", err);
      setError(err.message || "Failed to save category order.");
    }
  };

  const handleSaveMenu = async (values: MenuFormValues) => {
    if (!menuId || !menu || !supabase) return;
    setIsSaving(true);
    setSaveMessage(null);

    try {
      let newBannerUrl = menu.banner_url;

      if (isBannerMarkedForDeletion && menu.banner_url) {
        const oldBannerPath = menu.banner_url.substring(menu.banner_url.lastIndexOf('/') + 1);
        if (oldBannerPath) {
          await supabase.storage.from('menu-banners').remove([oldBannerPath]);
        }
        newBannerUrl = null;
      }

      if (bannerFile) {
        if (menu.banner_url && !isBannerMarkedForDeletion) {
          const oldBannerPath = menu.banner_url.substring(menu.banner_url.lastIndexOf('/') + 1);
          if (oldBannerPath) {
            await supabase.storage.from('menu-banners').remove([oldBannerPath]);
          }
        }

        const fileExt = bannerFile.name.split('.').pop();
        const filePath = `${menu.restaurant_id}/${menu.id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('menu-banners')
          .upload(filePath, bannerFile);

        if (uploadError) {
          throw new Error(`Falha no upload do banner: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage.from('menu-banners').getPublicUrl(filePath);
        newBannerUrl = publicUrlData.publicUrl;
      }

      const updateData = {
        id: menuId,
        name: values.name,
        is_active: values.is_active,
        banner_url: newBannerUrl,
      };

      const response = await fetch("/api/menus", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error((await response.json()).error || "Failed to update menu.");
      }

      await handleSaveCategoryOrder();

      await queryClient.invalidateQueries({ queryKey: ['menus', menu.restaurant_id] });
      setSaveMessage({ text: "Cardápio atualizado com sucesso!", type: "success" });

      setBannerFile(null);
      setIsBannerMarkedForDeletion(false);

    } catch (err: any) {
      console.error("Error saving menu:", err);
      setSaveMessage({ text: err.message || "Falha ao atualizar cardápio.", type: "error" });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  const handleSaveCategory = async (category: Partial<CategoryFormValues>) => {
    if (!menuId) return;
    try {
      const isNew = !category.id;
      const body = isNew ? { ...category, restaurant_id: menu.restaurant_id, position: categories.length } : { ...category };
      const response = await fetch("/api/categories", { method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error("Failed to save category.");
      if (isNew) {
        await fetchMenuData();
      }
    } catch (err: any) {
      console.error("Error saving category:", err);
      setError(err.message || "Failed to save category.");
    }
  };

  const handleMoveCategory = async (index: number, direction: 'up' | 'down') => {
    const newCategories = [...categories];
    const to = direction === 'up' ? index - 1 : index + 1;
    const from = index;
    const [movedCategory] = newCategories.splice(from, 1);
    newCategories.splice(to, 0, movedCategory);

    const updatedCategories = newCategories.map((cat, idx) => ({ ...cat, position: idx }));
    setCategories(updatedCategories);
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const response = await fetch("/api/categories", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: categoryId }) });
      if (!response.ok) throw new Error("Failed to delete category.");
      fetchMenuData();
    } catch (err: any) {
      console.error("Error deleting category:", err);
      setError(err.message || "Failed to delete category.");
    }
  };

  const handleSaveMenuItem = async (item: MenuItemFormValues) => {
    if (!menuId) return;
    try {
      const method = item.id ? "PUT" : "POST";
      const body = item.id ? item : { ...item, menu_id: menuId, category_id: selectedCategoryIdForMenuItem };
      const response = await fetch("/api/menu-items", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error("Failed to save menu item.");
      fetchMenuData();
    } catch (err: any) {
      console.error("Error saving menu item:", err);
      setError(err.message || "Failed to save menu item.");
    }
  };

  const handleDeleteMenuItem = async (itemId: string) => {
    try {
      const response = await fetch("/api/menu-items", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: itemId }) });
      if (!response.ok) throw new Error("Failed to delete menu item.");
      fetchMenuData();
    } catch (err: any) {
      console.error("Error deleting menu item:", err);
      setError(err.message || "Failed to delete menu item.");
    }
  };

  const handleItemNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    addMenuItemForm.setValue("name", value);
    if (value.length > 1) {
      const filteredSuggestions = PREDEFINED_MENU_ITEMS.filter(item => item.toLowerCase().includes(value.toLowerCase())).slice(0, 10);
      setItemSuggestions(filteredSuggestions);
    } else {
      setItemSuggestions([]);
    }
  };

  if (loading) return <div className="space-y-6 p-4"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-48 w-full" /><Skeleton className="h-32 w-full" /></div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;
  if (!menu) return <div className="text-muted-foreground p-4">Cardápio não encontrado.</div>;

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Editar Cardápio: {menu.name}</h1>
        <Button onClick={() => navigate(-1)} variant="outline"><X className="mr-2 h-4 w-4" />Voltar</Button>
      </div>

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

      {/* Modals and Dialogs */}
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
      />

      <EditMenuItemModal
        isOpen={isEditMenuItemModalOpen}
        onOpenChange={setIsEditMenuItemModalOpen}
        editMenuItemForm={editMenuItemForm}
        handleSaveMenuItem={handleSaveMenuItem}
      />

      <DeleteConfirmationDialog
        isOpen={!!categoryToDelete}
        onOpenChange={() => setCategoryToDelete(null)}
        onConfirm={() => {
          if (categoryToDelete) handleDeleteCategory(categoryToDelete);
        }}
        title="Você tem certeza?"
        description="Esta ação não pode ser desfeita. Isso excluirá permanentemente a categoria e todos os itens dentro dela."
      />

      <DeleteConfirmationDialog
        isOpen={!!itemToDelete}
        onOpenChange={() => setItemToDelete(null)}
        onConfirm={() => {
          if (itemToDelete) handleDeleteMenuItem(itemToDelete);
        }}
        title="Você tem certeza?"
        description="Esta ação não pode ser desfeita. Isso excluirá permanentemente o item do cardápio."
      />

      {/* NEW: Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-sm p-4 z-10">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
              {saveMessage && (
                <div className={`p-2 rounded-md text-sm font-semibold ${saveMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {saveMessage.text}
                </div>
              )}
              <Button 
                type="button" 
                onClick={() => menuForm.handleSubmit(handleSaveMenu)()} 
                disabled={isSaving}
              >
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Salvando..." : "Salvar Cardápio"}
              </Button>
          </div>
      </div>
    </div>
  );
}
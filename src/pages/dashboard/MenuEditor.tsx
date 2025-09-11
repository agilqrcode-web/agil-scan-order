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

// ... (schemas remain the same)

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

  // ... (modal and other states remain the same)

  // Form hooks
  const menuForm = useForm<MenuFormValues>({ resolver: zodResolver(menuSchema) });
  // ... (other form hooks remain the same)

  // ... (PREDEFINED_MENU_ITEMS and PREDEFINED_CATEGORIES remain the same)

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
    // ... (implementation remains the same)
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

  // ... (other handlers remain the same)

  if (loading) return <div className="space-y-6 p-4"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-48 w-full" /><Skeleton className="h-32 w-full" /></div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;
  if (!menu) return <div className="text-muted-foreground p-4">Cardápio não encontrado.</div>;

  return (
    // Add padding-bottom to account for the fixed bar
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

      {saveMessage && (
        <div className={`p-3 rounded-md text-center font-semibold ${saveMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {saveMessage.text}
        </div>
      )}

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

      {/* Modals and Dialogs (remain the same) */}

      {/* NEW: Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-sm p-4">
          <div className="max-w-4xl mx-auto flex justify-end">
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

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSupabase } from '@/contexts/SupabaseContext';

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { X } from "lucide-react";
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
  

  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<any | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
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

  const PREDEFINED_MENU_ITEMS = [
    "Bruschetta", "Carpaccio", "Batata frita", "Polenta frita", "Isca de peixe", "Anéis de cebola", "Coxinha", "Bolinho de bacalhau", "Pastéis sortidos", "Tábua de frios",
    "Sopa de legumes", "Caldo verde", "Canja de galinha", "Creme de abóbora", "Sopa de cebola gratinada", "Caldo de feijão",
    "Salada Caesar", "Salada Caprese", "Salada grega", "Salada tropical (frutas + verdes)", "Salada de grão-de-bico", "Salada de frango",
    "Bife à parmegiana", "Filé mignon grelhado", "Picanha na chapa", "Costela assada", "Frango grelhado", "Strogonoff de carne", "Feijoada", "Churrasco misto",
    "Espaguete à bolonhesa", "Lasanha à bolonhesa", "Nhoque ao sugo", "Ravioli de queijo", "Fettuccine Alfredo", "Penne quatro queijos",
    "Bacalhau à portuguesa", "Filé de salmão grelhado", "Moqueca de peixe", "Camarão na moranga", "Risoto de frutos do mar", "Lula à dorê",
    "Frango à passarinho", "Galeto assado", "Peito de frango grelhado", "Frango xadrez", "Frango à milanesa",
    "Hambúrguer clássico", "Cheeseburger", "X-bacon", "Hambúrguer vegano", "Sanduíche natural de frango", "Bauru",
    "Mussarela", "Calabresa", "Margherita", "Portuguesa", "Quatro queijos", "Frango com catupiry", "Pepperoni", "Vegetariana",
    "Hambúrguer de grão-de-bico", "Strogonoff de cogumelos", "Risoto de legumes", "Tofu grelhado", "Espaguete de abobrinha",
    "Arroz branco", "Arroz à grega", "Feijão carioca", "Purê de batata", "Legumes grelhados", "Farofa", "Vinagrete",
    "Pudim de leite", "Mousse de chocolate", "Torta de limão", "Petit gâteau", "Brownie", "Cheesecake", "Sorvete", "Frutas da estação",
    "Refrigerante (lata)", "Água mineral (com e sem gás)", "Suco natural de laranja", "Suco de maracujá", "Suco de uva integral", "Vitamina de frutas",
    "Café expresso", "Café coado", "Cappuccino", "Latte", "Chá de camomila", "Chá mate",
    "Caipirinha (limão, morango, maracujá)", "Mojito", "Piña colada", "Aperol Spritz", "Gin tônica",
    "Cerveja pilsen (long neck)", "Cerveja artesanal IPA", "Cerveja de trigo", "Chopp claro", "Chopp escuro",
    "Vinho tinto seco (taça)", "Vinho branco seco (taça)", "Vinho rosé", "Espumante brut"
  ];
  const PREDEFINED_CATEGORIES = [
    "Entradas / Aperitivos",
    "Sopas & Caldos",
    "Saladas",
    "Pratos Principais",
    "Massas",
    "Carnes",
    "Peixes & Frutos do Mar",
    "Aves",
    "Sanduíches & Hambúrgueres",
    "Pizzas",
    "Comida Vegetariana / Vegana",
    "Guarnições / Acompanhamentos",
    "Sobremesas",
    "Bebidas Não Alcoólicas",
    "Sucos & Vitaminas",
    "Cafés & Chás",
    "Drinks & Coquetéis",
    "Cervejas",
    "Vinhos",
    "Executivo / Combo do Dia",
    "Infantil",
    "Fit / Saudável",
    "Promoções / Ofertas Especiais",
  ];
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
    if (!menuId) return;
    try {
      const response = await fetch("/api/menus", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: menuId, ...values }) });
      if (!response.ok) throw new Error((await response.json()).error || "Failed to update menu.");

      // Call the new function to save category order
      await handleSaveCategoryOrder();

      setSaveMessage({ text: "Cardápio atualizado com sucesso!", type: "success" });

    } catch (err: any) {
      console.error("Error saving menu:", err);
      setError(err.message || "Falha ao salvar cardápio.");
      setSaveMessage({ text: err.message || "Falha ao atualizar cardápio.", type: "error" });
    } finally {
      setTimeout(() => setSaveMessage(null), 5000); // Clear message after 5 seconds
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Editar Cardápio: {menu.name}</h1>
        <Button onClick={() => navigate(-1)} variant="outline"><X className="mr-2 h-4 w-4" />Voltar</Button>
      </div>

      <MenuDetailsCard menuForm={menuForm} handleSaveMenu={handleSaveMenu} />

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
    </div>
  );
}

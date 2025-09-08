import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSupabase } from '@/contexts/SupabaseContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Save, X, ChevronDown, ChevronUp, Trash2, Edit } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Define schemas for validation
const menuSchema = z.object({
  name: z.string().min(1, "Nome do cardápio é obrigatório."),
  is_active: z.boolean().default(true),
});

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Nome da categoria é obrigatório."),
  menu_id: z.string().optional(),
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

type MenuFormValues = z.infer<typeof menuSchema>;
type CategoryFormValues = z.infer<typeof categorySchema>;
type MenuItemFormValues = z.infer<typeof menuItemSchema>;

export default function MenuEditor() {
  const { menuId } = useParams();
  const navigate = useNavigate();
  const supabase = useSupabase();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<any | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryError, setNewCategoryError] = useState<string | null>(null);
  const [isAddMenuItemModalOpen, setIsAddMenuItemModalOpen] = useState(false);
  const [selectedCategoryIdForMenuItem, setSelectedCategoryIdForMenuItem] = useState<string | null>(null);
  const [itemSuggestions, setItemSuggestions] = useState<string[]>([]);

  const usedCategoryNames = React.useMemo(() => {
    return categories.map(cat => cat.name.toLowerCase());
  }, [categories]);

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

  const menuForm = useForm<MenuFormValues>({
    resolver: zodResolver(menuSchema),
  });

  const menuItemForm = useForm<MenuItemFormValues>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      image_url: "",
    }
  });

  const fetchMenuData = async () => {
    if (!menuId || !supabase) {
      setLoading(false);
      return;
    }
    try {
      // Fetch menu details
      const menuResponse = await fetch(`/api/menus?id=${menuId}`);
      if (!menuResponse.ok) {
        throw new Error("Failed to fetch menu details.");
      }
      const menuData = await menuResponse.json();
      setMenu(menuData);
      menuForm.reset(menuData); // Populate form with fetched data

      // Fetch categories for this menu
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', menuData.restaurant_id);
      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Fetch menu items for this menu
      const { data: menuItemsData, error: menuItemsError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('menu_id', menuId);
      if (menuItemsError) throw menuItemsError;
      setMenuItems(menuItemsData || []);

    } catch (err: any) {
      console.error("Error fetching menu data:", err);
      setError(err.message || "Failed to load menu data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuData();
  }, [menuId, supabase]);

  const handleSaveMenu = async (values: MenuFormValues) => {
    if (!menuId) return;
    try {
      const response = await fetch("/api/menus", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: menuId, ...values }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update menu.");
      }
      // Optionally show a toast notification
    } catch (err: any) {
      console.error("Error saving menu:", err);
      setError(err.message || "Failed to save menu.");
    }
  };

  const handleAddCategory = () => {
    setIsAddCategoryModalOpen(true);
  };

  const handleSaveCategory = async (category: CategoryFormValues) => {
    if (!menuId) return;
    try {
      const method = category.id ? "PUT" : "POST";
      const url = "/api/categories";
      const body = category.id ? { ...category, id: category.id } : { ...category, restaurant_id: menu.restaurant_id };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save category.");
      }
      fetchMenuData(); // Refresh data after save
    } catch (err: any) {
      console.error("Error saving category:", err);
      setError(err.message || "Failed to save category.");
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const response = await fetch("/api/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: categoryId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete category.");
      }
      fetchMenuData(); // Refresh data after delete
    } catch (err: any) {
      console.error("Error deleting category:", err);
      setError(err.message || "Failed to delete category.");
    }
  };

  const handleAddMenuItem = (categoryId: string) => {
    setSelectedCategoryIdForMenuItem(categoryId);
    setIsAddMenuItemModalOpen(true);
  };

  const handleEditMenuItem = (item: any) => {
    // TODO: Implement edit functionality
    console.log("Edit item:", item);
  };

  const handleSaveMenuItem = async (item: MenuItemFormValues) => {
    if (!menuId) return;
    try {
      const method = item.id ? "PUT" : "POST";
      const url = "/api/menu-items";
      const body = item.id ? { ...item, id: item.id } : { ...item, menu_id: menuId };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save menu item.");
      }
      fetchMenuData(); // Refresh data after save
    } catch (err: any) {
      console.error("Error saving menu item:", err);
      setError(err.message || "Failed to save menu item.");
    }
  };

  const handleDeleteMenuItem = async (itemId: string) => {
    try {
      const response = await fetch("/api/menu-items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete menu item.");
      }
      fetchMenuData(); // Refresh data after delete
    } catch (err: any) {
      console.error("Error deleting menu item:", err);
      setError(err.message || "Failed to delete menu item.");
    }
  };

  const handleItemNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    menuItemForm.setValue("name", value); // Update react-hook-form value
    if (value.length > 1) {
      const filteredSuggestions = PREDEFINED_MENU_ITEMS.filter(item =>
        item.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 10);
      setItemSuggestions(filteredSuggestions);
    } else {
      setItemSuggestions([]);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-4">Erro: {error}</div>;
  }

  if (!menu) {
    return <div className="text-muted-foreground p-4">Cardápio não encontrado.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Editar Cardápio: {menu.name}</h1>
        <Button onClick={() => navigate(-1)} variant="outline">
          <X className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalhes do Cardápio</CardTitle>
          <CardDescription>Edite o nome e status do seu cardápio.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={menuForm.handleSubmit(handleSaveMenu)} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="menuName">Nome do Cardápio</Label>
              <Input id="menuName" {...menuForm.register("name")} />
              {menuForm.formState.errors.name && (
                <p className="text-red-500 text-sm">{menuForm.formState.errors.name.message}</p>
              )}
            </div>
            <Button type="submit">
              <Save className="mr-2 h-4 w-4" />
              Salvar Cardápio
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Categorias</CardTitle>
          <Button onClick={handleAddCategory}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Categoria
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {categories.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma categoria encontrada. Adicione uma para começar.</p>
          ) : (
            categories.map((category) => (
              <Card key={category.id} className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{category.name}</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteCategory(category.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <h4 className="text-md font-medium">Itens da Categoria</h4>
                  {menuItems.filter(item => item.category_id === category.id).length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum item nesta categoria.</p>
                  ) : (
                    menuItems.filter(item => item.category_id === category.id).map(item => (
                      <div key={item.id} className="flex items-center justify-between border p-2 rounded-md">
                        <span>{item.name} - R$ {Number(item.price).toFixed(2)}</span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEditMenuItem(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteMenuItem(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                  <Button size="sm" onClick={() => handleAddMenuItem(category.id)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Item
                  </Button>
                </div>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddCategoryModalOpen} onOpenChange={setIsAddCategoryModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Adicionar Categoria</DialogTitle>
            <DialogDescription>
              Escolha uma categoria comum ou crie uma nova.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label className="text-lg">Categorias Comuns:</Label>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto border p-2 rounded-md">
              {PREDEFINED_CATEGORIES.filter(cat => !usedCategoryNames.includes(cat.toLowerCase())).map((cat) => (
                <Button
                  key={cat}
                  variant="outline"
                  onClick={() => {
                    handleSaveCategory({ name: cat, restaurant_id: menu.restaurant_id });
                    setIsAddCategoryModalOpen(false);
                  }}
                >
                  {cat}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="newCategory" className="shrink-0">Nova Categoria:</Label>
              <Input
                id="newCategory"
                value={newCategoryName}
                onChange={(e) => {
                  setNewCategoryName(e.target.value);
                  setNewCategoryError(null);
                }}
                placeholder="Ex: Culinária Japonesa"
              />
              <Button
                onClick={() => {
                  const trimmedName = newCategoryName.trim();
                  if (!trimmedName) {
                    setNewCategoryError("O nome da categoria não pode ser vazio.");
                    return;
                  }
                  if (usedCategoryNames.includes(trimmedName.toLowerCase())) {
                    setNewCategoryError("Esta categoria já existe.");
                    return;
                  }
                  handleSaveCategory({ name: trimmedName, restaurant_id: menu.restaurant_id });
                  setNewCategoryName("");
                  setNewCategoryError(null);
                  setIsAddCategoryModalOpen(false);
                }}
                disabled={!newCategoryName.trim()}
              >
                Criar
              </Button>
            </div>
             {newCategoryError && (
                <p className="text-red-500 text-sm col-span-2">{newCategoryError}</p>
              )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddCategoryModalOpen(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddMenuItemModalOpen} onOpenChange={(isOpen) => {
        setIsAddMenuItemModalOpen(isOpen);
        if (!isOpen) {
          menuItemForm.reset();
          setItemSuggestions([]);
        }
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Adicionar Item à Categoria</DialogTitle>
            <DialogDescription>
              Use uma sugestão para preencher rapidamente ou crie um item do zero.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={menuItemForm.handleSubmit(async (values) => {
            if (!selectedCategoryIdForMenuItem || !menuId) return;
            await handleSaveMenuItem({
              ...values,
              menu_id: menuId,
              category_id: selectedCategoryIdForMenuItem,
            });
            setIsAddMenuItemModalOpen(false);
            menuItemForm.reset();
            setItemSuggestions([]);
          })}>
            <Tabs defaultValue="sugerido" className="w-full pt-4" onValueChange={() => {
              menuItemForm.reset();
              setItemSuggestions([]);
            }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sugerido">Item Sugerido</TabsTrigger>
                <TabsTrigger value="personalizado">Item Personalizado</TabsTrigger>
              </TabsList>
              <TabsContent value="sugerido" className="py-4 space-y-4">
                <div className="grid grid-cols-4 items-start gap-4 relative">
                  <Label htmlFor="itemNameSuggested" className="text-right pt-2">
                    Nome
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="itemNameSuggested"
                      {...menuItemForm.register("name")}
                      className="w-full"
                      placeholder="Digite para buscar uma sugestão..."
                      onChange={handleItemNameInputChange}
                      value={menuItemForm.watch("name") || ""}
                      autoComplete="off"
                    />
                    {itemSuggestions.length > 0 && (
                      <div className="absolute z-10 top-full mt-1 w-full max-h-40 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                        {itemSuggestions.map((suggestion) => (
                          <div
                            key={suggestion}
                            className="cursor-pointer p-2 hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                              menuItemForm.setValue("name", suggestion);
                              setItemSuggestions([]);
                            }}
                          >
                            {suggestion}
                          </div>
                        ))}
                      </div>
                    )}
                    {menuItemForm.formState.errors.name && (
                      <p className="text-sm text-red-500 mt-1">
                        {menuItemForm.formState.errors.name.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="itemDescriptionSuggested" className="text-right">
                    Descrição
                  </Label>
                  <Input
                    id="itemDescriptionSuggested"
                    {...menuItemForm.register("description")}
                    className="col-span-3"
                    placeholder="(Opcional)"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="itemPriceSuggested" className="text-right">
                    Preço
                  </Label>
                  <Input
                    id="itemPriceSuggested"
                    type="number"
                    step="0.01"
                    {...menuItemForm.register("price")}
                    className="col-span-3"
                    placeholder="Ex: 35.90"
                  />
                  {menuItemForm.formState.errors.price && (
                    <p className="col-span-4 text-right text-sm text-red-500">
                      {menuItemForm.formState.errors.price.message}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="itemImageUrlSuggested" className="text-right">
                    URL da Imagem
                  </Label>
                  <Input
                    id="itemImageUrlSuggested"
                    {...menuItemForm.register("image_url")}
                    className="col-span-3"
                    placeholder="(Opcional)"
                  />
                </div>
              </TabsContent>
              <TabsContent value="personalizado" className="py-4 space-y-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="itemNameCustom" className="text-right">
                    Nome
                  </Label>
                  <Input
                    id="itemNameCustom"
                    {...menuItemForm.register("name")}
                    className="col-span-3"
                    placeholder="Ex: Prato da Casa"
                    autoComplete="off"
                  />
                   {menuItemForm.formState.errors.name && (
                    <p className="col-span-4 text-right text-sm text-red-500">
                      {menuItemForm.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="itemDescriptionCustom" className="text-right">
                    Descrição
                  </Label>
                  <Input
                    id="itemDescriptionCustom"
                    {...menuItemForm.register("description")}
                    className="col-span-3"
                    placeholder="Ex: Ingredientes especiais..."
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="itemPriceCustom" className="text-right">
                    Preço
                  </Label>
                  <Input
                    id="itemPriceCustom"
                    type="number"
                    step="0.01"
                    {...menuItemForm.register("price")}
                    className="col-span-3"
                    placeholder="Ex: 42.00"
                  />
                   {menuItemForm.formState.errors.price && (
                    <p className="col-span-4 text-right text-sm text-red-500">
                      {menuItemForm.formState.errors.price.message}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="itemImageUrlCustom" className="text-right">
                    URL da Imagem
                  </Label>
                  <Input
                    id="itemImageUrlCustom"
                    {...menuItemForm.register("image_url")}
                    className="col-span-3"
                    placeholder="(Opcional)"
                  />
                </div>
              </TabsContent>
            </Tabs>
            <DialogFooter>
              <Button type="submit">Adicionar Item</Button>
              <Button variant="outline" type="button" onClick={() => setIsAddMenuItemModalOpen(false)}>
                Cancelar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

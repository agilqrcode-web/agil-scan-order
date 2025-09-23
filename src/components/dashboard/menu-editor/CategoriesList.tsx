import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { MenuItemsList } from "./MenuItemsList";
import React, { useState, useEffect } from 'react';

interface CategoriesListProps {
  categories: any[]; // Agora é a prop inicial
  handleDeleteCategory: (id: string) => void;
  handleEditMenuItem: (item: any) => void;
  handleDeleteMenuItem: (id: string) => void;
  handleAddMenuItem: (categoryId: string) => void;
  handleAddCategory: () => void;
  onCategoriesReordered: (categories: any[]) => void; // Nova prop para notificar o pai
}

export function CategoriesList({
  categories: initialCategories, // Renomeado para evitar conflito com o estado
  handleDeleteCategory,
  handleEditMenuItem,
  handleDeleteMenuItem,
  handleAddMenuItem,
  handleAddCategory,
  onCategoriesReordered, // Nova prop
}: CategoriesListProps) {
  const [categories, setCategories] = useState(initialCategories);

  // Atualiza o estado interno quando a prop initialCategories muda
  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  // Handler interno para mover categorias (opera no estado local)
  const handleMoveCategoryInternal = (index: number, direction: 'up' | 'down') => {
    const newCategories = [...categories];
    const to = direction === 'up' ? index - 1 : index + 1;
    if (to < 0 || to >= newCategories.length) return;
    const from = index;
    const [movedCategory] = newCategories.splice(from, 1);
    newCategories.splice(to, 0, movedCategory);
    const updatedCategories = newCategories.map((cat, idx) => ({ ...cat, position: idx }));
    setCategories(updatedCategories);
    onCategoriesReordered(updatedCategories); // Notifica o pai sobre a nova ordem
  };



  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Categorias</CardTitle>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleAddCategory}>
                <Plus className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Adicionar Categoria</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Adicionar Categoria</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="space-y-4">
        {categories.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma categoria encontrada. Adicione uma para começar.</p>
        ) : (
          categories.map((category, index) => (
            <Card key={category.id} className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{category.name}</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleMoveCategoryInternal(index, 'up')} disabled={index === 0}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleMoveCategoryInternal(index, 'down')} disabled={index === categories.length - 1}>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteCategory(category.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <h4 className="text-md font-medium">Itens da Categoria</h4>
                <MenuItemsList
                  items={category.items || []} // Usa os itens aninhados diretamente
                  onEditItem={handleEditMenuItem}
                  onDeleteItem={handleDeleteMenuItem}
                />
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
  );
}

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { MenuItemsList } from "./MenuItemsList";
import React from 'react';

// A interface agora espera uma função para mover, em vez de notificar sobre a reordenação
interface CategoriesListProps {
  categories: any[];
  handleDeleteCategory: (id: string) => void;
  handleEditMenuItem: (item: any) => void;
  handleDeleteMenuItem: (id: string) => void;
  handleAddMenuItem: (categoryId: string) => void;
  handleAddCategory: () => void;
  handleMoveCategory: (index: number, direction: 'up' | 'down') => void; // Prop atualizada
}

export function CategoriesList({
  categories,
  handleDeleteCategory,
  handleEditMenuItem,
  handleDeleteMenuItem,
  handleAddMenuItem,
  handleAddCategory,
  handleMoveCategory, // Recebe a função de mover diretamente
}: CategoriesListProps) {
  // O estado interno e o useEffect foram removidos.
  // O componente agora é "burro" e apenas renderiza as props que recebe.

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
                  {/* Os botões agora chamam a função do pai diretamente */}
                  <Button variant="outline" size="sm" onClick={() => handleMoveCategory(index, 'up')} disabled={index === 0}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleMoveCategory(index, 'down')} disabled={index === categories.length - 1}>
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

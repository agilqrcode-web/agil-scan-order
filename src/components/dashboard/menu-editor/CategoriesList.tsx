import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { MenuItemsList } from "./MenuItemsList";

interface CategoriesListProps {
  categories: any[];
  menuItems: any[];
  handleMoveCategory: (index: number, direction: 'up' | 'down') => void;
  handleDeleteCategory: (id: string) => void;
  handleEditMenuItem: (item: any) => void;
  handleDeleteMenuItem: (id: string) => void;
  handleAddMenuItem: (categoryId: string) => void;
  handleAddCategory: () => void;
}

export function CategoriesList({
  categories,
  menuItems,
  handleMoveCategory,
  handleDeleteCategory,
  handleEditMenuItem,
  handleDeleteMenuItem,
  handleAddMenuItem,
  handleAddCategory,
}: CategoriesListProps) {
  return (
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
          categories.map((category, index) => (
            <Card key={category.id} className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{category.name}</h3>
                <div className="flex gap-2">
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
                  items={menuItems.filter(item => item.category_id === category.id)}
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
}category.id)}>
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
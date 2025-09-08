import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface AddCategoryModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  handleSaveCategory: (category: { name: string; restaurant_id?: string; }) => void;
  PREDEFINED_CATEGORIES: string[];
  usedCategoryNames: string[];
  menu: { restaurant_id: string; };
}

export function AddCategoryModal({
  isOpen,
  onOpenChange,
  handleSaveCategory,
  PREDEFINED_CATEGORIES,
  usedCategoryNames,
  menu,
}: AddCategoryModalProps) {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryError, setNewCategoryError] = useState<string | null>(null);

  const onSave = () => {
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
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
                  onOpenChange(false);
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
            <Button onClick={onSave} disabled={!newCategoryName.trim()}>
              Criar
            </Button>
          </div>
          {newCategoryError && (
            <p className="text-red-500 text-sm col-span-2">{newCategoryError}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

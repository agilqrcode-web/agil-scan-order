import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm, UseFormReturn } from "react-hook-form";
import * as z from "zod";

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

type MenuItemFormValues = z.infer<typeof menuItemSchema>;

interface EditMenuItemModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  editMenuItemForm: UseFormReturn<MenuItemFormValues>;
  handleSaveMenuItem: (values: MenuItemFormValues) => Promise<void>;
}

export function EditMenuItemModal({
  isOpen,
  onOpenChange,
  editMenuItemForm,
  handleSaveMenuItem,
}: EditMenuItemModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Editar Item do Cardápio</DialogTitle>
          <DialogDescription>
            Altere os detalhes do item selecionado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={editMenuItemForm.handleSubmit(async (values) => {
          await handleSaveMenuItem(values);
          onOpenChange(false);
        })} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="itemNameEdit" className="text-right">Nome</Label>
            <Input id="itemNameEdit" {...editMenuItemForm.register("name")} className="col-span-3" />
            {editMenuItemForm.formState.errors.name && (
              <p className="col-span-4 text-right text-sm text-red-500">{editMenuItemForm.formState.errors.name.message}</p>
            )}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="itemDescriptionEdit" className="text-right">Descrição</Label>
            <Input id="itemDescriptionEdit" {...editMenuItemForm.register("description")} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="itemPriceEdit" className="text-right">Preço</Label>
            <Input id="itemPriceEdit" type="number" step="0.01" {...editMenuItemForm.register("price")} className="col-span-3" />
            {editMenuItemForm.formState.errors.price && (
              <p className="col-span-4 text-right text-sm text-red-500">{editMenuItemForm.formState.errors.price.message}</p>
            )}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="itemImageUrlEdit" className="text-right">URL da Imagem</Label>
            <Input id="itemImageUrlEdit" {...editMenuItemForm.register("image_url")} className="col-span-3" />
          </div>
          <DialogFooter>
            <Button type="submit">Salvar Alterações</Button>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancelar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

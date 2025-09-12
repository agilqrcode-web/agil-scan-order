import { useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm, UseFormReturn } from "react-hook-form";
import * as z from "zod";
import { useItemImageUpload } from '@/hooks/useItemImageUpload';
import { Image, Trash2, Upload } from 'lucide-react';

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

// Reusable component for the image upload UI
const ImageUploader = ({ imagePreview, handleImageChange, handleImageRemove }) => (
  <div className="grid grid-cols-4 items-start gap-4">
    <Label className="text-right pt-2">Imagem</Label>
    <div className="col-span-3 flex items-center gap-4">
      <div className="w-24 h-24 rounded-md border border-dashed flex items-center justify-center bg-muted/40">
        {imagePreview ? (
          <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-md" />
        ) : (
          <Image className="w-8 h-8 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Input id="itemImageUploadEdit" type="file" accept="image/png, image/jpeg, image/webp" onChange={handleImageChange} className="hidden" />
        <Label htmlFor="itemImageUploadEdit" className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
          <Upload className="mr-2 h-4 w-4" /> Enviar Imagem
        </Label>
        {imagePreview && (
          <Button variant="outline" size="sm" onClick={handleImageRemove} className="text-red-500 hover:text-red-600 border-red-200 hover:border-red-300">
            <Trash2 className="mr-2 h-4 w-4" /> Remover
          </Button>
        )}
      </div>
    </div>
  </div>
);

interface EditMenuItemModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  editMenuItemForm: UseFormReturn<MenuItemFormValues>;
  handleSaveMenuItem: (values: MenuItemFormValues) => Promise<void>;
  restaurantId: string;
  setSaveMessage: (message: { text: string; type: 'success' | 'error' } | null) => void;
}

export function EditMenuItemModal({
  isOpen,
  onOpenChange,
  editMenuItemForm,
  handleSaveMenuItem,
  restaurantId,
  setSaveMessage,
}: EditMenuItemModalProps) {

  const initialImageUrl = editMenuItemForm.getValues('image_url') || null;

  const { 
    imagePreview, 
    handleImageChange, 
    handleImageRemove, 
    uploadImage, 
    resetImageState 
  } = useItemImageUpload({
    initialImageUrl,
    restaurantId: restaurantId || '',
    setSaveMessage,
  });

  useEffect(() => {
    if (isOpen) {
      // When modal opens, reset the image upload state to match the current item
      resetImageState();
    }
  }, [isOpen, resetImageState]);

  const handleSaveWithImage = async (values: MenuItemFormValues) => {
    try {
      const newImageUrl = await uploadImage(initialImageUrl);
      const finalValues = { ...values, image_url: newImageUrl || '' };
      await handleSaveMenuItem(finalValues);
      onOpenChange(false); // Close modal on success
    } catch (error) {
      console.error("Failed to save item with image:", error);
      setSaveMessage({ text: 'Falha ao salvar item. Verifique o console para mais detalhes.', type: 'error' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Editar Item do Cardápio</DialogTitle>
          <DialogDescription>
            Altere os detalhes do item selecionado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={editMenuItemForm.handleSubmit(handleSaveWithImage)} className="grid gap-4 py-4">
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
          
          <ImageUploader imagePreview={imagePreview} handleImageChange={handleImageChange} handleImageRemove={handleImageRemove} />

          <DialogFooter>
            <Button type="submit">Salvar Alterações</Button>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancelar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

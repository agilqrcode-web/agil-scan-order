import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm, UseFormReturn } from "react-hook-form";
import * as z from "zod";
import { useSupabase } from '@/contexts/SupabaseContext';
import { Spinner } from '@/components/ui/spinner';
import { Trash2 } from 'lucide-react';

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
  restaurantId: string | undefined;
}

export function EditMenuItemModal({
  isOpen,
  onOpenChange,
  editMenuItemForm,
  handleSaveMenuItem,
  restaurantId,
}: EditMenuItemModalProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = useSupabase();

  const watchedImageUrl = editMenuItemForm.watch("image_url");

  useEffect(() => {
    if (isOpen) {
      // When the modal opens, sync the preview with the form's current image URL
      setImagePreview(watchedImageUrl || null);
      // Reset file input state
      setImageFile(null);
    } else {
      // Reset everything when modal closes
      resetImageState(true); // Pass true to not clear the form value immediately
    }
  }, [isOpen, watchedImageUrl]);

  const resetImageState = (keepFormValue = false) => {
    setImageFile(null);
    setImagePreview(null);
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (!keepFormValue) {
        editMenuItemForm.setValue("image_url", "");
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    // The handleSave logic will see the preview is null and handle deletion/URL update
  };

  const handleSave = async (values: MenuItemFormValues) => {
    if (!supabase || !restaurantId) return;

    setIsUploading(true);
    let imageUrl = values.image_url || "";
    const originalImageUrl = editMenuItemForm.getValues("image_url");

    try {
        // Case 1: New image was selected
        if (imageFile) {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `${restaurantId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('menu-item-images')
                .upload(filePath, imageFile);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('menu-item-images').getPublicUrl(filePath);
            imageUrl = data.publicUrl;

            // If there was an old image, delete it from storage
            if (originalImageUrl) {
                const oldFileName = originalImageUrl.split('/').pop();
                if (oldFileName) {
                    await supabase.storage.from('menu-item-images').remove([`${restaurantId}/${oldFileName}`]);
                }
            }
        } 
        // Case 2: Existing image was removed (no new file, but preview is gone)
        else if (originalImageUrl && !imagePreview) {
            const bucketName = 'menu-item-images';
            const oldImagePath = originalImageUrl.substring(originalImageUrl.indexOf(bucketName) + bucketName.length + 1);
            await supabase.storage.from(bucketName).remove([oldImagePath]);
            imageUrl = "";
        }

        await handleSaveMenuItem({ ...values, image_url: imageUrl });

    } catch (error) {
        console.error("Error during image handling or saving:", error);
        // Optionally show a toast
    } finally {
        setIsUploading(false);
        onOpenChange(false);
    }
  };

  const ImageUploader = () => (
    <div className="grid grid-cols-4 items-center gap-4">
      <Label htmlFor="item-image-edit" className="text-right">Imagem</Label>
      <div className="col-span-3">
        <input
          type="file"
          accept="image/png, image/jpeg, image/webp"
          ref={fileInputRef}
          onChange={handleImageFileChange}
          className="hidden"
          id="item-image-edit"
        />
        {!imagePreview && (
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            Adicionar Imagem
          </Button>
        )}
        {imagePreview && (
          <div className="relative w-32 h-32">
            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-md border" />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6"
              onClick={handleRemoveImage}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Editar Item do Cardápio</DialogTitle>
          <DialogDescription>
            Altere os detalhes do item selecionado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={editMenuItemForm.handleSubmit(handleSave)} className="grid gap-4 py-4">
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
          
          <ImageUploader />

          <DialogFooter>
            {isUploading ? (
                <Button disabled>
                    <Spinner className="mr-2 h-4 w-4" />
                    Salvando...
                </Button>
            ) : (
                <Button type="submit">Salvar Alterações</Button>
            )}
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isUploading}>
              Cancelar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

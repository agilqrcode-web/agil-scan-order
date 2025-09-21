import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface AddMenuItemModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  addMenuItemForm: UseFormReturn<MenuItemFormValues>;
  handleSaveMenuItem: (values: MenuItemFormValues) => Promise<void>;
  handleItemNameInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  itemSuggestions: string[];
  setItemSuggestions: React.Dispatch<React.SetStateAction<string[]>>;
  restaurantId: string | undefined;
}

export function AddMenuItemModal({
  isOpen,
  onOpenChange,
  addMenuItemForm,
  handleSaveMenuItem,
  handleItemNameInputChange,
  itemSuggestions,
  setItemSuggestions,
  restaurantId,
}: AddMenuItemModalProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = useSupabase();

  const resetImageState = () => {
    setImageFile(null);
    setImagePreview(null);
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    addMenuItemForm.setValue("image_url", "");
  };

  useEffect(() => {
    if (isOpen) {
      addMenuItemForm.reset();
      setItemSuggestions([]);
      resetImageState();
    }
  }, [isOpen, addMenuItemForm, setItemSuggestions]);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleSave = async (values: MenuItemFormValues) => {
    if (!supabase || !restaurantId) return;

    setIsUploading(true);
    let imageUrl = values.image_url || "";

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${restaurantId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('menu-item-images')
        .upload(filePath, imageFile);

      if (uploadError) {
        console.error("Error uploading image:", uploadError);
        setIsUploading(false);
        // Optionally: show an error toast to the user
        return;
      }

      const { data } = supabase.storage
        .from('menu-item-images')
        .getPublicUrl(filePath);

      imageUrl = data.publicUrl;
    }

    await handleSaveMenuItem({ ...values, image_url: imageUrl });
    setIsUploading(false);
    onOpenChange(false);
  };

      <ImageUploader 
        inputId="item-image-add-suggested"
        label="Imagem"
        imagePreview={imagePreview}
        onFileChange={handleImageFileChange}
        onRemove={resetImageState}
      />
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Adicionar Item à Categoria</DialogTitle>
          <DialogDescription>
            Use uma sugestão para preencher rapidamente ou crie um item do zero.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={addMenuItemForm.handleSubmit(handleSave)}>
          <Tabs defaultValue="sugerido" className="w-full pt-4" onValueChange={() => { addMenuItemForm.reset(); setItemSuggestions([]); resetImageState(); }}>
            <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="sugerido">Item Sugerido</TabsTrigger><TabsTrigger value="personalizado">Item Personalizado</TabsTrigger></TabsList>
            <TabsContent value="sugerido" className="py-4 space-y-4">
              <div className="grid grid-cols-4 items-center gap-4 relative">
                <Label htmlFor="itemNameSuggested" className="text-right">Nome</Label>
                <div className="col-span-3">
                  <Input id="itemNameSuggested" {...addMenuItemForm.register("name")} className="w-full" placeholder="Digite para buscar uma sugestão..." onChange={handleItemNameInputChange} value={addMenuItemForm.watch("name") || ""} autoComplete="off" />
                  {itemSuggestions.length > 0 && (
                    <div className="absolute z-10 top-full mt-1 w-full max-h-40 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                      {itemSuggestions.map((suggestion) => (
                        <div key={suggestion} className="cursor-pointer p-2 hover:bg-accent hover:text-accent-foreground" onClick={() => { addMenuItemForm.setValue("name", suggestion); setItemSuggestions([]); }}>{suggestion}</div>
                      ))}
                    </div>
                  )}
                  {addMenuItemForm.formState.errors.name && <p className="text-sm text-red-500 mt-1">{addMenuItemForm.formState.errors.name.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="itemDescriptionSuggested" className="text-right">Descrição</Label><Input id="itemDescriptionSuggested" {...addMenuItemForm.register("description")} className="col-span-3" placeholder="(Opcional)" /></div>
              <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="itemPriceSuggested" className="text-right">Preço</Label><Input id="itemPriceSuggested" type="number" step="0.01" {...addMenuItemForm.register("price")} className="col-span-3" placeholder="Ex: 35.90" />{addMenuItemForm.formState.errors.price && <p className="col-span-4 text-right text-sm text-red-500">{addMenuItemForm.formState.errors.price.message}</p>}</div>
              <ImageUploader />
            </TabsContent>
            <TabsContent value="personalizado" className="py-4 space-y-4">
              <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="itemNameCustom" className="text-right">Nome</Label><Input id="itemNameCustom" {...addMenuItemForm.register("name")} className="col-span-3" placeholder="Ex: Prato da Casa" autoComplete="off" />{addMenuItemForm.formState.errors.name && <p className="col-span-4 text-right text-sm text-red-500">{addMenuItemForm.formState.errors.name.message}</p>}</div>
              <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="itemDescriptionCustom" className="text-right">Descrição</Label><Input id="itemDescriptionCustom" {...addMenuItemForm.register("description")} className="col-span-3" placeholder="Ex: Ingredientes especiais..." /></div>
              <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="itemPriceCustom" className="text-right">Preço</Label><Input id="itemPriceCustom" type="number" step="0.01" {...addMenuItemForm.register("price")} className="col-span-3" placeholder="Ex: 42.00" />{addMenuItemForm.formState.errors.price && <p className="col-span-4 text-right text-sm text-red-500">{addMenuItemForm.formState.errors.price.message}</p>}</div>
              <ImageUploader />
            </TabsContent>
          </Tabs>
          <DialogFooter>
            {isUploading ? (
              <Button disabled>
                <Spinner className="mr-2 h-4 w-4" />
                Salvando...
              </Button>
            ) : (
              <Button type="submit">Adicionar Item</Button>
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

e="text-right">Preço</Label><Input id="itemPriceCustom" type="number" step="0.01" {...addMenuItemForm.register("price")} className="col-span-3" placeholder="Ex: 42.00" />{addMenuItemForm.formState.errors.price && <p className="col-span-4 text-right text-sm text-red-500">{addMenuItemForm.formState.errors.price.message}</p>}</div>
              <ImageUploader />
            </TabsContent>
          </Tabs>
          <DialogFooter>
            {isUploading ? (
              <Button disabled>
                <Spinner className="mr-2 h-4 w-4" />
                Salvando...
              </Button>
            ) : (
              <Button type="submit">Adicionar Item</Button>
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


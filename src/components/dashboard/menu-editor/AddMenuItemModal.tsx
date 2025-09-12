import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface AddMenuItemModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  addMenuItemForm: UseFormReturn<MenuItemFormValues>;
  handleSaveMenuItem: (values: MenuItemFormValues) => Promise<void>;
  handleItemNameInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  itemSuggestions: string[];
  setItemSuggestions: React.Dispatch<React.SetStateAction<string[]>>;
  restaurantId: string;
  setSaveMessage: (message: { text: string; type: 'success' | 'error' } | null) => void;
}

// A small reusable component for the image upload UI
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
        <Input id="itemImageUpload" type="file" accept="image/png, image/jpeg, image/webp" onChange={handleImageChange} className="hidden" />
        <Label htmlFor="itemImageUpload" className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
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

export function AddMenuItemModal({
  isOpen,
  onOpenChange,
  addMenuItemForm,
  handleSaveMenuItem,
  handleItemNameInputChange,
  itemSuggestions,
  setItemSuggestions,
  restaurantId,
  setSaveMessage,
}: AddMenuItemModalProps) {

  const { 
    imagePreview, 
    handleImageChange, 
    handleImageRemove, 
    uploadImage, 
    resetImageState 
  } = useItemImageUpload({
    initialImageUrl: null,
    restaurantId: restaurantId || '',
    setSaveMessage,
  });

  useEffect(() => {
    if (isOpen) {
      addMenuItemForm.reset();
      setItemSuggestions([]);
      resetImageState();
    }
  }, [isOpen, addMenuItemForm, setItemSuggestions, resetImageState]);

  const handleSaveWithImage = async (values: MenuItemFormValues) => {
    try {
      const newImageUrl = await uploadImage(null);
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
          <DialogTitle>Adicionar Item à Categoria</DialogTitle>
          <DialogDescription>
            Use uma sugestão para preencher rapidamente ou crie um item do zero.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={addMenuItemForm.handleSubmit(handleSaveWithImage)}>
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
              <ImageUploader imagePreview={imagePreview} handleImageChange={handleImageChange} handleImageRemove={handleImageRemove} />
            </TabsContent>
            <TabsContent value="personalizado" className="py-4 space-y-4">
              <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="itemNameCustom" className="text-right">Nome</Label><Input id="itemNameCustom" {...addMenuItemForm.register("name")} className="col-span-3" placeholder="Ex: Prato da Casa" autoComplete="off" />{addMenuItemForm.formState.errors.name && <p className="col-span-4 text-right text-sm text-red-500">{addMenuItemForm.formState.errors.name.message}</p>}</div>
              <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="itemDescriptionCustom" className="text-right">Descrição</Label><Input id="itemDescriptionCustom" {...addMenuItemForm.register("description")} className="col-span-3" placeholder="Ex: Ingredientes especiais..." /></div>
              <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="itemPriceCustom" className="text-right">Preço</Label><Input id="itemPriceCustom" type="number" step="0.01" {...addMenuItemForm.register("price")} className="col-span-3" placeholder="Ex: 42.00" />{addMenuItemForm.formState.errors.price && <p className="col-span-4 text-right text-sm text-red-500">{addMenuItemForm.formState.errors.price.message}</p>}</div>
              <ImageUploader imagePreview={imagePreview} handleImageChange={handleImageChange} handleImageRemove={handleImageRemove} />
            </TabsContent>
          </Tabs>
          <DialogFooter><Button type="submit">Adicionar Item</Button><Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancelar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Trash2, Image as ImageIcon } from "lucide-react";
import React from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import * as z from "zod";

const menuSchema = z.object({
  name: z.string().min(1, "Nome do cardápio é obrigatório."),
  is_active: z.boolean().default(true),
});

type MenuFormValues = z.infer<typeof menuSchema>;

interface MenuDetailsCardProps {
  menuForm: UseFormReturn<MenuFormValues>;
  bannerPreview: string | null;
  onBannerChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBannerRemove: () => void;
}

export function MenuDetailsCard({
  menuForm,
  bannerPreview,
  onBannerChange,
  onBannerRemove,
}: MenuDetailsCardProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalhes do Cardápio</CardTitle>
        <CardDescription>Edite o nome, status e o banner do seu cardápio.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="menuName">Nome do Cardápio</Label>
            <Input id="menuName" {...menuForm.register("name")} />
            {menuForm.formState.errors.name && (
              <p className="text-red-500 text-sm">{menuForm.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid gap-3">
            <Label>Banner do Cardápio</Label>
            <div className="relative w-full h-48 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/40">
              {bannerPreview ? (
                <img src={bannerPreview} alt="Pré-visualização do banner" className="w-full h-full object-cover rounded-lg" />
              ) : (
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="mx-auto h-10 w-10" />
                  <p className="mt-2 text-sm">Nenhum banner selecionado</p>
                </div>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onBannerChange}
              className="hidden"
              accept="image/png, image/jpeg"
            />
            <div className="flex justify-center gap-2">
                <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} aria-label="Carregar Banner">
                    <Upload className="h-4 w-4" />
                </Button>
                {bannerPreview && (
                    <Button type="button" variant="destructive" size="icon" onClick={onBannerRemove} aria-label="Remover Banner">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Formatos: PNG, JPG. Dimensões ideais: 1200x400 pixels. Tamanho máximo: 2MB.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

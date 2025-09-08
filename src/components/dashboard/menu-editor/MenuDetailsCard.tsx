import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { useForm, UseFormReturn } from "react-hook-form";
import * as z from "zod";

const menuSchema = z.object({
  name: z.string().min(1, "Nome do cardápio é obrigatório."),
  is_active: z.boolean().default(true),
});

type MenuFormValues = z.infer<typeof menuSchema>;

interface MenuDetailsCardProps {
  menuForm: UseFormReturn<MenuFormValues>;
  handleSaveMenu: (values: MenuFormValues) => Promise<void>;
}

export function MenuDetailsCard({ menuForm, handleSaveMenu }: MenuDetailsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalhes do Cardápio</CardTitle>
        <CardDescription>Edite o nome e status do seu cardápio.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={menuForm.handleSubmit(handleSaveMenu)} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="menuName">Nome do Cardápio</Label>
            <Input id="menuName" {...menuForm.register("name")} />
            {menuForm.formState.errors.name && (
              <p className="text-red-500 text-sm">{menuForm.formState.errors.name.message}</p>
            )}
          </div>
          <Button type="submit">
            <Save className="mr-2 h-4 w-4" />
            Salvar Cardápio
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

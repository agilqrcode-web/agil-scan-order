
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";

interface AddTableModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (values: AddTableFormValues) => Promise<void>;
  existingTableNumbers: number[];
}

const createAddTableSchema = (existingNumbers: number[]) => z.object({
  table_number: z.preprocess(
    (val) => Number(val),
    z.number().int().positive("Número da mesa deve ser um número inteiro positivo.")
  ).refine((val) => !existingNumbers.includes(val), {
    message: "Este número de mesa já está em uso.",
  }),
});

export type AddTableFormValues = z.infer<ReturnType<typeof createAddTableSchema>>;

export function AddTableModal({ isOpen, onOpenChange, onSubmit, existingTableNumbers }: AddTableModalProps) {
  const addTableSchema = createAddTableSchema(existingTableNumbers);

  const form = useForm<AddTableFormValues>({
    resolver: zodResolver(addTableSchema),
    defaultValues: {
      table_number: undefined,
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  const handleFormSubmit = async (values: AddTableFormValues) => {
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to add table:", error);
      form.setError("root.serverError", { type: "custom", message: error.message });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Nova Mesa</DialogTitle>
          <DialogDescription>
            Preencha os detalhes para adicionar uma nova mesa ao seu restaurante.
          </DialogDescription>
        </DialogHeader>
        <form id="add-table-form" onSubmit={form.handleSubmit(handleFormSubmit)} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="table_number" className="text-right">
              Número da Mesa
            </Label>
            <Input
              id="table_number"
              type="number"
              {...form.register("table_number")}
              className="col-span-3"
            />
            {form.formState.errors.table_number && (
              <p className="col-span-4 text-right text-red-500 text-sm">
                {form.formState.errors.table_number.message}
              </p>
            )}
          </div>
          {existingTableNumbers.length > 0 && (
            <div className="col-span-4 text-sm text-muted-foreground text-right">
              Números de mesa já em uso: {existingTableNumbers.join(', ')}
            </div>
          )}
          {form.formState.errors.root?.serverError && (
             <p className="col-span-4 text-center text-red-500 text-sm">
                {form.formState.errors.root.serverError.message}
             </p>
          )}
        </form>
        <DialogFooter>
          <Button type="submit" form="add-table-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Adicionando..." : "Adicionar Mesa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";

interface MenuItemsListProps {
  items: any[];
  onEditItem: (item: any) => void;
  onDeleteItem: (id: string) => void;
}

export function MenuItemsList({ items, onEditItem, onDeleteItem }: MenuItemsListProps) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">Nenhum item nesta categoria.</p>;
  }

  return (
    <>
      {items.map(item => (
        <div key={item.id} className="flex items-center justify-between border p-2 rounded-md">
          <span>{item.name} - R$ {Number(item.price).toFixed(2)}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onEditItem(item)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="destructive" size="sm" onClick={() => onDeleteItem(item.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </>
  );
}

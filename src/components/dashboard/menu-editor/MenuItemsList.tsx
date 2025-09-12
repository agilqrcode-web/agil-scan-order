import { Button } from "@/components/ui/button";
import { Edit, Trash2, Image } from "lucide-react";

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
          <div className="flex items-center gap-3">
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-md object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-md bg-muted/40 flex items-center justify-center">
                <Image className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <div className="font-medium">{item.name}</div>
              <div className="text-sm text-muted-foreground">R$ {Number(item.price).toFixed(2)}</div>
            </div>
          </div>
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

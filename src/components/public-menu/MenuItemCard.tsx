import { Badge } from "@/components/ui/badge";
import { MenuItem } from "@/hooks/usePublicMenu";

interface MenuItemCardProps {
    item: MenuItem;
}

export function MenuItemCard({ item }: MenuItemCardProps) {
    return (
        <div key={item.id} className="flex items-center space-x-3 pt-2">
            <img
                src={item.image_url || '/placeholder.svg'}
                alt={item.name}
                className="w-16 h-16 object-cover rounded-lg shadow-sm flex-shrink-0"
            />
            <div className="flex-grow">
                <h4 className="text-base font-bold text-gray-800">{item.name}</h4>
                {item.description && (
                    <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                )}
            </div>
            <Badge className="text-base font-bold px-2 py-1 bg-green-600 text-white flex-shrink-0 self-start">
                R$ {item.price.toFixed(2).replace('.', ',')}
            </Badge>
        </div>
    );
}

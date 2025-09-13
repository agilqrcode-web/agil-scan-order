import { Badge } from "@/components/ui/badge";
import { MenuItem } from "@/hooks/usePublicMenu";

interface MenuItemCardProps {
    item: MenuItem;
    onClick: () => void;
}

export function MenuItemCard({ item, onClick }: MenuItemCardProps) {
    return (
        <div onClick={onClick} className="flex items-start space-x-4 p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors duration-200">
            <img
                src={item.image_url || '/placeholder.svg'}
                alt={item.name}
                className="w-20 h-20 object-cover rounded-md shadow-sm flex-shrink-0"
            />
            <div className="flex-grow">
                <h4 className="text-base font-semibold text-gray-900">{item.name}</h4>
                {item.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                )}
            </div>
            <Badge className="text-sm font-bold px-2 py-1 bg-green-100 text-green-800 flex-shrink-0 self-start border border-green-200">
                R$ {item.price.toFixed(2).replace('.', ',')}
            </Badge>
        </div>
    );
}

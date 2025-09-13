import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Category, MenuItem } from "@/hooks/usePublicMenu";
import { MenuItemCard } from "./MenuItemCard";

interface CategorySectionProps {
    category: Category;
    onItemClick: (item: MenuItem) => void;
}

export function CategorySection({ category, onItemClick }: CategorySectionProps) {
    return (
        <Card key={category.id} className="shadow-lg bg-white flex flex-col overflow-hidden rounded-xl border-gray-200">
            <CardHeader className="p-4 bg-gray-50 border-b">
                <CardTitle className="text-lg font-bold text-gray-800">{category.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-2 flex-1">
                {category.items && category.items.length > 0 ? (
                    <div className="space-y-1">
                        {category.items.map((item) => (
                            <MenuItemCard key={item.id} item={item} onClick={() => onItemClick(item)} />
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 italic p-4 text-center">Nenhum item nesta categoria.</p>
                )}
            </CardContent>
        </Card>
    );
}

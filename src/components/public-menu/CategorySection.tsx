import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Category } from "@/hooks/usePublicMenu";
import { MenuItemCard } from "./MenuItemCard";

interface CategorySectionProps {
    category: Category;
}

export function CategorySection({ category }: CategorySectionProps) {
    return (
        <Card key={category.id} className="shadow-lg bg-white flex flex-col">
            <CardHeader className="p-4">
                <CardTitle>{category.name}</CardTitle>
                <CardDescription>Veja os itens desta categoria abaixo.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 flex-1">
                {category.items && category.items.length > 0 ? (
                    <div className="space-y-2">
                        {category.items.map((item) => (
                            <MenuItemCard key={item.id} item={item} />
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 italic">Nenhum item nesta categoria.</p>
                )}
            </CardContent>
        </Card>
    );
}

import { Card } from "@/components/ui/card";
import { Category, MenuItem } from "@/hooks/usePublicMenu";
import { CategorySection } from "./CategorySection";

interface MenuContentProps {
    categories: Category[];
    onItemClick: (item: MenuItem) => void;
}

export function MenuContent({ categories, onItemClick }: MenuContentProps) {
    return (
        <>{
            categories.length === 0 ? (
                <Card className="p-6 text-center text-gray-600 shadow-md bg-white">
                    <p className="text-lg">Este cardápio ainda não possui categorias ou itens.</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {categories.map((category) => (
                        <CategorySection key={category.id} category={category} onItemClick={onItemClick} />
                    ))}
                </div>
            )
        }</>
    );
}

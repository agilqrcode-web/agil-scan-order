import { Card } from "@/components/ui/card";
import { ImageIcon } from "lucide-react";
import { Menu } from "@/hooks/usePublicMenu";

interface MenuBannerProps {
    menu: Menu;
}

export function MenuBanner({ menu }: MenuBannerProps) {
    return (
        <Card className="mb-2 shadow-xl overflow-hidden rounded-lg">
            <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                {menu.banner_url ? (
                    <img src={menu.banner_url} alt={`Banner do ${menu.name}`} className="w-full h-full object-cover" />
                ) : (
                    <ImageIcon className="h-16 w-16 text-gray-400" />
                )}
            </div>
        </Card>
    );
}

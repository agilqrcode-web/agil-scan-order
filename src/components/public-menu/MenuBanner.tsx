import { Card } from "@/components/ui/card";
import { ImageIcon } from "lucide-react";
import { Menu, Restaurant } from "@/hooks/usePublicMenu";

interface MenuBannerProps {
    menu: Menu;
    restaurant: Restaurant;
}

export function MenuBanner({ menu, restaurant }: MenuBannerProps) {
    return (
        <div className="relative mb-4"> {/* Margem inferior ajustada */}
            <Card className="shadow-xl overflow-hidden rounded-lg">
                <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                    {menu.banner_url ? (
                        <img src={menu.banner_url} alt={`Banner do ${menu.name}`} className="w-full h-full object-cover" />
                    ) : (
                        <ImageIcon className="h-16 w-16 text-gray-400" />
                    )}
                </div>
            </Card>
            <div className="absolute top-1/2 left-4 -translate-y-1/2"> {/* Posicionamento da logo */}
                <div className="w-32 h-32 rounded-full bg-gray-300 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center">
                    {restaurant.logo_url ? (
                        <img src={restaurant.logo_url} alt={`Logo de ${restaurant.name}`} className="w-full h-full object-cover" />
                    ) : (
                        <ImageIcon className="h-12 w-12 text-gray-500" />
                    )}
                </div>
            </div>
        </div>
    );
}

import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Info, ShoppingCart, UtensilsCrossed } from 'lucide-react';

interface PublicMenuHeaderProps {
  restaurantName: string;
  tableNumber: number | null;
}

export function PublicMenuHeader({ restaurantName, tableNumber }: PublicMenuHeaderProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="container mx-auto max-w-3xl bg-white shadow-md p-2 flex items-center justify-between rounded-b-lg">
        <h1 className="text-lg font-bold text-gray-800">
          {restaurantName}
        </h1>
        <TabsList className="grid grid-cols-3 h-auto p-1 bg-gray-100 rounded-lg">
          <TabsTrigger value="menu" className="flex flex-col items-center justify-center p-1 text-gray-600 data-[state=active]:bg-white data-[state=active]:text-primary-600 rounded-md shadow-sm transition-all duration-200">
            <UtensilsCrossed className="h-4 w-4" />
            <span className="text-xs font-medium">Cardápio</span>
          </TabsTrigger>
          <TabsTrigger value="info" className="flex flex-col items-center justify-center p-1 text-gray-600 data-[state=active]:bg-white data-[state=active]:text-primary-600 rounded-md shadow-sm transition-all duration-200">
            <Info className="h-4 w-4" />
            <span className="text-xs font-medium">Info</span>
          </TabsTrigger>
          <TabsTrigger value="checkout" className="flex flex-col items-center justify-center p-1 text-gray-600 data-[state=active]:bg-white data-[state=active]:text-primary-600 rounded-md shadow-sm transition-all duration-200">
            <ShoppingCart className="h-4 w-4" />
            <span className="text-xs font-medium">Pedido</span>
          </TabsTrigger>
        </TabsList>
      </div>
    </div>
  );
}
rounded-md shadow-sm transition-all duration-200">
            <ShoppingCart className="h-4 w-4" />
            <span className="text-xs font-medium">Pedido</span>
          </TabsTrigger>
        </TabsList>
      </div>
    </div>
  );
}

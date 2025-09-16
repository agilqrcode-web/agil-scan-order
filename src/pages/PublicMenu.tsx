import { useState, useEffect } from 'react';
import { usePublicMenu, MenuItem } from '@/hooks/usePublicMenu';
import { CartProvider, useCart } from '@/contexts/CartContext';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { MenuLoadingSkeleton } from '@/components/public-menu/MenuLoadingSkeleton';
import { MenuError } from '@/components/public-menu/MenuError';
import { MenuNotFound } from '@/components/public-menu/MenuNotFound';
import { PublicMenuHeader } from '@/components/public-menu/PublicMenuHeader';
import { MenuBanner } from '@/components/public-menu/MenuBanner';
import { MenuContent } from '@/components/public-menu/MenuContent';
import { RestaurantInfoTab } from '@/components/public-menu/RestaurantInfoTab';
import { CheckoutTab } from '@/components/public-menu/CheckoutTab';
import { MenuItemDetailModal } from '@/components/public-menu/MenuItemDetailModal';

function PublicMenuPage() {
  const { data, isLoading, isError, error, menuId, tableIdentifier } = usePublicMenu();
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [tableNumberDisplay, setTableNumberDisplay] = useState<number | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);

  useEffect(() => {
    if (tableIdentifier) {
      fetch(`/api/tables?qr_identifier=${tableIdentifier}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.id && data.table_number) {
            setTableId(data.id);
            setTableNumberDisplay(data.table_number);
          }
        })
        .catch(err => console.error("Failed to fetch table data:", err));
    }
  }, [tableIdentifier]);

  if (isLoading) {
    return <MenuLoadingSkeleton />;
  }

  if (isError) {
    return <MenuError error={error} />;
  }

  if (!data || !data.menu || !data.restaurant || !data.categories) {
    return <MenuNotFound menuId={menuId} />;
  }

  const { menu, restaurant, categories } = data;

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
        <Tabs defaultValue="menu" className="w-full">
          <PublicMenuHeader restaurantName={restaurant.name} totalItems={totalItems} />

          <div className="pt-20 pb-8">
            <div className="container mx-auto px-4 max-w-3xl">
              <TabsContent value="menu">
                <MenuBanner menu={menu} />
                <MenuContent categories={categories} onItemClick={setSelectedItem} />
              </TabsContent>

              <TabsContent value="info">
                    <RestaurantInfoTab restaurant={restaurant} />
                </TabsContent>

              <TabsContent value="checkout">
                <CheckoutTab tableId={tableId} tableNumber={tableNumberDisplay} />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>

      {selectedItem && (
        <MenuItemDetailModal
          item={selectedItem}
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  );
}

export default function PublicMenu() {
  return (
    <CartProvider>
      <PublicMenuPage />
    </CartProvider>
  );
}
    </CartProvider>
  );
}

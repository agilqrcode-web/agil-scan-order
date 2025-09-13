import { usePublicMenu } from '@/hooks/usePublicMenu';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { MenuLoadingSkeleton } from '@/components/public-menu/MenuLoadingSkeleton';
import { MenuError } from '@/components/public-menu/MenuError';
import { MenuNotFound } from '@/components/public-menu/MenuNotFound';
import { PublicMenuHeader } from '@/components/public-menu/PublicMenuHeader';
import { MenuBanner } from '@/components/public-menu/MenuBanner';
import { MenuContent } from '@/components/public-menu/MenuContent';
import { RestaurantInfoTab } from '@/components/public-menu/RestaurantInfoTab';
import { CheckoutTab } from '@/components/public-menu/CheckoutTab';

export default function PublicMenu() {
  const { data, isLoading, isError, error, menuId } = usePublicMenu();

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
      <Tabs defaultValue="menu" className="w-full">
        <PublicMenuHeader restaurantName={restaurant.name} />

        {/* Main Content Area - Adjusted padding-top for fixed header */}
        <div className="pt-20 pb-8">
          <div className="container mx-auto px-4 max-w-3xl">
            <TabsContent value="menu">
              <MenuBanner menu={menu} />
              <MenuContent categories={categories} />
            </TabsContent>

            <TabsContent value="info">
              <RestaurantInfoTab />
            </TabsContent>

            <TabsContent value="checkout">
              <CheckoutTab />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
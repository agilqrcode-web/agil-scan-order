import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button'; // Added Button import
import { Loader2, UtensilsCrossed, Info, ShoppingCart, Wallet, Calendar, MapPin, Clock, Phone, BookOpen } from 'lucide-react'; // Added icons
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'; // Added Tabs components

export default function PublicMenu() {
  const { menuId } = useParams();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['publicMenu', menuId],
    queryFn: async () => {
      if (!menuId) return null;
      const response = await fetch(`/api/menupublic/public?menuId=${menuId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch public menu data');
      }
      return response.json();
    },
    enabled: !!menuId, // Only run query if menuId is available
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-gray-600">Carregando cardápio...</p>
        <div className="w-full max-w-2xl mt-8 space-y-4">
          <Skeleton className="h-10 w-3/4 mx-auto" />
          <Skeleton className="h-6 w-1/2 mx-auto" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto p-4 text-center min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold text-red-600 mb-4">Erro ao Carregar Cardápio</h1>
        <p className="text-lg text-gray-700">Não foi possível carregar o cardápio. Por favor, tente novamente mais tarde.</p>
        {error && <p className="text-sm text-gray-500 mt-2">Detalhes: {error.message}</p>}
      </div>
    );
  }

  if (!data || !data.menu || !data.restaurant || !data.categories) {
    return (
      <div className="container mx-auto p-4 text-center min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Cardápio Não Encontrado</h1>
        <p className="text-lg text-gray-700">O cardápio com o ID "{menuId}" não foi encontrado ou não está disponível.</p>
      </div>
    );
  }

  const { menu, restaurant, categories } = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-900 dark:to-gray-800">
      <Tabs defaultValue="menu" className="w-full"> {/* Main Tabs component now wraps everything */}
        {/* Fixed Header Bar */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 shadow-md p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            {restaurant.name}
          </h1>
          <TabsList className="grid grid-cols-3 h-auto p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <TabsTrigger value="menu" className="flex flex-col items-center justify-center p-2 text-gray-600 dark:text-gray-300 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:text-primary-600 dark:data-[state=active]:text-primary-400 rounded-md shadow-sm transition-all duration-200">
              <UtensilsCrossed className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">Cardápio</span>
            </TabsTrigger>
            <TabsTrigger value="info" className="flex flex-col items-center justify-center p-2 text-gray-600 dark:text-gray-300 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:text-primary-600 dark:data-[state=active]:text-primary-400 rounded-md shadow-sm transition-all duration-200">
              <Info className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">Info</span>
            </TabsTrigger>
            <TabsTrigger value="checkout" className="flex flex-col items-center justify-center p-2 text-gray-600 dark:text-gray-300 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:text-primary-600 dark:data-[state=active]:text-primary-400 rounded-md shadow-sm transition-all duration-200">
              <ShoppingCart className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">Pedido</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Main Content Area - Adjusted padding-top for fixed header */}
        <div className="pt-24 pb-8"> {/* Adjust pt- to match header height + desired spacing */}
          <div className="container mx-auto px-4 max-w-3xl">
            <TabsContent value="menu">
              {/* Existing Menu Display Logic */}
              <Card className="mb-8 shadow-xl border-t-4 border-primary-500 dark:border-primary-400">
                <CardHeader className="text-center">
                  <CardTitle className="text-4xl font-extrabold text-primary-700 dark:text-primary-300 tracking-tight leading-tight">
                    {menu.name}
                  </CardTitle>
                  <CardDescription className="text-xl text-gray-600 dark:text-gray-400 mt-2">
                    Explore nosso delicioso cardápio!
                  </CardDescription>
                </CardHeader>
              </Card>

              {categories.length === 0 ? (
                <Card className="p-6 text-center text-gray-600 dark:text-gray-400 shadow-md">
                  <p className="text-lg">Este cardápio ainda não possui categorias ou itens.</p>
                </Card>
              ) : (
                categories.map((category, index) => (
                  <React.Fragment key={category.id}>
                    <Card className="mb-6 shadow-lg dark:bg-gray-700">
                      <CardHeader>
                        <CardTitle className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                          {category.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {category.items && category.items.length > 0 ? (
                          category.items.map((item) => (
                            <div key={item.id} className="flex items-start space-x-4 pb-2">
                              {item.image_url && (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="w-20 h-20 object-cover rounded-md shadow-sm flex-shrink-0"
                                />
                              )}
                              <div className="flex-grow">
                                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-50">{item.name}</h4>
                                {item.description && (
                                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{item.description}</p>
                                )}
                              </div>
                              <Badge className="text-lg font-bold px-3 py-1 bg-primary-600 text-white dark:bg-primary-400 dark:text-gray-900 flex-shrink-0">
                                R$ {item.price.toFixed(2).replace('.', ',')}
                              </Badge>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-500 dark:text-gray-400 italic">Nenhum item nesta categoria.</p>
                        )}
                      </CardContent>
                    </Card>
                    {index < categories.length - 1 && (
                      <Separator className="my-8 bg-gray-300 dark:bg-gray-600" />
                    )}
                  </React.Fragment>
                ))
              )}
            </TabsContent>

            <TabsContent value="info" className="pt-4">
              <Card className="p-6 shadow-lg dark:bg-gray-700">
                <CardTitle className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">Informações do Restaurante</CardTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Column 1 */}
                  <div>
                    <h3 className="text-xl font-semibold mb-3 flex items-center text-gray-800 dark:text-gray-100">
                      <Wallet className="h-5 w-5 mr-2 text-primary-500" /> Método de Pagamento
                    </h3>
                    <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 pl-2">
                      <li>Dinheiro</li>
                      <li>Cartão</li>
                      <li>Pix</li>
                    </ul>

                    <h3 className="text-xl font-semibold mt-6 mb-3 flex items-center text-gray-800 dark:text-gray-100">
                      <Calendar className="h-5 w-5 mr-2 text-primary-500" /> Reserva de Mesa
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 pl-2">A combinar</p>

                    <h3 className="text-xl font-semibold mt-6 mb-3 flex items-center text-gray-800 dark:text-gray-100">
                      <MapPin className="h-5 w-5 mr-2 text-primary-500" /> Endereço
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 pl-2">Rua Exemplo, 123 - Bairro Fictício, Cidade - UF</p>
                  </div>

                  {/* Column 2 */}
                  <div>
                    <h3 className="text-xl font-semibold mb-3 flex items-center text-gray-800 dark:text-gray-100">
                      <Clock className="h-5 w-5 mr-2 text-primary-500" /> Horário de Funcionamento
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 pl-2">Segunda a Domingo: 00:00 - 00:00</p>

                    <h3 className="text-xl font-semibold mt-6 mb-3 flex items-center text-gray-800 dark:text-gray-100">
                      <Phone className="h-5 w-5 mr-2 text-primary-500" /> Telefone
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 pl-2">(XX) XXXX-XXXX</p>

                    <h3 className="text-xl font-semibold mt-6 mb-3 flex items-center text-gray-800 dark:text-gray-100">
                      <BookOpen className="h-5 w-5 mr-2 text-primary-500" /> Sobre Nós
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 pl-2">Um lugar aconchegante com a melhor comida da cidade!</p>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="checkout" className="pt-4">
              <Card className="p-6 shadow-lg dark:bg-gray-700">
                <CardTitle className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">Checkout de Pedidos</CardTitle>
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  Esta é a área de checkout. Em breve, você poderá finalizar seu pedido aqui!
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  **Itens no Carrinho:** (Nenhum item adicionado ainda)
                </p>
                <div className="mt-4">
                  <Button className="w-full bg-primary-600 hover:bg-primary-700 text-white">Finalizar Pedido (Estático)</Button>
                </div>
              </Card>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
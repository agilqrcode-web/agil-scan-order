import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button'; // Added Button import
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, UtensilsCrossed, Info, ShoppingCart, Wallet, Calendar, MapPin, Clock, Phone, BookOpen, ImageIcon } from 'lucide-react'; // Added icons
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
      <Tabs defaultValue="menu" className="w-full"> {/* Main Tabs component now wraps everything */}
        {/* Fixed Header Bar */}
        <div className="fixed top-0 left-0 right-0 z-50">
          <div className="container mx-auto max-w-3xl bg-white shadow-md p-2 flex items-center justify-between rounded-b-lg">
            <h1 className="text-lg font-bold text-gray-800">
              {restaurant.name}
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

        {/* Main Content Area - Adjusted padding-top for fixed header */}
        <div className="pt-20 pb-8"> {/* Adjust pt- to match header height + desired spacing */}
          <div className="container mx-auto px-4 max-w-3xl">
            <TabsContent value="menu">
              {/* Existing Menu Display Logic */}
              <Card className="mb-4 shadow-xl overflow-hidden rounded-lg">
                {/* Banner do Cardápio */}
                <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                  {menu.banner_url ? (
                    <img src={menu.banner_url} alt={`Banner do ${menu.name}`} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-16 w-16 text-gray-400" />
                  )}
                </div>
              </Card>

              {categories.length === 0 ? (
                <Card className="p-6 text-center text-gray-600 shadow-md bg-white">
                  <p className="text-lg">Este cardápio ainda não possui categorias ou itens.</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {categories.map((category) => (
                    <Card key={category.id} className="shadow-lg bg-white flex flex-col">
                      <CardHeader className="p-4">
                        <CardTitle>{category.name}</CardTitle>
                        <CardDescription>Veja os itens desta categoria abaixo.</CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 flex-1">
                        {category.items && category.items.length > 0 ? (
                          <div className="space-y-2">
                            {category.items.map((item) => (
                              <div key={item.id} className="flex items-center space-x-3 pt-2">
                                <img
                                  src={item.image_url || '/placeholder.svg'}
                                  alt={item.name}
                                  className="w-16 h-16 object-cover rounded-lg shadow-sm flex-shrink-0"
                                />
                                <div className="flex-grow">
                                  <h4 className="text-base font-bold text-gray-800">{item.name}</h4>
                                  {item.description && (
                                    <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                                  )}
                                </div>
                                <Badge className="text-base font-bold px-2 py-1 bg-green-600 text-white flex-shrink-0 self-start">
                                  R$ {item.price.toFixed(2).replace('.', ',')}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 italic">Nenhum item nesta categoria.</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="info">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Coluna da Esquerda */}
                <div className="space-y-6">
                  <Card className="p-6 shadow-lg bg-white">
                    <CardHeader className="p-0 pb-4">
                      <CardTitle className="flex items-center"><MapPin className="h-5 w-5 mr-3 text-primary" /> Endereço e Contato</CardTitle>
                    </CardHeader>
                    <div className="space-y-2 text-gray-700">
                      <p>Rua Exemplo, 123 - Bairro Fictício, Cidade - UF</p>
                      <p>(XX) XXXX-XXXX</p>
                    </div>
                  </Card>
                  <Card className="p-6 shadow-lg bg-white">
                    <CardHeader className="p-0 pb-4">
                      <CardTitle className="flex items-center"><BookOpen className="h-5 w-5 mr-3 text-primary" /> Sobre Nós</CardTitle>
                    </CardHeader>
                    <p className="text-gray-700">Um lugar aconchegante com a melhor comida da cidade!</p>
                  </Card>
                </div>
                {/* Coluna da Direita */}
                <div className="space-y-6">
                  <Card className="p-6 shadow-lg bg-white">
                    <CardHeader className="p-0 pb-4">
                      <CardTitle className="flex items-center"><Clock className="h-5 w-5 mr-3 text-primary" /> Horário de Funcionamento</CardTitle>
                    </CardHeader>
                    <p className="text-gray-700">Segunda a Domingo: 00:00 - 00:00</p>
                  </Card>
                  <Card className="p-6 shadow-lg bg-white">
                    <CardHeader className="p-0 pb-4">
                      <CardTitle className="flex items-center"><Wallet className="h-5 w-5 mr-3 text-primary" /> Métodos de Pagamento</CardTitle>
                    </CardHeader>
                    <ul className="list-disc list-inside text-gray-700">
                      <li>Dinheiro</li>
                      <li>Cartão</li>
                      <li>Pix</li>
                    </ul>
                  </Card>
                   <Card className="p-6 shadow-lg bg-white">
                    <CardHeader className="p-0 pb-4">
                      <CardTitle className="flex items-center"><Calendar className="h-5 w-5 mr-3 text-primary" /> Reservas</CardTitle>
                    </CardHeader>
                    <p className="text-gray-700">A combinar</p>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="checkout">
              <div className="pb-28"> {/* Padding for the fixed bottom bar */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Coluna da Esquerda: Detalhes do Cliente */}
                  <div className="space-y-6">
                    <Card className="p-6 shadow-lg bg-white">
                      <CardHeader className="p-0 pb-4">
                        <CardTitle>Suas Informações</CardTitle>
                        <CardDescription>Preencha seus dados para o pedido.</CardDescription>
                      </CardHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="customer-name">Nome</Label>
                          <Input id="customer-name" placeholder="Seu nome" />
                        </div>
                        <div>
                          <Label htmlFor="table-number">Número da Mesa</Label>
                          <Input id="table-number" placeholder="Número da sua mesa" />
                        </div>
                      </div>
                    </Card>
                    <Card className="p-6 shadow-lg bg-white">
                      <CardHeader className="p-0 pb-4">
                        <CardTitle>Observações</CardTitle>
                      </CardHeader>
                      <Textarea placeholder="Ex: tirar a cebola, ponto da carne mal passado, etc." />
                    </Card>
                  </div>

                  {/* Coluna da Direita: Resumo do Pedido */}
                  <div className="space-y-6">
                    <Card className="p-6 shadow-lg bg-white">
                      <CardHeader className="p-0 pb-4">
                        <CardTitle>Resumo do Pedido</CardTitle>
                      </CardHeader>
                      
                      {/* Lista de Itens */}
                      <div className="flow-root">
                        <ul className="-my-4 divide-y divide-gray-200">
                          {/* Placeholder for a cart item */}
                          <li className="flex items-center py-4">
                            <div className="h-16 w-16 rounded object-cover bg-secondary flex items-center justify-center">
                              <ImageIcon className="h-8 w-8 text-gray-400" />
                            </div>
                            <div className="ml-4 flex-1">
                              <h3 className="font-bold text-gray-900">Hambúrguer Clássico</h3>
                              <p className="mt-1 text-sm text-gray-500">R$ 25,50</p>
                            </div>
                            <div className="flex items-center">
                              <Button variant="outline" size="icon" className="h-8 w-8">-</Button>
                              <span className="w-8 text-center">1</span>
                              <Button variant="outline" size="icon" className="h-8 w-8">+</Button>
                            </div>
                          </li>
                          {/* Fim do Placeholder */}
                        </ul>
                      </div>

                      {/* Mensagem de carrinho vazio (para ser usada condicionalmente no futuro) */}
                      <div className="text-center text-gray-500 py-8 hidden">
                        <ShoppingCart className="mx-auto h-12 w-12" />
                        <p className="mt-4">Seu carrinho está vazio</p>
                      </div>

                      {/* Detalhes de Custo */}
                      <div className="mt-6 space-y-2 border-t pt-6">
                        <div className="flex items-center justify-between gap-2">
                          <Input placeholder="Adicionar cupom" className="flex-1" />
                          <Button variant="outline">Aplicar</Button>
                        </div>
                        <dl className="space-y-1 text-sm text-gray-700 pt-4">
                          <div className="flex justify-between">
                            <dt>Sub-total</dt>
                            <dd>R$ 25,50</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt>Taxa de Serviço (10%)</dt>
                            <dd>R$ 2,55</dd>
                          </div>
                          <div className="flex justify-between font-bold text-base text-gray-900 border-t pt-2 mt-2">
                            <dt>Total</dt>
                            <dd>R$ 28,05</dd>
                          </div>
                        </dl>
                      </div>
                    </Card>
                  </div>
                </div>
              </div>

              {/* Barra Inferior Fixa */}
              <div className="fixed bottom-0 left-0 right-0 z-50">
                <div className="container mx-auto max-w-3xl h-20 flex items-center justify-end px-4 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.1)] border-t rounded-t-lg">
                  <Button size="lg" className="bg-primary hover:opacity-90 text-primary-foreground">
                    Fazer pedido
                  </Button>
                </div>
              </div>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}

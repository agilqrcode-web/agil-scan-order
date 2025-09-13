import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageIcon, ShoppingCart } from "lucide-react";

export function CheckoutTab() {
    return (
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

            {/* Barra Inferior Fixa */}
            <div className="fixed bottom-0 left-0 right-0 z-50">
                <div className="container mx-auto max-w-3xl h-20 flex items-center justify-end px-4 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.1)] border-t rounded-t-lg">
                    <Button size="lg" className="bg-primary hover:opacity-90 text-primary-foreground">
                        Fazer pedido
                    </Button>
                </div>
            </div>
        </div>
    );
}

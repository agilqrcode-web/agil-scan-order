import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingCart, Trash2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/components/ui/use-toast";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface CheckoutTabProps {
  tableId: string | null;
  tableNumber: number | null;
}

export function CheckoutTab({ tableId, tableNumber }: CheckoutTabProps) {
    const { cartItems, updateQuantity, removeFromCart, totalPrice, clearCart } = useCart();
    const { toast } = useToast();
    const [customerName, setCustomerName] = useState('');
    const [observations, setObservations] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const serviceFee = totalPrice * 0.10;
    const finalTotal = totalPrice + serviceFee;

    const handlePlaceOrder = async () => {
        console.log("handlePlaceOrder called");
        if (cartItems.length === 0) {
            toast({
                variant: "destructive",
                title: "Carrinho vazio",
                description: "Adicione itens ao carrinho antes de fazer o pedido.",
            });
            return;
        }

        if (!tableId) {
            toast({
                variant: "destructive",
                title: "Mesa não identificada",
                description: "Não foi possível identificar o número da mesa. Tente escanear o QR Code novamente.",
            });
            return;
        }

        if (!customerName.trim()) {
            toast({
                variant: "destructive",
                title: "Nome obrigatório",
                description: "Por favor, preencha seu nome para o pedido.",
            });
            return;
        }

        setIsSaving(true);
        console.log("Validation passed, attempting API call");

        const formattedItems = cartItems.map(item => ({
            menu_item_id: item.id,
            quantity: item.quantity,
            price_at_time: item.price,
        }));

        try {
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    table_id: tableId,
                    customer_name: customerName,
                    observations: observations,
                    items: formattedItems,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao fazer o pedido.');
            }

            const { orderId } = await response.json(); // Assuming API returns { orderId: UUID }
            console.log("API call successful, orderId:", orderId);

            toast({
                title: "Pedido realizado!",
                description: "Seu pedido foi enviado com sucesso.",
            });
            clearCart();
            setCustomerName('');
            setObservations('');
            navigate(`/order-status/${orderId}`);

        } catch (error: any) {
            console.error("API call failed, error:", error);
            toast({
                variant: "destructive",
                title: "Erro",
                description: error.message || "Não foi possível enviar o pedido. Tente novamente.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="pb-28"> {/* Padding for the fixed bottom bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Coluna da Direita: Resumo do Pedido (Agora na esquerda no código para aparecer primeiro no mobile) */}
                <div className="space-y-6">
                    <Card className="p-6 shadow-lg bg-white">
                        <CardHeader className="p-0 pb-4">
                            <CardTitle className="text-xl font-semibold text-gray-800">Resumo do Pedido</CardTitle>
                            <Separator className="my-2" />
                        </CardHeader>

                        {cartItems.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">
                                <ShoppingCart className="mx-auto h-12 w-12" />
                                <p className="mt-4">Seu carrinho está vazio</p>
                                <p className="text-sm mt-1">Adicione itens do cardápio para começar.</p>
                            </div>
                        ) : (
                            <>
                                <div className="flow-root">
                                    <ul className="-my-4 divide-y divide-gray-200">
                                        {cartItems.map(item => (
                                            <li key={item.id} className="flex items-start py-4 gap-4">
                                                <img
                                                    src={item.image_url || '/placeholder.svg'}
                                                    alt={item.name}
                                                    className="h-16 w-16 rounded object-cover bg-secondary flex-shrink-0"
                                                />
                                                <div className="flex-1 flex flex-col">
                                                    <h3 className="font-semibold text-gray-800">{item.name}</h3>
                                                    
                                                    <div className="flex justify-between items-center mt-2">
                                                        <p className="text-sm text-gray-600 font-medium">R$ {item.price.toFixed(2).replace('.', ',')}</p>
                                                        <div className="flex items-center">
                                                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-r-none" onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</Button>
                                                            <span className="w-8 text-center font-medium border-y h-8 flex items-center justify-center">{item.quantity}</span>
                                                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-l-none" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-100 hover:text-red-600 ml-2" onClick={() => removeFromCart(item.id)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="mt-6 space-y-2 border-t pt-6">
                                    <div className="flex items-center justify-between gap-2">
                                        <Input placeholder="Adicionar cupom" className="flex-1" />
                                        <Button variant="outline">Aplicar</Button>
                                    </div>
                                    <dl className="space-y-1 text-sm text-gray-600 pt-4">
                                        <div className="flex justify-between">
                                            <dt>Sub-total</dt>
                                            <dd>R$ {totalPrice.toFixed(2).replace('.', ',')}</dd>
                                        </div>
                                        <div className="flex justify-between">
                                            <dt>Taxa de Serviço (10%)</dt>
                                            <dd>R$ {serviceFee.toFixed(2).replace('.', ',')}</dd>
                                        </div>
                                        <div className="flex justify-between font-bold text-base text-gray-800 border-t pt-2 mt-2">
                                            <dt>Total</dt>
                                            <dd>R$ {finalTotal.toFixed(2).replace('.', ',')}</dd>
                                        </div>
                                    </dl>
                                </div>
                            </>
                        )}
                    </Card>
                </div>

                {/* Coluna da Esquerda: Detalhes do Cliente (Agora na direita no código para aparecer depois no mobile) */}
                <div className="space-y-6">
                    <Card className="p-6 shadow-lg bg-white">
                        <CardHeader className="p-0 pb-4">
                            <CardTitle className="text-xl font-semibold text-gray-800">Suas Informações</CardTitle>
                            <CardDescription className="text-sm text-gray-600">Preencha seus dados para o pedido.</CardDescription>
                            <Separator className="my-2" />
                        </CardHeader>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="customer-name" className="text-sm text-gray-600">Nome</Label>
                                <Input id="customer-name" placeholder="Seu nome" className="text-sm text-gray-800" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                            </div>
                            {tableNumber && (
                                <div className="flex items-center gap-2">
                                    <Label className="text-sm text-gray-600">Número da Mesa:</Label>
                                    <span className="text-lg font-bold text-primary bg-primary/10 px-3 py-1 rounded-md">
                                        {tableNumber}
                                    </span>
                                </div>
                            )}
                        </div>
                    </Card>
                    <Card className="p-6 shadow-lg bg-white">
                        <CardHeader className="p-0 pb-4">
                            <CardTitle className="text-xl font-semibold text-gray-800">Observações</CardTitle>
                            <Separator className="my-2" />
                        </CardHeader>
                        <Textarea placeholder="Ex: tirar a cebola, ponto da carne mal passado, etc." className="text-sm text-gray-800" value={observations} onChange={(e) => setObservations(e.target.value)} />
                    </Card>
                </div>
            </div>

            {/* Barra Inferior Fixa */}
            <div className="fixed bottom-0 left-0 right-0 z-50">
                <div className="container mx-auto max-w-3xl h-20 flex items-center justify-end px-4 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.1)] border-t rounded-t-lg">
                    <Button size="lg" className="bg-orange-400 hover:bg-orange-500 text-white font-bold" disabled={cartItems.length === 0}>
                        Fazer pedido
                    </Button>
                </div>
            </div>
        </div>
    );
}
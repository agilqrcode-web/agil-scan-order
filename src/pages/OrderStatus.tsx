import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSupabase } from '@/contexts/SupabaseContext';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ShoppingCart, UtensilsCrossed } from 'lucide-react';

interface OrderItem {
  id: string;
  quantity: number;
  price_at_time: number;
  menu_items: {
    name: string;
    price: number;
  };
}

interface Order {
  id: string;
  customer_name: string;
  observations: string | null;
  status: string;
  total_amount: number;
  created_at: string;
  restaurant_tables: {
    table_number: number;
  };
  order_items: OrderItem[];
}

export default function OrderStatus() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const supabase = useSupabase();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrderDetails() {
      if (!orderId || !supabase) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Fetch order details from the API
        const response = await fetch(`/api/orders?orderId=${orderId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Falha ao buscar detalhes do pedido.');
        }
        const data = await response.json();
        // The API returns an array, but we expect a single order for a specific orderId
        if (data && data.length > 0) {
          setOrder(data[0]); // Assuming the API returns an array with one order
        } else {
          setError('Pedido não encontrado.');
        }
      } catch (err: any) {
        console.error('Erro ao buscar detalhes do pedido:', err);
        setError(err.message || 'Ocorreu um erro ao carregar o pedido.');
      } finally {
        setLoading(false);
      }
    }

    fetchOrderDetails();
  }, [orderId, supabase]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
        <Spinner size="large" />
        <p className="ml-4 text-lg text-gray-700">Carregando status do pedido...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 p-4 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Erro ao Carregar Pedido</h1>
        <p className="text-gray-700 mb-6">{error}</p>
        <Button onClick={() => navigate('/')}>Voltar para o Início</Button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 p-4 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Pedido Não Encontrado</h1>
        <p className="text-gray-700 mb-6">O ID do pedido fornecido não corresponde a nenhum pedido existente.</p>
        <Button onClick={() => navigate('/')}>Voltar para o Início</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto max-w-3xl bg-white shadow-lg rounded-lg p-6 sm:p-8">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-2xl font-bold text-gray-800 flex items-center">
            <ShoppingCart className="h-6 w-6 mr-3 text-primary" />
            Pedido mesa {order.restaurant_tables.table_number}
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Pedido realizado por <span className="font-semibold">{order.customer_name}</span> em {new Date(order.created_at).toLocaleString()}.
          </p>
          <Separator className="my-4" />
        </CardHeader>

        <CardContent className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Status Atual:</h2>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              order.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
              order.status === 'ready' ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {order.status === 'pending' && 'Pendente'}
              {order.status === 'preparing' && 'Em Preparação'}
              {order.status === 'ready' && 'Pronto para Retirada'}
              {order.status === 'finalized' && 'Finalizado'}
              {!['pending', 'preparing', 'ready', 'finalized'].includes(order.status) && order.status}
            </span>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Itens do Pedido:</h2>
            <ul className="divide-y divide-gray-200">
              {order.order_items.map(item => (
                <li key={item.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">{item.menu_items.name} (x{item.quantity})</p>
                    <p className="text-sm text-gray-600">R$ {item.price_at_time.toFixed(2).replace('.', ',')}</p>
                  </div>
                  <p className="font-semibold text-gray-900">R$ {(item.quantity * item.price_at_time).toFixed(2).replace('.', ',')}</p>
                </li>
              ))}
            </ul>
            <div className="border-t pt-3 mt-3 flex justify-between items-center font-bold text-lg text-gray-900">
              <span>Total:</span>
              <span>R$ {order.total_amount.toFixed(2).replace('.', ',')}</span>
            </div>
          </div>

          {order.observations && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-3">Observações:</h2>
              <p className="text-gray-700 bg-gray-50 p-3 rounded-md">{order.observations}</p>
            </div>
          )}

          <div className="text-center pt-6">
            <Button onClick={() => navigate(-1)} variant="outline">Voltar ao Cardápio</Button>
          </div>
        </CardContent>
      </div>
    </div>
  );
}

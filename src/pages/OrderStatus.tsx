import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ShoppingCart } from 'lucide-react';

// Interfaces para clareza
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
  table_id: string; // Adicionado para a busca em cadeia
  restaurant_tables: {
    table_number: number;
    restaurant_id: string;
  };
  order_items: OrderItem[];
}

export default function OrderStatus() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrderDetails() {
      if (!orderId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Passo 1: Buscar o pedido inicial para descobrir o ID da mesa
        const initialResponse = await fetch(`/api/orders?orderId=${orderId}`);
        if (!initialResponse.ok) {
          const errorData = await initialResponse.json();
          throw new Error(errorData.error || 'Falha ao buscar detalhes do pedido inicial.');
        }
        const initialData: Order[] = await initialResponse.json();
        
        if (!initialData || initialData.length === 0) {
          setError('Pedido não encontrado.');
          setLoading(false);
          return;
        }

        const tableId = initialData[0].table_id;

        // Passo 2: Buscar todos os pedidos para essa mesa
        const allOrdersResponse = await fetch(`/api/orders?tableId=${tableId}`);
        if (!allOrdersResponse.ok) {
            const errorData = await allOrdersResponse.json();
            throw new Error(errorData.error || 'Falha ao buscar todos os pedidos da mesa.');
        }
        const allOrdersData = await allOrdersResponse.json();
        setOrders(allOrdersData);

      } catch (err: any) {
        console.error('Erro ao buscar detalhes do pedido:', err);
        setError(err.message || 'Ocorreu um erro ao carregar o pedido.');
      } finally {
        setLoading(false);
      }
    }

    fetchOrderDetails();
  }, [orderId]);

  // Calcula os totais e informações consolidadas
  const { consolidatedItems, grandTotal, latestStatus, tableNumber, customerName } = useMemo(() => {
    if (orders.length === 0) {
      return { consolidatedItems: [], grandTotal: 0, latestStatus: '', tableNumber: null, customerName: '' };
    }

    const allItems = orders.flatMap(o => o.order_items);
    const grandTotal = orders.reduce((sum, o) => sum + o.total_amount, 0);
    const latestOrder = orders[orders.length - 1];

    return {
      consolidatedItems: allItems,
      grandTotal,
      latestStatus: latestOrder.status,
      tableNumber: latestOrder.restaurant_tables.table_number,
      customerName: latestOrder.customer_name, // Assumindo que o nome do cliente do último pedido é o principal
    };
  }, [orders]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
        <Spinner size="large" />
        <p className="ml-4 text-lg text-gray-700">Carregando conta da mesa...</p>
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

  if (orders.length === 0) {
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
            Conta da Mesa {tableNumber}
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Cliente: <span className="font-semibold">{customerName}</span>
          </p>
          <Separator className="my-4" />
        </CardHeader>

        <CardContent className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Status do Último Pedido:</h2>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              latestStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              latestStatus === 'preparing' ? 'bg-blue-100 text-blue-800' :
              latestStatus === 'ready' ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {latestStatus === 'pending' && 'Pendente'}
              {latestStatus === 'preparing' && 'Em Preparação'}
              {latestStatus === 'ready' && 'Pronto para Retirada'}
              {latestStatus === 'finalized' && 'Finalizado'}
              {!['pending', 'preparing', 'ready', 'finalized'].includes(latestStatus) && latestStatus}
            </span>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Itens Consumidos:</h2>
            <ul className="divide-y divide-gray-200">
              {consolidatedItems.map((item, index) => (
                <li key={`${item.id}-${index}`} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">{item.menu_items.name} (x{item.quantity})</p>
                    <p className="text-sm text-gray-600">R$ {item.price_at_time.toFixed(2).replace('.', ',')}</p>
                  </div>
                  <p className="font-semibold text-gray-900">R$ {(item.quantity * item.price_at_time).toFixed(2).replace('.', ',')}</p>
                </li>
              ))}
            </ul>
            <div className="border-t pt-3 mt-3 flex justify-between items-center font-bold text-lg text-gray-900">
              <span>Total da Mesa:</span>
              <span>R$ {grandTotal.toFixed(2).replace('.', ',')}</span>
            </div>
          </div>

          <div className="text-center pt-6">
            <Button onClick={() => navigate(-1)} variant="outline">Voltar ao Cardápio</Button>
          </div>
        </CardContent>
      </div>
    </div>
  );
}

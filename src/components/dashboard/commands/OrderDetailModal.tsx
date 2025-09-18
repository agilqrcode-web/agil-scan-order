import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Order } from "@/types/order";

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

const statusColors: { [key: string]: string } = {
  pending: "bg-yellow-100 text-yellow-800",
  preparing: "bg-blue-100 text-blue-800",
  ready: "bg-green-100 text-green-800",
  finalized: "bg-gray-100 text-gray-800",
};

const statusLabels: { [key: string]: string } = {
  pending: "Pendente",
  preparing: "Em Preparação",
  ready: "Pronto",
  finalized: "Finalizado",
};

export function OrderDetailModal({ isOpen, onClose, order }: OrderDetailModalProps) {
  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalhes do Pedido</DialogTitle>
          <DialogDescription>
            Pedido de <span className="font-semibold">{order.customer_name}</span> na Mesa <span className="font-semibold">{order.restaurant_tables.table_number}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge className={statusColors[order.status]}>{statusLabels[order.status]}</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Horário</span>
            <span>{new Date(order.created_at).toLocaleTimeString()}</span>
          </div>
          {order.observations && (
            <div className="flex flex-col space-y-1">
              <span className="text-sm text-muted-foreground">Observações</span>
              <p className="text-sm p-2 bg-secondary rounded-md">{order.observations}</p>
            </div>
          )}
          <Separator />
          <div>
            <h4 className="font-semibold mb-2">Itens do Pedido</h4>
            <ul className="space-y-2">
              {order.order_items.map(item => (
                <li key={item.id} className="flex justify-between items-center text-sm">
                  <div>
                    <span className="font-medium">{item.menu_items.name}</span>
                    <span className="text-muted-foreground"> (x{item.quantity})</span>
                  </div>
                  <span>R$ {(item.price_at_time * item.quantity).toFixed(2).replace('.', ',')}</span>
                </li>
              ))}
            </ul>
          </div>
          <Separator />
          <div className="flex justify-between items-center font-bold text-lg">
            <span>Total</span>
            <span>R$ {order.total_amount.toFixed(2).replace('.', ',')}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

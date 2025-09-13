import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MenuItem } from "@/hooks/usePublicMenu";
import { useCart } from "@/contexts/CartContext";
import { X } from "lucide-react";

interface MenuItemDetailModalProps {
  item: MenuItem;
  isOpen: boolean;
  onClose: () => void;
}

export function MenuItemDetailModal({ item, isOpen, onClose }: MenuItemDetailModalProps) {
  const { addToCart } = useCart();

  const handleAddToCart = () => {
    addToCart(item);
    onClose(); // Fecha o modal após adicionar
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0">
        <div className="relative">
          <img 
            src={item.image_url || '/placeholder.svg'} 
            alt={item.name} 
            className="w-full h-64 object-cover rounded-t-lg"
          />
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose} 
            className="absolute top-2 right-2 bg-black/50 hover:bg-black/75 text-white rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-6">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold mb-2">{item.name}</DialogTitle>
          </DialogHeader>
          {item.description && (
            <p className="text-base text-gray-600">
              {item.description}
            </p>
          )}
        </div>
        <DialogFooter className="p-6 pt-0">
          <div className="w-full flex justify-between items-center">
            <span className="text-2xl font-bold text-green-600">R$ {item.price.toFixed(2).replace('.', ',')}</span>
            <Button onClick={handleAddToCart} size="lg" className="bg-orange-400 hover:bg-orange-500 text-white font-bold">
              Adicionar ao pedido
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

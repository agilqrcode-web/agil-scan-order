import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

interface OrderFilterBarProps {
  // Futuras props para handlers de busca e filtro
}

export function OrderFilterBar(props: OrderFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por mesa ou cliente..." className="pl-9" />
      </div>
      <Select>
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="pending">Com Pendências</SelectItem>
          <SelectItem value="ready">Com Itens Prontos</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}


import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { QrCode, Settings, Eye, EyeOff } from "lucide-react";

const statusColors: { [key: string]: string } = {
  available: "bg-green-100 text-green-800",
  occupied: "bg-red-100 text-red-800",
  cleaning: "bg-yellow-100 text-yellow-800",
};

const statusLabels: { [key: string]: string } = {
  available: "Disponível",
  occupied: "Ocupada",
  cleaning: "Limpeza",
};

interface TableCardProps {
  table: any; // Consider defining a stricter type for the table object
  onShowQrCode: (table: { qr_code_identifier: string; table_number: number }) => void;
  onDelete: (tableId: string) => void;
}

export function TableCard({ table, onShowQrCode, onDelete }: TableCardProps) {
  const [isQrIdentifierVisible, setIsQrIdentifierVisible] = useState(false);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Mesa {table.table_number}</CardTitle>
          <Badge className={statusColors[table.status] || "bg-gray-100 text-gray-800"}>
            {statusLabels[table.status] || table.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Código: {isQrIdentifierVisible ? table.qr_code_identifier : '********'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsQrIdentifierVisible(!isQrIdentifierVisible)}
          >
            {isQrIdentifierVisible ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => onShowQrCode({ qr_code_identifier: table.qr_code_identifier, table_number: table.table_number })}
          >
            <QrCode className="mr-1 h-3 w-3" />
            QR Code
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Settings className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onDelete(table.id)}>
                Excluir Mesa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

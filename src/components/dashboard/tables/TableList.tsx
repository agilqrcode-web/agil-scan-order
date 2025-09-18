
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { TableCard } from "./TableCard";

interface TableListProps {
  tables: any[];
  loading: boolean;
  error: string | null;
  onShowQrCode: (table: { qr_code_identifier: string; table_number: number }) => void;
  onDelete: (tableId: string) => void;
}

export function TableList({ tables, loading, error, onShowQrCode, onDelete }: TableListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciar Mesas</CardTitle>
        <CardDescription>
          Visualize e gerencie todas as mesas do seu restaurante
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-4">
            <Input placeholder="Buscar mesa..." className="max-w-sm" />
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Baixar QR Codes
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <p className="text-muted-foreground col-span-3">Carregando mesas...</p>
            ) : error ? (
              <div className="text-red-500 text-sm col-span-3">{error}</div>
            ) : tables.length === 0 ? (
              <p className="text-muted-foreground col-span-3">Nenhuma mesa encontrada. Adicione uma nova mesa para começar!</p>
            ) : (
              tables.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  onShowQrCode={onShowQrCode}
                  onDelete={onDelete}
                />
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

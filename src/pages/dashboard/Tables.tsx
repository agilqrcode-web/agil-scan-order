import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, QrCode, Download, Settings } from "lucide-react";

const mockTables = [
  { id: 1, number: 1, qrCode: "QR001", status: "available", orders: 0 },
  { id: 2, number: 2, qrCode: "QR002", status: "occupied", orders: 2 },
  { id: 3, number: 3, qrCode: "QR003", status: "available", orders: 0 },
  { id: 4, number: 4, qrCode: "QR004", status: "cleaning", orders: 0 },
];

const statusColors = {
  available: "bg-green-100 text-green-800",
  occupied: "bg-red-100 text-red-800",
  cleaning: "bg-yellow-100 text-yellow-800"
};

const statusLabels = {
  available: "Disponível",
  occupied: "Ocupada",
  cleaning: "Limpeza"
};

export default function Tables() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Mesas</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Mesa
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Mesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockTables.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponíveis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {mockTables.filter(t => t.status === 'available').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ocupadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {mockTables.filter(t => t.status === 'occupied').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Limpeza</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {mockTables.filter(t => t.status === 'cleaning').length}
            </div>
          </CardContent>
        </Card>
      </div>

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
              {mockTables.map((table) => (
                <Card key={table.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Mesa {table.number}</CardTitle>
                      <Badge 
                        className={statusColors[table.status as keyof typeof statusColors]}
                      >
                        {statusLabels[table.status as keyof typeof statusLabels]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <QrCode className="h-4 w-4" />
                      <span className="text-sm text-muted-foreground">
                        Código: {table.qrCode}
                      </span>
                    </div>
                    
                    {table.orders > 0 && (
                      <p className="text-sm">
                        <strong>{table.orders}</strong> pedido(s) ativos
                      </p>
                    )}

                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1">
                        <QrCode className="mr-1 h-3 w-3" />
                        QR Code
                      </Button>
                      <Button size="sm" variant="outline">
                        <Settings className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
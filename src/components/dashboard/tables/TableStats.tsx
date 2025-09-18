
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface TableStatsProps {
  counts: {
    total_tables: number;
    available_tables: number;
    occupied_tables: number;
    cleaning_tables: number;
  };
  loading: boolean;
  error: string | null;
}

export function TableStats({ counts, loading, error }: TableStatsProps) {
  const stats = [
    { title: "Total de Mesas", key: "total_tables", color: "" },
    { title: "Disponíveis", key: "available_tables", color: "text-green-600" },
    { title: "Ocupadas", key: "occupied_tables", color: "text-red-600" },
    { title: "Em Limpeza", key: "cleaning_tables", color: "text-yellow-600" },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.key}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-1/2" />
            ) : error ? (
              <div className="text-red-500 text-sm">Erro</div>
            ) : (
              <div className={`text-2xl font-bold ${stat.color}`}>
                {counts[stat.key as keyof typeof counts]}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

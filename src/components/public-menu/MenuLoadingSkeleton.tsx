import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function MenuLoadingSkeleton() {
  return (
    <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-lg text-gray-600">Carregando cardápio...</p>
      <div className="w-full max-w-2xl mt-8 space-y-4">
        <Skeleton className="h-10 w-3/4 mx-auto" />
        <Skeleton className="h-6 w-1/2 mx-auto" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';

// Tipos inferidos da resposta da API e do componente original
export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
}

export interface Category {
  id: string;
  name: string;
  position: number;
  items: MenuItem[];
}

export interface Restaurant {
  name: string;
}

export interface Menu {
  id: string;
  name: string;
  banner_url: string | null;
}

export interface PublicMenuData {
  menu: Menu;
  restaurant: Restaurant;
  categories: Category[];
}

export function usePublicMenu() {
  const { menuId } = useParams<{ menuId: string }>();
  const [searchParams] = useSearchParams();
  const tableIdentifier = searchParams.get('table');

  const { data, isLoading, isError, error } = useQuery<PublicMenuData, Error>({
    queryKey: ['publicMenu', menuId],
    queryFn: async () => {
      if (!menuId) return null;
      const response = await fetch(`/api/menupublic/public?menuId=${menuId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch public menu data');
      }
      return response.json();
    },
    enabled: !!menuId, // Only run query if menuId is available
  });

  return { data, isLoading, isError, error, menuId, tableIdentifier };
}

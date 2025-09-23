import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { useCallback } from 'react';

// Tipos de dados que a API retorna
// (Poderiam ser movidos para um arquivo de tipos compartilhado)
export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category_id: string;
}

export interface Category {
  id: string;
  name: string;
  position: number;
  items: MenuItem[];
}

export interface Menu {
  id: string;
  name: string;
  banner_url?: string;
  is_active: boolean;
  restaurant_id: string;
}

export interface Restaurant {
  id: string;
  name: string;
  // ... outros campos do restaurante
}

export interface MenuEditorData {
  menu: Menu;
  restaurant: Restaurant;
  categories: Category[];
}

// O novo hook
export function useMenuEditor(menuId?: string) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  // Função genérica para requisições autenticadas
  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = await getToken();
    const headers = new Headers(options.headers);
    headers.append('Authorization', `Bearer ${token}`);
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }
    return response.json();
  }, [getToken]);

  // Query principal para buscar todos os dados do editor
  const { data, isLoading, isError, error } = useQuery<MenuEditorData, Error>({
    queryKey: ['menuEditorData', menuId],
    queryFn: async () => {
      console.log('[queryFn] INICIANDO. ID do Cardápio:', menuId);
      if (!menuId) {
        console.log('[queryFn] SEM ID de cardápio, retornando nulo.');
        return null;
      }
      try {
        const token = await getToken();
        const response = await fetch(`/api/menus?id=${menuId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        console.log(`[queryFn] Status da resposta da API: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[queryFn] Resposta da API não foi OK. Corpo:', errorText);
          throw new Error(`API respondeu com status ${response.status}: ${errorText}`);
        }

        const responseText = await response.text();
        console.log('[queryFn] Corpo da resposta (texto bruto):', responseText);

        if (!responseText) {
            console.warn('[queryFn] Corpo da resposta está vazio.');
            return null; // Retorna nulo se o corpo for vazio para evitar erro no parse
        }

        const jsonData = JSON.parse(responseText);
        console.log('[queryFn] JSON parseado com sucesso:', jsonData);
        return jsonData;

      } catch (e) {
        console.error('[queryFn] Erro catastrófico durante a execução:', e);
        throw e; // Re-lança o erro para o react-query tratar
      }
    },
    enabled: !!menuId, // A query só roda se o menuId existir
  });

  // Callback para invalidar a query principal após uma mutação
  const onMutationSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['menuEditorData', menuId] });
  };

  // Mutações
  const saveMenuMutation = useMutation({
    mutationFn: (menuData: Partial<Menu>) => fetchWithAuth('/api/menus', { 
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(menuData) 
    }),
    onSuccess: () => {
      // Invalida também a lista de menus na página principal de menus
      if (data?.menu.restaurant_id) {
        queryClient.invalidateQueries({ queryKey: ['menusPageData', data.menu.restaurant_id] });
      }
      onMutationSuccess();
    }
  });

  const saveCategoryOrderMutation = useMutation({
    mutationFn: (categories: {id: string, position: number}[]) => fetchWithAuth('/api/categories', { 
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ categories }) 
    }),
    onSuccess: onMutationSuccess
  });

  const saveCategoryMutation = useMutation({
    mutationFn: (category: Partial<Category>) => fetchWithAuth('/api/categories', { 
      method: category.id ? 'PUT' : 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(category) 
    }),
    onSuccess: onMutationSuccess
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryId: string) => fetchWithAuth('/api/categories', { 
      method: 'DELETE', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ id: categoryId }) 
    }),
    onSuccess: onMutationSuccess
  });

  const saveMenuItemMutation = useMutation({
    mutationFn: (item: Partial<MenuItem>) => fetchWithAuth('/api/menu-items', { 
      method: item.id ? 'PUT' : 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(item) 
    }),
    onSuccess: onMutationSuccess
  });

  const deleteMenuItemMutation = useMutation({
    mutationFn: (itemId: string) => fetchWithAuth('/api/menu-items', { 
      method: 'DELETE', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ id: itemId }) 
    }),
    onSuccess: onMutationSuccess
  });

  return {
    data,
    isLoading,
    isError,
    error,
    saveMenu: saveMenuMutation.mutateAsync,
    saveCategoryOrder: saveCategoryOrderMutation.mutateAsync,
    saveCategory: saveCategoryMutation.mutateAsync,
    deleteCategory: deleteCategoryMutation.mutateAsync,
    saveMenuItem: saveMenuItemMutation.mutateAsync,
    deleteMenuItem: deleteMenuItemMutation.mutateAsync,
  };
}

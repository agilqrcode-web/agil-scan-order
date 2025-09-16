// src/types/order.ts

export interface OrderItem {
  id: string;
  quantity: number;
  price_at_time: number;
  menu_items: {
    name: string;
    price: number;
  };
}

export interface Order {
  id: string;
  customer_name: string;
  observations: string | null;
  status: string;
  total_amount: number;
  created_at: string;
  table_id?: string; // Opcional, pois nem toda busca trará
  restaurant_tables: {
    table_number: number;
    restaurant_id: string;
  };
  order_items: OrderItem[];
}

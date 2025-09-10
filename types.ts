
export interface CupSize {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
}

export interface Topping {
  id: string;
  name: string;
  price: number;
  category: string;
}

export interface ToppingCategory {
  id: string;
  name: string;
}

export interface CartItem {
  id: string; // Unique ID for this specific cart item instance
  cup: CupSize;
  toppings: Topping[];
  basePrice: number;
  totalPrice: number;
  quantity: number;
}

export enum OrderStatus {
  PENDING = "Pendente",
  PREPARING = "Em Preparo",
  READY = "Pronto para Retirada",
  COMPLETED = "Finalizado",
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  timestamp: Date;
}

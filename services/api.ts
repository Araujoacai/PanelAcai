
import { CupSize, Topping, ToppingCategory, Order, OrderStatus, CartItem } from '../types';

const CUP_SIZES: CupSize[] = [
  { id: 'cup-1', name: 'Copo 300ml', description: 'O tamanho perfeito para um lanche rápido.', price: 12.00, imageUrl: 'https://picsum.photos/seed/acai1/400/300' },
  { id: 'cup-2', name: 'Copo 500ml', description: 'O mais pedido! Ideal para matar a vontade.', price: 16.00, imageUrl: 'https://picsum.photos/seed/acai2/400/300' },
  { id: 'cup-3', name: 'Copo 700ml', description: 'Para os verdadeiros amantes de açaí.', price: 20.00, imageUrl: 'https://picsum.photos/seed/acai3/400/300' },
  { id: 'cup-4', name: 'Barca de Açaí', description: 'Perfeita para compartilhar (ou não!).', price: 45.00, imageUrl: 'https://picsum.photos/seed/acai4/400/300' },
];

const TOPPING_CATEGORIES: ToppingCategory[] = [
  { id: 'cat-1', name: 'Frutas Frescas' },
  { id: 'cat-2', name: 'Cremes e Caldas' },
  { id: 'cat-3', name: 'Crocantes' },
  { id: 'cat-4', name: 'Extras' },
];

const TOPPINGS: Topping[] = [
  { id: 'top-1', name: 'Morango', price: 2.50, category: 'cat-1' },
  { id: 'top-2', name: 'Banana', price: 1.50, category: 'cat-1' },
  { id: 'top-3', name: 'Kiwi', price: 3.00, category: 'cat-1' },
  { id: 'top-4', name: 'Manga', price: 2.00, category: 'cat-1' },
  { id: 'top-5', name: 'Leite Condensado', price: 2.00, category: 'cat-2' },
  { id: 'top-6', name: 'Creme de Leite Ninho', price: 3.50, category: 'cat-2' },
  { id: 'top-7', name: 'Calda de Chocolate', price: 2.00, category: 'cat-2' },
  { id: 'top-8', name: 'Creme de Avelã', price: 4.00, category: 'cat-2' },
  { id: 'top-9', name: 'Granola', price: 2.00, category: 'cat-3' },
  { id: 'top-10', name: 'Paçoca', price: 1.50, category: 'cat-3' },
  { id: 'top-11', name: 'Flocos de Arroz', price: 1.50, category: 'cat-3' },
  { id: 'top-12', name: 'Amendoim', price: 1.50, category: 'cat-3' },
  { id: 'top-13', name: 'Leite em Pó', price: 2.00, category: 'cat-4' },
  { id: 'top-14', name: 'Gotas de Chocolate', price: 2.50, category: 'cat-4' },
  { id: 'top-15', name: 'Discos de Chocolate', price: 2.50, category: 'cat-4' },
];

const mockCartItem: CartItem = {
    id: 'ci-1',
    cup: CUP_SIZES[1],
    toppings: [TOPPINGS[0], TOPPINGS[5], TOPPINGS[8]],
    basePrice: 16.00,
    totalPrice: 16.00 + 2.50 + 3.50 + 2.00,
    quantity: 1,
};

let MOCK_ORDERS: Order[] = [
  { id: 'ord-1', items: [mockCartItem], total: 24.00, status: OrderStatus.PENDING, timestamp: new Date(Date.now() - 1000 * 60 * 5) },
  { id: 'ord-2', items: [mockCartItem, mockCartItem], total: 48.00, status: OrderStatus.PREPARING, timestamp: new Date(Date.now() - 1000 * 60 * 3) },
  { id: 'ord-3', items: [mockCartItem], total: 24.00, status: OrderStatus.READY, timestamp: new Date(Date.now() - 1000 * 60 * 1) },
  { id: 'ord-4', items: [mockCartItem], total: 24.00, status: OrderStatus.COMPLETED, timestamp: new Date(Date.now() - 1000 * 60 * 10) },
];


// Simulate API latency
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// This is where you would integrate Firebase SDK
export const api = {
  getCupSizes: async (): Promise<CupSize[]> => {
    await sleep(500);
    console.log('API: Fetched cup sizes');
    return CUP_SIZES;
  },
  getToppingCategories: async (): Promise<ToppingCategory[]> => {
    await sleep(500);
    console.log('API: Fetched topping categories');
    return TOPPING_CATEGORIES;
  },
  getToppings: async (): Promise<Topping[]> => {
    await sleep(500);
    console.log('API: Fetched toppings');
    return TOPPINGS;
  },
  getOrders: async (): Promise<Order[]> => {
    await sleep(1000);
    console.log('API: Fetched orders');
    return MOCK_ORDERS.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  },
  placeOrder: async (items: CartItem[], total: number): Promise<Order> => {
    await sleep(1500);
    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      items,
      total,
      status: OrderStatus.PENDING,
      timestamp: new Date(),
    };
    MOCK_ORDERS.push(newOrder);
    console.log('API: Placed new order', newOrder);
    return newOrder;
  },
  updateOrderStatus: async (orderId: string, status: OrderStatus): Promise<Order> => {
      await sleep(500);
      const orderIndex = MOCK_ORDERS.findIndex(o => o.id === orderId);
      if (orderIndex !== -1) {
          MOCK_ORDERS[orderIndex].status = status;
          console.log(`API: Updated order ${orderId} to status ${status}`);
          return MOCK_ORDERS[orderIndex];
      }
      throw new Error('Order not found');
  }
};

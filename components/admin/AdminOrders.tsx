
import React, { useState, useEffect, useCallback } from 'react';
import { Order, OrderStatus } from '../../types';
import { api } from '../../services/api';
import LoadingSpinner from '../shared/LoadingSpinner';

const getStatusColor = (status: OrderStatus) => {
    switch (status) {
        case OrderStatus.PENDING: return 'bg-yellow-100 text-yellow-800';
        case OrderStatus.PREPARING: return 'bg-blue-100 text-blue-800';
        case OrderStatus.READY: return 'bg-green-100 text-green-800';
        case OrderStatus.COMPLETED: return 'bg-gray-100 text-gray-800';
        default: return 'bg-gray-100';
    }
}

const OrderCard: React.FC<{ order: Order, onStatusChange: (id: string, status: OrderStatus) => void }> = ({ order, onStatusChange }) => {
    const nextStatusMap: Partial<Record<OrderStatus, OrderStatus>> = {
        [OrderStatus.PENDING]: OrderStatus.PREPARING,
        [OrderStatus.PREPARING]: OrderStatus.READY,
        [OrderStatus.READY]: OrderStatus.COMPLETED,
    };
    
    const nextStatus = nextStatusMap[order.status];

    return (
        <div className="bg-surface p-4 rounded-lg shadow-md mb-4">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-bold">Pedido #{order.id.slice(-5)}</h4>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusColor(order.status)}`}>{order.status}</span>
                </div>
                <div className="text-right">
                    <p className="font-bold text-lg text-primary">{order.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    <p className="text-xs text-text-secondary">{order.timestamp.toLocaleTimeString('pt-BR')}</p>
                </div>
            </div>
            <div className="mt-2 text-sm text-text-secondary">
                {order.items.map(item => `${item.cup.name}`).join(', ')}
            </div>
            {nextStatus && (
                <button 
                    onClick={() => onStatusChange(order.id, nextStatus)}
                    className="mt-4 w-full bg-primary text-white font-semibold py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm">
                    Mover para "{nextStatus}"
                </button>
            )}
        </div>
    );
}

const OrderColumn: React.FC<{ title: string, orders: Order[], onStatusChange: (id: string, status: OrderStatus) => void }> = ({ title, orders, onStatusChange }) => (
    <div className="bg-gray-100 rounded-xl p-4 w-full md:w-1/4 flex-shrink-0">
        <h3 className="font-bold text-primary-dark text-xl text-center pb-2 mb-4 border-b-2 border-primary-light">{title} ({orders.length})</h3>
        <div className="overflow-y-auto h-[calc(100vh-200px)] pr-2">
            {orders.map(order => <OrderCard key={order.id} order={order} onStatusChange={onStatusChange} />)}
        </div>
    </div>
);


const AdminOrders = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            const fetchedOrders = await api.getOrders();
            setOrders(fetchedOrders);
        } catch (error) {
            console.error("Failed to fetch orders:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);
    
    const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
        try {
            await api.updateOrderStatus(orderId, newStatus);
            fetchOrders(); // Refresh orders after update
        } catch (error) {
            console.error(`Failed to update order ${orderId}:`, error);
        }
    }

    if (isLoading) return <LoadingSpinner />;

    return (
        <div className="h-full flex flex-col">
            <h1 className="text-3xl font-bold text-primary-dark mb-6">Pedidos Atuais</h1>
            <div className="flex-grow flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
                <OrderColumn title="Pendentes" orders={orders.filter(o => o.status === OrderStatus.PENDING)} onStatusChange={handleStatusChange} />
                <OrderColumn title="Em Preparo" orders={orders.filter(o => o.status === OrderStatus.PREPARING)} onStatusChange={handleStatusChange} />
                <OrderColumn title="Prontos" orders={orders.filter(o => o.status === OrderStatus.READY)} onStatusChange={handleStatusChange} />
                <OrderColumn title="Finalizados" orders={orders.filter(o => o.status === OrderStatus.COMPLETED)} onStatusChange={handleStatusChange} />
            </div>
        </div>
    );
};

export default AdminOrders;

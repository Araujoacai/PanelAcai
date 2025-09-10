
import React from 'react';
import { useCart } from '../../context/CartContext';
import { api } from '../../services/api';

interface CartSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const CartSidebar: React.FC<CartSidebarProps> = ({ isOpen, onClose }) => {
    const { state, dispatch } = useCart();
    
    const totalCartPrice = state.items.reduce((total, item) => total + item.totalPrice * item.quantity, 0);

    const handlePlaceOrder = async () => {
        if (state.items.length === 0) return;
        try {
            await api.placeOrder(state.items, totalCartPrice);
            alert('Pedido realizado com sucesso!');
            dispatch({ type: 'CLEAR_CART' });
            onClose();
        } catch (error) {
            alert('Falha ao realizar o pedido. Tente novamente.');
        }
    };

    return (
        <>
            <div className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}></div>
            <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-surface shadow-2xl z-50 transform transition-transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex flex-col h-full">
                    <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-primary">Seu Pedido</h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="flex-grow overflow-y-auto p-6 space-y-4">
                        {state.items.length === 0 ? (
                            <div className="text-center text-text-secondary py-16">
                                <p>Seu carrinho está vazio.</p>
                                <p>Adicione um açaí para começar!</p>
                            </div>
                        ) : (
                            state.items.map(item => (
                                <div key={item.id} className="bg-background p-4 rounded-lg flex space-x-4">
                                    <img src={item.cup.imageUrl} alt={item.cup.name} className="w-24 h-24 object-cover rounded-md flex-shrink-0" />
                                    <div className="flex-grow">
                                        <h4 className="font-bold text-primary-dark">{item.cup.name}</h4>
                                        <div className="text-sm text-text-secondary">
                                            {item.toppings.map(t => t.name).join(', ') || 'Sem adicionais'}
                                        </div>
                                        <div className="flex justify-between items-center mt-2">
                                            <span className="font-bold text-lg text-secondary">
                                                {item.totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </span>
                                            <button onClick={() => dispatch({ type: 'REMOVE_ITEM', id: item.id })} className="text-red-500 hover:text-red-700">
                                                Remover
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    
                    {state.items.length > 0 && (
                        <div className="p-6 border-t border-gray-200 bg-gray-50">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-lg font-medium text-text-secondary">Subtotal</span>
                                <span className="text-xl font-bold text-primary-dark">
                                    {totalCartPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                            </div>
                            <button onClick={handlePlaceOrder} className="w-full bg-secondary text-white font-bold py-4 rounded-lg text-lg hover:opacity-90 transition-opacity shadow-lg">
                                Finalizar Pedido
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default CartSidebar;

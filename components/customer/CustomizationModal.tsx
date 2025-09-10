
import React, { useState, useMemo } from 'react';
import { CupSize, Topping, ToppingCategory, CartItem } from '../../types';
import { useCart } from '../../context/CartContext';

interface CustomizationModalProps {
  cup: CupSize;
  toppings: Topping[];
  toppingCategories: ToppingCategory[];
  onClose: () => void;
  onAddToCart: () => void;
}

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
);


const CustomizationModal: React.FC<CustomizationModalProps> = ({ cup, toppings, toppingCategories, onClose, onAddToCart }) => {
  const [selectedToppings, setSelectedToppings] = useState<Topping[]>([]);
  const { dispatch } = useCart();

  const handleToppingToggle = (topping: Topping) => {
    setSelectedToppings(prev =>
      prev.find(t => t.id === topping.id)
        ? prev.filter(t => t.id !== topping.id)
        : [...prev, topping]
    );
  };

  const totalPrice = useMemo(() => {
    return cup.price + selectedToppings.reduce((total, topping) => total + topping.price, 0);
  }, [cup.price, selectedToppings]);
  
  const handleAddToCartClick = () => {
    const newItem: CartItem = {
      id: `${cup.id}-${Date.now()}`,
      cup: cup,
      toppings: selectedToppings,
      basePrice: cup.price,
      totalPrice: totalPrice,
      quantity: 1
    };
    dispatch({ type: 'ADD_ITEM', item: newItem });
    onAddToCart();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-40 flex justify-center items-center" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-primary">Monte seu <span className="text-secondary">{cup.name}</span></h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col space-y-4">
                <img src={cup.imageUrl} alt={cup.name} className="w-full h-64 object-cover rounded-lg" />
                <div>
                    <h3 className="text-lg font-semibold text-primary-dark">Base</h3>
                    <p className="text-text-secondary">{cup.description}</p>
                    <p className="font-bold text-lg mt-1">{cup.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
            </div>
            <div className="flex flex-col space-y-4">
                {toppingCategories.map(category => (
                    <div key={category.id}>
                        <h4 className="text-lg font-semibold text-primary-dark border-b-2 border-primary-light pb-1 mb-2">{category.name}</h4>
                        <div className="space-y-2">
                            {toppings.filter(t => t.category === category.id).map(topping => {
                                const isSelected = selectedToppings.some(st => st.id === topping.id);
                                return (
                                    <div 
                                        key={topping.id}
                                        onClick={() => handleToppingToggle(topping)}
                                        className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition-all duration-200 ${isSelected ? 'bg-primary-light/20 border-primary' : 'bg-gray-100 hover:bg-gray-200 border-transparent'} border`}
                                    >
                                        <div className="flex items-center">
                                            <div className={`w-5 h-5 rounded-md border-2 ${isSelected ? 'bg-primary border-primary' : 'border-gray-300'} flex items-center justify-center mr-3`}>
                                                {isSelected && <CheckIcon />}
                                            </div>
                                            <span>{topping.name}</span>
                                        </div>
                                        <span className="font-medium text-text-secondary">
                                            + {topping.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
        
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex justify-between items-center">
            <div>
                <span className="text-text-secondary">Total:</span>
                <span className="text-3xl font-bold text-primary ml-2">
                    {totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
            </div>
          <button
            onClick={handleAddToCartClick}
            className="bg-secondary text-white font-bold py-3 px-8 rounded-lg text-lg hover:opacity-90 transition-opacity transform hover:scale-105 shadow-lg">
            Adicionar ao Carrinho
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomizationModal;

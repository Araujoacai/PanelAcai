
import React from 'react';
import { useCart } from '../../context/CartContext';

interface HeaderProps {
    onCartClick: () => void;
}

const ShoppingBagIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
);


const Header: React.FC<HeaderProps> = ({ onCartClick }) => {
    const { state } = useCart();
    const cartItemCount = state.items.reduce((total, item) => total + item.quantity, 0);

    return (
        <header className="bg-surface/80 backdrop-blur-lg sticky top-0 z-30 shadow-md">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    <h1 className="text-3xl font-brand text-primary">Açaí Paradise</h1>
                    <button onClick={onCartClick} className="relative text-primary hover:text-primary-dark transition-colors">
                        <ShoppingBagIcon />
                        {cartItemCount > 0 && (
                             <span className="absolute -top-2 -right-3 bg-secondary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                {cartItemCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;

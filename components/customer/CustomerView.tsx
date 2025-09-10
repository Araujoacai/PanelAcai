
import React, { useState, useEffect } from 'react';
import { CupSize, Topping, ToppingCategory } from '../../types';
import { api } from '../../services/api';
import Header from './Header';
import CustomizationModal from './CustomizationModal';
import CartSidebar from './CartSidebar';
import LoadingSpinner from '../shared/LoadingSpinner';

const CupSizeCard: React.FC<{ cup: CupSize, onSelect: (cup: CupSize) => void }> = ({ cup, onSelect }) => (
    <div className="bg-surface rounded-xl shadow-lg overflow-hidden transform hover:-translate-y-1 transition-transform duration-300 flex flex-col">
        <img src={cup.imageUrl} alt={cup.name} className="w-full h-48 object-cover" />
        <div className="p-6 flex flex-col flex-grow">
            <h3 className="text-xl font-bold text-primary">{cup.name}</h3>
            <p className="text-text-secondary mt-2 flex-grow">{cup.description}</p>
            <div className="mt-4 flex justify-between items-center">
                <span className="text-2xl font-bold text-secondary">
                    {cup.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                <button 
                    onClick={() => onSelect(cup)}
                    className="bg-primary text-white font-semibold py-2 px-4 rounded-lg hover:bg-primary-dark transition-colors shadow-md">
                    Montar
                </button>
            </div>
        </div>
    </div>
);


const CustomerView = () => {
    const [cupSizes, setCupSizes] = useState<CupSize[]>([]);
    const [toppings, setToppings] = useState<Topping[]>([]);
    const [toppingCategories, setToppingCategories] = useState<ToppingCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCup, setSelectedCup] = useState<CupSize | null>(null);
    const [isCartOpen, setIsCartOpen] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [cups, tops, cats] = await Promise.all([
                    api.getCupSizes(),
                    api.getToppings(),
                    api.getToppingCategories()
                ]);
                setCupSizes(cups);
                setToppings(tops);
                setToppingCategories(cats);
            } catch (error) {
                console.error("Failed to fetch data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleSelectCup = (cup: CupSize) => {
        setSelectedCup(cup);
    };

    const handleCloseModal = () => {
        setSelectedCup(null);
    };

    const handleAddToCart = () => {
        handleCloseModal();
        setIsCartOpen(true);
    }

    return (
        <div className="relative">
            <Header onCartClick={() => setIsCartOpen(true)} />

            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-bold text-primary-dark">Monte seu Açaí</h2>
                    <p className="text-lg text-text-secondary mt-2">Escolha o tamanho do copo e adicione seus acompanhamentos favoritos!</p>
                </div>
                {isLoading ? (
                    <LoadingSpinner />
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {cupSizes.map(cup => (
                            <CupSizeCard key={cup.id} cup={cup} onSelect={handleSelectCup} />
                        ))}
                    </div>
                )}
            </main>

            {selectedCup && (
                <CustomizationModal
                    cup={selectedCup}
                    toppings={toppings}
                    toppingCategories={toppingCategories}
                    onClose={handleCloseModal}
                    onAddToCart={handleAddToCart}
                />
            )}
            
            <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
        </div>
    );
};

export default CustomerView;


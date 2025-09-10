
import React, { useState, useEffect } from 'react';
import { CupSize, Topping } from '../../types';
import { api } from '../../services/api';
import LoadingSpinner from '../shared/LoadingSpinner';

const AdminMenu = () => {
  const [cupSizes, setCupSizes] = useState<CupSize[]>([]);
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [cups, tops] = await Promise.all([api.getCupSizes(), api.getToppings()]);
        setCupSizes(cups);
        setToppings(tops);
      } catch (error) {
        console.error("Failed to fetch menu data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleAction = (action: string, item: any) => {
      alert(`${action} item ${item.name}. This functionality would be implemented here.`);
  }

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary-dark">Gerenciar Cardápio</h1>
        <button className="bg-primary text-white font-semibold py-2 px-4 rounded-lg hover:bg-primary-dark transition-colors">
            Adicionar Novo Item
        </button>
      </div>

      <div className="bg-surface p-6 rounded-xl shadow-md mb-8">
        <h2 className="text-xl font-bold text-primary-dark mb-4">Tamanhos de Copo</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preço</th>
                <th className="py-3 px-6 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {cupSizes.map(cup => (
                <tr key={cup.id}>
                  <td className="py-4 px-6 whitespace-nowrap">{cup.name}</td>
                  <td className="py-4 px-6 whitespace-nowrap">{cup.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td className="py-4 px-6 whitespace-nowrap text-right space-x-2">
                    <button onClick={() => handleAction('Edit', cup)} className="text-primary hover:underline">Editar</button>
                    <button onClick={() => handleAction('Delete', cup)} className="text-red-600 hover:underline">Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="bg-surface p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-bold text-primary-dark mb-4">Acompanhamentos</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preço</th>
                <th className="py-3 px-6 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {toppings.map(topping => (
                <tr key={topping.id}>
                  <td className="py-4 px-6 whitespace-nowrap">{topping.name}</td>
                  <td className="py-4 px-6 whitespace-nowrap">{topping.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td className="py-4 px-6 whitespace-nowrap text-right space-x-2">
                    <button onClick={() => handleAction('Edit', topping)} className="text-primary hover:underline">Editar</button>
                    <button onClick={() => handleAction('Delete', topping)} className="text-red-600 hover:underline">Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminMenu;

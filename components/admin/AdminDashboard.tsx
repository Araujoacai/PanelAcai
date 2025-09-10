
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Seg', Vendas: 2400 },
  { name: 'Ter', Vendas: 1398 },
  { name: 'Qua', Vendas: 9800 },
  { name: 'Qui', Vendas: 3908 },
  { name: 'Sex', Vendas: 4800 },
  { name: 'Sáb', Vendas: 3800 },
  { name: 'Dom', Vendas: 4300 },
];

const StatCard: React.FC<{title: string, value: string, change: string}> = ({title, value, change}) => (
    <div className="bg-surface p-6 rounded-xl shadow-md">
        <h3 className="text-text-secondary">{title}</h3>
        <p className="text-3xl font-bold text-primary-dark mt-2">{value}</p>
        <p className="text-sm text-green-500 mt-1">{change}</p>
    </div>
);


const AdminDashboard = () => {
    return (
        <div>
            <h1 className="text-3xl font-bold text-primary-dark mb-6">Dashboard</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title="Vendas Hoje" value="R$ 1.250,00" change="+15% vs ontem" />
                <StatCard title="Pedidos Hoje" value="85" change="+5% vs ontem" />
                <StatCard title="Ticket Médio" value="R$ 14,70" change="-2% vs ontem" />
                <StatCard title="Novos Clientes" value="12" change="+3 vs ontem" />
            </div>

            <div className="bg-surface p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-primary-dark mb-4">Vendas da Semana</h2>
                 <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                        data={data}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                        <Legend />
                        <Bar dataKey="Vendas" fill="#8b5cf6" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default AdminDashboard;

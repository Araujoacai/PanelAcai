
import React from 'react';
import { Link, NavLink, Routes, Route, useNavigate } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';
import AdminMenu from './AdminMenu';
import AdminOrders from './AdminOrders';

const NavIcon: React.FC<{ name: string }> = ({ name }) => {
    const icons: { [key: string]: JSX.Element } = {
        dashboard: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
        menu: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>,
        orders: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
        logout: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
    };
    return icons[name] || null;
}

const AdminLayout = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        // Here you would handle actual logout logic
        console.log("Admin logged out");
        navigate('/');
    };
    
    const navLinkClasses = "flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors";
    const activeClass = "bg-primary-dark text-white font-semibold";
    const inactiveClass = "text-purple-100 hover:bg-primary-dark/50";

    return (
        <div className="flex h-screen bg-gray-100">
            <aside className="w-64 bg-primary text-white flex flex-col">
                <div className="p-6 text-center border-b border-primary-dark/50">
                    <h1 className="text-2xl font-brand text-white">Açaí Paradise</h1>
                    <span className="text-sm text-purple-200">Painel do Gestor</span>
                </div>
                <nav className="flex-grow p-4 space-y-2">
                    <NavLink to="/admin/dashboard" className={({isActive}) => `${navLinkClasses} ${isActive ? activeClass : inactiveClass}`}><NavIcon name="dashboard" /><span>Dashboard</span></NavLink>
                    <NavLink to="/admin/orders" className={({isActive}) => `${navLinkClasses} ${isActive ? activeClass : inactiveClass}`}><NavIcon name="orders" /><span>Pedidos</span></NavLink>
                    <NavLink to="/admin/menu" className={({isActive}) => `${navLinkClasses} ${isActive ? activeClass : inactiveClass}`}><NavIcon name="menu" /><span>Cardápio</span></NavLink>
                </nav>
                <div className="p-4 border-t border-primary-dark/50">
                    <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-purple-100 hover:bg-primary-dark/50 transition-colors">
                        <NavIcon name="logout" /><span>Sair</span>
                    </button>
                    <Link to="/" className="text-center text-sm text-purple-300 hover:text-white mt-4 block">Voltar para a loja</Link>
                </div>
            </aside>
            <main className="flex-1 overflow-y-auto p-8">
                <Routes>
                    <Route path="dashboard" element={<AdminDashboard />} />
                    <Route path="menu" element={<AdminMenu />} />
                    <Route path="orders" element={<AdminOrders />} />
                    <Route index element={<AdminDashboard />} />
                </Routes>
            </main>
        </div>
    );
};

export default AdminLayout;


import React from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import CustomerView from './components/customer/CustomerView';
import AdminLayout from './components/admin/AdminLayout';
import { CartProvider } from './context/CartContext';

function App() {
  return (
    <CartProvider>
      <HashRouter>
        <div className="bg-background min-h-screen text-text">
          <Routes>
            <Route path="/admin/*" element={<AdminLayout />} />
            <Route path="/*" element={<CustomerView />} />
          </Routes>
        </div>
      </HashRouter>
    </CartProvider>
  );
}

export default App;

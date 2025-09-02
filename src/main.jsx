import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App'
import AdminPanel from './components/AdminPanel'
import Login from './components/Login'
import './styles.css'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'

const Root = ()=>{
  const [user,setUser]=React.useState(null)
  const [loading,setLoading]=React.useState(true)
  React.useEffect(()=>{const unsub=onAuthStateChanged(auth,u=>{setUser(u);setLoading(false)});return ()=>unsub()},[])
  if(loading) return <div className="screen-center">Carregando...</div>
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App/>} />
        <Route path="/admin" element={user ? <AdminPanel/> : <Navigate to="/login" replace/>} />
        <Route path="/login" element={user ? <Navigate to="/admin" replace/> : <Login/>} />
        <Route path="*" element={<Navigate to="/" replace/>} />
      </Routes>
    </BrowserRouter>
  )
}
createRoot(document.getElementById('root')).render(<Root />)

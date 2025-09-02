export const formatBRL = (n) => (n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export const phoneDigits = s=>String(s||'').replace(/\D/g,'')
export const todayKey = ()=>{const d=new Date();const yyyy=d.getFullYear();const mm=String(d.getMonth()+1).padStart(2,'0');const dd=String(d.getDate()).padStart(2,'0');return `${yyyy}${mm}${dd}`}
export const readableOrderId=(counter, n)=>{const dd=counter.slice(6,8);const mm=counter.slice(4,6);return `${dd}${mm}-${String(n).padStart(3,'0')}`}

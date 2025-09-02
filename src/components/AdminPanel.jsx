import React from 'react'
import { auth, db } from '../firebase'
import { collection, addDoc, doc, onSnapshot, orderBy, query, setDoc, updateDoc, deleteDoc, serverTimestamp, getDocs } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { formatBRL } from '../utils/format'
import Papa from 'papaparse'

function useCollection(q){ const [data,setData]=React.useState([]); React.useEffect(()=>{ const unsub = onSnapshot(q, snap=> setData(snap.docs.map(d=>({id:d.id,...d.data()}))) ); return ()=>unsub() },[q]); return data }

export default function AdminPanel(){
  const produtos = useCollection(query(collection(db,'produtos'), orderBy('category'), orderBy('name')))
  const combos = useCollection(query(collection(db,'combos'), orderBy('name')))
  const vendas = useCollection(query(collection(db,'vendas'), orderBy('createdAt','desc')))
  const fluxo = useCollection(query(collection(db,'fluxoCaixa'), orderBy('createdAt','desc')))
  const [settings,setSettings]=React.useState({})
  React.useEffect(()=>{ const unsub = onSnapshot(docRef('configuracoes','horarios'), snap=> setSettings(snap.exists()?snap.data():{}) ); return ()=>unsub() },[])

  // theme
  const [theme,setTheme]=React.useState(localStorage.getItem('theme')||'dark')
  React.useEffect(()=>{ document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('theme', theme) },[theme])

  // product CRUD + ficha tecnica (recipe stored as array 'recipe': [{insumoId, qty}])
  const emptyProd = {name:'', price:0, cost:0, unit:'g', icon:'', category:'Fruta', active:true, recipe:[] }
  const [prodForm,setProdForm]=React.useState(emptyProd); const [editingProdId,setEditingProdId]=React.useState(null)
  const saveProd = async ()=>{ const data = {...prodForm, price:Number(prodForm.price)||0, cost:Number(prodForm.cost)||0, active:!!prodForm.active}; if(editingProdId) await updateDoc(doc(db,'produtos',editingProdId), data); else await addDoc(collection(db,'produtos'), data); setProdForm(emptyProd); setEditingProdId(null) }
  const editProd = p=>{ setProdForm(p); setEditingProdId(p.id) }
  const delProd = async p=>{ if(confirm('Excluir?')) await deleteDoc(doc(db,'produtos',p.id)) }

  // combos CRUD
  const emptyCombo = {name:'', price:0, description:'', image:'', active:true}
  const [comboForm,setComboForm]=React.useState(emptyCombo); const [editingComboId,setEditingComboId]=React.useState(null)
  const saveCombo = async ()=>{ const data = {...comboForm, price:Number(comboForm.price)||0, active:!!comboForm.active}; if(editingComboId) await updateDoc(doc(db,'combos',editingComboId), data); else await addDoc(collection(db,'combos'), data); setComboForm(emptyCombo); setEditingComboId(null) }
  const editCombo = c=>{ setComboForm(c); setEditingComboId(c.id) }
  const delCombo = async c=>{ if(confirm('Excluir?')) await deleteDoc(doc(db,'combos',c.id)) }

  // mark sale complete => add to fluxoCaixa
  const concluirVenda = async (v)=>{ await updateDoc(doc(db,'vendas',v.id), { status:'concluída', doneAt: serverTimestamp() }); await addDoc(collection(db,'fluxoCaixa'), { type:'entrada', amount: v.pricing?.total || v.combo?.price || 0, orderId: v.id, createdAt: serverTimestamp() }) }

  // export CSV
  const exportCSV = async (rows, filename='export.csv')=>{ const csv = Papa.unparse(rows); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url) }

  // sales report filter
  const [from,setFrom]=React.useState(''); const [to,setTo]=React.useState('')
  const filteredVendas = React.useMemo(()=>{
    const f = from? new Date(from+'T00:00:00') : null; const t = to? new Date(to+'T23:59:59') : null
    return vendas.filter(v=>{ const ts = v.createdAt?.toDate ? v.createdAt.toDate() : new Date(); if(f && ts < f) return false; if(t && ts > t) return false; return true })
  },[vendas,from,to])

  // compute cost & profit for a sale using ficha tecnica: for each sale size -> recipe is array of insumos with qty and we find cost per insumo from produtos collection
  const costOfSale = (sale)=>{
    if(sale.type !== 'acai') return 0
    const sizeId = sale.items?.size?.id
    const sizeProd = produtos.find(p=>p.id===sizeId)
    if(!sizeProd || !sizeProd.recipe) return 0
    let cost = 0
    for(const r of sizeProd.recipe){
      const ins = produtos.find(p=>p.id===r.insumoId)
      if(ins) cost += (ins.cost || 0) * (Number(r.qty) || 0)
    }
    return cost * (sale.items.qty || 1)
  }

  const salesRows = filteredVendas.map(v=>{
    const preco = v.pricing?.total || v.combo?.price || 0
    const custo = costOfSale(v)
    return { id: v.idReadable || v.id, tipo: v.type, cliente: v.customer?.name, telefone: v.customer?.phone, total: preco, custo, lucro: preco - custo, quando: v.createdAt?.toDate ? v.createdAt.toDate().toLocaleString('pt-BR') : '' }
  })

  return (
    <div>
      <header className="header"><div><img src="/favicon.svg" style={{width:28}} alt=""/> Painel Admin</div><div style={{display:'flex',gap:8}}><button className="btn" onClick={()=>setTheme(theme==='dark'?'light':'dark')}>Tema: {theme}</button><button className="btn" onClick={()=>signOut(auth)}>Logout</button></div></header>
      <div className="container">
        <div className="section"><h3>Produtos (CRUD & Ficha Técnica)</h3><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div>
            <label>Nome</label><input className="tag" value={prodForm.name} onChange={e=>setProdForm({...prodForm,name:e.target.value})}/>
            <label>Preço</label><input className="tag" type="number" value={prodForm.price} onChange={e=>setProdForm({...prodForm,price:e.target.value})}/>
            <label>Custo</label><input className="tag" type="number" value={prodForm.cost} onChange={e=>setProdForm({...prodForm,cost:e.target.value})}/>
            <label>Categoria</label><select className="tag" value={prodForm.category} onChange={e=>setProdForm({...prodForm,category:e.target.value})}><option>Tamanho</option><option>Fruta</option><option>Creme</option><option>Outro</option><option>Insumo</option></select>
            <label>Receita (apenas para Tamanho) — array de {`{insumoId, qty}`}</label><textarea className="tag" rows="3" value={JSON.stringify(prodForm.recipe||[])} onChange={e=>{ try{ setProdForm({...prodForm,recipe:JSON.parse(e.target.value)}) }catch{}}}></textarea>
            <div style={{marginTop:8}}><button className="btn" onClick={saveProd}>{editingProdId?'Salvar':'Adicionar'}</button>{editingProdId && <button className="btn" onClick={()=>{setProdForm(emptyProd); setEditingProdId(null)}}>Cancelar</button>}</div>
          </div>
          <div>
            <h4>Lista</h4>
            <table className="table"><thead><tr><th>Nome</th><th>Preço</th><th>Custo</th><th>Cat</th><th></th></tr></thead><tbody>{produtos.map(p=>(<tr key={p.id}><td>{p.name}</td><td>{formatBRL(p.price)}</td><td>{formatBRL(p.cost)}</td><td>{p.category}</td><td><button className="btn" onClick={()=>editProd(p)}>Editar</button><button className="btn" onClick={()=>delProd(p)}>Excluir</button></td></tr>))}</tbody></table>
          </div>
        </div></div>

        <div className="section"><h3>Combos</h3><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><label>Nome</label><input className="tag" value={comboForm.name} onChange={e=>setComboForm({...comboForm,name:e.target.value})}/><label>Preço</label><input className="tag" type="number" value={comboForm.price} onChange={e=>setComboForm({...comboForm,price:e.target.value})}/><label>Descrição</label><textarea className="tag" rows="2" value={comboForm.description} onChange={e=>setComboForm({...comboForm,description:e.target.value})}></textarea><label>Imagem (url)</label><input className="tag" value={comboForm.image} onChange={e=>setComboForm({...comboForm,image:e.target.value})}/><div style={{marginTop:8}}><button className="btn" onClick={saveCombo}>{editingComboId?'Salvar':'Adicionar'}</button></div></div>
          <div><h4>Lista</h4><table className="table"><thead><tr><th>Nome</th><th>Preço</th><th></th></tr></thead><tbody>{combos.map(c=>(<tr key={c.id}><td>{c.name}</td><td>{formatBRL(c.price)}</td><td><button className="btn" onClick={()=>editCombo(c)}>Editar</button><button className="btn" onClick={()=>delCombo(c)}>Excluir</button></td></tr>))}</tbody></table></div>
        </div></div>

        <div className="section"><h3>Vendas</h3><div style={{display:'flex',gap:8}}><label>De</label><input type="date" className="tag" value={from} onChange={e=>setFrom(e.target.value)}/><label>Até</label><input type="date" className="tag" value={to} onChange={e=>setTo(e.target.value)}/><button className="btn" onClick={()=>exportCSV(salesRows,'vendas.csv')}>Exportar CSV</button></div><div style={{marginTop:8}}><table className="table"><thead><tr><th>ID</th><th>Quando</th><th>Cliente</th><th>Total</th><th>Custo</th><th>Lucro</th><th>Status</th><th></th></tr></thead><tbody>{salesRows.map(r=>(<tr key={r.id}><td>{r.id}</td><td>{r.quando}</td><td>{r.cliente} <div className='small'>{r.telefone}</div></td><td>{formatBRL(r.total)}</td><td>{formatBRL(r.custo)}</td><td>{formatBRL(r.lucro)}</td><td>{vendas.find(v=> (v.idReadable||v.id)===r.id)?.status}</td><td><button className='btn' onClick={()=>concluirVenda(vendas.find(v=> (v.idReadable||v.id)===r.id))}>Concluir</button></td></tr>))}</tbody></table></div></div>

        <div className="section"><h3>Fluxo de Caixa</h3><div style={{display:'flex',gap:8}}><button className="btn" onClick={()=>exportCSV(fluxo,'fluxo.csv')}>Exportar CSV</button></div><div style={{marginTop:8}}><table className="table"><thead><tr><th>Quando</th><th>Tipo</th><th>Valor</th><th>Obs</th></tr></thead><tbody>{fluxo.map(f=>(<tr key={f.id}><td>{f.createdAt?.toDate?f.createdAt.toDate().toLocaleString('pt-BR') : ''}</td><td>{f.type}</td><td>{formatBRL(f.amount)}</td><td>{f.note}</td></tr>))}</tbody></table></div></div>

        <div className="section"><h3>Configurações</h3><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><div><label>WhatsApp (com DDI)</label><input className='tag' value={settings?.whatsapp||''} onChange={e=>setSettings({...settings, whatsapp:e.target.value})}/><label>Mensagem loja fechada</label><input className='tag' value={settings?.closedMessage||''} onChange={e=>setSettings({...settings, closedMessage:e.target.value})}/></div><div><label>Horários</label><textarea className='tag' rows='6' value={JSON.stringify(settings?.hours||{},null,2)} onChange={e=>{ try{ setSettings({...settings, hours:JSON.parse(e.target.value)}) }catch{}}}></textarea><div style={{marginTop:8}}><button className='btn' onClick={async ()=>{ await setDoc(docRef('configuracoes','horarios'), settings, {merge:true}); alert('Salvo') }}>Salvar</button></div></div></div></div>

      </div></div>
  )
}

// helper to get doc reference
function docRef(col, id){ return doc(db, col, id) }

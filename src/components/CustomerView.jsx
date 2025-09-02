import React from 'react'
import { db } from '../firebase'
import { collection, doc, onSnapshot, query, where, orderBy, runTransaction, serverTimestamp, addDoc } from 'firebase/firestore'
import { formatBRL, phoneDigits, todayKey, readableOrderId } from '../utils/format'

const EXTRA_PRICE = 3

export default function CustomerView(){
  const [combos,setCombos]=React.useState([])
  const [sizes,setSizes]=React.useState([])
  const [accomp,setAccomp]=React.useState({Fruta:[],Creme:[],Outro:[]})
  const [settings,setSettings]=React.useState(null)
  const [selectedSize,setSelectedSize]=React.useState(null)
  const [qty,setQty]=React.useState(1)
  const [onlyAcai,setOnlyAcai]=React.useState(false)
  const [selectedAccomp,setSelectedAccomp]=React.useState({})
  const [customer,setCustomer]=React.useState({name:'',phone:'',note:''})

  React.useEffect(()=>{
    const unsubSettings = onSnapshot(doc(db,'configuracoes','horarios'),snap=>setSettings(snap.exists()?snap.data():{}))
    const qCombos = query(collection(db,'combos'), where('active','==',true), orderBy('name'))
    const unsubCombos = onSnapshot(qCombos,snap=>setCombos(snap.docs.map(d=>({id:d.id,...d.data()}))))
    const qProducts = query(collection(db,'produtos'), where('active','==',true), orderBy('name'))
    const unsubProducts = onSnapshot(qProducts,snap=>{
      const all = snap.docs.map(d=>({id:d.id,...d.data()}))
      setSizes(all.filter(p=>p.category==='Tamanho').sort((a,b)=>a.price-b.price))
      setAccomp({Fruta:all.filter(p=>p.category==='Fruta'),Creme:all.filter(p=>p.category==='Creme'),Outro:all.filter(p=>p.category==='Outro')})
    })
    return ()=>{unsubSettings();unsubCombos();unsubProducts()}
  },[])

  const isOpen = React.useMemo(()=>{
    if(!settings || !settings.hours) return true
    const d = new Date(); const day = ['sun','mon','tue','wed','thu','fri','sat'][d.getDay()]
    const cfg = settings.hours[day]||{open:'00:00',close:'23:59',closed:false}
    if(cfg.closed) return false
    const [oh,om]=cfg.open.split(':').map(Number); const [ch,cm]=cfg.close.split(':').map(Number)
    const now = d.getHours()*60 + d.getMinutes(); const openMin = oh*60+om; const closeMin = ch*60+cm
    return now>=openMin && now<=closeMin
  },[settings])

  const accompList = React.useMemo(()=>Object.entries(selectedAccomp).map(([id,qty])=>({id,qty})),[selectedAccomp])
  const includedCount = onlyAcai ? 0 : Math.min(3, accompList.length)
  const extrasCount = Math.max(0, accompList.length - includedCount)
  const extrasCost = extrasCount * EXTRA_PRICE
  const basePrice = selectedSize ? (selectedSize.price||0) : 0
  const total = (basePrice + extrasCost) * qty

  const toggleAccomp = (item)=>{ setSelectedAccomp(prev=>{ const n={...prev}; if(n[item.id]) delete n[item.id]; else n[item.id]=1; return n }) }
  const setAccompQty = (item,newQty)=>{ setSelectedAccomp(prev=>({...prev,[item.id]:Math.max(1,Number(newQty)||1)})) }

  const handleSendOrder = async ()=>{
    if(!customer.name.trim()||!customer.phone.trim()||!selectedSize){ alert('Preencha nome, telefone e selecione um tamanho.'); return }
    const counterId = todayKey(); const counterRef = doc(db,'configuracoes','dailyCounter')
    // Transaction: increment or set counter object with date keys
    const orderReadable = await runTransaction(db, async (tx)=>{
      const snap = await tx.get(counterRef)
      const data = snap.exists()?snap.data():{}
      const today = counterId
      const current = (data[today]||0)
      const next = current+1
      tx.set(counterRef, {...data, [today]:next}, {merge:true})
      return readableOrderId(today, next)
    })
    const order = {
      idReadable: orderReadable,
      type: 'acai',
      createdAt: serverTimestamp(),
      status: 'pendente',
      customer: { name: customer.name.trim(), phone: phoneDigits(customer.phone), note: customer.note||'' },
      items: { size: { id: selectedSize.id, name: selectedSize.name, price: selectedSize.price }, accompaniments: accompList, onlyAcai, qty },
      pricing: { basePrice, includedCount, extrasCount, extrasCost, total }
    }
    // save to 'vendas'
    await addDoc(collection(db,'vendas'), order)
    const msg = [`*Pedido ${orderReadable}*`,`Nome: ${order.customer.name}`,`Telefone: ${order.customer.phone}`,`Tamanho: ${selectedSize.name}`,`Qtd: ${qty}`,`Somente Açaí: ${onlyAcai?'Sim':'Não'}`,`Acomp.: ${accompList.length} (Incluídos: ${includedCount} | Extras: ${extrasCount})`,`Total: ${formatBRL(total)}`, order.customer.note?`Obs.: ${order.customer.note}`:null].filter(Boolean).join('%0A')
    const phone = (settings?.whatsapp || '5599999999999').replace(/\D/g,'')
    window.open(`https://wa.me/${phone}?text=${msg}`,'_blank')
  }

  React.useEffect(()=>{ window.addOrder = async (o)=>{ await addDoc(collection(db,'vendas'), o) } },[])

  return (
    <div>
      <header className="header"><div>Açaí do Bairro</div><div>{isOpen?'Aberto ✅':'Fechado 🚫'}</div></header>
      <div className="container">
        {!isOpen && <div className="section"> {settings?.closedMessage || 'Fechado no momento.'} </div>}
        <div className="section"><h3>Combos</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>{combos.map(c=>(<div className="card" key={c.id}><img src={c.image} alt="" style={{width:'100%',height:140,objectFit:'cover'}}/><h4>{c.name}</h4><div>{c.description}</div><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}><div className="tag">{formatBRL(c.price)}</div><button className="btn" disabled={!isOpen} onClick={async ()=>{ if(!customer.name.trim()||!customer.phone.trim()){alert('Preencha nome e telefone antes.');return} const counterId=todayKey(); const counterRef=doc(db,'configuracoes','dailyCounter'); const orderReadable = await runTransaction(db, async (tx)=>{ const snap=await tx.get(counterRef); const data=snap.exists()?snap.data():{}; const today=counterId; const current=(data[today]||0); const next=current+1; tx.set(counterRef,{...data,[today]:next},{merge:true}); return readableOrderId(today,next) }); const order = { idReadable:orderReadable, type:'combo', createdAt:serverTimestamp(), status:'pendente', customer:{name:customer.name.trim(), phone:phoneDigits(customer.phone), note:customer.note||''}, combo:{id:c.id,name:c.name,price:c.price}, pricing:{total:c.price} }; await addDoc(collection(db,'vendas'), order); const msg = [`*Pedido ${orderReadable}*`,`Nome: ${order.customer.name}`,`Telefone: ${order.customer.phone}`,`Combo: ${c.name}`,`Total: ${formatBRL(c.price)}`, order.customer.note?`Obs.: ${order.customer.note}`:null].filter(Boolean).join('%0A'); const phone=(settings?.whatsapp||'5599999999999').replace(/\\D/g,''); window.open(`https://wa.me/${phone}?text=${msg}`,'_blank') }}>Pedir</button></div></div>))}</div></div>

        <div className="section"><h3>Monte seu Açaí</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 120px',gap:12}}>
            <div><label>Tamanhos</label><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>{sizes.map(s=>(<label key={s.id} className="tag"><input type="radio" name="size" onChange={()=>setSelectedSize(s)} checked={selectedSize?.id===s.id}/> {s.name} - {formatBRL(s.price)}</label>))}</div></div>
            <div><label>Quantidade</label><input type="number" min="1" value={qty} onChange={e=>setQty(Math.max(1,Number(e.target.value)||1))} className="tag"/></div>
          </div>

          <div style={{marginTop:12}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
              {['Fruta','Creme','Outro'].map(cat=>(<div key={cat}><h4>{cat}</h4>{accomp[cat].map(item=>(<div key={item.id} style={{border:'1px solid #222',padding:8,borderRadius:8,marginBottom:8}}><label><input type="checkbox" checked={!!selectedAccomp[item.id]} onChange={()=>toggleAccomp(item)}/> {item.name}</label>{selectedAccomp[item.id]&&(<div><label>Porções</label><input type="number" min="1" value={selectedAccomp[item.id]} onChange={e=>setAccompQty(item,e.target.value)} /></div>)}</div>))}</div>))}
            </div>
          </div>

          <div style={{display:'flex',gap:8,alignItems:'center',marginTop:12}}><label className="tag"><input type="checkbox" checked={onlyAcai} onChange={e=>setOnlyAcai(e.target.checked)} /> Somente Açaí</label><div className="tag">Incluídos: {includedCount}</div><div className="tag">Extras: {extrasCount} x {formatBRL(EXTRA_PRICE)} = {formatBRL(extrasCost)}</div><div style={{marginLeft:'auto',fontWeight:700}}>💰 Total: {formatBRL(total)}</div></div>
        </div>

        <div className="section"><h3>Seus dados</h3><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><input placeholder="Nome" className="tag" value={customer.name} onChange={e=>setCustomer({...customer,name:e.target.value})}/><input placeholder="Telefone" className="tag" value={customer.phone} onChange={e=>setCustomer({...customer,phone:e.target.value})}/></div><div style={{marginTop:8}}><textarea placeholder="Observações" className="tag" rows="3" value={customer.note} onChange={e=>setCustomer({...customer,note:e.target.value})}></textarea></div><div style={{marginTop:8,display:'flex',gap:8}}><button className="btn" disabled={!isOpen} onClick={handleSendOrder}>Enviar Pedido via WhatsApp</button>{!isOpen && <span>Pedidos desabilitados (loja fechada)</span>}</div></div>
      </div>
    </div>
  )
}

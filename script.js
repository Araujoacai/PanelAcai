import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { 
  getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, 
  serverTimestamp, query, where, orderBy, getDoc, setDoc, runTransaction 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Configuração Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCKZ-9QMY5ziW7uJIano6stDzHDKm8KqnE",
  authDomain: "salvapropagandas.firebaseapp.com",
  projectId: "salvapropagandas",
  storageBucket: "salvapropagandas.appspot.com",
  messagingSenderId: "285635693052",
  appId: "1:285635693052:web:260476698696d303be0a79"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Variáveis globais
let produtos = [];
let combos = [];
let precosBase = {};
let storeSettings = {};
let isStoreOpen = true;

const menuContainer = document.getElementById('menu-container');
const adminPanel = document.getElementById('admin-panel');
const whatsappBar = document.getElementById('whatsapp-bar');
const adminLoginBtn = document.getElementById('admin-login-button');
const adminLogoutBtn = document.getElementById('admin-logout-button');
const modalContainer = document.getElementById('modal-container');
const sendOrderBtnMobile = document.getElementById('send-order-button-mobile');
const sendOrderBtnDesktop = document.getElementById('send-order-button-desktop');

// ----------- Modal ----------- //
function showModal(content, onOpen = () => {}) {
  let modalContent = content;
  if (typeof content === 'string') {
    modalContent = `<p class="text-lg text-gray-800 mb-6">${content}</p>
    <button onclick="window.closeModal()" 
      class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-8 rounded-lg">OK</button>`;
  }
  modalContainer.innerHTML = `<div class="bg-white rounded-2xl p-6 w-full max-w-md text-center shadow-xl 
      transform transition-all scale-95 opacity-0" id="modal-box">${modalContent}</div>`;
  modalContainer.classList.remove('hidden');
  setTimeout(() => { 
    document.getElementById('modal-box').classList.remove('scale-95', 'opacity-0'); 
    onOpen(); 
  }, 10);
}
function closeModal() {
  const modalBox = document.getElementById('modal-box');
  if (modalBox) {
    modalBox.classList.add('scale-95', 'opacity-0');
    setTimeout(() => { modalContainer.classList.add('hidden'); modalContainer.innerHTML = ''; }, 200);
  }
}
window.closeModal = closeModal;

// ----------- Menu ----------- //
function renderMenu() {
  const containers = { 
    tamanho: document.getElementById('tamanhos-container'), 
    fruta: document.getElementById('frutas-container'), 
    creme: document.getElementById('cremes-container'), 
    outro: document.getElementById('outros-container') 
  };
  Object.values(containers).forEach(c => c.innerHTML = '');
  precosBase = {};

  const produtosVisiveis = produtos.filter(p => p.category !== 'insumo' && p.isActive !== false);
  if (produtosVisiveis.length === 0) {
    Object.values(containers).forEach(c => 
      c.innerHTML = '<p class="text-red-500 text-sm col-span-2">Nenhum item disponível.</p>'
    );
    return;
  }

  produtosVisiveis.forEach(p => {
    const pId = p.name.replace(/[^a-zA-Z0-9]/g, '');
    if (p.category === 'tamanho') {
      precosBase[p.name] = p.price;
      containers.tamanho.innerHTML += `
        <label class="flex items-center justify-between bg-purple-100 px-4 py-3 rounded-2xl shadow cursor-pointer hover:bg-purple-200 transition">
          <div><span class="font-medium text-gray-800">${p.name}</span>
          <span class="ml-3 text-sm text-gray-600">R$${p.price.toFixed(2)}</span></div>
          <input type="radio" name="tamanho" value="${p.name}" class="accent-pink-500">
        </label>`;
    } else {
      const bgColor = p.category === 'fruta' ? 'bg-pink-100 hover:bg-pink-200' 
                   : p.category === 'creme' ? 'bg-purple-100 hover:bg-purple-200' 
                   : 'bg-violet-200 hover:bg-violet-300';
      const accentColor = p.category === 'fruta' ? 'accent-purple-600' : 'accent-pink-600';
      if (containers[p.category]) { 
        containers[p.category].innerHTML += `
        <label class="flex items-center ${bgColor} px-3 py-2 rounded-xl shadow cursor-pointer">
          <img src="${p.iconUrl}" alt="${p.name}" class="card-img flex-shrink-0" onerror="this.style.display='none'">
          <input type="checkbox" value="${p.name}" data-qty-target="qty-${pId}" 
            class="acompanhamento-check mx-2 ${accentColor} flex-shrink-0">
          <span class="flex-grow truncate">${p.name}</span>
          <input type="number" value="1" min="1" id="qty-${pId}" 
            class="acompanhamento-qty w-14 text-center border rounded-md hidden p-1 ml-2">
        </label>`;
      }
    }
  });

  document.querySelectorAll('.acompanhamento-check').forEach(check => {
    check.addEventListener('change', (e) => {
      const qtyInput = document.getElementById(e.target.dataset.qtyTarget);
      if (e.target.checked) { qtyInput.classList.remove('hidden'); qtyInput.value = 1; } 
      else { qtyInput.classList.add('hidden'); }
      calcularValor();
    });
  });
  document.querySelectorAll('input, textarea').forEach(el => { 
    el.addEventListener("change", calcularValor); 
    el.addEventListener("input", calcularValor); 
  });
  document.getElementById('apenas-acai-check').addEventListener('change', calcularValor);
}

function renderCombosMenu() {
  const container = document.getElementById('combos-container');
  const section = document.getElementById('combos-section');
  container.innerHTML = '';
  const combosAtivos = combos.filter(c => c.isActive !== false);
  if(combosAtivos.length === 0) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');

  combosAtivos.forEach(combo => {
    container.innerHTML += `
      <div class="bg-gradient-to-br from-purple-100 to-pink-100 p-4 rounded-2xl shadow-md flex flex-col">
        <img src="${combo.imageUrl || 'https://placehold.co/600x400/f3e8ff/9333ea?text=Combo'}" 
          alt="${combo.name}" class="w-full h-32 object-cover rounded-lg mb-3">
        <h4 class="text-lg font-bold text-purple-800">${combo.name}</h4>
        <p class="text-sm text-gray-600 flex-grow">${combo.description}</p>
        <div class="flex justify-between items-center mt-3">
          <span class="text-xl font-bold text-green-600">R$${(combo.price || 0).toFixed(2).replace('.', ',')}</span>
          <button onclick="window.pedirCombo('${combo.id}')" 
            class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg">Pedir</button>
        </div>
      </div>`;
  });
}

// ----------- Cálculo ----------- //
function calcularValor() {
  const tamanhoEl = document.querySelector('input[name="tamanho"]:checked');
  const apenasAcai = document.getElementById('apenas-acai-check').checked;
  const rulesText = document.getElementById('acompanhamentos-rules');
  let totalText = "R$0,00";

  if (tamanhoEl) {
    const tamanho = tamanhoEl.value;
    const quantidade = parseInt(document.getElementById("quantidade").value) || 0;
    let totalPorcoes = 0;
    document.querySelectorAll('.acompanhamento-check:checked').forEach(check => {
      const qtyInput = document.getElementById(check.dataset.qtyTarget);
      totalPorcoes += parseInt(qtyInput.value) || 0;
    });

    let precoBase = precosBase[tamanho] || 0;
    let adicionais = 0;
    if (apenasAcai) {
      adicionais = totalPorcoes * 3;
      rulesText.textContent = 'Todos os acompanhamentos são cobrados como extra (R$3 cada).';
    } else {
      adicionais = totalPorcoes > 3 ? (totalPorcoes - 3) * 3 : 0;
      rulesText.textContent = '3 porções por copo | Adicional R$3 por porção extra';
    }

    let total = (precoBase + adicionais) * quantidade;
    totalText = "R$" + total.toFixed(2).replace(".", ",");
  }
  document.getElementById("valor-mobile").innerText = totalText;
  document.getElementById("valor-desktop").innerText = totalText;
}

// ----------- Reset ----------- //
function resetarFormulario() {
  document.querySelectorAll('input[name="tamanho"]:checked').forEach(el => el.checked = false);
  document.querySelectorAll('.acompanhamento-check:checked').forEach(el => {
    el.checked = false;
    const qtyInput = document.getElementById(el.dataset.qtyTarget);
    if (qtyInput) qtyInput.classList.add('hidden');
  });
  document.getElementById('quantidade').value = 1;
  document.getElementById('nome-cliente').value = '';
  document.getElementById('telefone-cliente').value = '';
  document.getElementById('observacoes').value = '';
  document.getElementById('apenas-acai-check').checked = false;
  calcularValor();
}

// ----------- Pedido ----------- //
function handleOrderAction() {
  if (isStoreOpen) { enviarPedido(); } 
  else { showModal(storeSettings.mensagemFechado || "Desculpe, estamos fechados."); }
}
sendOrderBtnMobile.addEventListener('click', handleOrderAction);
sendOrderBtnDesktop.addEventListener('click', handleOrderAction);

async function enviarPedido() {
  if (!isStoreOpen) return;
  const tamanhoEl = document.querySelector('input[name="tamanho"]:checked');
  if (!tamanhoEl) { showModal("Por favor, selecione o tamanho do copo!"); return; }
  const quantidade = document.getElementById("quantidade").value;
  if (quantidade < 1) { showModal("Por favor, informe a quantidade!"); return; }
  const nomeCliente = document.getElementById('nome-cliente').value.trim();
  if (!nomeCliente) { showModal("Por favor, digite seu nome!"); return; }
  const telefoneCliente = document.getElementById('telefone-cliente').value.trim();
  if (!telefoneCliente) { showModal("Por favor, digite seu telefone!"); return; }

  const acompanhamentosSelecionados = [];
  document.querySelectorAll('.acompanhamento-check:checked').forEach(check => {
    const nome = check.value;
    const qtyInput = document.getElementById(check.dataset.qtyTarget);
    const qty = qtyInput.value;
    acompanhamentosSelecionados.push({ name: nome, quantity: parseInt(qty) });
  });

  const apenasAcai = document.getElementById('apenas-acai-check').checked;
  if (!apenasAcai && acompanhamentosSelecionados.length === 0) { 
    showModal("Selecione ao menos 1 acompanhamento ou marque 'Somente Açaí'."); return; 
  }
  
  const observacoes = document.getElementById("observacoes").value;
  const valor = document.getElementById("valor-mobile").innerText;

  const counterRef = doc(db, "configuracoes", "dailyCounter");
  let orderId;
  try {
    orderId = await runTransaction(db, async (transaction) => {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;
      const displayDate = `${dd}${mm}`;
      const counterDoc = await transaction.get(counterRef);
      let newCount = 1;
      if (counterDoc.exists() && counterDoc.data().lastOrderDate === todayStr) {
        newCount = counterDoc.data().lastOrderNumber + 1;
      }
      transaction.set(counterRef, { lastOrderNumber: newCount, lastOrderDate: todayStr });
      const paddedCount = String(newCount).padStart(3, '0');
      return `${displayDate}-${paddedCount}`;
    });
  } catch (e) {
    console.error("Transaction failed: ", e);
    showModal("Não foi possível gerar o ID do pedido. Tente novamente.");
    return;
  }

  const numero = storeSettings.whatsappNumber || "5514991962607";
  const acompanhamentosText = acompanhamentosSelecionados.map(a => `${a.name} (x${a.quantity})`).join("\n- ");
  const msg = `*Novo Pedido: ${orderId}*\n\n*Cliente:* ${nomeCliente}\n*Telefone:* ${telefoneCliente}\n\nOlá! Quero pedir ${quantidade} copo(s) de açaí ${tamanhoEl.value}.\n\n*Acompanhamentos:*\n- ${acompanhamentosSelecionados.length > 0 ? acompanhamentosText : 'Nenhum (Somente Açaí)'}\n\n📝 *Observações:* ${observacoes || "Nenhuma"}\n\n💰 *Valor Total: ${valor}*`;

  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, "_blank");

  try { 
    await addDoc(collection(db, "vendas"), { 
      orderId, nomeCliente, telefoneCliente, tamanho: tamanhoEl.value, 
      quantidade: parseInt(quantidade), acompanhamentos: acompanhamentosSelecionados, 
      observacoes: observacoes || "Nenhuma", total: valor, status: "pendente", 
      timestamp: serverTimestamp() 
    }); 
    showModal("Pedido enviado com sucesso! Obrigado.");
    resetarFormulario();
  } catch (e) { 
    console.error("Erro ao salvar venda: ", e); 
    showModal("Erro ao salvar no sistema, mas você pode enviá-lo pelo WhatsApp."); 
  }
}

window.pedirCombo = async (comboId) => {
  if (!isStoreOpen) {
    showModal(storeSettings.mensagemFechado || "Desculpe, estamos fechados no momento.");
    return;
  }
  const combo = combos.find(c => c.id === comboId);
  if (!combo) return;

  const nomeCliente = document.getElementById('nome-cliente').value.trim();
  if (!nomeCliente) { showModal("Preencha seu nome no formulário principal antes de pedir um combo!"); return; }
  const telefoneCliente = document.getElementById('telefone-cliente').value.trim();
  if (!telefoneCliente) { showModal("Preencha seu telefone antes de pedir um combo!"); return; }

  const counterRef = doc(db, "configuracoes", "dailyCounter");
  let orderId;
  try {
    orderId = await runTransaction(db, async (transaction) => {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;
      const displayDate = `${dd}${mm}`;
      const counterDoc = await transaction.get(counterRef);
      let newCount = 1;
      if (counterDoc.exists() && counterDoc.data().lastOrderDate === todayStr) {
        newCount = counterDoc.data().lastOrderNumber + 1;
      }
      transaction.set(counterRef, { lastOrderNumber: newCount, lastOrderDate: todayStr });
      const paddedCount = String(newCount).padStart(3, '0');
      return `${displayDate}-${paddedCount}`;
    });
  } catch (e) {
    console.error("Transaction failed: ", e);
    showModal("Não foi possível gerar o ID do pedido.");
    return;
  }

  const numero = storeSettings.whatsappNumber || "5514991962607";
  const valor = `R$${(combo.price || 0).toFixed(2).replace('.', ',')}`;
  const msg = `*Pedido de Combo: ${orderId}*\n\n*Cliente:* ${nomeCliente}\n*Telefone:* ${telefoneCliente}\n\nOlá! Gostaria de pedir o *${combo.name}*.\n\n*Descrição:* ${combo.description || ''}\n\n💰 *Valor Total: ${valor}*`;

  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, "_blank");

  try {
    await addDoc(collection(db, "vendas"), {
      orderId, nomeCliente, telefoneCliente, pedidoCombo: combo.name, 
      observacoes: combo.description || "", total: valor, status: "pendente", 
      timestamp: serverTimestamp(), tamanho: "", quantidade: 1, acompanhamentos: []
    });
    showModal("Pedido do combo enviado com sucesso!");
  } catch (e) {
    console.error("Erro ao salvar combo: ", e);
    showModal("Erro ao salvar no sistema, mas você pode enviar pelo WhatsApp.");
  }
};
// ------ Troca de Tema ------
const themeSelect = document.getElementById('theme-select');
if (themeSelect) {
  // Carregar tema salvo
  const savedTheme = localStorage.getItem('selectedTheme') || 'theme-default';
  document.body.classList.add(savedTheme);
  themeSelect.value = savedTheme;

  themeSelect.addEventListener('change', () => {
    document.body.classList.remove('theme-default', 'theme-blue', 'theme-green', 'theme-dark');
    document.body.classList.add(themeSelect.value);
    localStorage.setItem('selectedTheme', themeSelect.value);
  });
}

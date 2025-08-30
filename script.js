import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, where, orderBy, getDoc, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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

let produtos = [];
let combos = [];
let precosBase = {};
let unsubscribeVendas;
let unsubscribeFluxoCaixa;
let storeSettings = {};
let isStoreOpen = true;
let initialVendasLoadComplete = false;

// Copos
let coposSelecionados = [];

const menuContainer = document.getElementById('menu-container');
const adminPanel = document.getElementById('admin-panel');
const whatsappBar = document.getElementById('whatsapp-bar');
const adminLoginBtn = document.getElementById('admin-login-button');
const adminLogoutBtn = document.getElementById('admin-logout-button');
const modalContainer = document.getElementById('modal-container');
const sendOrderBtnMobile = document.getElementById('send-order-button-mobile');
const sendOrderBtnDesktop = document.getElementById('send-order-button-desktop');

function showModal(content, onOpen = () => {}) {
  let modalContent = content;
  if (typeof content === 'string') {
    modalContent = `<p class="text-lg text-gray-800 mb-6">${content}</p><button onclick="window.closeModal()" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-8 rounded-lg transition-colors">OK</button>`;
  }
  modalContainer.innerHTML = `<div class="bg-white rounded-2xl p-6 w-full max-w-md text-center shadow-xl transform transition-all scale-95 opacity-0" id="modal-box">${modalContent}</div>`;
  modalContainer.classList.remove('hidden');
  setTimeout(() => { document.getElementById('modal-box').classList.remove('scale-95', 'opacity-0'); onOpen(); }, 10);
}
function closeModal() {
  const modalBox = document.getElementById('modal-box');
  if (modalBox) {
    modalBox.classList.add('scale-95', 'opacity-0');
    setTimeout(() => { modalContainer.classList.add('hidden'); modalContainer.innerHTML = ''; }, 200);
  }
}
window.closeModal = closeModal;

// 🔑 Login Admin
onAuthStateChanged(auth, user => {
  if (user) {
    adminLoginBtn.classList.add('hidden');
    adminLogoutBtn.classList.remove('hidden');
    menuContainer.classList.add('hidden');
    whatsappBar.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    renderAdminPanel();
  } else {
    adminLoginBtn.classList.remove('hidden');
    adminLogoutBtn.classList.add('hidden');
    menuContainer.classList.remove('hidden');
    whatsappBar.classList.remove('hidden');
    adminPanel.classList.add('hidden');
    if (unsubscribeVendas) unsubscribeVendas();
    if (unsubscribeFluxoCaixa) unsubscribeFluxoCaixa();
    initialVendasLoadComplete = false;
  }
});
adminLoginBtn.addEventListener('click', () => {
  const loginFormHTML = `<h3 class="text-xl font-bold mb-4">Login Admin</h3><input type="email" id="email" placeholder="Email" class="w-full p-2 border rounded mb-2"><input type="password" id="password" placeholder="Senha" class="w-full p-2 border rounded mb-4"><button id="login-submit" class="bg-purple-600 text-white px-6 py-2 rounded-lg">Entrar</button><button onclick="window.closeModal()" class="bg-gray-300 px-4 py-2 rounded-lg ml-2">Cancelar</button>`;
  showModal(loginFormHTML, () => {
    document.getElementById('login-submit').addEventListener('click', async () => {
      try {
        await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
        closeModal();
      } catch (error) {
        console.error("Erro de login:", error);
        alert("Email ou senha inválidos.");
      }
    });
  });
});
adminLogoutBtn.addEventListener('click', () => signOut(auth));

/* ===================================================
   NOVO SISTEMA DE COPOS
=================================================== */

function renderCoposSelecionados() {
  const container = document.getElementById("copos-container");
  container.innerHTML = "";
  if (coposSelecionados.length === 0) {
    container.innerHTML = `<p class="text-gray-500">Nenhum copo adicionado.</p>`;
    calcularValor();
    return;
  }
  coposSelecionados.forEach((copo, index) => {
    const acompList = copo.acompanhamentos.map(a => `${a.name} (x${a.quantity})`).join(", ") || "Somente Açaí";
    container.innerHTML += `
      <div class="bg-purple-50 border border-purple-200 rounded-lg p-3 flex justify-between items-start">
        <div>
          <p class="font-semibold text-purple-700">${copo.tamanho}</p>
          <small class="text-gray-600">${acompList}</small>
        </div>
        <div class="flex gap-2">
          <button onclick="editarCopo(${index})" class="text-blue-600">✏️</button>
          <button onclick="removerCopo(${index})" class="text-red-600">❌</button>
        </div>
      </div>`;
  });
  calcularValor();
}
document.getElementById("add-copo-btn").addEventListener("click", () => abrirModalCopo());

function abrirModalCopo(copoExistente = null, index = null) {
  let conteudo = `
    <h3 class="text-xl font-bold mb-4">${copoExistente ? "Editar Copo" : "Adicionar Copo"}</h3>
    <div class="mb-4"><h4 class="font-semibold text-purple-700 mb-2">🥤 Tamanho</h4><div id="modal-tamanhos" class="flex flex-col gap-2"></div></div>
    <div><h4 class="font-semibold text-purple-700 mb-2">➕ Acompanhamentos</h4><div id="modal-acompanhamentos" class="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto"></div></div>
    <button id="salvar-copo-btn" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg mt-4">Salvar Copo</button>`;
  showModal(conteudo, () => {
    // Render tamanhos
    const containerT = document.getElementById("modal-tamanhos");
    const tamanhos = produtos.filter(p => p.category === "tamanho" && p.isActive !== false);
    tamanhos.forEach(t => {
      containerT.innerHTML += `
        <label class="flex items-center justify-between bg-purple-100 px-3 py-2 rounded-lg cursor-pointer">
          <span>${t.name} - R$${t.price.toFixed(2)}</span>
          <input type="radio" name="modal-tamanho" value="${t.name}" class="accent-pink-500">
        </label>`;
    });
    // Render acompanhamentos
    const containerA = document.getElementById("modal-acompanhamentos");
    const acoes = produtos.filter(p => ["fruta","creme","outro"].includes(p.category) && p.isActive !== false);
    acoes.forEach(a => {
      const safeId = a.name.replace(/[^a-zA-Z0-9]/g, '');
      containerA.innerHTML += `
        <label class="flex items-center bg-pink-50 px-2 py-1 rounded-lg cursor-pointer">
          <input type="checkbox" id="chk-${safeId}" value="${a.name}" class="mr-2 accent-purple-600">
          <span class="flex-grow">${a.name}</span>
          <input type="number" id="qty-${safeId}" value="1" min="1" class="hidden w-14 text-center border rounded-md p-1 ml-2">
        </label>`;
    });
    containerA.querySelectorAll("input[type=checkbox]").forEach(chk => {
      chk.addEventListener("change", e => {
        const qtyInput = document.getElementById("qty-" + e.target.id.replace("chk-",""));
        if (e.target.checked) qtyInput.classList.remove("hidden"); else qtyInput.classList.add("hidden");
      });
    });
    // Se edição
    if (copoExistente) {
      const radio = document.querySelector(`input[name=modal-tamanho][value="${copoExistente.tamanho}"]`);
      if (radio) radio.checked = true;
      copoExistente.acompanhamentos.forEach(a => {
        const safeId = a.name.replace(/[^a-zA-Z0-9]/g, '');
        const chk = document.getElementById("chk-" + safeId);
        const qty = document.getElementById("qty-" + safeId);
        if (chk && qty) { chk.checked = true; qty.classList.remove("hidden"); qty.value = a.quantity; }
      });
    }
    // Salvar
    document.getElementById("salvar-copo-btn").addEventListener("click", () => {
      const tamanhoSel = document.querySelector("input[name=modal-tamanho]:checked");
      if (!tamanhoSel) { alert("Selecione o tamanho!"); return; }
      const acomp = [];
      containerA.querySelectorAll("input[type=checkbox]:checked").forEach(chk => {
        const safeId = chk.id.replace("chk-","");
        const qty = document.getElementById("qty-" + safeId).value;
        acomp.push({ name: chk.value, quantity: parseInt(qty) });
      });
      const novoCopo = { tamanho: tamanhoSel.value, acompanhamentos: acomp };
      if (index !== null) coposSelecionados[index] = novoCopo;
      else coposSelecionados.push(novoCopo);
      closeModal(); renderCoposSelecionados();
    });
  });
}
window.editarCopo = (i) => abrirModalCopo(coposSelecionados[i], i);
window.removerCopo = (i) => { coposSelecionados.splice(i,1); renderCoposSelecionados(); };

function calcularValor() {
  let total = 0;
  coposSelecionados.forEach(copo => {
    let precoBase = precosBase[copo.tamanho] || 0;
    let totalPorcoes = copo.acompanhamentos.reduce((sum, a) => sum + a.quantity, 0);
    let adicionais = totalPorcoes > 3 ? (totalPorcoes - 3) * 3 : 0;
    total += precoBase + adicionais;
  });
  let totalText = "R$" + total.toFixed(2).replace(".", ",");
  document.getElementById("valor-mobile").innerText = totalText;
  document.getElementById("valor-desktop").innerText = totalText;
}

async function enviarPedido() {
  if (coposSelecionados.length === 0) { showModal("Adicione ao menos 1 copo ao pedido!"); return; }
  const nomeCliente = document.getElementById('nome-cliente').value.trim();
  const telefoneCliente = document.getElementById('telefone-cliente').value.trim();
  const observacoes = document.getElementById('observacoes').value;
  let itensTexto = coposSelecionados.map((copo, i) => {
    let a = copo.acompanhamentos.map(x => `${x.name} (x${x.quantity})`).join(", ") || "Somente Açaí";
    return `Copo ${i+1}: ${copo.tamanho}\n   - ${a}`;
  }).join("\n\n");
  const valor = document.getElementById("valor-mobile").innerText;
  const msg = `*Novo Pedido*\n\nCliente: ${nomeCliente}\nTelefone: ${telefoneCliente}\n\n${itensTexto}\n\nObs: ${observacoes || "Nenhuma"}\n\n💰 Total: ${valor}`;
  window.open(`https://wa.me/${storeSettings.whatsappNumber || "5514991962607"}?text=${encodeURIComponent(msg)}`, "_blank");
  await addDoc(collection(db, "vendas"), { nomeCliente, telefoneCliente, copos: coposSelecionados, observacoes, total: valor, status: "pendente", timestamp: serverTimestamp() });
  showModal("Pedido enviado com sucesso!");
  coposSelecionados = []; renderCoposSelecionados();
}
sendOrderBtnMobile.addEventListener('click', enviarPedido);
sendOrderBtnDesktop.addEventListener('click', enviarPedido);

/* ===================================================
   RESTANTE DO SCRIPT (admin, combos, relatório, etc.)
   >>> AQUI mantém igual ao seu original, só altere renderVendasAdmin:
=================================================== */

function renderVendasAdmin() {
  document.getElementById('content-vendas').innerHTML = `
    <div class="bg-white p-6 rounded-2xl shadow-lg">
      <h3 class="text-2xl font-semibold mb-4 text-purple-700">Relatório de Vendas</h3>
      <div class="overflow-x-auto"><table class="w-full text-left">
        <thead class="bg-gray-100"><tr><th class="p-3">ID</th><th class="p-3">Data/Hora</th><th class="p-3">Cliente</th><th class="p-3">Pedido</th><th class="p-3">Total</th><th class="p-3">Status</th></tr></thead>
        <tbody id="vendas-table-body"></tbody>
      </table></div>
    </div>`;
  carregarVendasAdmin();
}

function carregarVendasAdmin() {
  const tableBody = document.getElementById('vendas-table-body');
  if (unsubscribeVendas) unsubscribeVendas();
  unsubscribeVendas = onSnapshot(query(collection(db, "vendas"), orderBy("timestamp","desc")), snapshot => {
    tableBody.innerHTML = "";
    snapshot.docs.forEach(docSnap => {
      const venda = { id: docSnap.id, ...docSnap.data() };
      const data = venda.timestamp ? new Date(venda.timestamp.seconds * 1000).toLocaleString('pt-BR') : 'N/A';
      let pedidoHTML = "";
      if (venda.copos) {
        pedidoHTML = venda.copos.map((c,i)=>`${c.tamanho}<br><small>${(c.acompanhamentos||[]).map(a=>`${a.name}(x${a.quantity})`).join(", ")}</small>`).join("<hr>");
      }
      tableBody.innerHTML += `
        <tr class="border-b">
          <td class="p-3">${venda.id}</td>
          <td class="p-3">${data}</td>
          <td class="p-3">${venda.nomeCliente}</td>
          <td class="p-3">${pedidoHTML}</td>
          <td class="p-3">${venda.total}</td>
          <td class="p-3">${venda.status}</td>
        </tr>`;
    });
  });
}

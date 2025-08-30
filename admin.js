// admin.js (Módulo ADMIN)

// ---------------- Firebase ----------------
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp,
  query, where, orderBy, onSnapshot, getDoc, setDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// — use o mesmo config do script.js —
const firebaseConfig = {
  apiKey: "AIzaSyCKZ-9QMY5ziW7uJIano6stDzHDKm8KqnE",
  authDomain: "salvapropagandas.firebaseapp.com",
  projectId: "salvapropagandas",
  storageBucket: "salvapropagandas.appspot.com",
  messagingSenderId: "285635693052",
  appId: "1:285635693052:web:260476698696d303be0a79"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------------- Elementos base ----------------
const adminPanel = document.getElementById("admin-panel");
const menuContainer = document.getElementById("menu-container");
const adminLoginBtn = document.getElementById("admin-login-button");
const adminLogoutBtn = document.getElementById("admin-logout-button");
const modalContainer = document.getElementById("modal-container");
const toastContainer = document.getElementById("toast-container");

// ---------------- Util ----------------
function toast(msg, type = "success") {
  const id = "t" + Math.random().toString(36).slice(2);
  const base = document.createElement("div");
  base.id = id;
  base.className = `toast-notification mt-2 relative top-[-100px] bg-white shadow-xl rounded-xl px-4 py-3 border
    ${type === "error" ? "border-red-300" : type === "warn" ? "border-yellow-300" : "border-green-300"}`;
  base.innerHTML = `<div class="flex items-start gap-2">
    <span>${type === "error" ? "❌" : type === "warn" ? "⚠️" : "✅"}</span>
    <div class="text-sm text-gray-800">${msg}</div>
  </div>`;
  toastContainer.appendChild(base);
  setTimeout(() => base.remove(), 4000);
}

function showModalAdmin(contentHtml) {
  modalContainer.innerHTML = `
    <div class="bg-white rounded-2xl p-6 w-full max-w-lg text-left shadow-xl transform transition-all scale-95 opacity-0" id="admin-modal">
      ${contentHtml}
    </div>`;
  modalContainer.classList.remove("hidden");
  setTimeout(() => {
    const b = document.getElementById("admin-modal");
    if (b) { b.classList.remove("scale-95","opacity-0"); }
  }, 10);
}
function closeModalAdmin() {
  const b = document.getElementById("admin-modal");
  if (b) {
    b.classList.add("scale-95","opacity-0");
    setTimeout(() => { modalContainer.classList.add("hidden"); modalContainer.innerHTML = ""; }, 180);
  }
}
window.closeModalAdmin = closeModalAdmin;

// ---------------- Estado ----------------
let unsubProdutos = null;
let unsubCombos = null;
let unsubVendas = null;

const CATEGORIAS = ["tamanho","fruta","creme","outro","insumo"];
const STATUS_VENDA = ["pendente","em_preparo","pronto","entregue","cancelado"];

// ---------------- Layout Painel ----------------
function renderAdminLayout() {
  adminPanel.innerHTML = `
    <div class="bg-white/95 border border-purple-200 rounded-3xl p-4 md:p-6 shadow-2xl">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-2xl font-extrabold text-purple-800">Painel Administrativo</h2>
        <div class="flex gap-2">
          <button id="btn-tab-produtos" class="px-3 py-2 rounded-xl border hover:bg-purple-50">Produtos</button>
          <button id="btn-tab-combos" class="px-3 py-2 rounded-xl border hover:bg-purple-50">Combos</button>
          <button id="btn-tab-vendas" class="px-3 py-2 rounded-xl border hover:bg-purple-50">Vendas</button>
          <button id="btn-tab-caixa" class="px-3 py-2 rounded-xl border hover:bg-purple-50">Caixa</button>
          <button id="btn-tab-config" class="px-3 py-2 rounded-xl border hover:bg-purple-50">Configurações</button>
        </div>
      </div>
      <div id="admin-content" class="mt-4"></div>
    </div>
  `;

  document.getElementById("btn-tab-produtos").onclick = showProdutos;
  document.getElementById("btn-tab-combos").onclick = showCombos;
  document.getElementById("btn-tab-vendas").onclick = showVendas;
  document.getElementById("btn-tab-caixa").onclick = showCaixa;
  document.getElementById("btn-tab-config").onclick = showConfig;

  // Abre Produtos por padrão
  showProdutos();
}

// ---------------- Login ----------------
function openLoginModal() {
  showModalAdmin(`
    <h3 class="text-xl font-bold mb-4">Login do Administrador</h3>
    <div class="grid gap-3">
      <input id="admin-email" type="email" placeholder="E-mail" class="border p-3 rounded-xl">
      <input id="admin-pass" type="password" placeholder="Senha" class="border p-3 rounded-xl">
      <div class="flex justify-end gap-2 mt-2">
        <button class="px-4 py-2 rounded-xl border" onclick="window.closeModalAdmin()">Cancelar</button>
        <button id="do-login" class="px-4 py-2 rounded-xl bg-purple-600 text-white font-semibold">Entrar</button>
      </div>
    </div>
  `);
  document.getElementById("do-login").onclick = async () => {
    const email = document.getElementById("admin-email").value.trim();
    const pass = document.getElementById("admin-pass").value.trim();
    if (!email || !pass) { toast("Informe e-mail e senha.", "warn"); return; }
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      toast("Login realizado!");
      closeModalAdmin();
    } catch (e) {
      console.error(e);
      toast("Falha no login. Verifique as credenciais.", "error");
    }
  };
}

adminLoginBtn?.addEventListener("click", openLoginModal);
adminLogoutBtn?.addEventListener("click", async () => {
  try { await signOut(auth); toast("Sessão encerrada."); } 
  catch (e) { toast("Erro ao sair.", "error"); }
});

// ---------------- Auth State ----------------
onAuthStateChanged(auth, (user) => {
  const autenticado = !!user;
  if (autenticado) {
    adminLoginBtn?.classList.add("hidden");
    adminLogoutBtn?.classList.remove("hidden");
    menuContainer?.classList.add("hidden");
    adminPanel?.classList.remove("hidden");
    renderAdminLayout();
  } else {
    // limpa listeners
    unsubProdutos?.(); unsubProdutos = null;
    unsubCombos?.(); unsubCombos = null;
    unsubVendas?.(); unsubVendas = null;

    adminLogoutBtn?.classList.add("hidden");
    adminLoginBtn?.classList.remove("hidden");
    adminPanel?.classList.add("hidden");
    menuContainer?.classList.remove("hidden");
    adminPanel.innerHTML = "";
  }
});

// ===================================================================
//                              PRODUTOS
// ===================================================================
function showProdutos() {
  const content = document.getElementById("admin-content");
  content.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-xl font-bold text-purple-700">Produtos</h3>
      <button id="btn-novo-produto" class="bg-purple-600 text-white px-4 py-2 rounded-xl">+ Novo</button>
    </div>
    <div class="overflow-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left border-b">
            <th class="py-2">Nome</th>
            <th class="py-2">Categoria</th>
            <th class="py-2">Preço</th>
            <th class="py-2">Ativo</th>
            <th class="py-2">Ícone</th>
            <th class="py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody id="produtos-tbody"></tbody>
      </table>
    </div>
  `;
  document.getElementById("btn-novo-produto").onclick = () => openProdutoForm();

  const col = collection(db, "produtos");
  const qy = query(col, orderBy("category"), orderBy("name"));
  unsubProdutos?.();
  unsubProdutos = onSnapshot(qy, (snap) => {
    const tbody = document.getElementById("produtos-tbody");
    tbody.innerHTML = "";
    snap.forEach((d) => {
      const p = d.data(); p.id = d.id;
      tbody.innerHTML += `
        <tr class="border-b">
          <td class="py-2">${p.name || "-"}</td>
          <td class="py-2">${p.category || "-"}</td>
          <td class="py-2">${typeof p.price === "number" ? "R$"+p.price.toFixed(2).replace(".",",") : "-"}</td>
          <td class="py-2">${p.isActive !== false ? "Sim" : "Não"}</td>
          <td class="py-2"><a class="text-purple-600 underline break-all" href="${p.iconUrl || "#"}" target="_blank">${p.iconUrl ? "abrir" : "-"}</a></td>
          <td class="py-2 text-right">
            <button class="px-2 py-1 rounded-md border mr-2" data-edit="${p.id}">Editar</button>
            <button class="px-2 py-1 rounded-md border text-red-600" data-del="${p.id}">Excluir</button>
          </td>
        </tr>
      `;
    });

    tbody.querySelectorAll("[data-edit]").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-edit");
        const docRef = doc(db, "produtos", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) openProdutoForm({ id, ...docSnap.data() });
      };
    });
    tbody.querySelectorAll("[data-del]").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-del");
        showModalAdmin(`
          <h4 class="text-lg font-bold mb-3">Excluir produto?</h4>
          <p class="text-sm text-gray-600 mb-4">Essa ação não pode ser desfeita.</p>
          <div class="flex justify-end gap-2">
            <button class="px-4 py-2 rounded-xl border" onclick="window.closeModalAdmin()">Cancelar</button>
            <button id="conf-del-prod" class="px-4 py-2 rounded-xl bg-red-600 text-white">Excluir</button>
          </div>
        `);
        document.getElementById("conf-del-prod").onclick = async () => {
          try { await deleteDoc(doc(db,"produtos",id)); toast("Produto excluído."); closeModalAdmin(); }
          catch (e) { console.error(e); toast("Erro ao excluir.", "error"); }
        };
      };
    });
  });
}

function openProdutoForm(prod = {}) {
  const isEdit = !!prod.id;
  showModalAdmin(`
    <h4 class="text-lg font-bold mb-4">${isEdit ? "Editar" : "Novo"} Produto</h4>
    <div class="grid gap-3">
      <input id="p-nome" class="border p-3 rounded-xl" placeholder="Nome" value="${prod.name || ""}">
      <select id="p-cat" class="border p-3 rounded-xl">
        ${CATEGORIAS.map(c=>`<option ${prod.category===c?"selected":""} value="${c}">${c}</option>`).join("")}
      </select>
      <input id="p-preco" type="number" step="0.01" min="0" class="border p-3 rounded-xl" placeholder="Preço (use 0 para itens sem preço)" value="${typeof prod.price==="number"?prod.price:""}">
      <input id="p-icon" class="border p-3 rounded-xl" placeholder="URL do ícone" value="${prod.iconUrl || ""}">
      <label class="flex items-center gap-2">
        <input id="p-ativo" type="checkbox" class="w-5 h-5 accent-purple-600" ${prod.isActive!==false?"checked":""}>
        <span>Ativo</span>
      </label>
      <div class="flex justify-end gap-2 mt-2">
        <button class="px-4 py-2 rounded-xl border" onclick="window.closeModalAdmin()">Cancelar</button>
        <button id="save-prod" class="px-4 py-2 rounded-xl bg-purple-600 text-white">${isEdit?"Salvar":"Criar"}</button>
      </div>
    </div>
  `);

  document.getElementById("save-prod").onclick = async () => {
    const name = document.getElementById("p-nome").value.trim();
    const category = document.getElementById("p-cat").value;
    const priceVal = document.getElementById("p-preco").value;
    const price = priceVal === "" ? 0 : Number(priceVal);
    const iconUrl = document.getElementById("p-icon").value.trim();
    const isActive = document.getElementById("p-ativo").checked;

    if (!name) { toast("Informe o nome do produto.","warn"); return; }
    if (!CATEGORIAS.includes(category)) { toast("Categoria inválida.","error"); return; }
    if (Number.isNaN(price) || price < 0) { toast("Preço inválido.","error"); return; }

    const payload = { name, category, price, iconUrl, isActive, updatedAt: serverTimestamp() };
    try {
      if (isEdit) {
        await updateDoc(doc(db,"produtos",prod.id), payload);
        toast("Produto atualizado.");
      } else {
        await addDoc(collection(db,"produtos"), { ...payload, createdAt: serverTimestamp() });
        toast("Produto criado.");
      }
      closeModalAdmin();
    } catch(e) {
      console.error(e); toast("Erro ao salvar produto.","error");
    }
  };
}

// ===================================================================
//                               COMBOS
// ===================================================================
function showCombos() {
  const content = document.getElementById("admin-content");
  content.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-xl font-bold text-purple-700">Combos</h3>
      <button id="btn-novo-combo" class="bg-purple-600 text-white px-4 py-2 rounded-xl">+ Novo</button>
    </div>
    <div class="grid md:grid-cols-2 gap-3" id="combos-grid"></div>
  `;
  document.getElementById("btn-novo-combo").onclick = () => openComboForm();

  const col = collection(db, "combos");
  const qy = query(col, orderBy("name"));
  unsubCombos?.();
  unsubCombos = onSnapshot(qy, (snap) => {
    const grid = document.getElementById("combos-grid");
    grid.innerHTML = "";
    snap.forEach(d => {
      const c = d.data(); c.id = d.id;
      grid.innerHTML += `
        <div class="border rounded-2xl p-3 flex gap-3">
          <img src="${c.imageUrl || "https://placehold.co/160x100/f3e8ff/9333ea?text=Combo"}" class="w-36 h-24 object-cover rounded-lg" />
          <div class="flex-1">
            <div class="font-bold">${c.name || "-"}</div>
            <div class="text-sm text-gray-600 line-clamp-2">${c.description || ""}</div>
            <div class="mt-1 text-green-700 font-semibold">${typeof c.price === "number" ? "R$"+c.price.toFixed(2).replace(".",",") : "-"}</div>
            <div class="text-sm mt-1">Ativo: ${c.isActive!==false?"Sim":"Não"}</div>
            <div class="flex justify-end gap-2 mt-2">
              <button class="px-2 py-1 rounded-md border" data-edit="${c.id}">Editar</button>
              <button class="px-2 py-1 rounded-md border text-red-600" data-del="${c.id}">Excluir</button>
            </div>
          </div>
        </div>
      `;
    });

    grid.querySelectorAll("[data-edit]").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-edit");
        const ref = doc(db,"combos",id);
        const s = await getDoc(ref);
        if (s.exists()) openComboForm({ id, ...s.data() });
      };
    });
    grid.querySelectorAll("[data-del]").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-del");
        showModalAdmin(`
          <h4 class="text-lg font-bold mb-3">Excluir combo?</h4>
          <p class="text-sm text-gray-600 mb-4">Essa ação não pode ser desfeita.</p>
          <div class="flex justify-end gap-2">
            <button class="px-4 py-2 rounded-xl border" onclick="window.closeModalAdmin()">Cancelar</button>
            <button id="conf-del-combo" class="px-4 py-2 rounded-xl bg-red-600 text-white">Excluir</button>
          </div>
        `);
        document.getElementById("conf-del-combo").onclick = async () => {
          try { await deleteDoc(doc(db,"combos",id)); toast("Combo excluído."); closeModalAdmin(); }
          catch(e){ console.error(e); toast("Erro ao excluir combo.","error"); }
        };
      };
    });
  });
}

function openComboForm(combo = {}) {
  const isEdit = !!combo.id;
  showModalAdmin(`
    <h4 class="text-lg font-bold mb-4">${isEdit?"Editar":"Novo"} Combo</h4>
    <div class="grid gap-3">
      <input id="c-nome" class="border p-3 rounded-xl" placeholder="Nome" value="${combo.name || ""}">
      <textarea id="c-desc" rows="3" class="border p-3 rounded-xl" placeholder="Descrição">${combo.description || ""}</textarea>
      <input id="c-preco" type="number" step="0.01" min="0" class="border p-3 rounded-xl" placeholder="Preço" value="${typeof combo.price==="number"?combo.price:""}">
      <input id="c-img" class="border p-3 rounded-xl" placeholder="URL da imagem" value="${combo.imageUrl || ""}">
      <label class="flex items-center gap-2">
        <input id="c-ativo" type="checkbox" class="w-5 h-5 accent-purple-600" ${combo.isActive!==false?"checked":""}>
        <span>Ativo</span>
      </label>
      <div class="flex justify-end gap-2 mt-2">
        <button class="px-4 py-2 rounded-xl border" onclick="window.closeModalAdmin()">Cancelar</button>
        <button id="save-combo" class="px-4 py-2 rounded-xl bg-purple-600 text-white">${isEdit?"Salvar":"Criar"}</button>
      </div>
    </div>
  `);

  document.getElementById("save-combo").onclick = async () => {
    const name = document.getElementById("c-nome").value.trim();
    const description = document.getElementById("c-desc").value.trim();
    const priceVal = document.getElementById("c-preco").value;
    const price = priceVal === "" ? 0 : Number(priceVal);
    const imageUrl = document.getElementById("c-img").value.trim();
    const isActive = document.getElementById("c-ativo").checked;

    if (!name) { toast("Informe o nome do combo.","warn"); return; }
    if (Number.isNaN(price) || price < 0) { toast("Preço inválido.","error"); return; }

    const payload = { name, description, price, imageUrl, isActive, updatedAt: serverTimestamp() };
    try {
      if (isEdit) {
        await updateDoc(doc(db,"combos",combo.id), payload);
        toast("Combo atualizado.");
      } else {
        await addDoc(collection(db,"combos"), { ...payload, createdAt: serverTimestamp() });
        toast("Combo criado.");
      }
      closeModalAdmin();
    } catch (e) {
      console.error(e); toast("Erro ao salvar combo.","error");
    }
  };
}

// ===================================================================
//                               VENDAS
// ===================================================================
function showVendas() {
  const content = document.getElementById("admin-content");
  content.innerHTML = `
    <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <label class="text-xs text-gray-600">Status</label>
          <select id="f-status" class="border p-2 rounded-lg w-full">
            <option value="">Todos</option>
            ${STATUS_VENDA.map(s=>`<option value="${s}">${s}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-600">De (data)</label>
          <input id="f-de" type="date" class="border p-2 rounded-lg w-full">
        </div>
        <div>
          <label class="text-xs text-gray-600">Até (data)</label>
          <input id="f-ate" type="date" class="border p-2 rounded-lg w-full">
        </div>
        <div class="flex items-end">
          <button id="f-aplicar" class="bg-purple-600 text-white px-4 py-2 rounded-xl w-full">Aplicar</button>
        </div>
      </div>
      <div class="flex gap-2">
        <button id="btn-export" class="border px-4 py-2 rounded-xl">Exportar CSV</button>
      </div>
    </div>
    <div class="overflow-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left border-b">
            <th class="py-2">ID</th>
            <th class="py-2">Cliente</th>
            <th class="py-2">Telefone</th>
            <th class="py-2">Itens</th>
            <th class="py-2">Total</th>
            <th class="py-2">Status</th>
            <th class="py-2">Data/Hora</th>
            <th class="py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody id="vendas-tbody"></tbody>
      </table>
    </div>
  `;

  const apply = () => loadVendas();
  document.getElementById("f-aplicar").onclick = apply;
  document.getElementById("btn-export").onclick = exportCSV;

  loadVendas();
}

function loadVendas() {
  const tbody = document.getElementById("vendas-tbody");
  tbody.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-gray-500">Carregando…</td></tr>`;

  const status = document.getElementById("f-status").value;
  const de = document.getElementById("f-de").value;
  const ate = document.getElementById("f-ate").value;

  let col = collection(db,"vendas");
  let qy = query(col, orderBy("timestamp","desc"));
  // filtro de status aplicado client-side (por simplicidade)
  unsubVendas?.();
  unsubVendas = onSnapshot(qy, (snap) => {
    const rows = [];
    snap.forEach(d => {
      const v = d.data(); v.id = d.id;

      // filtros
      if (status && v.status !== status) return;
      if (de) {
        const dt = v.timestamp?.toDate?.() || new Date();
        const d0 = new Date(de+"T00:00:00");
        if (dt < d0) return;
      }
      if (ate) {
        const dt = v.timestamp?.toDate?.() || new Date();
        const d1 = new Date(ate+"T23:59:59");
        if (dt > d1) return;
      }

      const itens = Array.isArray(v.acompanhamentos) && v.acompanhamentos.length
        ? v.acompanhamentos.map(a=>`${a.name} x${a.quantity}`).join(", ")
        : v.pedidoCombo ? `[Combo] ${v.pedidoCombo}` : "-";

      const dataTxt = v.timestamp?.toDate?.()
        ? v.timestamp.toDate().toLocaleString()
        : "-";

      rows.push(`
        <tr class="border-b">
          <td class="py-2">${v.orderId || v.id}</td>
          <td class="py-2">${v.nomeCliente || "-"}</td>
          <td class="py-2">${v.telefoneCliente || "-"}</td>
          <td class="py-2">${itens}</td>
          <td class="py-2">${v.total || "-"}</td>
          <td class="py-2">
            <select class="border p-1 rounded-md" data-status="${v.id}">
              ${STATUS_VENDA.map(s=>`<option ${v.status===s?"selected":""} value="${s}">${s}</option>`).join("")}
            </select>
          </td>
          <td class="py-2">${dataTxt}</td>
          <td class="py-2 text-right">
            <button class="px-2 py-1 rounded-md border text-red-600" data-del="${v.id}">Excluir</button>
          </td>
        </tr>
      `);
    });
    tbody.innerHTML = rows.join("") || `<tr><td colspan="8" class="py-6 text-center text-gray-500">Sem vendas.</td></tr>`;

    tbody.querySelectorAll("[data-status]").forEach(sel => {
      sel.onchange = async () => {
        const id = sel.getAttribute("data-status");
        try { await updateDoc(doc(db,"vendas",id), { status: sel.value }); toast("Status atualizado."); }
        catch(e){ console.error(e); toast("Erro ao atualizar status.","error"); }
      };
    });

    tbody.querySelectorAll("[data-del]").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-del");
        showModalAdmin(`
          <h4 class="text-lg font-bold mb-3">Excluir venda?</h4>
          <p class="text-sm text-gray-600 mb-4">Essa ação não pode ser desfeita.</p>
          <div class="flex justify-end gap-2">
            <button class="px-4 py-2 rounded-xl border" onclick="window.closeModalAdmin()">Cancelar</button>
            <button id="conf-del-venda" class="px-4 py-2 rounded-xl bg-red-600 text-white">Excluir</button>
          </div>
        `);
        document.getElementById("conf-del-venda").onclick = async () => {
          try { await deleteDoc(doc(db,"vendas",id)); toast("Venda excluída."); closeModalAdmin(); }
          catch(e){ console.error(e); toast("Erro ao excluir venda.","error"); }
        };
      };
    });
  });
}

function exportCSV() {
  const status = document.getElementById("f-status").value;
  const de = document.getElementById("f-de").value;
  const ate = document.getElementById("f-ate").value;

  // Snapshot única para export (sem listener)
  const col = collection(db, "vendas");
  const qy = query(col, orderBy("timestamp","desc"));

  // Não há getDocs importado; faremos via onSnapshot única + unsubscribe
  const unsubOnce = onSnapshot(qy, (snap) => {
    const rows = [["orderId","cliente","telefone","itens","total","status","data"]];
    snap.forEach(d=>{
      const v = d.data(); v.id = d.id;

      if (status && v.status !== status) return;
      if (de) {
        const dt = v.timestamp?.toDate?.() || new Date();
        const d0 = new Date(de+"T00:00:00");
        if (dt < d0) return;
      }
      if (ate) {
        const dt = v.timestamp?.toDate?.() || new Date();
        const d1 = new Date(ate+"T23:59:59");
        if (dt > d1) return;
      }

      const itens = Array.isArray(v.acompanhamentos) && v.acompanhamentos.length
        ? v.acompanhamentos.map(a=>`${a.name} x${a.quantity}`).join(" | ")
        : v.pedidoCombo ? `[Combo] ${v.pedidoCombo}` : "";

      rows.push([
        (v.orderId || v.id),
        (v.nomeCliente || ""),
        (v.telefoneCliente || ""),
        itens,
        (v.total || ""),
        (v.status || ""),
        (v.timestamp?.toDate?.()?.toISOString() || "")
      ]);
    });

    const csv = rows.map(r => r.map(x => `"${String(x).replaceAll('"','""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `vendas_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    unsubOnce();
    toast("CSV exportado.");
  });
}

// ===================================================================
//                                CAIXA
// ===================================================================
function showCaixa() {
  const content = document.getElementById("admin-content");
  content.innerHTML = `
    <div class="grid md:grid-cols-3 gap-4">
      <div class="border rounded-2xl p-4">
        <div class="text-sm text-gray-600">Hoje</div>
        <div id="cx-hoje" class="text-2xl font-extrabold text-green-700">R$0,00</div>
      </div>
      <div class="border rounded-2xl p-4">
        <div class="text-sm text-gray-600">Este mês</div>
        <div id="cx-mes" class="text-2xl font-extrabold text-green-700">R$0,00</div>
      </div>
      <div class="border rounded-2xl p-4">
        <div class="text-sm text-gray-600">Entregues (acumulado)</div>
        <div id="cx-total" class="text-2xl font-extrabold text-green-700">R$0,00</div>
      </div>
    </div>
    <div class="mt-6">
      <h4 class="text-lg font-bold mb-2">Filtrar por período</h4>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <input id="cx-de" type="date" class="border p-2 rounded-lg">
        <input id="cx-ate" type="date" class="border p-2 rounded-lg">
        <button id="cx-aplicar" class="bg-purple-600 text-white px-4 py-2 rounded-xl">Aplicar</button>
        <button id="cx-export" class="border px-4 py-2 rounded-xl">Exportar CSV</button>
      </div>
      <div class="overflow-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left border-b">
              <th class="py-2">Data</th>
              <th class="py-2">ID</th>
              <th class="py-2">Cliente</th>
              <th class="py-2">Total</th>
              <th class="py-2">Status</th>
            </tr>
          </thead>
          <tbody id="cx-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("cx-aplicar").onclick = carregarCaixa;
  document.getElementById("cx-export").onclick = exportCaixaCSV;

  carregarResumoCaixa();
  carregarCaixa();
}

function parseMoneyToNumber(txt) {
  // Aceita "R$12,34" ou "12,34"
  if (!txt) return 0;
  const t = String(txt).replace(/[^\d,.-]/g,"").replace(".","").replace(",",".");
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function carregarResumoCaixa() {
  const col = collection(db, "vendas");
  const qy = query(col, orderBy("timestamp","desc"));

  const unsubOnce = onSnapshot(qy, (snap) => {
    let somaHoje = 0, somaMes = 0, somaTotal = 0;
    const now = new Date();
    const dHoje = now.toISOString().slice(0,10);
    const ym = now.toISOString().slice(0,7);

    snap.forEach(d=>{
      const v = d.data();
      if (v.status !== "entregue") return; // conta apenas entregues
      const val = parseMoneyToNumber(v.total);
      const ts = v.timestamp?.toDate?.();
      const iso = ts ? ts.toISOString() : "";
      if (iso.startsWith(dHoje)) somaHoje += val;
      if (iso.startsWith(ym)) somaMes += val;
      somaTotal += val;
    });

    const f = (n)=>"R$"+n.toFixed(2).replace(".",",");
    document.getElementById("cx-hoje").textContent = f(somaHoje);
    document.getElementById("cx-mes").textContent = f(somaMes);
    document.getElementById("cx-total").textContent = f(somaTotal);

    unsubOnce();
  });
}

function carregarCaixa() {
  const de = document.getElementById("cx-de").value;
  const ate = document.getElementById("cx-ate").value;
  const col = collection(db, "vendas");
  const qy = query(col, orderBy("timestamp","desc"));

  const unsubOnce = onSnapshot(qy, (snap) => {
    const rows = [];
    snap.forEach(d=>{
      const v = d.data(); v.id = d.id;
      if (v.status !== "entregue") return;

      const dt = v.timestamp?.toDate?.() || new Date();
      if (de) {
        const d0 = new Date(de+"T00:00:00");
        if (dt < d0) return;
      }
      if (ate) {
        const d1 = new Date(ate+"T23:59:59");
        if (dt > d1) return;
      }
      rows.push(`
        <tr class="border-b">
          <td class="py-2">${dt.toLocaleString()}</td>
          <td class="py-2">${v.orderId || v.id}</td>
          <td class="py-2">${v.nomeCliente || "-"}</td>
          <td class="py-2">${v.total || "-"}</td>
          <td class="py-2">${v.status || "-"}</td>
        </tr>
      `);
    });
    document.getElementById("cx-tbody").innerHTML = rows.join("") || `
      <tr><td colspan="5" class="py-6 text-center text-gray-500">Sem registros.</td></tr>`;
    unsubOnce();
  });
}

function exportCaixaCSV() {
  const de = document.getElementById("cx-de").value;
  const ate = document.getElementById("cx-ate").value;
  const col = collection(db, "vendas");
  const qy = query(col, orderBy("timestamp","desc"));

  const unsubOnce = onSnapshot(qy, (snap) => {
    const rows = [["data","orderId","cliente","total","status"]];
    snap.forEach(d=>{
      const v = d.data(); v.id = d.id;
      if (v.status !== "entregue") return;
      const dt = v.timestamp?.toDate?.() || new Date();
      if (de) {
        const d0 = new Date(de+"T00:00:00");
        if (dt < d0) return;
      }
      if (ate) {
        const d1 = new Date(ate+"T23:59:59");
        if (dt > d1) return;
      }
      rows.push([
        dt.toISOString(),
        (v.orderId || v.id),
        (v.nomeCliente || ""),
        (v.total || ""),
        (v.status || "")
      ]);
    });

    const csv = rows.map(r => r.map(x => `"${String(x).replaceAll('"','""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `caixa_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    unsubOnce();
    toast("CSV exportado.");
  });
}

// ===================================================================
//                           CONFIGURAÇÕES
// ===================================================================
function showConfig() {
  const content = document.getElementById("admin-content");
  content.innerHTML = `
    <div class="grid md:grid-cols-2 gap-4">
      <div class="border rounded-2xl p-4">
        <h4 class="text-lg font-bold mb-3">Loja</h4>
        <div class="grid gap-3">
          <label class="text-sm">Número do WhatsApp (com DDI/DDI):</label>
          <input id="cfg-wa" class="border p-3 rounded-xl" placeholder="Ex: 5514991962607">
          <label class="flex items-center gap-2">
            <input id="cfg-aberta" type="checkbox" class="w-5 h-5 accent-purple-600">
            <span>Loja aberta</span>
          </label>
          <label class="text-sm">Mensagem quando a loja estiver fechada:</label>
          <textarea id="cfg-msg" rows="3" class="border p-3 rounded-xl" placeholder="Mensagem de loja fechada"></textarea>
          <div class="flex justify-end">
            <button id="cfg-salvar" class="bg-purple-600 text-white px-4 py-2 rounded-xl">Salvar</button>
          </div>
        </div>
      </div>

      <div class="border rounded-2xl p-4">
        <h4 class="text-lg font-bold mb-3">Contador diário (ID de pedido)</h4>
        <div class="grid gap-3">
          <p class="text-sm text-gray-600">Reinicia automaticamente a cada dia quando for usado pelo primeiro pedido.</p>
          <div class="flex items-center gap-2">
            <button id="reset-counter" class="border px-4 py-2 rounded-xl">Zerar manualmente</button>
          </div>
        </div>
      </div>
    </div>
  `;

  carregarConfig();
  document.getElementById("cfg-salvar").onclick = salvarConfig;
  document.getElementById("reset-counter").onclick = resetCounter;
}

async function carregarConfig() {
  try {
    const ref = doc(db,"configuracoes","loja");
    const s = await getDoc(ref);
    if (s.exists()) {
      const cfg = s.data();
      document.getElementById("cfg-wa").value = cfg.whatsappNumber || "";
      document.getElementById("cfg-aberta").checked = cfg.lojaAberta !== false;
      document.getElementById("cfg-msg").value = cfg.mensagemFechado || "";
    }
  } catch(e) {
    console.error(e); toast("Erro ao carregar configurações.","error");
  }
}

async function salvarConfig() {
  const whatsappNumber = document.getElementById("cfg-wa").value.trim();
  const lojaAberta = document.getElementById("cfg-aberta").checked;
  const mensagemFechado = document.getElementById("cfg-msg").value.trim();

  try {
    await setDoc(doc(db,"configuracoes","loja"), {
      whatsappNumber, lojaAberta, mensagemFechado, updatedAt: serverTimestamp()
    }, { merge: true });
    toast("Configurações salvas.");
  } catch(e) {
    console.error(e); toast("Erro ao salvar configurações.","error");
  }
}

async function resetCounter() {
  try {
    await setDoc(doc(db,"configuracoes","dailyCounter"), {
      lastOrderNumber: 0,
      lastOrderDate: new Date(0).toISOString().slice(0,10)
    }, { merge: true });
    toast("Contador diário zerado.");
  } catch(e) {
    console.error(e); toast("Erro ao zerar contador.","error");
  }
}

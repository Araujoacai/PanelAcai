// Importa as funções necessárias do Firebase.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, where, orderBy, getDoc, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Configuração do Firebase.
const firebaseConfig = {
  apiKey: "AIzaSyCKZ-9QMY5ziW7uJIano6stDzHDKm8KqnE",
  authDomain: "salvapropagandas.firebaseapp.com",
  projectId: "salvapropagandas",
  storageBucket: "salvapropagandas.appspot.com",
  messagingSenderId: "285635693052",
  appId: "1:285635693052:web:260476698696d303be0a79"
};

// Inicializa o Firebase.
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Variáveis globais.
let produtos = [];
let combos = []; // Variável para armazenar os combos
let precosBase = {};
let unsubscribeVendas;
let unsubscribeFluxoCaixa;
let storeSettings = {};
let isStoreOpen = true; 
let initialVendasLoadComplete = false;

// Elementos do DOM.
const menuContainer = document.getElementById("menu-container");
const adminPanel = document.getElementById("admin-panel");
const whatsappBar = document.getElementById("whatsapp-bar");
const adminLoginBtn = document.getElementById("admin-login-button");
const adminLogoutBtn = document.getElementById("admin-logout-button");
const modalContainer = document.getElementById("modal-container");
const sendOrderBtnMobile = document.getElementById("send-order-button-mobile");
const sendOrderBtnDesktop = document.getElementById("send-order-button-desktop");

/**
 * Exibe um modal com o conteúdo fornecido.
 * @param {string|HTMLElement} content - O conteúdo a ser exibido no modal.
 * @param {function} onOpen - Função a ser executada após a abertura do modal.
 */
function showModal(content, onOpen = () => {}) {
    let modalContent = content;
    if (typeof content === "string") {
        modalContent = `<p class="text-lg text-gray-800 mb-6">${content}</p><button onclick="window.closeModal()" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-8 rounded-lg transition-colors">OK</button>`;
    }
    modalContainer.innerHTML = `<div class="bg-white rounded-2xl p-6 w-full max-w-md text-center shadow-xl transform transition-all scale-95 opacity-0" id="modal-box">${modalContent}</div>`;
    modalContainer.classList.remove("hidden");
    setTimeout(() => { document.getElementById("modal-box").classList.remove("scale-95", "opacity-0"); onOpen(); }, 10);
}

/**
 * Fecha o modal.
 */
function closeModal() {
    const modalBox = document.getElementById("modal-box");
    if (modalBox) {
        modalBox.classList.add("scale-95", "opacity-0");
        setTimeout(() => { modalContainer.classList.add("hidden"); modalContainer.innerHTML = ""; }, 200);
    }
}

// Observador de estado de autenticação.
onAuthStateChanged(auth, user => {
    if (user) {
        adminLoginBtn.classList.add("hidden"); adminLogoutBtn.classList.remove("hidden"); menuContainer.classList.add("hidden"); whatsappBar.classList.add("hidden"); adminPanel.classList.remove("hidden");
        renderAdminPanel();
    } else {
        adminLoginBtn.classList.remove("hidden"); adminLogoutBtn.classList.add("hidden"); menuContainer.classList.remove("hidden"); whatsappBar.classList.remove("hidden"); adminPanel.classList.add("hidden");
        if (unsubscribeVendas) unsubscribeVendas();
        if (unsubscribeFluxoCaixa) unsubscribeFluxoCaixa();
        initialVendasLoadComplete = false;
    }
});

// Evento de clique no botão de login.
adminLoginBtn.addEventListener("click", () => {
    const loginFormHTML = `<h3 class="text-xl font-bold mb-4">Login Admin</h3><input type="email" id="email" placeholder="Email" class="w-full p-2 border rounded mb-2"><input type="password" id="password" placeholder="Senha" class="w-full p-2 border rounded mb-4"><button id="login-submit" class="bg-purple-600 text-white px-6 py-2 rounded-lg">Entrar</button><button onclick="window.closeModal()" class="bg-gray-300 px-4 py-2 rounded-lg ml-2">Cancelar</button>`;
    showModal(loginFormHTML, () => {
         document.getElementById("login-submit").addEventListener("click", async () => {
            try { await signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("password").value); closeModal(); } catch (error) { console.error("Erro de login:", error); alert("Email ou senha inválidos."); }
        });
    });
});

// Evento de clique no botão de logout.
adminLogoutBtn.addEventListener("click", () => signOut(auth));

/**
 * Renderiza o menu de produtos.
 */
function renderMenu() {
    const containers = { tamanho: document.getElementById("tamanhos-container"), fruta: document.getElementById("frutas-container"), creme: document.getElementById("cremes-container"), outro: document.getElementById("outros-container") };
    Object.values(containers).forEach(c => c.innerHTML = "");
    precosBase = {};
    const produtosVisiveis = produtos.filter(p => p.category !== "insumo" && p.isActive !== false);
    if (produtosVisiveis.length === 0) { Object.values(containers).forEach(c => c.innerHTML = "<p class=\"text-red-500 text-sm col-span-2\">Nenhum item. Faça login como admin para adicionar produtos.</p>"); return; }
    
    produtosVisiveis.forEach(p => {
        const pId = p.name.replace(/[^a-zA-Z0-9]/g, ""); // Create a safe ID
        if (p.category === "tamanho") {
            precosBase[p.name] = p.price;
            containers.tamanho.innerHTML += `<label class="flex items-center justify-between bg-purple-100 px-4 py-3 rounded-2xl shadow cursor-pointer hover:bg-purple-200 transition"><div><span class="font-medium text-gray-800">${p.name}</span><span class="ml-3 text-sm text-gray-600">R$${p.price.toFixed(2)}</span></div><input type="radio" name="tamanho" value="${p.name}" class="accent-pink-500"></label>`;
        } else {
            const bgColor = p.category === "fruta" ? "bg-pink-100 hover:bg-pink-200" : p.category === "creme" ? "bg-purple-100 hover:bg-purple-200" : "bg-violet-200 hover:bg-violet-300";
            const accentColor = p.category === "fruta" ? "accent-purple-600" : "accent-pink-600";
            if(containers[p.category]) { 
                containers[p.category].innerHTML += `\n                    <label class="flex items-center ${bgColor} px-3 py-2 rounded-xl shadow cursor-pointer">\n                        <img src="${p.iconUrl}" alt="${p.name}" class="card-img flex-shrink-0" onerror="this.style.display=\'none\'">\n                        <input type="checkbox" value="${p.name}" data-qty-target="qty-${pId}" class="acompanhamento-check mx-2 ${accentColor} flex-shrink-0">\n                        <span class="flex-grow truncate">${p.name}</span>\n                        <input type="number" value="1" min="1" id="qty-${pId}" class="acompanhamento-qty w-14 text-center border rounded-md hidden p-1 ml-2 flex-shrink-0">\n                    </label>`;
            }
        }
    });

    document.querySelectorAll(".acompanhamento-check").forEach(check => {
        check.addEventListener("change", (e) => {
            const qtyInput = document.getElementById(e.target.dataset.qtyTarget);
            if (e.target.checked) {
                qtyInput.classList.remove("hidden");
                qtyInput.value = 1;
            } else {
                qtyInput.classList.add("hidden");
            }
            calcularValor();
        });
    });
    document.querySelectorAll("input, textarea").forEach(el => { el.addEventListener("change", calcularValor); el.addEventListener("input", calcularValor); });
    document.getElementById("apenas-acai-check").addEventListener("change", calcularValor);
}

/**
 * Renderiza o menu de combos.
 */
function renderCombosMenu() {
    const container = document.getElementById("combos-container");
    const section = document.getElementById("combos-section");
    container.innerHTML = "";

    const combosAtivos = combos.filter(c => c.isActive !== false);

    if(combosAtivos.length === 0) {
        section.classList.add("hidden");
        return;
    }

    section.classList.remove("hidden");
    combosAtivos.forEach(combo => {
        container.innerHTML += `\n                <div class="bg-gradient-to-br from-purple-100 to-pink-100 p-4 rounded-2xl shadow-md flex flex-col">\n                    <img src="${combo.imageUrl || "https://placehold.co/600x400/f3e8ff/9333ea?text=Combo"}" alt="${combo.name}" class="w-full h-32 object-cover rounded-lg mb-3">\n                    <h4 class="text-lg font-bold text-purple-800 mb-1">${combo.name}</h4>\n                    <p class="text-sm text-gray-600 mb-2 flex-grow">${combo.description}</p>\n                    <div class="flex justify-between items-center mt-auto">\n                        <span class="text-xl font-bold text-green-700">R$${combo.price.toFixed(2)}</span>\n                        <button class="select-combo-btn bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition" data-id="${combo.id}">Selecionar</button>\n                    </div>\n                </div>`;
    });
    document.querySelectorAll(".select-combo-btn").forEach(btn => btn.addEventListener("click", (e) => selecionarCombo(e.currentTarget.dataset.id)));
}

/**
 * Seleciona um combo e atualiza o formulário.
 * @param {string} comboId - O ID do combo selecionado.
 */
function selecionarCombo(comboId) {
    const comboSelecionado = combos.find(c => c.id === comboId);
    if (comboSelecionado) {
        document.getElementById("quantidade").value = 1; // Reset quantity for combo
        document.getElementById("apenas-acai-check").checked = false; // Uncheck "only acai" for combo
        document.querySelectorAll(".acompanhamento-check").forEach(check => {
            check.checked = false;
            document.getElementById(check.dataset.qtyTarget).classList.add("hidden");
        });

        // Set selected size based on combo description (simple parsing, might need refinement)
        const tamanhoMatch = comboSelecionado.description.match(/(\d+ml|\d+L)/i);
        if (tamanhoMatch) {
            const tamanhoValue = tamanhoMatch[0];
            const radioTamanho = document.querySelector(`input[name="tamanho"][value*="${tamanhoValue}"]`);
            if (radioTamanho) {
                radioTamanho.checked = true;
            }
        }
        calcularValor();
        showToast("Combo selecionado!", "success");
    }
}

/**
 * Exibe uma notificação toast.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - O tipo de notificação (success, error, info).
 */
function showToast(message, type = "info") {
    const toastContainer = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast-notification p-4 rounded-lg shadow-md mb-3 flex items-center justify-between transform transition-all duration-300 ease-out ${type === "success" ? "bg-green-500 text-white" : type === "error" ? "bg-red-500 text-white" : "bg-gray-800 text-white"}`;
    toast.innerHTML = `<span>${message}</span><button class="ml-4 text-white opacity-75 hover:opacity-100" onclick="this.parentElement.remove()">×</button>`;
    toastContainer.prepend(toast);
    setTimeout(() => toast.remove(), 5000);
}

/**
 * Calcula o valor total do pedido.
 */
function calcularValor() {
    let valorTotal = 0;
    const quantidade = parseInt(document.getElementById("quantidade").value) || 1;
    const tamanhoSelecionado = document.querySelector("input[name=\"tamanho\"]:checked");
    const apenasAcai = document.getElementById("apenas-acai-check").checked;

    if (tamanhoSelecionado) {
        const precoTamanho = precosBase[tamanhoSelecionado.value];
        valorTotal += precoTamanho;

        if (!apenasAcai) {
            let acompanhamentosSelecionados = 0;
            document.querySelectorAll(".acompanhamento-check:checked").forEach(check => {
                const qtyInput = document.getElementById(check.dataset.qtyTarget);
                acompanhamentosSelecionados += parseInt(qtyInput.value) || 1;
            });

            const adicionais = Math.max(0, acompanhamentosSelecionados - 3);
            valorTotal += adicionais * 3; // R$3 por adicional
        }
    }

    valorTotal *= quantidade;

    document.getElementById("valor-mobile").innerText = `R$${valorTotal.toFixed(2).replace(".", ",")}`;
    document.getElementById("valor-desktop").innerText = `R$${valorTotal.toFixed(2).replace(".", ",")}`;
}

// Eventos de clique nos botões de enviar pedido.
sendOrderBtnMobile.addEventListener("click", enviarPedido);
sendOrderBtnDesktop.addEventListener("click", enviarPedido);

/**
 * Envia o pedido para o Firebase e WhatsApp.
 */
async function enviarPedido() {
    if (!isStoreOpen) {
        showModal(storeSettings.mensagemFechado || "A loja está fechada no momento. Por favor, verifique o horário de funcionamento.");
        return;
    }

    const tamanhoSelecionado = document.querySelector("input[name=\"tamanho\"]:checked");
    if (!tamanhoSelecionado) { showModal("Por favor, escolha o tamanho do açaí."); return; }

    const nomeCliente = document.getElementById("nome-cliente").value.trim();
    const telefoneCliente = document.getElementById("telefone-cliente").value.trim();
    if (!nomeCliente || !telefoneCliente) { showModal("Por favor, preencha seu nome e telefone/WhatsApp."); return; }

    const acompanhamentos = [];
    if (!document.getElementById("apenas-acai-check").checked) {
        document.querySelectorAll(".acompanhamento-check:checked").forEach(check => {
            const qtyInput = document.getElementById(check.dataset.qtyTarget);
            acompanhamentos.push(`${check.value} (${qtyInput.value})`);
        });
    }

    const observacoes = document.getElementById("observacoes").value.trim();
    const quantidade = parseInt(document.getElementById("quantidade").value) || 1;
    const valorTotal = parseFloat(document.getElementById("valor-mobile").innerText.replace("R$", "").replace(",", "."));

    const pedido = {
        tamanho: tamanhoSelecionado.value,
        acompanhamentos: acompanhamentos.length > 0 ? acompanhamentos.join(", ") : "Nenhum",
        observacoes: observacoes || "Nenhuma",
        quantidade: quantidade,
        valor: valorTotal,
        nomeCliente: nomeCliente,
        telefoneCliente: telefoneCliente,
        timestamp: serverTimestamp(),
        status: "Novo",
        custoTotal: 0 // Será calculado no backend ou admin
    };

    let mensagemWhatsApp = `*NOVO PEDIDO - AÇAÍ ARAUJO*%0A%0A`;
    mensagemWhatsApp += `*Cliente:* ${pedido.nomeCliente}%0A`;
    mensagemWhatsApp += `*Telefone:* ${pedido.telefoneCliente}%0A%0A`;
    mensagemWhatsApp += `*Detalhes do Pedido:*%0A`;
    mensagemWhatsApp += `- *Tamanho:* ${pedido.tamanho}%0A`;
    mensagemWhatsApp += `- *Quantidade:* ${pedido.quantidade}%0A`;
    mensagemWhatsApp += `- *Acompanhamentos:* ${pedido.acompanhamentos}%0A`;
    if (pedido.observacoes !== "Nenhuma") {
        mensagemWhatsApp += `- *Observações:* ${pedido.observacoes}%0A`;
    }
    mensagemWhatsApp += `%0A*Valor Total:* R$${pedido.valor.toFixed(2).replace(".", ",")}%0A%0A`;
    mensagemWhatsApp += `Aguardando confirmação!`;

    try {
        await addDoc(collection(db, "pedidos"), pedido);
        const whatsappNumber = storeSettings.whatsappNumber || "5511999998888"; // Default number
        window.open(`https://api.whatsapp.com/send?phone=${whatsappNumber}&text=${mensagemWhatsApp}`, "_blank");
        showModal("Seu pedido foi enviado com sucesso para o WhatsApp!", () => {
            // Limpar formulário após o envio
            document.getElementById("nome-cliente").value = "";
            document.getElementById("telefone-cliente").value = "";
            document.getElementById("observacoes").value = "";
            document.getElementById("quantidade").value = 1;
            document.querySelector("input[name=\"tamanho\"]:checked").checked = false;
            document.getElementById("apenas-acai-check").checked = false;
            document.querySelectorAll(".acompanhamento-check").forEach(check => {
                check.checked = false;
                document.getElementById(check.dataset.qtyTarget).classList.add("hidden");
            });
            calcularValor();
        });
    } catch (error) {
        console.error("Erro ao enviar pedido:", error);
        showModal("Ocorreu um erro ao enviar seu pedido. Por favor, tente novamente.");
    }
}

/**
 * Renderiza o painel de administração.
 */
function renderAdminPanel() {
    adminPanel.innerHTML = `
        <div class="bg-white/95 shadow-2xl rounded-3xl p-6 w-full mb-8 backdrop-blur-sm border border-purple-200">
            <h2 class="text-3xl font-extrabold text-purple-800 mb-6 text-center">Painel Administrativo</h2>
            <div class="flex justify-center mb-6">
                <button class="tab-button p-3 rounded-lg mr-2 font-semibold text-gray-600 border border-transparent hover:border-purple-400 transition tab-active" data-tab="produtos">Produtos</button>
                <button class="tab-button p-3 rounded-lg mr-2 font-semibold text-gray-600 border border-transparent hover:border-purple-400 transition" data-tab="combos">Combos</button>
                <button class="tab-button p-3 rounded-lg mr-2 font-semibold text-gray-600 border border-transparent hover:border-purple-400 transition" data-tab="vendas">Vendas</button>
                <button class="tab-button p-3 rounded-lg mr-2 font-semibold text-gray-600 border border-transparent hover:border-purple-400 transition" data-tab="caixa">Caixa</button>
                <button class="tab-button p-3 rounded-lg font-semibold text-gray-600 border border-transparent hover:border-purple-400 transition" data-tab="config">Configurações</button>
            </div>
            <div id="admin-content"></div>
        </div>
    `;

    document.querySelectorAll(".tab-button").forEach(button => {
        button.addEventListener("click", (e) => {
            document.querySelectorAll(".tab-button").forEach(btn => btn.classList.remove("tab-active"));
            e.currentTarget.classList.add("tab-active");
            const tab = e.currentTarget.dataset.tab;
            renderAdminContent(tab);
        });
    });
    renderAdminContent("produtos"); // Render default tab
}

/**
 * Renderiza o conteúdo da aba do painel de administração.
 * @param {string} tab - A aba a ser renderizada.
 */
function renderAdminContent(tab) {
    const adminContentDiv = document.getElementById("admin-content");
    adminContentDiv.innerHTML = ""; // Clear previous content

    switch (tab) {
        case "produtos":
            adminContentDiv.innerHTML = `
                <div id="content-produtos">
                    <h3 class="text-2xl font-semibold mb-4 text-purple-700">Gerenciar Produtos</h3>
                    <div class="bg-gray-50 p-4 rounded-lg shadow-inner mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <input type="hidden" id="produto-id">
                        <input type="text" id="produto-nome" placeholder="Nome do Produto" class="p-2 border rounded col-span-2">
                        <input type="number" id="produto-preco" placeholder="Preço de Venda" step="0.01" class="p-2 border rounded">
                        <input type="number" id="produto-custo" placeholder="Custo (opcional)" step="0.01" class="p-2 border rounded">
                        <input type="text" id="produto-unidade" placeholder="Unidade (Ex: kg, ml, un)" class="p-2 border rounded">
                        <input type="text" id="produto-icone" placeholder="URL do Ícone (opcional)" class="p-2 border rounded">
                        <select id="produto-categoria" class="p-2 border rounded">
                            <option value="tamanho">Tamanho</option>
                            <option value="fruta">Fruta</option>
                            <option value="creme">Creme</option>
                            <option value="outro">Outro</option>
                            <option value="insumo">Insumo</option>
                        </select>
                        <button id="salvar-produto-btn" class="bg-green-500 text-white p-2 rounded hover:bg-green-600">Salvar Produto</button>
                    </div>
                    <div id="lista-produtos-admin"></div>
                </div>
            `;
            document.getElementById("salvar-produto-btn").addEventListener("click", salvarProduto);
            carregarProdutosAdmin();
            break;
        case "combos":
            adminContentDiv.innerHTML = `
                <div id="content-combos">
                    <h3 class="text-2xl font-semibold mb-4 text-purple-700">Gerenciar Combos</h3>
                    <div class="bg-gray-50 p-4 rounded-lg shadow-inner mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="hidden" id="combo-id">
                        <input type="text" id="combo-nome" placeholder="Nome do Combo" class="p-2 border rounded">
                        <input type="number" id="combo-preco" placeholder="Preço do Combo" step="0.01" class="p-2 border rounded">
                        <input type="text" id="combo-imagem" placeholder="URL da Imagem" class="p-2 border rounded col-span-full">
                        <textarea id="combo-descricao" placeholder="Descrição do Combo (Ex: 2 Açaís 500ml...)" class="p-2 border rounded col-span-full" rows="3"></textarea>
                        <button id="salvar-combo-btn" class="bg-green-500 text-white p-2 rounded hover:bg-green-600 col-span-full">Salvar Combo</button>
                    </div>
                    <div id="lista-combos-admin"></div>
                </div>`;
            document.getElementById("salvar-combo-btn").addEventListener("click", salvarCombo);
            carregarCombosAdmin();
            break;
        case "vendas":
            adminContentDiv.innerHTML = `<div id="content-vendas"></div>`;
            renderVendasAdmin();
            break;
        case "caixa":
            adminContentDiv.innerHTML = `<div id="content-caixa"></div>`;
            renderCaixaAdmin();
            break;
        case "config":
            adminContentDiv.innerHTML = `<div id="content-config"></div>`;
            renderConfigAdmin();
            break;
        default:
            adminContentDiv.innerHTML = `<p class="text-red-500">Aba não encontrada.</p>`;
    }
}

/**
 * Salva um combo no Firebase.
 */
async function salvarCombo() {
    const id = document.getElementById("combo-id").value;
    const combo = { 
        name: document.getElementById("combo-nome").value, 
        price: parseFloat(document.getElementById("combo-preco").value) || 0,
        description: document.getElementById("combo-descricao").value,
        imageUrl: document.getElementById("combo-imagem").value,
        isActive: true 
    };
    if (!combo.name || !combo.description || combo.price <= 0) { showModal("Nome, Descrição e Preço válido são obrigatórios."); return; }
    
    try {
        if (id) { 
             const existingCombo = combos.find(c => c.id === id);
             if(existingCombo) combo.isActive = existingCombo.isActive;
             await updateDoc(doc(db, "combos", id), combo); 
        } else { await addDoc(collection(db, "combos"), combo); }
        document.getElementById("combo-id").value = ""; document.getElementById("combo-nome").value = ""; document.getElementById("combo-preco").value = ""; document.getElementById("combo-descricao").value = ""; document.getElementById("combo-imagem").value = "";
    } catch (error) { console.error("Erro ao salvar combo:", error); showModal("Não foi possível salvar o combo."); }
}

/**
 * Carrega os combos do Firebase e os exibe no painel de administração.
 */
function carregarCombosAdmin() {
    const container = document.getElementById("lista-combos-admin");
    onSnapshot(query(collection(db, "combos"), orderBy("name")), (snapshot) => {
        container.innerHTML = `<h4 class="text-xl font-medium mt-6 mb-2 text-purple-600">Combos Cadastrados</h4>`;
        const grid = document.createElement("div");
        grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";
        if (snapshot.empty) {
            grid.innerHTML = "<p class=\"col-span-full text-gray-500\">Nenhum combo cadastrado.</p>";
        }
        snapshot.forEach(docSnap => {
            const c = { id: docSnap.id, ...docSnap.data() };
            const isInactive = c.isActive === false;
            const activeBtnClass = isInactive ? "bg-gray-400" : "bg-green-500";
            const activeBtnIcon = isInactive ? "🚫" : "👁️";

            grid.innerHTML += `\n                <div class="border p-3 rounded-lg flex justify-between items-start ${isInactive ? "opacity-50" : ""}">\n                    <div class="flex-grow">\n                        <p class="font-bold">${c.name}</p>\n                        <p class="text-sm text-gray-600">${c.description}</p>\n                        <p class="text-md font-semibold text-green-700 mt-1">R$${(c.price || 0).toFixed(2)}</p>\n                    </div>\n                    <div class="flex flex-col ml-2">\n                        <button class="toggle-combo-btn p-1 text-white rounded mb-1 ${activeBtnClass}" data-id="${c.id}">${activeBtnIcon}</button>\n                        <button class="edit-combo-btn p-1 text-blue-500" data-id="${c.id}">✏️</button>\n                        <button class="delete-combo-btn p-1 text-red-500" data-id="${c.id}">🗑️</button>\n                    </div>\n                </div>`;
        });
        container.appendChild(grid);

        document.querySelectorAll(".edit-combo-btn").forEach(btn => btn.addEventListener("click", (e) => editarCombo(e.currentTarget.dataset.id)));
        document.querySelectorAll(".delete-combo-btn").forEach(btn => btn.addEventListener("click", (e) => deletarCombo(e.currentTarget.dataset.id)));
        document.querySelectorAll(".toggle-combo-btn").forEach(btn => btn.addEventListener("click", (e) => toggleComboStatus(e.currentTarget.dataset.id)));
    });
}

/**
 * Preenche o formulário de edição de combo.
 * @param {string} id - O ID do combo a ser editado.
 */
function editarCombo(id) {
    const c = combos.find(combo => combo.id === id);
    if (c) { 
        document.getElementById("combo-id").value = c.id; 
        document.getElementById("combo-nome").value = c.name; 
        document.getElementById("combo-preco").value = c.price; 
        document.getElementById("combo-descricao").value = c.description; 
        document.getElementById("combo-imagem").value = c.imageUrl; 
    }
}

/**
 * Deleta um combo do Firebase.
 * @param {string} id - O ID do combo a ser deletado.
 */
function deletarCombo(id) {
    showModal(`<h3 class="text-xl font-bold mb-4">Confirmar Exclusão</h3><p class="mb-6">Tem certeza que deseja excluir este combo?</p><button id="confirm-delete-combo-btn" class="bg-red-500 text-white px-6 py-2 rounded-lg">Excluir</button><button onclick="window.closeModal()" class="bg-gray-300 px-4 py-2 rounded-lg ml-2">Cancelar</button>`, () => {
        document.getElementById("confirm-delete-combo-btn").addEventListener("click", async () => {
            try { await deleteDoc(doc(db, "combos", id)); closeModal(); } catch (error) { console.error("Erro ao excluir combo:", error); closeModal(); showModal("Ocorreu um erro ao excluir o combo."); }
        });
    });
}

/**
 * Alterna o status de um combo (ativo/inativo).
 * @param {string} id - O ID do combo a ter o status alterado.
 */
async function toggleComboStatus(id) {
    const combo = combos.find(c => c.id === id);
    if (combo) {
        const newStatus = !(combo.isActive !== false);
        try { await updateDoc(doc(db, "combos", id), { isActive: newStatus }); } 
        catch (error) { console.error("Erro ao atualizar status:", error); showModal("Não foi possível atualizar o status do combo."); }
    }
}

/**
 * Renderiza a seção de vendas do painel de administração.
 */
function renderVendasAdmin() {
    document.getElementById("content-vendas").innerHTML = `<div class="bg-white p-6 rounded-2xl shadow-lg"><h3 class="text-2xl font-semibold mb-4 text-purple-700">Relatório de Vendas</h3><div class="flex flex-wrap gap-4 items-center mb-4 p-4 border rounded-lg"><label for="start-date">De:</label><input type="date" id="start-date" class="p-2 border rounded"><label for="end-date">Até:</label><input type="date" id="end-date" class="p-2 border rounded"><button id="gerar-relatorio-btn" class="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">Gerar Relatório</button></div><div class="overflow-x-auto"><table class="w-full text-left"><thead class="bg-gray-100"><tr><th class="p-3">ID Pedido</th><th class="p-3">Data/Hora</th><th class="p-3">Cliente</th><th class="p-3">Pedido</th><th class="p-3">Financeiro</th><th class="p-3">Status</th><th class="p-3">Ações</th></tr></thead><tbody id="vendas-table-body"></tbody></table></div><div class="mt-4 text-right pr-4"><h4 class="text-xl font-bold text-gray-800">Total das Vendas (Período): <span id="total-vendas" class="text-purple-700">R$0,00</span></h4></div></div>`;
    document.getElementById("gerar-relatorio-btn").addEventListener("click", () => carregarVendasAdmin(document.getElementById("start-date").value, document.getElementById("end-date").value));
    carregarVendasAdmin();
}

/**
 * Renderiza a seção de configurações do painel de administração.
 */
function renderConfigAdmin() {
    const dias = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
    let diasHTML = dias.map(dia => `\n            <div class="grid grid-cols-1 sm:grid-cols-10 gap-x-4 gap-y-2 items-center mb-3 pb-3 border-b last:border-b-0">\n                <span class="font-semibold capitalize sm:col-span-3">${dia}-feira</span>\n                <input type="time" id="${dia}-abertura" class="p-2 border rounded w-full sm:col-span-3">\n                <input type="time" id="${dia}-fechamento" class="p-2 border rounded w-full sm:col-span-3">\n                <label class="flex items-center gap-2 sm:justify-self-center sm:col-span-1"><input type="checkbox" id="${dia}-aberto" class="w-5 h-5"> Aberto</label>\n            </div>`).join("");

    document.getElementById("content-config").innerHTML = `\n            <div class="bg-white p-6 rounded-2xl shadow-lg">\n                <h3 class="text-2xl font-semibold mb-4 text-purple-700">Configurações Gerais</h3>\n                <div class="mb-6 p-4 border rounded-lg">\n                    <label for="whatsapp-number" class="block font-semibold mb-2">Número do WhatsApp para Pedidos</label>\n                    <input type="text" id="whatsapp-number" placeholder="Ex: 5511999998888" class="w-full p-2 border rounded">\n                </div>\n                <h3 class="text-2xl font-semibold mt-6 mb-4 text-purple-700">Horário de Funcionamento</h3>\n                <div class="p-4 border rounded-lg">${diasHTML}</div>\n                <h3 class="text-2xl font-semibold mt-6 mb-4 text-purple-700">Mensagem (Loja Fechada)</h3>\n                <textarea id="mensagem-fechado" class="w-full p-2 border rounded" rows="3" placeholder="Ex: Estamos fechados. Nosso horário é de..."></textarea>\n                <button id="salvar-config-btn" class="bg-green-500 text-white p-2 rounded hover:bg-green-600 mt-4">Salvar Configurações</button>\n            </div>`;
    
    document.getElementById("salvar-config-btn").addEventListener("click", salvarConfiguracoes);
    carregarConfiguracoesAdmin();
}

/**
 * Renderiza a seção de fluxo de caixa do painel de administração.
 */
function renderCaixaAdmin() {
    document.getElementById("content-caixa").innerHTML = `\n            <div class="bg-white p-6 rounded-2xl shadow-lg">\n                <h3 class="text-2xl font-semibold mb-4 text-purple-700">Fluxo de Caixa</h3>\n                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-center">\n                    <div class="bg-green-100 p-4 rounded-lg"><h4 class="font-semibold text-green-800">Total de Entradas</h4><p id="total-entradas" class="text-2xl font-bold text-green-600">R$0,00</p></div>\n                    <div class="bg-red-100 p-4 rounded-lg"><h4 class="font-semibold text-red-800">Total de Saídas</h4><p id="total-saidas" class="text-2xl font-bold text-red-600">R$0,00</p></div>\n                    <div class="bg-blue-100 p-4 rounded-lg"><h4 class="font-semibold text-blue-800">Saldo Atual</h4><p id="saldo-atual" class="text-2xl font-bold text-blue-600">R$0,00</p></div>\n                </div>\n                <div class="mb-6 p-4 border rounded-lg">\n                    <h4 class="text-xl font-medium mb-3">Adicionar Lançamento</h4>\n                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">\n                        <input type="hidden" id="transacao-id">\n                        <input type="text" id="transacao-descricao" placeholder="Descrição" class="p-2 border rounded col-span-2">\n                        <input type="number" id="transacao-valor" placeholder="Valor" step="0.01" class="p-2 border rounded">\n                        <select id="transacao-tipo" class="p-2 border rounded"><option value="entrada">Entrada</option><option value="saida">Saída</option></select>\n                        <button id="salvar-transacao-btn" class="bg-green-500 text-white p-2 rounded hover:bg-green-600 col-span-4 md:col-span-1">Salvar</button>\n                    </div>\n                </div>\n                <div class="flex flex-wrap gap-4 items-center mb-4 p-4 border rounded-lg">\n                    <label for="start-date-caixa">De:</label><input type="date" id="start-date-caixa" class="p-2 border rounded">\n                    <label for="end-date-caixa">Até:</label><input type="date" id="end-date-caixa" class="p-2 border rounded">\n                    <button id="gerar-relatorio-caixa-btn" class="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">Filtrar</button>\n                </div>\n                <div class="overflow-x-auto"><table class="w-full text-left"><thead class="bg-gray-100"><tr>\n                    <th class="p-3">Data</th><th class="p-3">Descrição</th><th class="p-3">Tipo</th><th class="p-3">Valor</th><th class="p-3">Ações</th>\n                </tr></thead><tbody id="caixa-table-body"></tbody></table></div>\n            </div>`;
    document.getElementById("salvar-transacao-btn").addEventListener("click", salvarTransacao);
    document.getElementById("gerar-relatorio-caixa-btn").addEventListener("click", () => carregarFluxoCaixa(document.getElementById("start-date-caixa").value, document.getElementById("end-date-caixa").value));
    carregarFluxoCaixa();
}

/**
 * Salva um produto no Firebase.
 */
async function salvarProduto() {
    const id = document.getElementById("produto-id").value;
    const produto = { 
        name: document.getElementById("produto-nome").value, 
        price: parseFloat(document.getElementById("produto-preco").value) || 0,
        cost: parseFloat(document.getElementById("produto-custo").value) || 0,
        unit: document.getElementById("produto-unidade").value,
        iconUrl: document.getElementById("produto-icone").value, 
        category: document.getElementById("produto-categoria").value,
        isActive: true
    };
    if (!produto.name || !produto.unit) { showModal("Nome e Unidade são obrigatórios."); return; }
    
    if (produto.category === "tamanho") {
        produto.recipe = []; // Default empty recipe for new sizes
    }

    try {
        if (id) { 
            const existingProd = produtos.find(p => p.id === id);
            if (existingProd) {
                produto.recipe = existingProd.recipe || []; // Preserve existing recipe on update
                produto.isActive = existingProd.isActive; // Preserve active status
            }
            await updateDoc(doc(db, "produtos", id), produto); 
        } else { 
            await addDoc(collection(db, "produtos"), produto); 
        }
        document.getElementById("produto-id").value = ""; document.getElementById("produto-nome").value = ""; document.getElementById("produto-preco").value = ""; document.getElementById("produto-custo").value = ""; document.getElementById("produto-unidade").value = ""; document.getElementById("produto-icone").value = "";
    } catch (error) { console.error("Erro ao salvar produto:", error); showModal("Não foi possível salvar o produto."); }
}

/**
 * Carrega os produtos do Firebase e os exibe no painel de administração.
 */
function carregarProdutosAdmin() {
    const container = document.getElementById("lista-produtos-admin");
    onSnapshot(collection(db, "produtos"), (snapshot) => {
        const produtosPorCategoria = { tamanho: [], fruta: [], creme: [], outro: [], insumo: [] };
        snapshot.docs.forEach(docSnap => { const p = { id: docSnap.id, ...docSnap.data() }; if(produtosPorCategoria[p.category]) produtosPorCategoria[p.category].push(p); });
        
        container.innerHTML = "";
        for (const categoria in produtosPorCategoria) {
            container.innerHTML += `<h4 class="text-xl font-medium mt-6 mb-2 capitalize text-purple-600">${categoria}s</h4>`;
            const grid = document.createElement("div");
            grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";
            produtosPorCategoria[categoria].forEach(p => {
                const isInactive = p.isActive === false;
                const activeBtnClass = isInactive ? "bg-gray-400" : "bg-green-500";
                const activeBtnIcon = isInactive ? "🚫" : "👁️";

                grid.innerHTML += `\n                    <div class="border p-3 rounded-lg flex justify-between items-center ${isInactive ? "opacity-50" : ""}">\n                        <div>\n                            <p class="font-bold">${p.name}</p>\n                            <p class="text-sm text-gray-600">Venda: R$${(p.price || 0).toFixed(2)} | Custo: R$${(p.cost || 0).toFixed(2)} / ${p.unit}</p>\n                        </div>\n                        <div class="flex items-center space-x-2">\n                            ${p.category === "tamanho" ? `<button class="recipe-btn p-1 text-blue-500" data-id="${p.id}">📋</button>` : ""}\n                            <button class="toggle-product-btn p-1 text-white rounded ${activeBtnClass}" data-id="${p.id}">${activeBtnIcon}</button>\n                            <button class="edit-product-btn p-1 text-blue-500" data-id="${p.id}">✏️</button>\n                            <button class="delete-product-btn p-1 text-red-500" data-id="${p.id}">🗑️</button>\n                        </div>\n                    </div>`;
            });
            container.appendChild(grid);
        }

        document.querySelectorAll(".edit-product-btn").forEach(btn => btn.addEventListener("click", (e) => editarProduto(e.currentTarget.dataset.id)));
        document.querySelectorAll(".delete-product-btn").forEach(btn => btn.addEventListener("click", (e) => deletarProduto(e.currentTarget.dataset.id)));
        document.querySelectorAll(".toggle-product-btn").forEach(btn => btn.addEventListener("click", (e) => toggleProductStatus(e.currentTarget.dataset.id)));
        document.querySelectorAll(".recipe-btn").forEach(btn => btn.addEventListener("click", (e) => openRecipeModal(e.currentTarget.dataset.id)));
    });
}

/**
 * Preenche o formulário de edição de produto.
 * @param {string} id - O ID do produto a ser editado.
 */
function editarProduto(id) {
    const p = produtos.find(produto => produto.id === id);
    if (p) {
        document.getElementById("produto-id").value = p.id;
        document.getElementById("produto-nome").value = p.name;
        document.getElementById("produto-preco").value = p.price;
        document.getElementById("produto-custo").value = p.cost;
        document.getElementById("produto-unidade").value = p.unit;
        document.getElementById("produto-icone").value = p.iconUrl;
        document.getElementById("produto-categoria").value = p.category;
    }
}

/**
 * Deleta um produto do Firebase.
 * @param {string} id - O ID do produto a ser deletado.
 */
function deletarProduto(id) {
    showModal(`<h3 class="text-xl font-bold mb-4">Confirmar Exclusão</h3><p class="mb-6">Tem certeza que deseja excluir este produto?</p><button id="confirm-delete-product-btn" class="bg-red-500 text-white px-6 py-2 rounded-lg">Excluir</button><button onclick="window.closeModal()" class="bg-gray-300 px-4 py-2 rounded-lg ml-2">Cancelar</button>`, () => {
        document.getElementById("confirm-delete-product-btn").addEventListener("click", async () => {
            try { await deleteDoc(doc(db, "produtos", id)); closeModal(); } catch (error) { console.error("Erro ao excluir produto:", error); closeModal(); showModal("Ocorreu um erro ao excluir o produto."); }
        });
    });
}

/**
 * Alterna o status de um produto (ativo/inativo).
 * @param {string} id - O ID do produto a ter o status alterado.
 */
async function toggleProductStatus(id) {
    const produto = produtos.find(p => p.id === id);
    if (produto) {
        const newStatus = !(produto.isActive !== false);
        try { await updateDoc(doc(db, "produtos", id), { isActive: newStatus }); } 
        catch (error) { console.error("Erro ao atualizar status:", error); showModal("Não foi possível atualizar o status do produto."); }
    }
}

/**
 * Carrega as vendas do Firebase e as exibe no painel de administração.
 * @param {string} startDate - A data de início do período do relatório.
 * @param {string} endDate - A data de fim do período do relatório.
 */
function carregarVendasAdmin(startDate = null, endDate = null) {
    const tableBody = document.getElementById("vendas-table-body");
    let vendasQuery = query(collection(db, "pedidos"), orderBy("timestamp", "desc"));

    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Set to end of day
        vendasQuery = query(vendasQuery, where("timestamp", ">=", start), where("timestamp", "<=", end));
    }

    if (unsubscribeVendas) unsubscribeVendas(); // Unsubscribe from previous listener

    unsubscribeVendas = onSnapshot(vendasQuery, async (snapshot) => {
        tableBody.innerHTML = "";
        let totalVendasPeriodo = 0;
        const vendasPromises = snapshot.docs.map(async docSnap => {
            const venda = { id: docSnap.id, ...docSnap.data() };
            totalVendasPeriodo += venda.valor || 0;

            // Calculate cost for each sale
            let custoVenda = 0;
            if (venda.tamanho && venda.quantidade) {
                const produtoTamanho = produtos.find(p => p.name === venda.tamanho && p.category === "tamanho");
                if (produtoTamanho && produtoTamanho.recipe && produtoTamanho.recipe.length > 0) {
                    for (const itemReceita of produtoTamanho.recipe) {
                        const insumo = produtos.find(p => p.name === itemReceita.name && p.category === "insumo");
                        if (insumo && insumo.cost) {
                            custoVenda += (insumo.cost / insumo.unit) * itemReceita.quantity; // Assuming unit is for 1 unit of insumo
                        }
                    }
                }
            }
            venda.custoTotal = custoVenda * venda.quantidade;

            // Update the document with calculated cost if it's a new calculation or different
            if (docSnap.data().custoTotal !== venda.custoTotal) {
                await updateDoc(doc(db, "pedidos", docSnap.id), { custoTotal: venda.custoTotal });
            }

            const dataHora = venda.timestamp ? new Date(venda.timestamp.seconds * 1000).toLocaleString("pt-BR") : "N/A";
            const statusClass = venda.status === "Novo" ? "bg-blue-200 text-blue-800" : venda.status === "Em Preparo" ? "bg-yellow-200 text-yellow-800" : "bg-green-200 text-green-800";
            
            return `
                <tr class="border-b">
                    <td class="p-3 text-sm">${venda.id.substring(0, 5)}...</td>
                    <td class="p-3 text-sm">${dataHora}</td>
                    <td class="p-3">${venda.nomeCliente}</td>
                    <td class="p-3 text-sm">${venda.quantidade}x ${venda.tamanho} (${venda.acompanhamentos})</td>
                    <td class="p-3 text-sm">V: R$${(venda.valor || 0).toFixed(2).replace(".", ",")}<br>C: R$${(venda.custoTotal || 0).toFixed(2).replace(".", ",")}</td>
                    <td class="p-3"><span class="${statusClass} px-2 py-1 rounded-full text-xs font-semibold">${venda.status}</span></td>
                    <td class="p-3">
                        <select class="status-select p-1 border rounded text-xs" data-id="${venda.id}">
                            <option value="Novo" ${venda.status === "Novo" ? "selected" : ""}>Novo</option>
                            <option value="Em Preparo" ${venda.status === "Em Preparo" ? "selected" : ""}>Em Preparo</option>
                            <option value="Concluído" ${venda.status === "Concluído" ? "selected" : ""}>Concluído</option>
                            <option value="Cancelado" ${venda.status === "Cancelado" ? "selected" : ""}>Cancelado</option>
                        </select>
                        <button class="delete-venda-btn bg-red-500 text-white px-2 py-1 rounded text-xs mt-1" data-id="${venda.id}">🗑️</button>
                    </td>
                </tr>`;
        });

        const vendasHTML = await Promise.all(vendasPromises);
        tableBody.innerHTML = vendasHTML.join("");
        document.getElementById("total-vendas").innerText = `R$${totalVendasPeriodo.toFixed(2).replace(".", ",")}`;

        document.querySelectorAll(".status-select").forEach(select => {
            select.addEventListener("change", async (e) => {
                const vendaId = e.currentTarget.dataset.id;
                const newStatus = e.currentTarget.value;
                try { await updateDoc(doc(db, "pedidos", vendaId), { status: newStatus }); } 
                catch (error) { console.error("Erro ao atualizar status:", error); showToast("Não foi possível atualizar o status.", "error"); }
            });
        });
        document.querySelectorAll(".delete-venda-btn").forEach(btn => btn.addEventListener("click", e => deletarVenda(e.currentTarget.dataset.id)));

        if (!initialVendasLoadComplete) {
            initialVendasLoadComplete = true;
            // Trigger initial calculation of cash flow after first sales load
            carregarFluxoCaixa();
        }
    }, (error) => {
        console.error("Erro ao carregar vendas:", error);
        tableBody.innerHTML = `<tr><td colspan="7" class="p-3 text-red-500 text-center">Erro ao carregar vendas.</td></tr>`;
    });
}

/**
 * Deleta uma venda do Firebase.
 * @param {string} id - O ID da venda a ser deletada.
 */
function deletarVenda(id) {
    showModal(`<h3 class="text-xl font-bold mb-4">Confirmar Exclusão</h3><p class="mb-6">Tem certeza que deseja excluir esta venda?</p><button id="confirm-delete-venda-btn" class="bg-red-500 text-white px-6 py-2 rounded-lg">Excluir</button><button onclick="window.closeModal()" class="bg-gray-300 px-4 py-2 rounded-lg ml-2">Cancelar</button>`, () => {
        document.getElementById("confirm-delete-venda-btn").addEventListener("click", async () => {
            try { await deleteDoc(doc(db, "pedidos", id)); closeModal(); } catch (error) { console.error("Erro ao excluir venda:", error); closeModal(); showModal("Ocorreu um erro ao excluir a venda."); }
        });
    });
}

/**
 * Salva as configurações da loja no Firebase.
 */
async function salvarConfiguracoes() {
    const whatsappNumber = document.getElementById("whatsapp-number").value.trim();
    const mensagemFechado = document.getElementById("mensagem-fechado").value.trim();
    const dias = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
    const horarios = {};

    dias.forEach(dia => {
        horarios[dia] = {
            aberto: document.getElementById(`${dia}-aberto`).checked,
            abertura: document.getElementById(`${dia}-abertura`).value,
            fechamento: document.getElementById(`${dia}-fechamento`).value,
        };
    });

    try {
        await setDoc(doc(db, "configuracoes", "horarios"), { whatsappNumber, mensagemFechado, ...horarios });
        showToast("Configurações salvas com sucesso!", "success");
    } catch (error) {
        console.error("Erro ao salvar configurações:", error);
        showToast("Não foi possível salvar as configurações.", "error");
    }
}

/**
 * Carrega as configurações da loja do Firebase e as exibe no painel de administração.
 */
function carregarConfiguracoesAdmin() {
    getDoc(doc(db, "configuracoes", "horarios")).then(docSnap => {
        if (docSnap.exists()) {
            const config = docSnap.data();
            document.getElementById("whatsapp-number").value = config.whatsappNumber || "";
            document.getElementById("mensagem-fechado").value = config.mensagemFechado || "";
            const dias = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
            dias.forEach(dia => {
                if (config[dia]) {
                    document.getElementById(`${dia}-aberto`).checked = config[dia].aberto;
                    document.getElementById(`${dia}-abertura`).value = config[dia].abertura;
                    document.getElementById(`${dia}-fechamento`).value = config[dia].fechamento;
                }
            });
        }
    }).catch(error => console.error("Erro ao carregar configurações:", error));
}

/**
 * Salva uma transação no Firebase.
 */
async function salvarTransacao() {
    const id = document.getElementById("transacao-id").value;
    const descricao = document.getElementById("transacao-descricao").value.trim();
    const valor = parseFloat(document.getElementById("transacao-valor").value);
    const tipo = document.getElementById("transacao-tipo").value;

    if (!descricao || isNaN(valor) || valor <= 0) { showModal("Descrição e Valor válido são obrigatórios para a transação."); return; }

    const transacao = { descricao, valor, tipo, timestamp: serverTimestamp() };

    try {
        if (id) { await updateDoc(doc(db, "fluxoCaixa", id), transacao); } 
        else { await addDoc(collection(db, "fluxoCaixa"), transacao); }
        document.getElementById("transacao-id").value = "";
        document.getElementById("transacao-descricao").value = "";
        document.getElementById("transacao-valor").value = "";
        showToast("Transação salva com sucesso!", "success");
    } catch (error) {
        console.error("Erro ao salvar transação:", error);
        showToast("Não foi possível salvar a transação.", "error");
    }
}

/**
 * Carrega o fluxo de caixa do Firebase e o exibe no painel de administração.
 * @param {string} startDate - A data de início do período do relatório.
 * @param {string} endDate - A data de fim do período do relatório.
 */
function carregarFluxoCaixa(startDate = null, endDate = null) {
    const tableBody = document.getElementById("caixa-table-body");
    let caixaQuery = query(collection(db, "fluxoCaixa"), orderBy("timestamp", "desc"));

    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Set to end of day
        caixaQuery = query(caixaQuery, where("timestamp", ">=", start), where("timestamp", "<=", end));
    }

    if (unsubscribeFluxoCaixa) unsubscribeFluxoCaixa();

    unsubscribeFluxoCaixa = onSnapshot(caixaQuery, (snapshot) => {
        tableBody.innerHTML = "";
        let totalEntradas = 0;
        let totalSaidas = 0;

        snapshot.docs.forEach(docSnap => {
            const t = { id: docSnap.id, ...docSnap.data() };
            const valor = t.valor || 0;
            if (t.tipo === "entrada") { totalEntradas += valor; } else { totalSaidas += valor; }

            const data = t.timestamp ? new Date(t.timestamp.seconds * 1000).toLocaleDateString("pt-BR") : "N/A";
            const tipoClass = t.tipo === "entrada" ? "text-green-600" : "text-red-600";
            tableBody.innerHTML += `\n                    <tr class="border-b">\n                        <td class="p-3 text-sm">${data}</td><td class="p-3">${t.descricao}</td>\n                        <td class="p-3 font-semibold ${tipoClass} capitalize">${t.tipo}</td>\n                        <td class="p-3 font-medium">R$${valor.toFixed(2).replace(".", ",")}</td>\n                        <td class="p-3"><button class="delete-transacao-btn bg-red-500 text-white px-2 py-1 rounded text-xs" data-id="${t.id}">🗑️</button></td>\n                    </tr>`;
        });
        
        document.getElementById("total-entradas").innerText = `R$${totalEntradas.toFixed(2).replace(".", ",")}`;
        document.getElementById("total-saidas").innerText = `R$${totalSaidas.toFixed(2).replace(".", ",")}`;
        document.getElementById("saldo-atual").innerText = `R$${(totalEntradas - totalSaidas).toFixed(2).replace(".", ",")}`;

        document.querySelectorAll(".delete-transacao-btn").forEach(btn => btn.addEventListener("click", e => deletarTransacao(e.currentTarget.dataset.id)));
    });
}

/**
 * Deleta uma transação do Firebase.
 * @param {string} id - O ID da transação a ser deletada.
 */
function deletarTransacao(id) {
    const confirmationHTML = `<h3 class="text-xl font-bold mb-4">Confirmar Exclusão</h3><p class="mb-6">Tem certeza que deseja excluir este lançamento?</p><button id="confirm-delete-transacao-btn" class="bg-red-500 text-white px-6 py-2 rounded-lg">Excluir</button><button onclick="window.closeModal()" class="bg-gray-300 px-4 py-2 rounded-lg ml-2">Cancelar</button>`;
    showModal(confirmationHTML, () => {
        document.getElementById("confirm-delete-transacao-btn").addEventListener("click", async () => {
            try { await deleteDoc(doc(db, "fluxoCaixa", id)); closeModal(); } catch (error) { console.error("Erro ao excluir transação:", error); closeModal(); showModal("Ocorreu um erro ao excluir."); }
        });
    });
}

/**
 * Verifica se a loja está aberta com base no horário de funcionamento configurado.
 */
function checkStoreOpen() {
    const dias = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
    const agora = new Date();
    const diaSemana = dias[agora.getDay()];
    const horaAtual = agora.getHours() * 60 + agora.getMinutes();
    const configDia = storeSettings[diaSemana];
    
    const avisoLojaFechada = document.getElementById("loja-fechada-aviso");
    const msgLojaFechada = document.getElementById("mensagem-loja-fechada");

    if (!configDia || !configDia.aberto || !configDia.abertura || !configDia.fechamento) { 
        isStoreOpen = true; // Assume a loja aberta se não houver configuração
    } else {
        const [aberturaH, aberturaM] = configDia.abertura.split(":").map(Number);
        const [fechamentoH, fechamentoM] = configDia.fechamento.split(":").map(Number);
        const aberturaTotal = aberturaH * 60 + aberturaM;
        const fechamentoTotal = fechamentoH * 60 + fechamentoM;
        isStoreOpen = horaAtual >= aberturaTotal && horaAtual < fechamentoTotal;
    }
    
    const buttons = [sendOrderBtnMobile, sendOrderBtnDesktop];
    buttons.forEach(btn => {
        if (btn) {
            if (isStoreOpen) { 
                btn.disabled = false; 
                btn.classList.remove("bg-gray-400", "cursor-not-allowed"); 
                btn.classList.add("bg-green-500", "hover:bg-green-600"); 
                avisoLojaFechada.classList.add("hidden");
            } else { 
                btn.disabled = true; 
                btn.classList.add("bg-gray-400", "cursor-not-allowed"); 
                btn.classList.remove("bg-green-500", "hover:bg-green-600"); 
                avisoLojaFechada.classList.remove("hidden");
                msgLojaFechada.innerText = storeSettings.mensagemFechado || "Estamos fechados no momento.";
            }
        }
    });
}

/**
 * Abre o modal de receita para um produto.
 * @param {string} id - O ID do produto.
 */
function openRecipeModal(id) {
    const produtoTamanho = produtos.find(p => p.id === id);
    if (!produtoTamanho) return;

    const insumos = produtos.filter(p => p.category === "insumo");
    let insumosHTML = insumos.map(insumo => {
        const itemReceita = produtoTamanho.recipe?.find(r => r.name === insumo.name);
        const quantidade = itemReceita ? itemReceita.quantity : 0;
        return `\n                <div class="flex justify-between items-center mb-2">\n                    <label for="recipe-${insumo.id}">${insumo.name} (${insumo.unit})</label>\n                    <input type="number" id="recipe-${insumo.id}" data-name="${insumo.name}" value="${quantidade}" class="w-24 p-1 border rounded text-center" placeholder="Qtd.">\n                </div>\n            `;
    }).join("");

    const modalContent = `\n            <div class="text-left">\n                <h3 class="text-xl font-bold mb-4 text-purple-700">Ficha Técnica para ${produtoTamanho.name}</h3>\n                <div id="recipe-form" class="max-h-96 overflow-y-auto p-2">${insumosHTML}</div>\n                <div class="mt-6 text-right">\n                    <button id="save-recipe-btn" class="bg-green-500 text-white px-6 py-2 rounded-lg">Salvar Receita</button>\n                    <button onclick="window.closeModal()" class="bg-gray-300 px-4 py-2 rounded-lg ml-2">Cancelar</button>\n                </div>\n            </div>\n        `;

    showModal(modalContent, () => {
        document.getElementById("save-recipe-btn").addEventListener("click", () => salvarReceita(id));
    });
}

/**
 * Salva a receita de um produto no Firebase.
 * @param {string} id - O ID do produto.
 */
async function salvarReceita(id) {
    const recipe = [];
    document.querySelectorAll("#recipe-form input").forEach(input => {
        const quantity = parseFloat(input.value);
        if (quantity > 0) {
            recipe.push({
                name: input.dataset.name,
                quantity: quantity
            });
        }
    });

    try {
        await updateDoc(doc(db, "produtos", id), { recipe: recipe });
        closeModal();
        showModal("Receita salva com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar receita:", error);
        showModal("Não foi possível salvar a receita.");
    }
}

// Observador de configurações.
onSnapshot(doc(db, "configuracoes", "horarios"), (doc) => {
    if (doc.exists()) { storeSettings = doc.data(); } else { storeSettings = { mensagemFechado: "Horário não configurado." }; }
    checkStoreOpen();
}, (error) => {
    console.error("Erro ao carregar configurações:", error.message);
    storeSettings = { mensagemFechado: "Não foi possível verificar o horário." };
    isStoreOpen = true; 
    checkStoreOpen();
});

// Observador de produtos.
onSnapshot(collection(db, "produtos"), (snapshot) => {
    produtos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderMenu();
    calcularValor();
}, (error) => {
    console.error("Erro ao carregar produtos:", error);
    document.getElementById("menu-container").innerHTML = "<p class=\"text-red-600 text-center\">Não foi possível carregar o cardápio.</p>";
});

// Observador de combos.
onSnapshot(collection(db, "combos"), (snapshot) => {
    combos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderCombosMenu();
}, (error) => {
    console.error("Erro ao carregar combos:", error);
    document.getElementById("combos-section").classList.add("hidden");
});



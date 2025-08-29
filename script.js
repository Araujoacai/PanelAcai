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

// --- NOVA ESTRUTURA PARA GERENCIAR O PEDIDO ---
let pedidoAtual = []; // Array para guardar os objetos de cada copo
let copoAtualIndex = 0; // Índice do copo que está sendo editado

const menuContainer = document.getElementById('menu-container');
const adminPanel = document.getElementById('admin-panel');
const whatsappBar = document.getElementById('whatsapp-bar');
const adminLoginBtn = document.getElementById('admin-login-button');
const adminLogoutBtn = document.getElementById('admin-logout-button');
const modalContainer = document.getElementById('modal-container');
const sendOrderBtnMobile = document.getElementById('send-order-button-mobile');
const sendOrderBtnDesktop = document.getElementById('send-order-button-desktop');

// Função para inicializar o pedido com um copo
function inicializarPedido() {
    pedidoAtual = [{
        tamanho: null,
        acompanhamentos: [],
        apenasAcai: false,
        observacoes: '',
        preco: 0
    }];
    copoAtualIndex = 0;
    document.getElementById('quantidade').value = 1;
    atualizarFormularioParaCopoAtual();
    renderizarResumoPedido();
    calcularValor();
}

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

onAuthStateChanged(auth, user => {
    if (user) {
        adminLoginBtn.classList.add('hidden'); adminLogoutBtn.classList.remove('hidden'); menuContainer.classList.add('hidden'); whatsappBar.classList.add('hidden'); adminPanel.classList.remove('hidden');
        renderAdminPanel();
    } else {
        adminLoginBtn.classList.remove('hidden'); adminLogoutBtn.classList.add('hidden'); menuContainer.classList.remove('hidden'); whatsappBar.classList.remove('hidden'); adminPanel.classList.add('hidden');
        if (unsubscribeVendas) unsubscribeVendas();
        if (unsubscribeFluxoCaixa) unsubscribeFluxoCaixa();
        initialVendasLoadComplete = false;
    }
});

adminLoginBtn.addEventListener('click', () => {
    const loginFormHTML = `<h3 class="text-xl font-bold mb-4">Login Admin</h3><input type="email" id="email" placeholder="Email" class="w-full p-2 border rounded mb-2"><input type="password" id="password" placeholder="Senha" class="w-full p-2 border rounded mb-4"><button id="login-submit" class="bg-purple-600 text-white px-6 py-2 rounded-lg">Entrar</button><button onclick="window.closeModal()" class="bg-gray-300 px-4 py-2 rounded-lg ml-2">Cancelar</button>`;
    showModal(loginFormHTML, () => {
         document.getElementById('login-submit').addEventListener('click', async () => {
            try { await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value); closeModal(); } catch (error) { console.error("Erro de login:", error); alert("Email ou senha inválidos."); }
        });
    });
});

adminLogoutBtn.addEventListener('click', () => signOut(auth));

function renderMenu() {
    const containers = { tamanho: document.getElementById('tamanhos-container'), fruta: document.getElementById('frutas-container'), creme: document.getElementById('cremes-container'), outro: document.getElementById('outros-container') };
    Object.values(containers).forEach(c => c.innerHTML = '');
    precosBase = {};
    const produtosVisiveis = produtos.filter(p => p.category !== 'insumo' && p.isActive !== false);
    if (produtosVisiveis.length === 0) { Object.values(containers).forEach(c => c.innerHTML = '<p class="text-red-500 text-sm col-span-2">Nenhum item. Faça login como admin para adicionar produtos.</p>'); return; }
    
    produtosVisiveis.forEach(p => {
        const pId = p.name.replace(/[^a-zA-Z0-9]/g, ''); // Create a safe ID
        if (p.category === 'tamanho') {
            precosBase[p.name] = p.price;
            containers.tamanho.innerHTML += `<label class="flex items-center justify-between bg-purple-100 px-4 py-3 rounded-2xl shadow cursor-pointer hover:bg-purple-200 transition"><div><span class="font-medium text-gray-800">${p.name}</span><span class="ml-3 text-sm text-gray-600">R$${p.price.toFixed(2)}</span></div><input type="radio" name="tamanho" value="${p.name}" class="accent-pink-500"></label>`;
        } else {
            const bgColor = p.category === 'fruta' ? 'bg-pink-100 hover:bg-pink-200' : p.category === 'creme' ? 'bg-purple-100 hover:bg-purple-200' : 'bg-violet-200 hover:bg-violet-300';
            const accentColor = p.category === 'fruta' ? 'accent-purple-600' : 'accent-pink-600';
            if(containers[p.category]) { 
                containers[p.category].innerHTML += `
                <label class="flex items-center ${bgColor} px-3 py-2 rounded-xl shadow cursor-pointer">
                    <img src="${p.iconUrl}" alt="${p.name}" class="card-img flex-shrink-0" onerror="this.style.display='none'">
                    <input type="checkbox" value="${p.name}" data-qty-target="qty-${pId}" class="acompanhamento-check mx-2 ${accentColor} flex-shrink-0">
                    <span class="flex-grow truncate">${p.name}</span>
                    <input type="number" value="1" min="1" id="qty-${pId}" class="acompanhamento-qty w-14 text-center border rounded-md hidden p-1 ml-2 flex-shrink-0">
                </label>`;
            }
        }
    });

    document.querySelectorAll('.acompanhamento-check').forEach(check => {
        check.addEventListener('change', (e) => {
            const qtyInput = document.getElementById(e.target.dataset.qtyTarget);
            if (e.target.checked) {
                qtyInput.classList.remove('hidden');
                qtyInput.value = 1;
            } else {
                qtyInput.classList.add('hidden');
            }
            calcularValor();
        });
    });

    document.querySelectorAll('input, textarea').forEach(el => { 
        el.addEventListener("change", calcularValor); 
        el.addEventListener("input", calcularValor); 
    });
    document.getElementById('apenas-acai-check').addEventListener('change', calcularValor);
    
    // NOVO: Adiciona listener para o campo de quantidade
    document.getElementById('quantidade').addEventListener('input', atualizarQuantidadeCopos);
    
    inicializarPedido(); // Inicia o pedido com 1 copo
}

function renderizarResumoPedido() {
    const container = document.getElementById('resumo-pedido-container');
    if (!container) return;
    container.innerHTML = '';

    pedidoAtual.forEach((copo, index) => {
        const isAtivo = index === copoAtualIndex;
        const activeClass = isAtivo 
            ? 'border-2 border-purple-600 bg-purple-50 shadow-md' 
            : 'border border-gray-300 bg-white hover:bg-gray-50';

        const acompanhamentosHTML = copo.acompanhamentos.map(a => 
            `<li class="text-xs">- ${a.name} (x${a.quantity})</li>`
        ).join('');

        const precoCopo = copo.preco ? `R$${copo.preco.toFixed(2).replace(".", ",")}` : "—";

        const cardHTML = `
            <div class="p-3 rounded-xl cursor-pointer transition-all ${activeClass}">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-purple-800 font-bold">🥤 Copo ${index + 1}</span>
                    <span class="text-sm text-gray-700">${copo.tamanho || 'Sem tamanho'}</span>
                </div>
                <ul class="text-sm text-gray-600">
                    ${copo.acompanhamentos.length > 0 ? acompanhamentosHTML : '<li class="text-gray-400">Nenhum acompanhamento</li>'}
                </ul>
                <div class="flex justify-between items-center mt-2">
                    <span class="font-semibold text-green-700">💰 ${precoCopo}</span>
                    <button onclick="window.selecionarCopoParaEdicao(${index})"
                        class="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1 rounded-lg shadow">
                        Editar
                    </button>
                </div>
            </div>
        `;
        container.innerHTML += cardHTML;
    });
}
// NOVA FUNÇÃO: Atualiza a quantidade de copos no pedido
function atualizarQuantidadeCopos() {
    const novaQuantidade = parseInt(document.getElementById('quantidade').value) || 1;
    const diferenca = novaQuantidade - pedidoAtual.length;

    if (diferenca > 0) {
        for (let i = 0; i < diferenca; i++) {
            // Adiciona novos copos, copiando a configuração do último
            const ultimoCopo = pedidoAtual[pedidoAtual.length - 1];
            pedidoAtual.push(JSON.parse(JSON.stringify(ultimoCopo)));
        }
    } else if (diferenca < 0) {
        pedidoAtual.splice(novaQuantidade);
    }

    if (copoAtualIndex >= novaQuantidade) {
        copoAtualIndex = novaQuantidade - 1;
    }

    renderizarResumoPedido();
    atualizarFormularioParaCopoAtual();
    calcularValor();
}

// NOVA FUNÇÃO: Seleciona um copo para edição
window.selecionarCopoParaEdicao = (index) => {
    if (index === copoAtualIndex) return; // Não faz nada se já estiver selecionado
    copoAtualIndex = index;
    atualizarFormularioParaCopoAtual();
    renderizarResumoPedido();
};

// NOVA FUNÇÃO: Sincroniza o formulário com os dados do copo atual
function atualizarFormularioParaCopoAtual() {
    const copo = pedidoAtual[copoAtualIndex];
    if (!copo) return;

    // Reseta o formulário
    document.querySelectorAll('input[name="tamanho"]').forEach(el => el.checked = false);
    document.querySelectorAll('.acompanhamento-check').forEach(el => {
        el.checked = false;
        const qtyInput = document.getElementById(el.dataset.qtyTarget);
        if (qtyInput) qtyInput.classList.add('hidden');
    });

    // Preenche com os dados do copo selecionado
    if (copo.tamanho) {
        const tamanhoEl = document.querySelector(`input[name="tamanho"][value="${copo.tamanho}"]`);
        if (tamanhoEl) tamanhoEl.checked = true;
    }

    copo.acompanhamentos.forEach(acomp => {
        const checkEl = document.querySelector(`.acompanhamento-check[value="${acomp.name}"]`);
        if (checkEl) {
            checkEl.checked = true;
            const qtyInput = document.getElementById(checkEl.dataset.qtyTarget);
            qtyInput.classList.remove('hidden');
            qtyInput.value = acomp.quantity;
        }
    });

    document.getElementById('apenas-acai-check').checked = copo.apenasAcai;
}


function renderCombosMenu() { /* ...código inalterado... */ }

// FUNÇÃO MODIFICADA: `calcularValor` agora calcula para cada copo
function calcularValor() {
    if (!pedidoAtual || pedidoAtual.length === 0) return;

    // 1. Atualiza o objeto do copo atual com base no formulário
    const copo = pedidoAtual[copoAtualIndex];
    const tamanhoEl = document.querySelector('input[name="tamanho"]:checked');
    copo.tamanho = tamanhoEl ? tamanhoEl.value : null;
    copo.apenasAcai = document.getElementById('apenas-acai-check').checked;
    
    copo.acompanhamentos = [];
    document.querySelectorAll('.acompanhamento-check:checked').forEach(check => {
        const nome = check.value;
        const qtyInput = document.getElementById(check.dataset.qtyTarget);
        const qty = parseInt(qtyInput.value) || 1;
        copo.acompanhamentos.push({ name: nome, quantity: qty });
    });

    // 2. Calcula o preço do copo atual
    let precoCopo = 0;
    if (copo.tamanho) {
        let precoBase = precosBase[copo.tamanho] || 0;
        let adicionais = 0;
        let totalPorcoes = copo.acompanhamentos.reduce((sum, item) => sum + item.quantity, 0);

        const rulesText = document.getElementById('acompanhamentos-rules');
        if (copo.apenasAcai) {
            adicionais = totalPorcoes * 3;
            rulesText.textContent = 'Todos os acompanhamentos são cobrados como extra (R$3 cada).';
        } else {
            adicionais = totalPorcoes > 3 ? (totalPorcoes - 3) * 3 : 0;
            rulesText.textContent = '3 porções por copo | Adicional R$3 por porção extra';
        }
        precoCopo = precoBase + adicionais;
    }
    copo.preco = precoCopo;

    // 3. Soma o preço de TODOS os copos no pedido
    const totalPedido = pedidoAtual.reduce((total, c) => total + c.preco, 0);
    const totalText = "R$" + totalPedido.toFixed(2).replace(".", ",");
    
    document.getElementById("valor-mobile").innerText = totalText;
    document.getElementById("valor-desktop").innerText = totalText;
    
    // 4. Re-renderiza o resumo para mostrar os dados atualizados
    renderizarResumoPedido();
}

// FUNÇÃO MODIFICADA: resetarFormulario agora usa a nova estrutura
function resetarFormulario() {
    document.getElementById('nome-cliente').value = '';
    document.getElementById('telefone-cliente').value = '';
    document.getElementById('observacoes').value = '';
    inicializarPedido(); // Reinicia o pedido para o estado inicial
}

function handleOrderAction() {
    if (isStoreOpen) { enviarPedido(); } else { showModal(storeSettings.mensagemFechado || "Desculpe, estamos fechados no momento."); }
}
sendOrderBtnMobile.addEventListener('click', handleOrderAction);
sendOrderBtnDesktop.addEventListener('click', handleOrderAction);

// FUNÇÃO MODIFICADA: enviarPedido agora envia cada copo individualmente
async function enviarPedido() {
    if (!isStoreOpen) return;
    
    for (const [index, copo] of pedidoAtual.entries()) {
        if (!copo.tamanho) {
            showModal(`Por favor, selecione o tamanho do Copo ${index + 1}!`);
            return;
        }
        if (!copo.apenasAcai && copo.acompanhamentos.length === 0) {
            showModal(`Por favor, selecione ao menos 1 acompanhamento para o Copo ${index + 1} ou marque 'Somente Açaí'.`);
            return;
        }
    }

    const nomeCliente = document.getElementById('nome-cliente').value.trim();
    if (!nomeCliente) { showModal("Por favor, digite seu nome!"); return; }
    const telefoneCliente = document.getElementById('telefone-cliente').value.trim();
    if (!telefoneCliente) { showModal("Por favor, digite seu telefone!"); return; }
    
    const observacoesGerais = document.getElementById("observacoes").value;
    const valorTotal = document.getElementById("valor-mobile").innerText;
    
    // Gerar ID do Pedido
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

    // Montar mensagem do WhatsApp
    let itensText = pedidoAtual.map((copo, index) => {
        const acompanhamentosText = copo.acompanhamentos.map(a => `${a.name} (x${a.quantity})`).join("\n- ");
        return `\n--- *Copo ${index + 1} (${copo.tamanho})* ---\n*Acompanhamentos:*\n- ${copo.acompanhamentos.length > 0 ? acompanhamentosText : 'Nenhum (Somente Açaí)'}`;
    }).join("\n");

    const numero = storeSettings.whatsappNumber || "5514991962607";
    const msg = `*Novo Pedido: ${orderId}*\n\n*Cliente:* ${nomeCliente}\n*Telefone:* ${telefoneCliente}\n\nOlá! Gostaria de fazer o seguinte pedido:\n${itensText}\n\n📝 *Observações Gerais:* ${observacoesGerais || "Nenhuma"}\n\n💰 *Valor Total: ${valorTotal}*`;
    
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, "_blank");

    // Salvar no Firebase
    try { 
        // A estrutura salva agora contém um array `itens` com os detalhes de cada copo
        await addDoc(collection(db, "vendas"), { 
            orderId, 
            nomeCliente, 
            telefoneCliente, 
            itens: pedidoAtual, // Salva o array de copos
            observacoes: observacoesGerais || "Nenhuma", 
            total: valorTotal, 
            status: "pendente", 
            timestamp: serverTimestamp() 
        }); 
        showModal("Pedido enviado com sucesso! Agradecemos a preferência.");
        resetarFormulario();
    } catch (e) { 
        console.error("Erro ao salvar venda: ", e); 
        showModal("Ocorreu um erro ao salvar seu pedido no nosso sistema, mas você pode enviá-lo pelo WhatsApp."); 
    }
}

// O restante do seu script.js (funções de Admin, Combos, etc.) permanece o mesmo.
// Cole o restante do seu arquivo original a partir daqui.

// ... (cole aqui as funções: window.closeModal, window.pedirCombo, renderAdminPanel, etc...)
// ... todo o resto do seu código original ...

window.closeModal = closeModal;

window.pedirCombo = async (comboId) => { /* ...código inalterado... */ };

function renderAdminPanel() { /* ...código inalterado... */ }

function renderProdutosAdmin() { /* ...código inalterado... */ }

function renderCombosAdmin() { /* ...código inalterado... */ }

async function salvarCombo() { /* ...código inalterado... */ }

function carregarCombosAdmin() { /* ...código inalterado... */ }

function editarCombo(id) { /* ...código inalterado... */ }

function deletarCombo(id) { /* ...código inalterado... */ }

async function toggleComboStatus(id) { /* ...código inalterado... */ }

function renderVendasAdmin() { /* ...código inalterado... */ }

function renderConfigAdmin() { /* ...código inalterado... */ }

function renderCaixaAdmin() { /* ...código inalterado... */ }

async function salvarProduto() { /* ...código inalterado... */ }

function carregarProdutosAdmin() { /* ...código inalterado... */ }

function editarProduto(id) { /* ...código inalterado... */ }

function deletarProduto(id) { /* ...código inalterado... */ }

async function toggleProductStatus(id) { /* ...código inalterado... */ }

function showToast(message) { /* ...código inalterado... */ }

function playNotificationSound() { /* ...código inalterado... */ }

// MODIFIQUE A FUNÇÃO `calcularCustoPedido` e `carregarVendasAdmin` para lidar com a nova estrutura de `itens`
function calcularCustoPedido(venda) {
    if (!venda.itens || !Array.isArray(venda.itens)) { // Fallback para o formato antigo
        // Mantenha a lógica antiga aqui se precisar
        return { custoTotal: 0, lucro: 0 };
    }
    
    let custoTotalPedido = 0;

    venda.itens.forEach(item => {
        let custoItem = 0;
        const tamanhoProduto = produtos.find(p => p.name === item.tamanho && p.category === 'tamanho');

        if (tamanhoProduto) {
            custoItem += tamanhoProduto.cost || 0;
            if (tamanhoProduto.recipe) {
                tamanhoProduto.recipe.forEach(ingrediente => {
                    const insumoData = produtos.find(p => p.name === ingrediente.name && p.category === 'insumo');
                    if (insumoData) {
                        custoItem += (ingrediente.quantity || 0) * (insumoData.cost || 0);
                    }
                });
            }
        }

        if (item.acompanhamentos) {
            item.acompanhamentos.forEach(itemPedido => {
                const acompanhamentoProduto = produtos.find(p => p.name === itemPedido.name);
                if (acompanhamentoProduto) {
                    custoItem += (itemPedido.quantity || 0) * (acompanhamentoProduto.cost || 0);
                }
            });
        }
        custoTotalPedido += custoItem;
    });

    const valorVenda = parseFloat(venda.total.replace('R$', '').replace(',', '.'));
    const lucro = valorVenda - custoTotalPedido;

    return { custoTotal: custoTotalPedido, lucro };
}

function carregarVendasAdmin(startDate, endDate) {
    initialVendasLoadComplete = false;
    const tableBody = document.getElementById('vendas-table-body');
    let q = query(collection(db, "vendas"), orderBy("timestamp", "desc"));

    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        q = query(collection(db, "vendas"), where("timestamp", ">=", start), where("timestamp", "<=", end), orderBy("timestamp", "desc"));
    }
    
    if (unsubscribeVendas) unsubscribeVendas();

    unsubscribeVendas = onSnapshot(q, (snapshot) => {
        if (initialVendasLoadComplete && snapshot.docChanges().some(change => change.type === 'added')) {
            playNotificationSound();
            showToast("Novo Pedido Recebido!");
            document.getElementById('tab-vendas').click();
        }
        
        tableBody.innerHTML = '';
        let totalVendas = 0;

        if (snapshot.empty) { 
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center p-4">Nenhuma venda encontrada.</td></tr>';
            document.getElementById('total-vendas').innerText = 'R$0,00';
        } else {
            snapshot.docs.forEach(docSnap => {
                const venda = { id: docSnap.id, ...docSnap.data() };
                
                const valorNumerico = parseFloat(venda.total.replace('R$', '').replace(',', '.'));
                if (!isNaN(valorNumerico)) { totalVendas += valorNumerico; }

                const data = venda.timestamp ? new Date(venda.timestamp.seconds * 1000).toLocaleString('pt-BR') : 'N/A';
                const statusClass = venda.status === 'pendente' ? 'text-yellow-600' : 'text-green-600';
                
                let pedidoHTML = '';
                let financeiroHTML = '';

                // Lógica para a NOVA estrutura de `itens`
                if (venda.itens && Array.isArray(venda.itens)) {
                    pedidoHTML = venda.itens.map((item, index) => {
                        const acompText = (item.acompanhamentos || []).map(a => `${a.name}(x${a.quantity})`).join(', ');
                        return `<strong>Copo ${index + 1} (${item.tamanho}):</strong><br><small class="text-gray-500">${acompText || 'Apenas Açaí'}</small>`;
                    }).join('<hr class="my-1">');
                     pedidoHTML += `<br><small class="text-blue-500 font-semibold">Obs: ${venda.observacoes}</small>`;
                     const { custoTotal, lucro } = calcularCustoPedido(venda);
                     financeiroHTML = `Venda: ${venda.total}<br><small class="text-red-500">Custo: R$${custoTotal.toFixed(2)}</small><br><strong class="text-green-600">Lucro: R$${lucro.toFixed(2)}</strong>`;
                }
                // Lógica para pedidos de COMBO
                else if (venda.pedidoCombo) {
                    pedidoHTML = `<strong>Combo:</strong> ${venda.pedidoCombo}<br><small class="text-gray-500">${venda.observacoes}</small>`;
                    financeiroHTML = `Venda: ${venda.total}<br><small class="text-gray-500">Custo/Lucro não aplicável</small>`;
                }
                // Fallback para pedidos antigos ou inconsistentes
                else {
                    pedidoHTML = `<span class="text-red-500">Pedido com dados inconsistentes</span>`;
                    financeiroHTML = `Venda: ${venda.total}<br><small class="text-gray-500">N/A</small>`;
                }

                tableBody.innerHTML += `
                    <tr class="border-b">
                        <td class="p-3 text-sm font-mono">${venda.orderId || 'N/A'}</td>
                        <td class="p-3 text-sm">${data}</td>
                        <td class="p-3 text-sm font-semibold">${venda.nomeCliente || 'N/A'}<br><small class="text-gray-500 font-normal">${venda.telefoneCliente || ''}</small></td>
                        <td class="p-3 text-sm">${pedidoHTML}</td>
                        <td class="p-3 font-medium">${financeiroHTML}</td>
                        <td class="p-3 font-semibold ${statusClass} capitalize">${venda.status}</td>
                        <td class="p-3">
                            ${venda.status === 'pendente' ? `<button class="confirm-venda-btn bg-green-500 text-white px-2 py-1 rounded text-xs" data-id="${venda.id}">✔️</button>` : ''}
                            <button class="delete-venda-btn bg-red-500 text-white px-2 py-1 rounded text-xs ml-1" data-id="${venda.id}">🗑️</button>
                        </td>
                    </tr>`;
            });
            document.getElementById('total-vendas').innerText = `R$${totalVendas.toFixed(2).replace('.', ',')}`;
        }

        document.querySelectorAll('.confirm-venda-btn').forEach(btn => btn.addEventListener('click', e => confirmarVenda(e.currentTarget.dataset.id)));
        document.querySelectorAll('.delete-venda-btn').forEach(btn => btn.addEventListener('click', e => deletarVenda(e.currentTarget.dataset.id)));
        
        if (!initialVendasLoadComplete) {
            setTimeout(() => { initialVendasLoadComplete = true; }, 2000);
        }
    });
}

async function confirmarVenda(id) { /* ...código inalterado... */ }

function deletarVenda(id) { /* ...código inalterado... */ }

async function salvarConfiguracoes() { /* ...código inalterado... */ }

async function carregarConfiguracoesAdmin() { /* ...código inalterado... */ }

async function salvarTransacao() { /* ...código inalterado... */ }

function carregarFluxoCaixa(startDate, endDate) { /* ...código inalterado... */ }

function deletarTransacao(id) { /* ...código inalterado... */ }

function checkStoreOpen() { /* ...código inalterado... */ }

function openRecipeModal(id) { /* ...código inalterado... */ }

async function salvarReceita(id) { /* ...código inalterado... */ }


// --- LISTENERS FINAIS ---
onSnapshot(doc(db, "configuracoes", "horarios"), (doc) => {
    if (doc.exists()) { storeSettings = doc.data(); } else { storeSettings = { mensagemFechado: "Horário não configurado." }; }
    checkStoreOpen();
}, (error) => {
    console.error("Erro ao carregar configurações:", error.message);
    storeSettings = { mensagemFechado: "Não foi possível verificar o horário." };
    isStoreOpen = true; 
    checkStoreOpen();
});

onSnapshot(collection(db, "produtos"), (snapshot) => {
    produtos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderMenu(); // Esta função agora também chama `inicializarPedido`
}, (error) => {
    console.error("Erro ao carregar produtos:", error);
    document.getElementById('menu-container').innerHTML = '<p class="text-red-600 text-center">Não foi possível carregar o cardápio.</p>';
});

onSnapshot(collection(db, "combos"), (snapshot) => {
    combos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderCombosMenu();
}, (error) => {
    console.error("Erro ao carregar combos:", error);
    document.getElementById('combos-section').classList.add('hidden');
});

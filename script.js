import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, where, orderBy, getDoc, setDoc, runTransaction, getDocs } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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

// ESTADO GLOBAL
let produtos = [];
let combos = [];
let precosBase = {};
let unsubscribeVendas;
let unsubscribeFluxoCaixa;
let storeSettings = {};
let isStoreOpen = true; 
let initialVendasLoadComplete = false;
let pedidoAtual = []; // NOVO: Array para armazenar os copos individuais
let editingCupIndex = -1; // NOVO: Índice do copo sendo editado, -1 se for um novo

const menuContainer = document.getElementById('menu-container');
const adminPanel = document.getElementById('admin-panel');
const whatsappBar = document.getElementById('whatsapp-bar');
const adminLoginBtn = document.getElementById('admin-login-button');
const adminLogoutBtn = document.getElementById('admin-logout-button');
const modalContainer = document.getElementById('modal-container');
const sendOrderBtnMobile = document.getElementById('send-order-button-mobile');
const sendOrderBtnDesktop = document.getElementById('send-order-button-desktop');
const addCupBtn = document.getElementById('add-cup-button');

// #############################################################
// FUNÇÕES QUE FALTAVAM (ESSENCIAIS PARA O FUNCIONAMENTO)
// #############################################################

function showModal(content, onOpen = () => {}) {
    let modalContent = content;
    if (typeof content === 'string') {
        modalContent = `<p class="text-lg text-gray-800 mb-6">${content}</p><button onclick="window.closeModal()" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-8 rounded-lg transition-colors">OK</button>`;
    }
    modalContainer.innerHTML = `<div class="bg-white border border-purple-200 text-gray-800 rounded-2xl p-6 w-full max-w-md text-center shadow-xl transform transition-all scale-95 opacity-0" id="modal-box">${modalContent}</div>`;
    modalContainer.classList.remove('hidden');
    setTimeout(() => { 
        const modalBox = document.getElementById('modal-box');
        if (modalBox) {
            modalBox.classList.remove('scale-95', 'opacity-0');
        }
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
        if (document.body.clientWidth < 1024) { 
             whatsappBar.classList.remove('hidden');
        }
        adminPanel.classList.add('hidden');
        if (unsubscribeVendas) unsubscribeVendas();
        if (unsubscribeFluxoCaixa) unsubscribeFluxoCaixa();
        initialVendasLoadComplete = false;
    }
});

adminLoginBtn.addEventListener('click', () => {
    const loginFormHTML = `<h3 class="text-xl font-bold mb-4">Login Admin</h3><input type="email" id="email" placeholder="Email" class="w-full p-2 border rounded mb-2 bg-gray-100 border-gray-300 text-gray-800"><input type="password" id="password" placeholder="Senha" class="w-full p-2 border rounded mb-4 bg-gray-100 border-gray-300 text-gray-800"><button id="login-submit" class="bg-purple-600 text-white px-6 py-2 rounded-lg">Entrar</button><button onclick="window.closeModal()" class="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg ml-2">Cancelar</button>`;
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


// #############################################################
// CÓDIGO DO CARDÁPIO E PEDIDO (MODIFICADO)
// #############################################################

function renderMenu() {
    const containers = { tamanho: document.getElementById('tamanhos-container'), fruta: document.getElementById('frutas-container'), creme: document.getElementById('cremes-container'), outro: document.getElementById('outros-container') };
    Object.values(containers).forEach(c => { if(c) c.innerHTML = ''; });
    precosBase = {};
    const produtosVisiveis = produtos.filter(p => p.category !== 'insumo' && p.isActive !== false);
    if (produtosVisiveis.length === 0) { Object.values(containers).forEach(c => { if(c) c.innerHTML = '<p class="text-red-500 text-sm col-span-full">Nenhum item. Faça login como admin para adicionar produtos.</p>'; }); return; }
    
    produtosVisiveis.forEach(p => {
        const pId = p.name.replace(/[^a-zA-Z0-9]/g, '');
        if (p.category === 'tamanho' && containers.tamanho) {
            precosBase[p.name] = p.price;
            containers.tamanho.innerHTML += `
                <div>
                    <input type="radio" name="tamanho" value="${p.name}" id="tamanho-${pId}" class="hidden">
                    <label for="tamanho-${pId}" class="radio-label block cursor-pointer p-3 border-2 border-gray-300 rounded-xl text-center bg-gray-50">
                        <span class="font-semibold block">${p.name}</span>
                        <span class="text-sm text-gray-500">R$${p.price.toFixed(2)}</span>
                    </label>
                </div>`;
        } else {
            if(containers[p.category]) { 
                containers[p.category].innerHTML += `
                <div class="relative">
                  <input type="checkbox" value="${p.name}" data-qty-target="qty-${pId}" id="check-${pId}" class="acompanhamento-check hidden">
                   <label for="check-${pId}" class="checkbox-label cursor-pointer flex items-center bg-gray-50 p-3 border-2 border-gray-300 rounded-xl">
                      <img src="${p.iconUrl || 'https://placehold.co/24x24/7c3aed/f3e8ff?text=AC'}" alt="${p.name}" class="w-6 h-6 object-contain mr-3 flex-shrink-0 rounded-full" onerror="this.src='https://placehold.co/24x24/7c3aed/f3e8ff?text=AC'">
                      <span class="flex-grow truncate font-medium">${p.name}</span>
                   </label>
                   <input type="number" value="1" min="1" id="qty-${pId}" class="acompanhamento-qty w-16 text-center border-gray-300 bg-white rounded-md absolute right-2 top-1/2 -translate-y-1/2 p-1 hidden">
                </div>`;
            }
        }
    });

    document.querySelectorAll('.acompanhamento-check').forEach(check => {
        check.addEventListener('change', (e) => {
            const qtyInput = document.getElementById(e.target.dataset.qtyTarget);
            if (e.target.checked) {
                qtyInput.classList.remove('hidden');
                qtyInput.value = 1;
                e.target.nextElementSibling.classList.add('pr-20'); 
            } else {
                qtyInput.classList.add('hidden');
                 e.target.nextElementSibling.classList.remove('pr-20');
            }
        });
    });
}

function renderCombosMenu() {
    const container = document.getElementById('combos-container');
    const section = document.getElementById('combos-section');
    if (!container || !section) return;
    container.innerHTML = '';
    const combosAtivos = combos.filter(c => c.isActive !== false);

    if(combosAtivos.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    combosAtivos.forEach(combo => {
        container.innerHTML += `
            <div class="bg-white/60 p-4 rounded-2xl shadow-md flex flex-col border border-purple-200">
                <img src="${combo.imageUrl || 'https://placehold.co/600x400/f3e8ff/9333ea?text=Combo'}" alt="${combo.name}" class="w-full h-32 object-cover rounded-lg mb-3">
                <h4 class="text-lg font-bold text-purple-800">${combo.name}</h4>
                <p class="text-sm text-gray-600 flex-grow">${combo.description}</p>
                <div class="flex justify-between items-center mt-3">
                    <span class="text-xl font-bold text-green-600">R$${(combo.price || 0).toFixed(2).replace('.', ',')}</span>
                    <button onclick="window.pedirCombo('${combo.id}')" class="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-2 px-4 rounded-lg transition">Pedir</button>
                </div>
            </div>
        `;
    });
}

// MODIFICADO: A função agora calcula o valor total do array `pedidoAtual`
function calcularValorTotal() {
    const total = pedidoAtual.reduce((acc, copo) => acc + copo.valor, 0);
    const totalText = "R$" + total.toFixed(2).replace(".", ",");
    
    const valorMobileEl = document.getElementById("valor-mobile");
    const valorDesktopEl = document.getElementById("valor-desktop");
    if(valorMobileEl) valorMobileEl.innerText = totalText;
    if(valorDesktopEl) valorDesktopEl.innerText = totalText;
}

// NOVO: Reseta apenas o formulário de montagem do copo
function resetarFormularioCopo() {
    document.querySelector('input[name="tamanho"]:checked')?.removeAttribute('checked');
    document.querySelectorAll('input[type="radio"]').forEach(el => el.checked = false);
    document.querySelectorAll('.acompanhamento-check').forEach(el => {
        el.checked = false;
        el.dispatchEvent(new Event('change'));
    });
    document.getElementById('apenas-acai-check').checked = false;
    
    editingCupIndex = -1;
    document.getElementById('editing-cup-index').value = -1;
    addCupBtn.innerText = 'Adicionar Copo ao Pedido';
    addCupBtn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
    addCupBtn.classList.add('bg-purple-600', 'hover:bg-purple-700');
}

// MODIFICADO: Reseta o pedido inteiro, incluindo o array de copos
function resetarFormulario() {
    resetarFormularioCopo();
    pedidoAtual = [];
    renderPedidoAtual(); // Re-renderiza o resumo do pedido (que ficará vazio)

    const dinheiroRadio = document.getElementById('payment-dinheiro');
    if (dinheiroRadio) dinheiroRadio.checked = true;

    document.getElementById('nome-cliente').value = '';
    document.getElementById('telefone-cliente').value = '';
    document.getElementById('observacoes').value = '';
    calcularValorTotal();
}

// NOVO: Renderiza a lista de copos no resumo do pedido
function renderPedidoAtual() {
    const container = document.getElementById('resumo-pedido-container');
    if (pedidoAtual.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500">Seu carrinho está vazio. Monte um copo acima para começar!</p>`;
        calcularValorTotal();
        return;
    }

    container.innerHTML = pedidoAtual.map((copo, index) => {
        const acompanhamentosText = copo.acompanhamentos.length > 0
            ? copo.acompanhamentos.map(a => `${a.name} (x${a.quantity})`).join(', ')
            : 'Apenas Açaí';
        
        return `
            <div class="bg-purple-50 p-4 rounded-xl border border-purple-200 flex justify-between items-start">
                <div class="flex-grow">
                    <p class="font-bold text-purple-800 text-lg">${index + 1}. Copo de ${copo.tamanho}</p>
                    <p class="text-sm text-gray-600">Acompanhamentos: ${acompanhamentosText}</p>
                    <p class="font-semibold text-green-600 mt-1">Valor: R$${copo.valor.toFixed(2).replace('.', ',')}</p>
                </div>
                <div class="flex flex-col gap-2 ml-2">
                    <button onclick="window.editarCopo(${index})" class="bg-yellow-500 text-white p-2 rounded-md hover:bg-yellow-600 text-xs">✏️</button>
                    <button onclick="window.excluirCopo(${index})" class="bg-red-500 text-white p-2 rounded-md hover:bg-red-600 text-xs">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
    
    calcularValorTotal();
}

// NOVO: Adiciona ou atualiza um copo no pedido
function adicionarOuAtualizarCopo() {
    const tamanhoEl = document.querySelector('input[name="tamanho"]:checked');
    if (!tamanhoEl) {
        showModal("Por favor, selecione o tamanho do copo!");
        return;
    }

    const tamanho = tamanhoEl.value;
    const apenasAcai = document.getElementById('apenas-acai-check').checked;
    
    const acompanhamentosSelecionados = [];
    document.querySelectorAll('.acompanhamento-check:checked').forEach(check => {
        const nome = check.value;
        const qtyInput = document.getElementById(check.dataset.qtyTarget);
        const qty = parseInt(qtyInput.value) || 1;
        acompanhamentosSelecionados.push({ name: nome, quantity: qty });
    });

    if (!apenasAcai && acompanhamentosSelecionados.length === 0) {
        showModal("Por favor, selecione ao menos 1 acompanhamento ou marque 'Apenas Açaí'.");
        return;
    }

    let totalPorcoes = acompanhamentosSelecionados.reduce((acc, item) => acc + item.quantity, 0);
    let precoBase = precosBase[tamanho] || 0;
    let adicionais = 0;

    if (apenasAcai) {
        adicionais = totalPorcoes * 3;
    } else {
        adicionais = totalPorcoes > 3 ? (totalPorcoes - 3) * 3 : 0;
    }

    const valorCopo = precoBase + adicionais;

    const copo = {
        tamanho: tamanho,
        acompanhamentos: apenasAcai ? [] : acompanhamentosSelecionados,
        valor: valorCopo
    };

    if (editingCupIndex > -1) {
        // Atualizando um copo existente
        pedidoAtual[editingCupIndex] = copo;
    } else {
        // Adicionando um novo copo
        pedidoAtual.push(copo);
    }
    
    renderPedidoAtual();
    resetarFormularioCopo();
}

addCupBtn.addEventListener('click', adicionarOuAtualizarCopo);

// NOVO: Prepara o formulário para editar um copo
window.editarCopo = (index) => {
    const copo = pedidoAtual[index];
    if (!copo) return;

    // Reseta o formulário antes de preencher
    resetarFormularioCopo();
    
    editingCupIndex = index;
    document.getElementById('editing-cup-index').value = index;

    // Preenche o formulário com os dados do copo
    document.getElementById(`tamanho-${copo.tamanho.replace(/[^a-zA-Z0-9]/g, '')}`).checked = true;

    if (copo.acompanhamentos.length === 0) {
        document.getElementById('apenas-acai-check').checked = true;
    } else {
        copo.acompanhamentos.forEach(item => {
            const pId = item.name.replace(/[^a-zA-Z0-9]/g, '');
            const checkbox = document.getElementById(`check-${pId}`);
            if (checkbox) {
                checkbox.checked = true;
                checkbox.dispatchEvent(new Event('change'));
                const qtyInput = document.getElementById(`qty-${pId}`);
                if(qtyInput) qtyInput.value = item.quantity;
            }
        });
    }

    addCupBtn.innerText = `Atualizar Copo ${index + 1}`;
    addCupBtn.classList.remove('bg-purple-600', 'hover:bg-purple-700');
    addCupBtn.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
    
    document.getElementById('cup-builder-form').scrollIntoView({ behavior: 'smooth' });
}

// NOVO: Exclui um copo do pedido
window.excluirCopo = (index) => {
    pedidoAtual.splice(index, 1);
    renderPedidoAtual();
}

function handleOrderAction() {
    if (isStoreOpen) { enviarPedido(); } else { showModal(storeSettings.mensagemFechado || "Desculpe, estamos fechados no momento."); }
}
sendOrderBtnMobile.addEventListener('click', handleOrderAction);
sendOrderBtnDesktop.addEventListener('click', handleOrderAction);

async function enviarPedido() {
    if (!isStoreOpen) return;
    
    if (pedidoAtual.length === 0) {
        showModal("Seu pedido está vazio! Por favor, monte pelo menos um copo.");
        return;
    }
    
    const nomeCliente = document.getElementById('nome-cliente').value.trim();
    if (!nomeCliente) { showModal("Por favor, digite seu nome!"); return; }
    const telefoneCliente = document.getElementById('telefone-cliente').value.trim();
    if (!telefoneCliente) { showModal("Por favor, digite seu telefone!"); return; }
    
    const observacoes = document.getElementById("observacoes").value;
    const valorTotal = document.getElementById("valor-mobile").innerText;
    
    const paymentMethodEl = document.querySelector('input[name="payment-method"]:checked');
    if (!paymentMethodEl) { showModal("Por favor, selecione a forma de pagamento!"); return; }
    const paymentMethod = paymentMethodEl.value;
    
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
            
            transaction.set(counterRef, { 
                lastOrderNumber: newCount,
                lastOrderDate: todayStr 
            });

            const paddedCount = String(newCount).padStart(3, '0');
            return `${displayDate}-${paddedCount}`;
        });
    } catch (e) {
        console.error("Transaction failed: ", e);
        showModal("Não foi possível gerar o ID do pedido. Tente novamente.");
        return;
    }

    const numero = storeSettings.whatsappNumber || "5514991962607";
    
    const coposText = pedidoAtual.map((copo, index) => {
        const acompanhamentosText = copo.acompanhamentos.length > 0
            ? "\n- " + copo.acompanhamentos.map(a => `${a.name} (x${a.quantity})`).join("\n- ")
            : ' (Apenas Açaí)';
        return `*${index + 1}º Copo (${copo.tamanho})*${acompanhamentosText}`;
    }).join('\n\n');

    const msg = `*Novo Pedido: ${orderId}*\n\n*Cliente:* ${nomeCliente}\n*Telefone:* ${telefoneCliente}\n\n*Itens do Pedido:*\n${coposText}\n\n📝 *Observações Gerais:* ${observacoes || "Nenhuma"}\n\n*Forma de Pagamento:* ${paymentMethod}\n\n💰 *Valor Total: ${valorTotal}*`;
    
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, "_blank");

    try { 
        const vendaData = {
            orderId,
            nomeCliente,
            telefoneCliente,
            copos: pedidoAtual,
            observacoes: observacoes || "Nenhuma",
            total: valorTotal,
            status: "pendente",
            paymentMethod: paymentMethod,
            timestamp: serverTimestamp()
        };
        await addDoc(collection(db, "vendas"), vendaData); 
        
        if (paymentMethod === 'PIX') {
            showPixModal(valorTotal, orderId);
        } else {
            showModal("Pedido enviado com sucesso! Agradecemos a preferência.");
        }
        resetarFormulario();

    } catch (e) { 
        console.error("Erro ao salvar venda: ", e); 
        showModal("Ocorreu um erro ao salvar seu pedido no nosso sistema, mas você pode enviá-lo pelo WhatsApp."); 
    }
}

window.closeModal = closeModal;

window.pedirCombo = async (comboId) => {
    if (!isStoreOpen) {
        showModal(storeSettings.mensagemFechado || "Desculpe, estamos fechados no momento.");
        return;
    }
    const combo = combos.find(c => c.id === comboId);
    if (!combo) return;

    const nomeCliente = document.getElementById('nome-cliente').value.trim();
    if (!nomeCliente) { showModal("Por favor, preencha seu nome no formulário principal antes de pedir um combo!"); return; }
    const telefoneCliente = document.getElementById('telefone-cliente').value.trim();
    if (!telefoneCliente) { showModal("Por favor, preencha seu telefone no formulário principal antes de pedir um combo!"); return; }
    
    const paymentMethodEl = document.querySelector('input[name="payment-method"]:checked');
    if (!paymentMethodEl) { showModal("Por favor, selecione a forma de pagamento!"); return; }
    const paymentMethod = paymentMethodEl.value;

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
    const valor = `R$${(combo.price || 0).toFixed(2).replace('.', ',')}`;
    const msg = `*Pedido de Combo: ${orderId}*\n\n*Cliente:* ${nomeCliente}\n*Telefone:* ${telefoneCliente}\n\nOlá! Gostaria de pedir o *${combo.name}*.\n\n*Descrição:* ${combo.description || ''}\n\n*Forma de Pagamento:* ${paymentMethod}\n\n💰 *Valor Total: ${valor}*`;
    
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, "_blank");

    try {
        const vendaData = {
            orderId, nomeCliente, telefoneCliente, pedidoCombo: combo.name, observacoes: combo.description || "", total: valor, status: "pendente", paymentMethod: paymentMethod, timestamp: serverTimestamp()
        };
        await addDoc(collection(db, "vendas"), vendaData);
        
        if (paymentMethod === 'PIX') {
            showPixModal(valor, orderId);
        } else {
            showModal("Pedido do combo enviado com sucesso! Agradecemos a preferência.");
        }

    } catch (e) {
        console.error("Erro ao salvar venda do combo: ", e);
        showModal("Ocorreu um erro ao salvar seu pedido no nosso sistema, mas você pode enviá-lo pelo WhatsApp.");
    }
};

// #############################################################
// CÓDIGO DO PAINEL DE ADMINISTRAÇÃO
// #############################################################

function renderAdminPanel() {
    adminPanel.innerHTML = `
        <h2 class="text-3xl font-bold text-center text-purple-700 mb-6">Painel de Administração</h2>
        <div class="flex border-b border-gray-200 mb-4 overflow-x-auto no-scrollbar">
            <button id="tab-produtos" class="tab-btn py-2 px-4 font-semibold border-b-2 tab-active flex-shrink-0">Gerenciar Produtos</button>
            <button id="tab-combos" class="tab-btn py-2 px-4 font-semibold border-b-2 border-transparent flex-shrink-0">Gerenciar Combos</button>
            <button id="tab-vendas" class="tab-btn py-2 px-4 font-semibold border-b-2 border-transparent flex-shrink-0">Relatório de Vendas</button>
            <button id="tab-caixa" class="tab-btn py-2 px-4 font-semibold border-b-2 border-transparent flex-shrink-0">Fluxo de Caixa</button>
            <button id="tab-config" class="tab-btn py-2 px-4 font-semibold border-b-2 border-transparent flex-shrink-0">Configurações</button>
        </div>
        <div id="content-produtos"></div>
        <div id="content-combos" class="hidden"></div>
        <div id="content-vendas" class="hidden"></div>
        <div id="content-caixa" class="hidden"></div>
        <div id="content-config" class="hidden"></div>
    `;
    renderProdutosAdmin();
    renderCombosAdmin();
    renderVendasAdmin();
    renderCaixaAdmin();
    renderConfigAdmin();
    
    const tabs = { produtos: document.getElementById('tab-produtos'), combos: document.getElementById('tab-combos'), vendas: document.getElementById('tab-vendas'), caixa: document.getElementById('tab-caixa'), config: document.getElementById('tab-config') };
    const contents = { produtos: document.getElementById('content-produtos'), combos: document.getElementById('content-combos'), vendas: document.getElementById('content-vendas'), caixa: document.getElementById('content-caixa'), config: document.getElementById('content-config') };

    Object.keys(tabs).forEach(key => {
        tabs[key].addEventListener('click', () => {
            Object.values(tabs).forEach(t => t.classList.remove('tab-active'));
            Object.values(contents).forEach(c => c.classList.add('hidden'));
            tabs[key].classList.add('tab-active');
            contents[key].classList.remove('hidden');
        });
    });
}

function renderProdutosAdmin() {
    document.getElementById('content-produtos').innerHTML = `<div class="bg-white p-6 rounded-2xl shadow-lg mb-8"><h3 class="text-2xl font-semibold mb-4 text-purple-700">Adicionar / Editar Produto</h3><div class="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6 p-4 border border-gray-200 rounded-lg"><input type="hidden" id="produto-id"><input type="text" id="produto-nome" placeholder="Nome" class="p-2 border rounded border-gray-300"><input type="number" id="produto-preco" placeholder="Preço Venda" step="0.01" class="p-2 border rounded border-gray-300"><input type="number" id="produto-custo" placeholder="Preço Custo" step="0.01" class="p-2 border rounded border-gray-300"><input type="text" id="produto-unidade" placeholder="Unidade (g, ml, un)" class="p-2 border rounded border-gray-300"><input type="text" id="produto-icone" placeholder="URL do Ícone" class="p-2 border rounded border-gray-300"><select id="produto-categoria" class="p-2 border rounded border-gray-300"><option value="tamanho">Tamanho</option><option value="fruta">Fruta</option><option value="creme">Creme</option><option value="outro">Outro</option><option value="insumo">Insumo</option></select><button id="salvar-produto-btn" class="bg-green-500 text-white p-2 rounded hover:bg-green-600 col-span-full">Salvar</button></div><div id="lista-produtos-admin"></div></div>`;
    document.getElementById('salvar-produto-btn').addEventListener('click', salvarProduto);
    carregarProdutosAdmin();
}

function renderCombosAdmin() {
    document.getElementById('content-combos').innerHTML = `<div class="bg-white p-6 rounded-2xl shadow-lg mb-8"><h3 class="text-2xl font-semibold mb-4 text-purple-700">Adicionar / Editar Combo</h3><div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 border border-gray-200 rounded-lg"><input type="hidden" id="combo-id"><input type="text" id="combo-nome" placeholder="Nome do Combo" class="p-2 border rounded border-gray-300"><input type="number" id="combo-preco" placeholder="Preço do Combo" step="0.01" class="p-2 border rounded border-gray-300"><input type="text" id="combo-imagem" placeholder="URL da Imagem" class="p-2 border rounded col-span-full border-gray-300"><textarea id="combo-descricao" placeholder="Descrição do Combo (Ex: 2 Açaís 500ml...)" class="p-2 border rounded col-span-full border-gray-300" rows="3"></textarea><button id="salvar-combo-btn" class="bg-green-500 text-white p-2 rounded hover:bg-green-600 col-span-full">Salvar Combo</button></div><div id="lista-combos-admin"></div></div>`;
    document.getElementById('salvar-combo-btn').addEventListener('click', salvarCombo);
    carregarCombosAdmin();
}

async function salvarCombo() {
    const id = document.getElementById('combo-id').value;
    const combo = { name: document.getElementById('combo-nome').value, price: parseFloat(document.getElementById('combo-preco').value) || 0, description: document.getElementById('combo-descricao').value, imageUrl: document.getElementById('combo-imagem').value, isActive: true };
    if (!combo.name || !combo.description || combo.price <= 0) { showModal("Nome, Descrição e Preço válido são obrigatórios."); return; }
    try {
        if (id) { const existingCombo = combos.find(c => c.id === id); if(existingCombo) combo.isActive = existingCombo.isActive; await updateDoc(doc(db, "combos", id), combo); } else { await addDoc(collection(db, "combos"), combo); }
        document.getElementById('combo-id').value = ''; document.getElementById('combo-nome').value = ''; document.getElementById('combo-preco').value = ''; document.getElementById('combo-descricao').value = ''; document.getElementById('combo-imagem').value = '';
    } catch (error) { console.error("Erro ao salvar combo:", error); showModal("Não foi possível salvar o combo."); }
}

function carregarCombosAdmin() {
    onSnapshot(query(collection(db, "combos"), orderBy("name")), (snapshot) => {
        const container = document.getElementById('lista-combos-admin');
        if (!container) return;
        container.innerHTML = `<h4 class="text-xl font-medium mt-6 mb-2 text-purple-600">Combos Cadastrados</h4>`;
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
        if (snapshot.empty) { grid.innerHTML = '<p class="col-span-full text-gray-500">Nenhum combo cadastrado.</p>'; }
        snapshot.forEach(docSnap => {
            const c = { id: docSnap.id, ...docSnap.data() };
            const isInactive = c.isActive === false;
            grid.innerHTML += `<div class="border border-gray-200 p-3 rounded-lg flex justify-between items-start ${isInactive ? 'opacity-50' : ''}"><div class="flex-grow"><p class="font-bold">${c.name}</p><p class="text-sm text-gray-600">${c.description}</p><p class="text-md font-semibold text-green-700 mt-1">R$${(c.price || 0).toFixed(2)}</p></div><div class="flex flex-col ml-2"><button class="toggle-combo-btn p-1 text-white rounded mb-1 ${isInactive ? 'bg-gray-400' : 'bg-green-500'}" data-id="${c.id}">${isInactive ? '🚫' : '👁️'}</button><button class="edit-combo-btn p-1 text-blue-500" data-id="${c.id}">✏️</button><button class="delete-combo-btn p-1 text-red-500" data-id="${c.id}">🗑️</button></div></div>`;
        });
        container.appendChild(grid);
        document.querySelectorAll('.edit-combo-btn').forEach(btn => btn.addEventListener('click', (e) => editarCombo(e.currentTarget.dataset.id)));
        document.querySelectorAll('.delete-combo-btn').forEach(btn => btn.addEventListener('click', (e) => deletarCombo(e.currentTarget.dataset.id)));
        document.querySelectorAll('.toggle-combo-btn').forEach(btn => btn.addEventListener('click', (e) => toggleComboStatus(e.currentTarget.dataset.id)));
    });
}

function editarCombo(id) {
    const c = combos.find(combo => combo.id === id);
    if (c) { document.getElementById('combo-id').value = c.id; document.getElementById('combo-nome').value = c.name; document.getElementById('combo-preco').value = c.price; document.getElementById('combo-descricao').value = c.description; document.getElementById('combo-imagem').value = c.imageUrl; }
}

function deletarCombo(id) {
    showModal(`<h3 class="text-xl font-bold mb-4">Confirmar Exclusão</h3><p class="mb-6">Tem certeza que deseja excluir este combo?</p><button id="confirm-delete-combo-btn" class="bg-red-500 text-white px-6 py-2 rounded-lg">Excluir</button><button onclick="window.closeModal()" class="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg ml-2">Cancelar</button>`, () => {
        document.getElementById('confirm-delete-combo-btn').addEventListener('click', async () => {
            try { await deleteDoc(doc(db, "combos", id)); closeModal(); } catch (error) { console.error("Erro ao excluir combo:", error); closeModal(); showModal('Ocorreu um erro ao excluir o combo.'); }
        });
    });
}

async function toggleComboStatus(id) {
    const combo = combos.find(c => c.id === id);
    if (combo) {
        const newStatus = !(combo.isActive !== false);
        try { await updateDoc(doc(db, "combos", id), { isActive: newStatus }); } catch (error) { console.error("Erro ao atualizar status:", error); showModal("Não foi possível atualizar o status do combo."); }
    }
}

function renderVendasAdmin() {
    document.getElementById('content-vendas').innerHTML = `<div class="bg-white p-6 rounded-2xl shadow-lg"><h3 class="text-2xl font-semibold mb-4 text-purple-700">Relatório de Vendas</h3><div class="flex flex-wrap gap-4 items-center mb-4 p-4 border border-gray-200 rounded-lg"><label for="start-date">De:</label><input type="date" id="start-date" class="p-2 border rounded border-gray-300"><label for="end-date">Até:</label><input type="date" id="end-date" class="p-2 border rounded border-gray-300"><button id="gerar-relatorio-btn" class="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">Gerar Relatório</button><button id="exportar-relatorio-btn" class="bg-green-500 text-white p-2 rounded hover:bg-green-600">Exportar CSV</button></div><div class="overflow-x-auto"><table class="w-full text-left"><thead class="bg-gray-100"><tr><th class="p-3">ID Pedido</th><th class="p-3">Data/Hora</th><th class="p-3">Cliente</th><th class="p-3">Pedido</th><th class="p-3">Pagamento</th><th class="p-3">Financeiro</th><th class="p-3">Status</th><th class="p-3">Ações</th></tr></thead><tbody id="vendas-table-body" class="divide-y divide-gray-200"></tbody></table></div><div class="mt-4 flex justify-end items-start gap-8 pr-4"><div id="total-por-tamanho" class="text-right"></div><div class="text-right"><h4 class="text-xl font-bold text-gray-800">Total das Vendas (Período): <span id="total-vendas" class="text-purple-700">R$0,00</span></h4></div></div></div>`;
    document.getElementById('gerar-relatorio-btn').addEventListener('click', () => carregarVendasAdmin(document.getElementById('start-date').value, document.getElementById('end-date').value));
    document.getElementById('exportar-relatorio-btn').addEventListener('click', exportarRelatorioVendas);
    carregarVendasAdmin();
}

async function exportarRelatorioVendas() {
    // ... (função sem alteração)
}

function renderConfigAdmin() {
    // ... (função sem alteração)
}

function renderCaixaAdmin() {
    // ... (função sem alteração)
}

async function salvarProduto() {
    // ... (função sem alteração)
}

function carregarProdutosAdmin() {
    // ... (função sem alteração)
}

function editarProduto(id) {
    // ... (função sem alteração)
}

function deletarProduto(id) {
    // ... (função sem alteração)
}

async function toggleProductStatus(id) {
    // ... (função sem alteração)
}

function showToast(message) {
    // ... (função sem alteração)
}

function playNotificationSound() {
    // ... (função sem alteração)
}

// MODIFICADO: Adaptado para calcular custo com base no array `copos`
function calcularCustoPedido(venda) {
    let custoTotal = 0;
    if(venda.copos && Array.isArray(venda.copos)) {
        venda.copos.forEach(copo => {
            const tamanhoProduto = produtos.find(p => p.name === copo.tamanho && p.category === 'tamanho');
            if (tamanhoProduto && tamanhoProduto.recipe) {
                tamanhoProduto.recipe.forEach(ingrediente => {
                    const insumoData = produtos.find(p => p.name === ingrediente.name && p.category === 'insumo');
                    if (insumoData) { custoTotal += (ingrediente.quantity || 0) * (insumoData.cost || 0); }
                });
            }
            if (copo.acompanhamentos) {
                copo.acompanhamentos.forEach(itemPedido => {
                    const acompanhamentoProduto = produtos.find(p => p.name === itemPedido.name);
                    if (acompanhamentoProduto) { custoTotal += (itemPedido.quantity || 0) * (acompanhamentoProduto.cost || 0); }
                });
            }
        });
    }

    const valorVenda = parseFloat(venda.total.replace('R$', '').replace(',', '.'));
    const lucro = valorVenda - custoTotal;
    return { custoTotal, lucro };
}

// MODIFICADO: `carregarVendasAdmin` agora renderiza os detalhes de cada copo.
function carregarVendasAdmin(startDate, endDate) {
    initialVendasLoadComplete = false;
    let q = query(collection(db, "vendas"), orderBy("timestamp", "desc"));
    if (startDate && endDate) { const start = new Date(startDate); const end = new Date(endDate); end.setHours(23, 59, 59, 999); q = query(collection(db, "vendas"), where("timestamp", ">=", start), where("timestamp", "<=", end), orderBy("timestamp", "desc")); }
    if (unsubscribeVendas) unsubscribeVendas();
    unsubscribeVendas = onSnapshot(q, (snapshot) => {
        const tableBody = document.getElementById('vendas-table-body');
        const totalPorTamanhoContainer = document.getElementById('total-por-tamanho');
        const totalVendasSpan = document.getElementById('total-vendas');

        if (!tableBody || !totalPorTamanhoContainer || !totalVendasSpan) return;

        if (initialVendasLoadComplete && snapshot.docChanges().some(change => change.type === 'added')) { 
            playNotificationSound(); 
            showToast("Novo Pedido Recebido!"); 
            document.getElementById('tab-vendas')?.click();
        }
        
        tableBody.innerHTML = ''; 
        let totalVendas = 0;
        const totaisPorTamanho = {};

        if (snapshot.empty) { 
            tableBody.innerHTML = '<tr><td colspan="8" class="text-center p-4 text-gray-500">Nenhuma venda encontrada.</td></tr>'; 
            totalVendasSpan.innerText = 'R$0,00'; 
            totalPorTamanhoContainer.innerHTML = '';
        } else {
            snapshot.docs.forEach(docSnap => {
                const venda = { id: docSnap.id, ...docSnap.data() }; 
                const isCombo = venda.pedidoCombo;
                const { custoTotal, lucro } = isCombo ? { custoTotal: 0, lucro: 0 } : calcularCustoPedido(venda);
                const valorNumerico = parseFloat(String(venda.total).replace('R$', '').replace(',', '.'));
                
                if (!isNaN(valorNumerico)) { 
                    totalVendas += valorNumerico; 
                    if (venda.copos && Array.isArray(venda.copos)) {
                        venda.copos.forEach(copo => {
                           if (!totaisPorTamanho[copo.tamanho]) { totaisPorTamanho[copo.tamanho] = { count: 0 }; }
                            totaisPorTamanho[copo.tamanho].count += 1;
                        });
                    }
                }

                const data = venda.timestamp ? new Date(venda.timestamp.seconds * 1000).toLocaleString('pt-BR') : 'N/A';
                
                let pedidoHTML = '';
                if(isCombo) {
                     pedidoHTML = `<strong>Combo:</strong> ${venda.pedidoCombo}`;
                } else if (venda.copos && Array.isArray(venda.copos)) {
                    pedidoHTML = venda.copos.map((copo, index) => {
                        const acompanhamentos = (copo.acompanhamentos || []).map(a => `${a.name}(x${a.quantity})`).join(', ');
                        return `<div class="p-1 my-1 border-b last:border-0"><strong>${index + 1}: ${copo.tamanho}</strong><br><small class="text-gray-500">${acompanhamentos || 'Apenas Açaí'}</small></div>`;
                    }).join('');
                } else { // Fallback para o formato antigo
                    pedidoHTML = `${venda.quantidade || 1}x ${venda.tamanho}`;
                }
                if (venda.observacoes) {
                     pedidoHTML += `<br><small class="text-blue-500 font-semibold">Obs: ${venda.observacoes}</small>`;
                }

                const financeiroHTML = isCombo ? `Venda: ${venda.total}` : `Venda: ${venda.total}<br><small class="text-red-500">Custo: R$${custoTotal.toFixed(2)}</small><br><strong class="text-green-600">Lucro: R$${lucro.toFixed(2)}</strong>`;
                const paymentIcon = venda.paymentMethod === 'PIX' ? '📱' : venda.paymentMethod === 'Cartão' ? '💳' : '💵';
                const paymentHTML = `<span class="font-semibold">${venda.paymentMethod || 'N/A'} ${paymentIcon}</span>`;

                tableBody.innerHTML += `<tr class="border-b-0">
                    <td class="p-3 text-sm font-mono">${venda.orderId || 'N/A'}</td>
                    <td class="p-3 text-sm">${data}</td>
                    <td class="p-3 text-sm font-semibold">${venda.nomeCliente || 'N/A'}<br><small class="text-gray-500 font-normal">${venda.telefoneCliente || ''}</small></td>
                    <td class="p-3 text-sm">${pedidoHTML}</td>
                    <td class="p-3 text-sm">${paymentHTML}</td>
                    <td class="p-3 font-medium">${financeiroHTML}</td>
                    <td class="p-3 font-semibold ${venda.status === 'pendente' ? 'text-yellow-600' : 'text-green-600'} capitalize">${venda.status}</td>
                    <td class="p-3">${venda.status === 'pendente' ? `<button class="confirm-venda-btn bg-green-500 text-white px-2 py-1 rounded text-xs" data-id="${venda.id}">✔️</button>` : ''}<button class="delete-venda-btn bg-red-500 text-white px-2 py-1 rounded text-xs ml-1" data-id="${venda.id}">🗑️</button></td>
                </tr>`;
            }); 
            totalVendasSpan.innerText = `R$${totalVendas.toFixed(2).replace('.', ',')}`;
            
            let totaisHTML = '<h4 class="text-xl font-bold text-gray-800 mb-2">Resumo por Tamanho</h4>';
            if (Object.keys(totaisPorTamanho).length > 0) {
                totaisHTML += '<div class="space-y-1">';
                Object.keys(totaisPorTamanho).sort().forEach(tamanho => {
                    const info = totaisPorTamanho[tamanho];
                    totaisHTML += `<p class="text-sm font-semibold text-gray-700">${tamanho}: <span class="font-bold">${info.count}</span> copo(s)</p>`;
                });
                totaisHTML += '</div>';
            } else { totaisHTML += '<p class="text-sm text-gray-500">Nenhum copo vendido no período.</p>'; }
            totalPorTamanhoContainer.innerHTML = totaisHTML;
        }
        document.querySelectorAll('.confirm-venda-btn').forEach(btn => btn.addEventListener('click', e => confirmarVenda(e.currentTarget.dataset.id)));
        document.querySelectorAll('.delete-venda-btn').forEach(btn => btn.addEventListener('click', e => deletarVenda(e.currentTarget.dataset.id)));
        if (!initialVendasLoadComplete) { setTimeout(() => { initialVendasLoadComplete = true; }, 2000); }
    });
}

async function confirmarVenda(id) {
    const vendaRef = doc(db, "vendas", id);
    const vendaSnap = await getDoc(vendaRef);
    if (vendaSnap.exists()) { const venda = vendaSnap.data(); const valorNumerico = parseFloat(String(venda.total).replace('R$', '').replace(',', '.')); await addDoc(collection(db, "fluxoCaixa"), { descricao: `Venda Pedido #${venda.orderId}`, valor: valorNumerico, tipo: 'entrada', timestamp: serverTimestamp() }); await updateDoc(vendaRef, { status: 'concluida' }); }
}

function deletarVenda(id) {
    showModal(`<h3 class="text-xl font-bold mb-4">Confirmar Exclusão</h3><p class="mb-6">Tem certeza que deseja excluir esta venda?</p><button id="confirm-delete-btn" class="bg-red-500 text-white px-6 py-2 rounded-lg">Excluir</button><button onclick="window.closeModal()" class="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg ml-2">Cancelar</button>`, () => {
        document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
            try { await deleteDoc(doc(db, "vendas", id)); closeModal(); } catch (error) { console.error("Erro ao excluir venda:", error); closeModal(); showModal('Ocorreu um erro ao excluir a venda.'); }
        });
    });
}

// ... (O resto das funções de admin, PIX, e os listeners onSnapshot finais) ...
async function salvarConfiguracoes() {
    // ...
}
async function carregarConfiguracoesAdmin() {
    // ...
}
async function salvarTransacao() {
    // ...
}
function carregarFluxoCaixa(startDate, endDate) {
    // ...
}
function deletarTransacao(id) {
    // ...
}
function checkStoreOpen() {
    // ...
}
function openRecipeModal(id) {
    // ...
}
async function salvarReceita(id) {
    // ...
}
function generatePixPayload(key, name, city, amountStr, txid) {
    // ...
}
function showPixModal(valor, orderId) {
    // ...
}


// LISTENERS INICIAIS
onSnapshot(doc(db, "configuracoes", "horarios"), (doc) => {
    if (doc.exists()) { storeSettings = doc.data(); } else { storeSettings = { mensagemFechado: "Horário não configurado." }; }
    checkStoreOpen();
}, (error) => { console.error("Erro ao carregar configurações:", error.message); storeSettings = { mensagemFechado: "Não foi possível verificar o horário." }; isStoreOpen = true; checkStoreOpen(); });

onSnapshot(collection(db, "produtos"), (snapshot) => {
    produtos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
    renderMenu(); 
    calcularValorTotal();
}, (error) => { console.error("Erro ao carregar produtos:", error); 
    const menuContainerEl = document.getElementById('menu-container');
    if (menuContainerEl) {
        menuContainerEl.innerHTML = '<p class="text-red-500 text-center">Não foi possível carregar o cardápio.</p>';
    }
});

onSnapshot(collection(db, "combos"), (snapshot) => {
    combos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); renderCombosMenu();
}, (error) => { console.error("Erro ao carregar combos:", error); 
    const combosSectionEl = document.getElementById('combos-section');
    if(combosSectionEl) {
        combosSectionEl.classList.add('hidden');
    }
});

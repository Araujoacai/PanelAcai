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
let pedidoAtual = []; // Armazena os copos individuais do pedido
let editingCupIndex = -1; // Índice do copo sendo editado, -1 se for um novo

// MAPEAMENTO DE ELEMENTOS DO DOM
const menuContainer = document.getElementById('menu-container');
const adminPanel = document.getElementById('admin-panel');
const whatsappBar = document.getElementById('whatsapp-bar');
const adminLoginBtn = document.getElementById('admin-login-button');
const adminLogoutBtn = document.getElementById('admin-logout-button');
const modalContainer = document.getElementById('modal-container');
const sendOrderBtnMobile = document.getElementById('send-order-button-mobile');
const sendOrderBtnDesktop = document.getElementById('send-order-button-desktop');
const addCupBtn = document.getElementById('add-cup-button');

// FUNÇÕES DE MODAL E UI GERAL
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

function showToast(message) {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast-notification bg-green-500 text-white p-4 rounded-lg shadow-lg';
    toast.innerText = message;
    toastContainer.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 5000);
}

function playNotificationSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode); gainNode.connect(audioContext.destination);
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 1);
    oscillator.start(audioContext.currentTime); oscillator.stop(audioContext.currentTime + 1);
}

// AUTENTICAÇÃO E CONTROLE DE VISIBILIDADE
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


// LÓGICA DO CARDÁPIO PÚBLICO
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

function calcularValorTotal() {
    const total = pedidoAtual.reduce((acc, copo) => acc + copo.valor, 0);
    const totalText = "R$" + total.toFixed(2).replace(".", ",");

    const valorMobileEl = document.getElementById("valor-mobile");
    const valorDesktopEl = document.getElementById("valor-desktop");
    if(valorMobileEl) valorMobileEl.innerText = totalText;
    if(valorDesktopEl) valorDesktopEl.innerText = totalText;
}

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

function resetarFormulario() {
    resetarFormularioCopo();
    pedidoAtual = [];
    renderPedidoAtual();

    const dinheiroRadio = document.getElementById('payment-dinheiro');
    if (dinheiroRadio) dinheiroRadio.checked = true;

    document.getElementById('nome-cliente').value = '';
    document.getElementById('telefone-cliente').value = '';
    document.getElementById('observacoes').value = '';
    calcularValorTotal();
}

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
        pedidoAtual[editingCupIndex] = copo;
    } else {
        pedidoAtual.push(copo);
    }

    renderPedidoAtual();
    resetarFormularioCopo();
}
addCupBtn.addEventListener('click', adicionarOuAtualizarCopo);

window.editarCopo = (index) => {
    const copo = pedidoAtual[index];
    if (!copo) return;

    resetarFormularioCopo();

    editingCupIndex = index;
    document.getElementById('editing-cup-index').value = index;

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

window.excluirCopo = (index) => {
    pedidoAtual.splice(index, 1);
    renderPedidoAtual();
}

function handleOrderAction() {
    if (isStoreOpen) {
        enviarPedido();
    } else {
        showModal(storeSettings.mensagemFechado || "Desculpe, estamos fechados no momento.");
    }
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

// PAINEL DE ADMINISTRAÇÃO
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
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    let q = query(collection(db, "vendas"), orderBy("timestamp", "desc"));

    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        q = query(collection(db, "vendas"), where("timestamp", ">=", start), where("timestamp", "<=", end), orderBy("timestamp", "desc"));
    }

    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            showModal("Nenhuma venda encontrada no período para exportar.");
            return;
        }

        const sanitizeCSVField = (field) => {
            const str = String(field ?? '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const headers = [
            'ID Pedido', 'Data/Hora', 'Cliente', 'Telefone', 'Item Principal', 'Acompanhamentos', 'Observacoes', 'Pagamento', 'Total', 'Status'
        ];

        let csvContent = headers.join(',') + '\r\n';

        querySnapshot.forEach(docSnap => {
            const venda = docSnap.data();
            const data = venda.timestamp ? new Date(venda.timestamp.seconds * 1000).toLocaleString('pt-BR') : 'N/A';

            if (venda.copos && venda.copos.length > 0) {
                venda.copos.forEach((copo, index) => {
                    const itemPrincipal = `Copo ${index + 1}: ${copo.tamanho}`;
                    const acompanhamentos = (copo.acompanhamentos || []).map(a => `${a.name}(x${a.quantity})`).join('; ');
                    const observacoes = index === 0 ? venda.observacoes : ''; // Apenas na primeira linha do pedido
                    const total = index === 0 ? venda.total : ''; // Apenas na primeira linha

                    const row = [
                        venda.orderId, data, venda.nomeCliente, venda.telefoneCliente,
                        itemPrincipal, acompanhamentos, observacoes,
                        venda.paymentMethod, total, venda.status
                    ].map(sanitizeCSVField).join(',');
                    csvContent += row + '\r\n';
                });
            } else { // Fallback para combos ou formato antigo
                 const row = [
                    venda.orderId, data, venda.nomeCliente, venda.telefoneCliente,
                    venda.pedidoCombo || venda.tamanho, '', venda.observacoes,
                    venda.paymentMethod, venda.total, venda.status
                ].map(sanitizeCSVField).join(',');
                csvContent += row + '\r\n';
            }
        });

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        const today = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        link.setAttribute("download", `relatorio_vendas_${today}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("Erro ao exportar relatório: ", error);
        showModal("Ocorreu um erro ao gerar o arquivo de exportação.");
    }
}

function renderConfigAdmin() {
    const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    let diasHTML = dias.map(dia => `<div class="grid grid-cols-1 sm:grid-cols-10 gap-x-4 gap-y-2 items-center mb-3 pb-3 border-b border-gray-200 last:border-b-0"><span class="font-semibold capitalize sm:col-span-3">${dia}-feira</span><input type="time" id="${dia}-abertura" class="p-2 border rounded w-full sm:col-span-3 border-gray-300"><input type="time" id="${dia}-fechamento" class="p-2 border rounded w-full sm:col-span-3 border-gray-300"><label class="flex items-center gap-2 sm:justify-self-center sm:col-span-1"><input type="checkbox" id="${dia}-aberto" class="w-5 h-5 accent-purple-600"> Aberto</label></div>`).join('');

    document.getElementById('content-config').innerHTML = `
        <div class="bg-white p-6 rounded-2xl shadow-lg">
            <h3 class="text-2xl font-semibold mb-4 text-purple-700">Configurações Gerais</h3>
            <div class="mb-6 p-4 border border-gray-200 rounded-lg">
                <label for="whatsapp-number" class="block font-semibold mb-2">Número do WhatsApp para Pedidos</label>
                <input type="text" id="whatsapp-number" placeholder="Ex: 5511999998888" class="w-full p-2 border rounded border-gray-300">
            </div>

            <h3 class="text-2xl font-semibold mb-4 text-purple-700">Configurações do PIX</h3>
             <div class="mb-6 p-4 border border-gray-200 rounded-lg space-y-4">
                <div>
                    <label for="pix-key" class="block font-semibold mb-2">Chave PIX</label>
                    <input type="text" id="pix-key" placeholder="Sua chave PIX (CPF, CNPJ, e-mail, etc.)" class="w-full p-2 border rounded border-gray-300">
                </div>
                <div>
                    <label for="pix-recipient-name" class="block font-semibold mb-2">Nome do Beneficiário</label>
                    <input type="text" id="pix-recipient-name" placeholder="Nome completo que aparecerá no PIX" class="w-full p-2 border rounded border-gray-300">
                </div>
                <div>
                    <label for="pix-recipient-city" class="block font-semibold mb-2">Cidade do Beneficiário</label>
                    <input type="text" id="pix-recipient-city" placeholder="Cidade do beneficiário (sem acentos)" class="w-full p-2 border rounded border-gray-300">
                </div>
            </div>

            <h3 class="text-2xl font-semibold mb-4 text-purple-700">Horário de Funcionamento</h3>
            <div class="p-4 border border-gray-200 rounded-lg">${diasHTML}</div>
            <h3 class="text-2xl font-semibold mt-6 mb-4 text-purple-700">Mensagem (Loja Fechada)</h3>
            <textarea id="mensagem-fechado" class="w-full p-2 border rounded border-gray-300" rows="3" placeholder="Ex: Estamos fechados. Nosso horário é de..."></textarea>
            <button id="salvar-config-btn" class="bg-green-500 text-white p-2 rounded hover:bg-green-600 mt-4">Salvar Configurações</button>
        </div>`;
    document.getElementById('salvar-config-btn').addEventListener('click', salvarConfiguracoes);
    carregarConfiguracoesAdmin();
}

function renderCaixaAdmin() {
    document.getElementById('content-caixa').innerHTML = `<div class="bg-white p-6 rounded-2xl shadow-lg"><h3 class="text-2xl font-semibold mb-4 text-purple-700">Fluxo de Caixa</h3><div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-center"><div class="bg-green-100 p-4 rounded-lg"><h4 class="font-semibold text-green-800">Total de Entradas</h4><p id="total-entradas" class="text-2xl font-bold text-green-600">R$0,00</p></div><div class="bg-red-100 p-4 rounded-lg"><h4 class="font-semibold text-red-800">Total de Saídas</h4><p id="total-saidas" class="text-2xl font-bold text-red-600">R$0,00</p></div><div class="bg-blue-100 p-4 rounded-lg"><h4 class="font-semibold text-blue-800">Saldo Atual</h4><p id="saldo-atual" class="text-2xl font-bold text-blue-600">R$0,00</p></div></div><div class="mb-6 p-4 border border-gray-200 rounded-lg"><h4 class="text-xl font-medium mb-3">Adicionar Lançamento</h4><div class="grid grid-cols-1 md:grid-cols-4 gap-4"><input type="hidden" id="transacao-id"><input type="text" id="transacao-descricao" placeholder="Descrição" class="p-2 border rounded col-span-2 border-gray-300"><input type="number" id="transacao-valor" placeholder="Valor" step="0.01" class="p-2 border rounded border-gray-300"><select id="transacao-tipo" class="p-2 border rounded border-gray-300"><option value="entrada">Entrada</option><option value="saida">Saída</option></select><button id="salvar-transacao-btn" class="bg-green-500 text-white p-2 rounded hover:bg-green-600 col-span-4 md:col-span-1">Salvar</button></div></div><div class="flex flex-wrap gap-4 items-center mb-4 p-4 border border-gray-200 rounded-lg"><label for="start-date-caixa">De:</label><input type="date" id="start-date-caixa" class="p-2 border rounded border-gray-300"><label for="end-date-caixa">Até:</label><input type="date" id="end-date-caixa" class="p-2 border rounded border-gray-300"><button id="gerar-relatorio-caixa-btn" class="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">Filtrar</button></div><div class="overflow-x-auto"><table class="w-full text-left"><thead class="bg-gray-100"><tr><th class="p-3">Data</th><th class="p-3">Descrição</th><th class="p-3">Tipo</th><th class="p-3">Valor</th><th class="p-3">Ações</th></tr></thead><tbody id="caixa-table-body" class="divide-y divide-gray-200"></tbody></table></div></div>`;
    document.getElementById('salvar-transacao-btn').addEventListener('click', salvarTransacao);
    document.getElementById('gerar-relatorio-caixa-btn').addEventListener('click', () => carregarFluxoCaixa(document.getElementById('start-date-caixa').value, document.getElementById('end-date-caixa').value));
    carregarFluxoCaixa();
}

async function salvarProduto() {
    const id = document.getElementById('produto-id').value;
    const produto = { name: document.getElementById('produto-nome').value, price: parseFloat(document.getElementById('produto-preco').value) || 0, cost: parseFloat(document.getElementById('produto-custo').value) || 0, unit: document.getElementById('produto-unidade').value, iconUrl: document.getElementById('produto-icone').value, category: document.getElementById('produto-categoria').value, isActive: true };
    if (!produto.name || !produto.unit) { showModal("Nome e Unidade são obrigatórios."); return; }
    if (produto.category === 'tamanho') { produto.recipe = []; }
    try {
        if (id) { const existingProd = produtos.find(p => p.id === id); if (existingProd) { produto.recipe = existingProd.recipe || []; produto.isActive = existingProd.isActive; } await updateDoc(doc(db, "produtos", id), produto); } else { await addDoc(collection(db, "produtos"), produto); }
        document.getElementById('produto-id').value = ''; document.getElementById('produto-nome').value = ''; document.getElementById('produto-preco').value = ''; document.getElementById('produto-custo').value = ''; document.getElementById('produto-unidade').value = ''; document.getElementById('produto-icone').value = '';
    } catch (error) { console.error("Erro ao salvar produto:", error); showModal("Não foi possível salvar o produto."); }
}

function carregarProdutosAdmin() {
    onSnapshot(collection(db, "produtos"), (snapshot) => {
        const container = document.getElementById('lista-produtos-admin');
        if (!container) return;
        const produtosPorCategoria = { tamanho: [], fruta: [], creme: [], outro: [], insumo: [] };
        snapshot.docs.forEach(docSnap => { const p = { id: docSnap.id, ...docSnap.data() }; if(produtosPorCategoria[p.category]) produtosPorCategoria[p.category].push(p); });
        container.innerHTML = '';
        for (const categoria in produtosPorCategoria) {
            container.innerHTML += `<h4 class="text-xl font-medium mt-6 mb-2 capitalize text-purple-600">${categoria}s</h4>`;
            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
            produtosPorCategoria[categoria].forEach(p => {
                const isInactive = p.isActive === false;
                grid.innerHTML += `<div class="border border-gray-200 p-3 rounded-lg flex justify-between items-center ${isInactive ? 'opacity-50' : ''}"><div><p class="font-bold">${p.name}</p><p class="text-sm text-gray-600">Venda: R$${(p.price || 0).toFixed(2)} | Custo: R$${(p.cost || 0).toFixed(2)} / ${p.unit}</p></div><div class="flex items-center">${p.category !== 'tamanho' && p.category !== 'insumo' ? `<button class="toggle-active-btn p-1 text-white rounded ${isInactive ? 'bg-gray-400' : 'bg-green-500'}" data-id="${p.id}">${isInactive ? '🚫' : '👁️'}</button>` : ''}${p.category === 'tamanho' ? `<button class="recipe-btn p-1 text-green-500" data-id="${p.id}">⚙️</button>` : ''}<button class="edit-produto-btn p-1 text-blue-500" data-id="${p.id}">✏️</button><button class="delete-produto-btn p-1 text-red-500" data-id="${p.id}">🗑️</button></div></div>`;
            });
            container.appendChild(grid);
        }
        document.querySelectorAll('.edit-produto-btn').forEach(btn => btn.addEventListener('click', (e) => editarProduto(e.currentTarget.dataset.id)));
        document.querySelectorAll('.delete-produto-btn').forEach(btn => btn.addEventListener('click', (e) => deletarProduto(e.currentTarget.dataset.id)));
        document.querySelectorAll('.recipe-btn').forEach(btn => btn.addEventListener('click', (e) => openRecipeModal(e.currentTarget.dataset.id)));
        document.querySelectorAll('.toggle-active-btn').forEach(btn => btn.addEventListener('click', (e) => toggleProductStatus(e.currentTarget.dataset.id)));
    });
}

function editarProduto(id) {
    const p = produtos.find(prod => prod.id === id);
    if (p) { document.getElementById('produto-id').value = p.id; document.getElementById('produto-nome').value = p.name; document.getElementById('produto-preco').value = p.price; document.getElementById('produto-custo').value = p.cost; document.getElementById('produto-unidade').value = p.unit; document.getElementById('produto-icone').value = p.iconUrl; document.getElementById('produto-categoria').value = p.category; }
}

function deletarProduto(id) {
    const confirmationHTML = `<h3 class="text-xl font-bold mb-4">Confirmar Exclusão</h3><p class="mb-6">Tem certeza que deseja excluir este produto?</p><button id="confirm-delete-produto-btn" class="bg-red-500 text-white px-6 py-2 rounded-lg">Excluir</button><button onclick="window.closeModal()" class="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg ml-2">Cancelar</button>`;
    showModal(confirmationHTML, () => {
        document.getElementById('confirm-delete-produto-btn').addEventListener('click', async () => {
            try { await deleteDoc(doc(db, "produtos", id)); closeModal(); } catch (error) { console.error("Erro ao excluir produto:", error); closeModal(); showModal('Ocorreu um erro ao excluir o produto.'); }
        });
    });
}

async function toggleProductStatus(id) {
    const product = produtos.find(p => p.id === id);
    if (product) {
        const newStatus = !(product.isActive !== false);
        try { await updateDoc(doc(db, "produtos", id), { isActive: newStatus }); } catch (error) { console.error("Erro ao atualizar status:", error); showModal("Não foi possível atualizar o status do produto."); }
    }
}

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

    const valorVenda = parseFloat(String(venda.total).replace('R$', '').replace(',', '.'));
    const lucro = valorVenda - custoTotal;
    return { custoTotal, lucro };
}

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

async function salvarConfiguracoes() {
    const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const settings = {
        mensagemFechado: document.getElementById('mensagem-fechado').value,
        whatsappNumber: document.getElementById('whatsapp-number').value,
        pixKey: document.getElementById('pix-key').value,
        pixRecipientName: document.getElementById('pix-recipient-name').value,
        pixRecipientCity: document.getElementById('pix-recipient-city').value
    };
    dias.forEach(dia => { settings[dia] = { aberto: document.getElementById(`${dia}-aberto`).checked, abertura: document.getElementById(`${dia}-abertura`).value, fechamento: document.getElementById(`${dia}-fechamento`).value, }; });
    try { await setDoc(doc(db, "configuracoes", "horarios"), settings); storeSettings = settings; checkStoreOpen(); showModal('Configurações salvas com sucesso!'); } catch (error) { console.error("Erro ao salvar configurações:", error); showModal('Erro ao salvar as configurações.'); }
}

async function carregarConfiguracoesAdmin() {
    const docRef = doc(db, "configuracoes", "horarios");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const settings = docSnap.data();
        document.getElementById('whatsapp-number').value = settings.whatsappNumber || '';
        document.getElementById('mensagem-fechado').value = settings.mensagemFechado || '';
        document.getElementById('pix-key').value = settings.pixKey || '';
        document.getElementById('pix-recipient-name').value = settings.pixRecipientName || '';
        document.getElementById('pix-recipient-city').value = settings.pixRecipientCity || '';
        const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
        dias.forEach(dia => { if (settings[dia]) { document.getElementById(`${dia}-aberto`).checked = settings[dia].aberto; document.getElementById(`${dia}-abertura`).value = settings[dia].abertura; document.getElementById(`${dia}-fechamento`).value = settings[dia].fechamento; } });
    }
}

async function salvarTransacao() {
    const id = document.getElementById('transacao-id').value;
    const transacao = { descricao: document.getElementById('transacao-descricao').value, valor: parseFloat(document.getElementById('transacao-valor').value), tipo: document.getElementById('transacao-tipo').value, timestamp: serverTimestamp() };
    if (!transacao.descricao || isNaN(transacao.valor) || transacao.valor <= 0) { showModal("Descrição e valor válido são obrigatórios."); return; }
    try { if (id) { await updateDoc(doc(db, "fluxoCaixa", id), { descricao: transacao.descricao, valor: transacao.valor, tipo: transacao.tipo }); } else { await addDoc(collection(db, "fluxoCaixa"), transacao); } document.getElementById('transacao-id').value = ''; document.getElementById('transacao-descricao').value = ''; document.getElementById('transacao-valor').value = ''; } catch (error) { console.error("Erro ao salvar transação:", error); showModal("Não foi possível salvar a transação."); }
}

function carregarFluxoCaixa(startDate, endDate) {
    let q = query(collection(db, "fluxoCaixa"), orderBy("timestamp", "desc"));
    if (startDate && endDate) { const start = new Date(startDate); const end = new Date(endDate); end.setHours(23, 59, 59, 999); q = query(collection(db, "fluxoCaixa"), where("timestamp", ">=", start), where("timestamp", "<=", end), orderBy("timestamp", "desc")); }
    if (unsubscribeFluxoCaixa) unsubscribeFluxoCaixa();
    unsubscribeFluxoCaixa = onSnapshot(q, (snapshot) => {
        const tableBody = document.getElementById('caixa-table-body');
        const totalEntradasEl = document.getElementById('total-entradas');
        const totalSaidasEl = document.getElementById('total-saidas');
        const saldoAtualEl = document.getElementById('saldo-atual');

        if (!tableBody || !totalEntradasEl || !totalSaidasEl || !saldoAtualEl) {
            return;
        }

        tableBody.innerHTML = ''; let totalEntradas = 0, totalSaidas = 0;
        if (snapshot.empty) { tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-500">Nenhum lançamento encontrado.</td></tr>'; }
        snapshot.docs.forEach(docSnap => {
            const t = { id: docSnap.id, ...docSnap.data() }; const valor = t.valor || 0;
            if (t.tipo === 'entrada') totalEntradas += valor; else totalSaidas += valor;
            tableBody.innerHTML += `<tr class="border-b-0"><td class="p-3 text-sm">${t.timestamp ? new Date(t.timestamp.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A'}</td><td class="p-3">${t.descricao}</td><td class="p-3 font-semibold ${t.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'} capitalize">${t.tipo}</td><td class="p-3 font-medium">R$${valor.toFixed(2).replace('.', ',')}</td><td class="p-3"><button class="delete-transacao-btn bg-red-500 text-white px-2 py-1 rounded text-xs" data-id="${t.id}">🗑️</button></td></tr>`;
        });
        totalEntradasEl.innerText = `R$${totalEntradas.toFixed(2).replace('.', ',')}`;
        totalSaidasEl.innerText = `R$${totalSaidas.toFixed(2).replace('.', ',')}`;
        saldoAtualEl.innerText = `R$${(totalEntradas - totalSaidas).toFixed(2).replace('.', ',')}`;
        document.querySelectorAll('.delete-transacao-btn').forEach(btn => btn.addEventListener('click', e => deletarTransacao(e.currentTarget.dataset.id)));
    });
}

function deletarTransacao(id) {
    showModal(`<h3 class="text-xl font-bold mb-4">Confirmar Exclusão</h3><p class="mb-6">Tem certeza que deseja excluir este lançamento?</p><button id="confirm-delete-transacao-btn" class="bg-red-500 text-white px-6 py-2 rounded-lg">Excluir</button><button onclick="window.closeModal()" class="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg ml-2">Cancelar</button>`, () => {
        document.getElementById('confirm-delete-transacao-btn').addEventListener('click', async () => {
            try { await deleteDoc(doc(db, "fluxoCaixa", id)); closeModal(); } catch (error) { console.error("Erro ao excluir transação:", error); closeModal(); showModal('Ocorreu um erro ao excluir.'); }
        });
    });
}

function checkStoreOpen() {
    const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const agora = new Date(); const diaSemana = dias[agora.getDay()]; const horaAtual = agora.getHours() * 60 + agora.getMinutes(); const configDia = storeSettings[diaSemana];
    const avisoLojaFechada = document.getElementById('loja-fechada-aviso'); const msgLojaFechada = document.getElementById('mensagem-loja-fechada');
    if (!configDia || !configDia.aberto || !configDia.abertura || !configDia.fechamento) { isStoreOpen = true; } else {
        const [aberturaH, aberturaM] = configDia.abertura.split(':').map(Number); const [fechamentoH, fechamentoM] = configDia.fechamento.split(':').map(Number);
        isStoreOpen = horaAtual >= (aberturaH * 60 + aberturaM) && horaAtual < (fechamentoH * 60 + fechamentoM);
    }
    [sendOrderBtnMobile, sendOrderBtnDesktop, addCupBtn].forEach(btn => {
        if (btn) {
            btn.disabled = !isStoreOpen;
            btn.classList.toggle('bg-gray-400', !isStoreOpen);
            btn.classList.toggle('cursor-not-allowed', !isStoreOpen);
            if(btn.id.includes('send-order')) btn.classList.toggle('bg-gradient-to-r', isStoreOpen);
            if(avisoLojaFechada) avisoLojaFechada.classList.toggle('hidden', isStoreOpen);
            if (!isStoreOpen && msgLojaFechada) { msgLojaFechada.innerText = storeSettings.mensagemFechado || "Estamos fechados no momento."; }
        }
    });
}

function openRecipeModal(id) {
    const produtoTamanho = produtos.find(p => p.id === id); if (!produtoTamanho) return;
    const insumos = produtos.filter(p => p.category === 'insumo');
    let insumosHTML = insumos.map(insumo => {
        const itemReceita = produtoTamanho.recipe?.find(r => r.name === insumo.name);
        return `<div class="flex justify-between items-center mb-2"><label for="recipe-${insumo.id}">${insumo.name} (${insumo.unit})</label><input type="number" id="recipe-${insumo.id}" data-name="${insumo.name}" value="${itemReceita ? itemReceita.quantity : 0}" class="w-24 p-1 border rounded text-center bg-gray-100 border-gray-300" placeholder="Qtd."></div>`;
    }).join('');
    showModal(`<div class="text-left"><h3 class="text-xl font-bold mb-4 text-purple-700">Ficha Técnica para ${produtoTamanho.name}</h3><div id="recipe-form" class="max-h-96 overflow-y-auto p-2">${insumosHTML}</div><div class="mt-6 text-right"><button id="save-recipe-btn" class="bg-green-500 text-white px-6 py-2 rounded-lg">Salvar Receita</button><button onclick="window.closeModal()" class="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg ml-2">Cancelar</button></div></div>`, () => {
        document.getElementById('save-recipe-btn').addEventListener('click', () => salvarReceita(id));
    });
}

async function salvarReceita(id) {
    const recipe = [];
    document.querySelectorAll('#recipe-form input').forEach(input => { const quantity = parseFloat(input.value); if (quantity > 0) { recipe.push({ name: input.dataset.name, quantity: quantity }); } });
    try { await updateDoc(doc(db, "produtos", id), { recipe: recipe }); closeModal(); showModal("Receita salva com sucesso!"); } catch (error) { console.error("Erro ao salvar receita:", error); showModal("Não foi possível salvar a receita."); }
}

// LÓGICA DE GERAÇÃO DE PIX
function crc16(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
        }
    }
    return ('0000' + (crc & 0xFFFF).toString(16).toUpperCase()).slice(-4);
}

function formatField(id, value) {
    const len = String(value.length).padStart(2, '0');
    return `${id}${len}${value}`;
}

function normalizeText(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 25);
}

function generatePixPayload(key, name, city, amountStr, txid) {
    const amount = parseFloat(amountStr.replace("R$", "").replace(",", ".")).toFixed(2);
    const normalizedName = normalizeText(name).toUpperCase();
    const normalizedCity = normalizeText(city).toUpperCase();
    const cleanTxid = '***';

    const merchantAccountInfo = formatField('00', 'br.gov.bcb.pix') + formatField('01', key);

    let payload = [
        formatField('00', '01'),
        formatField('26', merchantAccountInfo),
        formatField('52', '0000'),
        formatField('53', '986'),
        formatField('54', amount),
        formatField('58', 'BR'),
        formatField('59', normalizedName),
        formatField('60', normalizedCity),
        formatField('62', formatField('05', cleanTxid))
    ].join('');

    const payloadWithCrcTag = payload + '6304';
    const crcResult = crc16(payloadWithCrcTag);
    return payloadWithCrcTag + crcResult;
}

function showPixModal(valor, orderId) {
    const { pixKey, pixRecipientName, pixRecipientCity } = storeSettings;
    if (!pixKey || !pixRecipientName || !pixRecipientCity) {
        showModal("Pedido enviado! O pagamento via PIX não está configurado. Por favor, configure no painel de administração.");
        return;
    }

    const payload = generatePixPayload(pixKey, pixRecipientName, pixRecipientCity, valor, orderId);

    const pixModalHTML = `
        <h3 class="text-2xl font-bold mb-2 text-purple-800">Pagamento via PIX</h3>
        <p class="text-gray-600 mb-4">Seu pedido foi enviado! Agora, realize o pagamento.</p>
        <div id="qrcode" class="p-2 bg-gray-100 inline-block rounded-xl"></div>
        <p class="text-sm font-semibold text-gray-700 mb-2">PIX Copia e Cola:</p>
        <div class="relative mb-4">
            <input type="text" id="pix-payload-text" value="${payload}" readonly class="w-full bg-gray-100 border border-gray-300 rounded-lg p-3 pr-12 text-sm text-gray-700">
            <button id="copy-pix-btn" class="absolute inset-y-0 right-0 px-3 flex items-center bg-purple-200 text-purple-700 rounded-r-lg hover:bg-purple-300">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zM-1 7a.5.5 0 0 1 .5-.5h15a.5.5 0 0 1 0 1H-0.5A.5.5 0 0 1-1 7z"/></svg>
            </button>
        </div>
        <button onclick="window.closeModal()" class="bg-gray-300 text-gray-800 font-bold py-2 px-8 rounded-lg transition-colors">Fechar</button>
    `;
    showModal(pixModalHTML, () => {
        new QRCode(document.getElementById("qrcode"), {
            text: payload,
            width: 200,
            height: 200,
            colorDark: "#4C2A7A",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
        document.getElementById('copy-pix-btn').addEventListener('click', (e) => {
            const textToCopy = document.getElementById('pix-payload-text');
            textToCopy.select();
            textToCopy.setSelectionRange(0, 99999);
            try {
                document.execCommand('copy');
                e.currentTarget.innerHTML = 'Copiado!';
                setTimeout(() => { e.currentTarget.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zM-1 7a.5.5 0 0 1 .5-.5h15a.5.5 0 0 1 0 1H-0.5A.5.5 0 0 1-1 7z"/></svg>'; }, 2000);
            } catch(err) {
                console.error('Falha ao copiar:', err);
            }
        });
    });
}

// LISTENERS INICIAIS (CARREGAMENTO DE DADOS)
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
    combos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderCombosMenu();
}, (error) => { console.error("Erro ao carregar combos:", error);
    const combosSectionEl = document.getElementById('combos-section');
    if(combosSectionEl) {
        combosSectionEl.classList.add('hidden');
    }
});

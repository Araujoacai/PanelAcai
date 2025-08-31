document.addEventListener('DOMContentLoaded', () => {
        const modal = document.getElementById('retirada-modal');
        const modalBox = document.getElementById('retirada-modal-box');
        const closeButton = document.getElementById('close-retirada-modal');

        // Mostra o modal com uma animação suave
        setTimeout(() => {
            modal.style.opacity = '1';
            modal.style.pointerEvents = 'auto';
            modalBox.style.opacity = '1';
            modalBox.style.transform = 'scale(1)';
        }, 300); // Um pequeno atraso para garantir que a animação ocorra

        // Função para fechar o modal
        const closeModal = () => {
            modalBox.style.transform = 'scale(0.95)';
            modalBox.style.opacity = '0';
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.style.display = 'none'; // Remove o modal da tela
            }, 300);
        };

        closeButton.addEventListener('click', closeModal);
    });

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
    let combos = []; // Variável para armazenar os combos
    let precosBase = {};
    let unsubscribeVendas;
    let unsubscribeFluxoCaixa;
    let storeSettings = {};
    let isStoreOpen = true; 
    let initialVendasLoadComplete = false;

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

        produtos.filter(p => p.category !== 'insumo').forEach(p => {
            const inputType = p.category === 'tamanho' ? 'radio' : 'checkbox';
            const nameAttr = p.category === 'tamanho' ? 'tamanho' : '';
            const checkedAttr = p.category === 'tamanho' && p.default ? 'checked' : '';
            const disabledAttr = p.isActive === false ? 'disabled' : '';
            const opacityClass = p.isActive === false ? 'opacity-50' : '';

            const itemHTML = `
                <label class="flex items-center p-3 border-2 border-purple-300 rounded-xl cursor-pointer hover:bg-purple-50 transition ${opacityClass}">
                    <input type="${inputType}" name="${nameAttr}" value="${p.id}" data-price="${p.price}" data-cost="${p.cost}" class="w-5 h-5 accent-purple-600 flex-shrink-0" ${checkedAttr} ${disabledAttr}>
                    <span class="ml-3 font-semibold text-purple-700 flex-grow">${p.name}</span>
                    <span class="font-bold text-pink-600">R$${(p.price || 0).toFixed(2).replace('.', ',')}</span>
                </label>
            `;
            if (containers[p.category]) containers[p.category].innerHTML += itemHTML;
        });

        // Adiciona listeners para os inputs de tamanho e acompanhamentos
        document.querySelectorAll('input[name="tamanho"]').forEach(input => input.addEventListener('change', calcularValor));
        document.querySelectorAll('#frutas-container input, #cremes-container input, #outros-container input').forEach(input => input.addEventListener('change', calcularValor));
        document.getElementById('quantidade').addEventListener('input', calcularValor);
        document.getElementById('apenas-acai-check').addEventListener('change', toggleApenasAcai);
    }

    function renderCombosMenu() {
        const combosContainer = document.getElementById('combos-container');
        const combosSection = document.getElementById('combos-section');
        combosContainer.innerHTML = '';

        const activeCombos = combos.filter(c => c.isActive !== false);

        if (activeCombos.length > 0) {
            combosSection.classList.remove('hidden');
            activeCombos.forEach(combo => {
                const comboHTML = `
                    <div class="bg-white border border-purple-300 rounded-xl shadow-lg p-4 flex flex-col items-center text-center">
                        ${combo.imageUrl ? `<img src="${combo.imageUrl}" alt="${combo.name}" class="w-full h-32 object-cover rounded-lg mb-3">` : ''}
                        <h3 class="text-xl font-bold text-purple-800 mb-2">${combo.name}</h3>
                        <p class="text-gray-700 mb-3">${combo.description}</p>
                        <p class="text-2xl font-extrabold text-pink-600 mb-4">R$${(combo.price || 0).toFixed(2).replace('.', ',')}</p>
                        <button class="add-combo-to-order-btn bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg transition-colors w-full" data-combo-id="${combo.id}">
                            Adicionar Combo
                        </button>
                    </div>
                `;
                combosContainer.innerHTML += comboHTML;
            });

            document.querySelectorAll('.add-combo-to-order-btn').forEach(button => {
                button.addEventListener('click', (e) => addComboToOrder(e.target.dataset.comboId));
            });
        } else {
            combosSection.classList.add('hidden');
        }
    }

    function addComboToOrder(comboId) {
        const combo = combos.find(c => c.id === comboId);
        if (!combo) return;

        // Simula a seleção de um tamanho (se houver) e define a quantidade como 1
        // Isso é um exemplo, a lógica real pode precisar ser mais complexa
        const tamanhoRadio = document.querySelector('input[name="tamanho"]:checked');
        if (tamanhoRadio) {
            tamanhoRadio.checked = false; // Desseleciona o tamanho atual
        }

        // Desseleciona todos os acompanhamentos
        document.querySelectorAll('#frutas-container input:checked, #cremes-container input:checked, #outros-container input:checked').forEach(input => {
            input.checked = false;
        });

        // Define o nome do combo como observação ou nome do cliente
        document.getElementById('observacoes').value = `Pedido do Combo: ${combo.name} - ${combo.description}. Preço: R$${combo.price.toFixed(2).replace('.', ',')}.`;
        document.getElementById('quantidade').value = 1;

        // Atualiza o valor total para o preço do combo
        document.getElementById('valor-desktop').innerText = `R$${combo.price.toFixed(2).replace('.', ',')}`;
        document.getElementById('valor-mobile').innerText = `R$${combo.price.toFixed(2).replace('.', ',')}`;

        showToast(`Combo "${combo.name}" adicionado!`, 'success');
    }

    function toggleApenasAcai() {
        const apenasAcaiChecked = document.getElementById('apenas-acai-check').checked;
        document.querySelectorAll('#frutas-container input, #cremes-container input, #outros-container input').forEach(input => {
            input.disabled = apenasAcaiChecked;
            if (apenasAcaiChecked) input.checked = false;
        });
        calcularValor();
    }

    function calcularValor() {
        let valorTotal = 0;
        let custoTotal = 0;
        let porcoesAcompanhamentos = 0;
        const quantidade = parseInt(document.getElementById('quantidade').value) || 1;

        const tamanhoSelecionado = document.querySelector('input[name="tamanho"]:checked');
        if (tamanhoSelecionado) {
            valorTotal += parseFloat(tamanhoSelecionado.dataset.price);
            custoTotal += parseFloat(tamanhoSelecionado.dataset.cost);
        }

        if (!document.getElementById('apenas-acai-check').checked) {
            document.querySelectorAll('#frutas-container input:checked, #cremes-container input:checked, #outros-container input:checked').forEach(input => {
                valorTotal += parseFloat(input.dataset.price);
                custoTotal += parseFloat(input.dataset.cost);
                porcoesAcompanhamentos++;
            });
        }

        // Lógica para porções extras
        if (porcoesAcompanhamentos > 3) {
            const porcoesExtras = porcoesAcompanhamentos - 3;
            valorTotal += porcoesExtras * 3; // R$3 por porção extra
        }

        valorTotal *= quantidade;
        custoTotal *= quantidade;

        document.getElementById('valor-desktop').innerText = `R$${valorTotal.toFixed(2).replace('.', ',')}`;
        document.getElementById('valor-mobile').innerText = `R$${valorTotal.toFixed(2).replace('.', ',')}`;
    }

    sendOrderBtnMobile.addEventListener('click', () => sendOrder('mobile'));
    sendOrderBtnDesktop.addEventListener('click', () => sendOrder('desktop'));

    async function sendOrder(platform) {
        if (!isStoreOpen) {
            showModal(storeSettings.mensagemFechado || "Desculpe, a loja está fechada no momento.");
            return;
        }

        const nomeCliente = document.getElementById('nome-cliente').value.trim();
        const telefoneCliente = document.getElementById('telefone-cliente').value.trim();
        const observacoes = document.getElementById('observacoes').value.trim();
        const quantidade = parseInt(document.getElementById('quantidade').value) || 1;

        if (!nomeCliente || !telefoneCliente) {
            showModal("Por favor, preencha seu nome e telefone/WhatsApp para o pedido.");
            return;
        }

        const tamanhoSelecionado = document.querySelector('input[name="tamanho"]:checked');
        if (!tamanhoSelecionado && !observacoes.includes('Combo')) { // Permite pedido sem tamanho se for combo
            showModal("Por favor, escolha o tamanho do açaí.");
            return;
        }

        let itensPedido = [];
        let valorTotal = 0;
        let custoTotal = 0;

        if (observacoes.includes('Combo')) {
            // Se for combo, o valor já foi definido e a observação já contém os detalhes
            valorTotal = parseFloat(document.getElementById('valor-desktop').innerText.replace('R$', '').replace(',', '.'));
            itensPedido.push({ name: observacoes, price: valorTotal, quantity: quantidade });
            // Custo do combo não é calculado aqui, assumimos que é tratado separadamente ou não é relevante para o relatório de insumos
        } else {
            // Lógica para pedidos normais
            const produtoTamanho = produtos.find(p => p.id === tamanhoSelecionado.value);
            if (produtoTamanho) {
                itensPedido.push({ name: produtoTamanho.name, price: produtoTamanho.price, quantity: quantidade });
                valorTotal += produtoTamanho.price;
                custoTotal += produtoTamanho.cost;
            }

            let acompanhamentosSelecionados = [];
            if (!document.getElementById('apenas-acai-check').checked) {
                document.querySelectorAll('#frutas-container input:checked, #cremes-container input:checked, #outros-container input:checked').forEach(input => {
                    const produtoAcompanhamento = produtos.find(p => p.id === input.value);
                    if (produtoAcompanhamento) {
                        acompanhamentosSelecionados.push(produtoAcompanhamento.name);
                        valorTotal += produtoAcompanhamento.price;
                        custoTotal += produtoAcompanhamento.cost;
                    }
                });
            }

            if (acompanhamentosSelecionados.length > 0) {
                itensPedido.push({ name: `Acompanhamentos: ${acompanhamentosSelecionados.join(', ')}`, price: 0, quantity: 1 });
                if (acompanhamentosSelecionados.length > 3) {
                    const porcoesExtras = acompanhamentosSelecionados.length - 3;
                    valorTotal += porcoesExtras * 3; // Adiciona R$3 por porção extra
                    itensPedido.push({ name: `Porções Extras (${porcoesExtras})`, price: porcoesExtras * 3, quantity: 1 });
                }
            }
        }

        valorTotal *= quantidade;
        custoTotal *= quantidade;

        const pedido = {
            cliente: nomeCliente,
            telefone: telefoneCliente,
            itens: itensPedido,
            valorTotal: valorTotal,
            custoTotal: custoTotal,
            observacoes: observacoes,
            quantidadeCopos: quantidade,
            timestamp: serverTimestamp(),
            status: 'Pendente' // Novo campo de status
        };

        try {
            const docRef = await addDoc(collection(db, "pedidos"), pedido);
            showToast("Pedido enviado com sucesso!", 'success');
            resetForm();

            // Gerar link do WhatsApp
            let mensagemWhatsapp = `*NOVO PEDIDO - Açaí Delivery*\n\n`;
            mensagemWhatsapp += `*Cliente:* ${nomeCliente}\n`;
            mensagemWhatsapp += `*Telefone:* ${telefoneCliente}\n`;
            mensagemWhatsapp += `*Itens:*\n`;
            itensPedido.forEach(item => {
                mensagemWhatsapp += `- ${item.quantity > 1 ? `${item.quantity}x ` : ''}${item.name} ${item.price > 0 ? `(R$${item.price.toFixed(2).replace('.', ',')})` : ''}\n`;
            });
            if (observacoes) mensagemWhatsapp += `*Observações:* ${observacoes}\n`;
            mensagemWhatsapp += `*Quantidade de Copos:* ${quantidade}\n`;
            mensagemWhatsapp += `*Valor Total:* R$${valorTotal.toFixed(2).replace('.', ',')}\n\n`;
            mensagemWhatsapp += `*ID do Pedido:* ${docRef.id}\n`;

            const whatsappNumber = storeSettings.whatsappNumber || '5531999998888'; // Número padrão
            const whatsappLink = `https://api.whatsapp.com/send?phone=${whatsappNumber}&text=${encodeURIComponent(mensagemWhatsapp)}`;

            window.open(whatsappLink, '_blank');

        } catch (e) {
            console.error("Erro ao adicionar documento: ", e);
            showToast("Erro ao enviar pedido.", 'error');
        }
    }

    function resetForm() {
        document.getElementById('nome-cliente').value = '';
        document.getElementById('telefone-cliente').value = '';
        document.getElementById('observacoes').value = '';
        document.getElementById('quantidade').value = '1';
        document.getElementById('apenas-acai-check').checked = false;
        toggleApenasAcai(); // Reativa os acompanhamentos

        document.querySelectorAll('input[name="tamanho"]').forEach(input => input.checked = false);
        document.querySelectorAll('#frutas-container input:checked, #cremes-container input:checked, #outros-container input:checked').forEach(input => input.checked = false);
        calcularValor();
    }

    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast-notification bg-white p-4 rounded-lg shadow-md mb-3 flex items-center space-x-3`;
        
        let icon = '';
        let textColor = 'text-gray-800';
        if (type === 'success') { icon = '✅'; textColor = 'text-green-700'; }
        else if (type === 'error') { icon = '❌'; textColor = 'text-red-700'; }
        else { icon = 'ℹ️'; textColor = 'text-blue-700'; }

        toast.innerHTML = `<span class="text-2xl">${icon}</span><p class="font-semibold ${textColor}">${message}</p>`;
        toastContainer.prepend(toast); // Adiciona no início para aparecer em cima

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3000);
    }

    function renderAdminPanel() {
        adminPanel.innerHTML = `
            <h2 class="text-3xl font-bold text-center text-purple-800 mb-6">Painel de Administração</h2>
            <div class="flex border-b mb-4 overflow-x-auto no-scrollbar">
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
        renderCombosAdmin(); // Nova função
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
        document.getElementById('content-produtos').innerHTML = `<div class="bg-white p-6 rounded-2xl shadow-lg mb-8"><h3 class="text-2xl font-semibold mb-4 text-purple-700">Adicionar / Editar Produto</h3><div class="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6 p-4 border rounded-lg"><input type="hidden" id="produto-id"><input type="text" id="produto-nome" placeholder="Nome" class="p-2 border rounded"><input type="number" id="produto-preco" placeholder="Preço Venda" step="0.01" class="p-2 border rounded"><input type="number" id="produto-custo" placeholder="Preço Custo" step="0.01" class="p-2 border rounded"><input type="text" id="produto-unidade" placeholder="Unidade (g, ml, un)" class="p-2 border rounded"><input type="text" id="produto-icone" placeholder="URL do Ícone" class="p-2 border rounded"><select id="produto-categoria" class="p-2 border rounded"><option value="tamanho">Tamanho</option><option value="fruta">Fruta</option><option value="creme">Creme</option><option value="outro">Outro</option><option value="insumo">Insumo</option></select><button id="salvar-produto-btn" class="bg-green-500 text-white p-2 rounded hover:bg-green-600 col-span-full">Salvar</button></div><div id="lista-produtos-admin"></div></div>`;
        document.getElementById('salvar-produto-btn').addEventListener('click', salvarProduto);
        carregarProdutosAdmin();
    }

    // ** NOVAS FUNÇÕES PARA GERENCIAR COMBOS **
    function renderCombosAdmin() {
        document.getElementById('content-combos').innerHTML = `
            <div class="bg-white p-6 rounded-2xl shadow-lg mb-8">
                <h3 class="text-2xl font-semibold mb-4 text-purple-700">Adicionar / Editar Combo</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 border rounded-lg">
                    <input type="hidden" id="combo-id">
                    <input type="text" id="combo-nome" placeholder="Nome do Combo" class="p-2 border rounded">
                    <input type="number" id="combo-preco" placeholder="Preço do Combo" step="0.01" class="p-2 border rounded">
                    <input type="text" id="combo-imagem" placeholder="URL da Imagem" class="p-2 border rounded col-span-full">
                    <textarea id="combo-descricao" placeholder="Descrição do Combo (Ex: 2 Açaís 500ml...)" class="p-2 border rounded col-span-full" rows="3"></textarea>
                    <button id="salvar-combo-btn" class="bg-green-500 text-white p-2 rounded hover:bg-green-600 col-span-full">Salvar Combo</button>
                </div>
                <div id="lista-combos-admin"></div>
            </div>`;
        document.getElementById('salvar-combo-btn').addEventListener('click', salvarCombo);
        carregarCombosAdmin();
    }

    async function salvarCombo() {
        const id = document.getElementById('combo-id').value;
        const combo = { 
            name: document.getElementById('combo-nome').value, 
            price: parseFloat(document.getElementById('combo-preco').value) || 0,
            description: document.getElementById('combo-descricao').value,
            imageUrl: document.getElementById('combo-imagem').value,
            isActive: true 
        };
        if (!combo.name || !combo.description || combo.price <= 0) { showModal("Nome, Descrição e Preço válido são obrigatórios."); return; }
        
        try {
            if (id) { 
                 const existingCombo = combos.find(c => c.id === id);
                 if(existingCombo) combo.isActive = existingCombo.isActive;
                 await updateDoc(doc(db, "combos", id), combo); 
            } else { await addDoc(collection(db, "combos"), combo); }
            document.getElementById('combo-id').value = ''; document.getElementById('combo-nome').value = ''; document.getElementById('combo-preco').value = ''; document.getElementById('combo-descricao').value = ''; document.getElementById('combo-imagem').value = '';
        } catch (error) { console.error("Erro ao salvar combo:", error); showModal("Não foi possível salvar o combo."); }
    }

    function carregarCombosAdmin() {
        const container = document.getElementById('lista-combos-admin');
        onSnapshot(query(collection(db, "combos"), orderBy("name")), (snapshot) => {
            container.innerHTML = `<h4 class="text-xl font-medium mt-6 mb-2 text-purple-600">Combos Cadastrados</h4>`;
            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
            if (snapshot.empty) {
                grid.innerHTML = '<p class="col-span-full text-gray-500">Nenhum combo cadastrado.</p>';
            }
            snapshot.forEach(docSnap => {
                const c = { id: docSnap.id, ...docSnap.data() };
                const isInactive = c.isActive === false;
                const activeBtnClass = isInactive ? 'bg-gray-400' : 'bg-green-500';
                const activeBtnIcon = isInactive ? '🚫' : '👁️';

                grid.innerHTML += `
                <div class="border p-3 rounded-lg flex justify-between items-start ${isInactive ? 'opacity-50' : ''}">
                    <div class="flex-grow">
                        <p class="font-bold">${c.name}</p>
                        <p class="text-sm text-gray-600">${c.description}</p>
                        <p class="text-md font-semibold text-green-700 mt-1">R$${(c.price || 0).toFixed(2).replace('.', ',')}</p>
                    </div>
                    <div class="flex flex-col ml-2">
                        <button class="toggle-combo-btn p-1 text-white rounded mb-1 ${activeBtnClass}" data-id="${c.id}">${activeBtnIcon}</button>
                        <button class="edit-combo-btn p-1 text-blue-500" data-id="${c.id}">✏️</button>
                        <button class="delete-combo-btn p-1 text-red-500" data-id="${c.id}">🗑️</button>
                    </div>
                </div>`;
            });
            container.appendChild(grid);

            document.querySelectorAll('.edit-combo-btn').forEach(btn => btn.addEventListener('click', (e) => editarCombo(e.currentTarget.dataset.id)));
            document.querySelectorAll('.delete-combo-btn').forEach(btn => btn.addEventListener('click', (e) => deletarCombo(e.currentTarget.dataset.id)));
            document.querySelectorAll('.toggle-combo-btn').forEach(btn => btn.addEventListener('click', (e) => toggleComboStatus(e.currentTarget.dataset.id)));
        });
    }

    function editarCombo(id) {
        const c = combos.find(combo => combo.id === id);
        if (c) { 
            document.getElementById('combo-id').value = c.id; 
            document.getElementById('combo-nome').value = c.name; 
            document.getElementById('combo-preco').value = c.price; 
            document.getElementById('combo-descricao').value = c.description; 
            document.getElementById('combo-imagem').value = c.imageUrl; 
        }
    }

    function deletarCombo(id) {
        showModal(`<h3 class="text-xl font-bold mb-4">Confirmar Exclusão</h3><p class="mb-6">Tem certeza que deseja excluir este combo?</p><button id="confirm-delete-combo-btn" class="bg-red-500 text-white px-6 py-2 rounded-lg">Excluir</button><button onclick="window.closeModal()" class="bg-gray-300 px-4 py-2 rounded-lg ml-2">Cancelar</button>`, () => {
            document.getElementById('confirm-delete-combo-btn').addEventListener('click', async () => {
                try { await deleteDoc(doc(db, "combos", id)); closeModal(); } catch (error) { console.error("Erro ao excluir combo:", error); closeModal(); showModal('Ocorreu um erro ao excluir o combo.'); }
            });
        });
    }

    async function toggleComboStatus(id) {
        const combo = combos.find(c => c.id === id);
        if (combo) {
            const newStatus = !(combo.isActive !== false);
            try { await updateDoc(doc(db, "combos", id), { isActive: newStatus }); } 
            catch (error) { console.error("Erro ao atualizar status:", error); showModal("Não foi possível atualizar o status do combo."); }
        }
    }
    // ** FIM DAS FUNÇÕES DE COMBO **

    function renderVendasAdmin() {
        document.getElementById('content-vendas').innerHTML = `<div class="bg-white p-6 rounded-2xl shadow-lg"><h3 class="text-2xl font-semibold mb-4 text-purple-700">Relatório de Vendas</h3><div class="flex flex-wrap gap-4 items-center mb-4 p-4 border rounded-lg"><label for="start-date">De:</label><input type="date" id="start-date" class="p-2 border rounded"><label for="end-date">Até:</label><input type="date" id="end-date" class="p-2 border rounded"><button id="gerar-relatorio-btn" class="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">Gerar Relatório</button></div><div class="overflow-x-auto"><table class="w-full text-left"><thead class="bg-gray-100"><tr><th class="p-3">ID Pedido</th><th class="p-3">Data/Hora</th><th class="p-3">Cliente</th><th class="p-3">Pedido</th><th class="p-3">Financeiro</th><th class="p-3">Status</th><th class="p-3">Ações</th></tr></thead><tbody id="vendas-table-body"></tbody></table></div><div class="mt-4 text-right pr-4"><h4 class="text-xl font-bold text-gray-800">Total das Vendas (Período): <span id="total-vendas" class="text-purple-700">R$0,00</span></h4></div></div>`;
        document.getElementById('gerar-relatorio-btn').addEventListener('click', () => carregarVendasAdmin(document.getElementById('start-date').value, document.getElementById('end-date').value));
        carregarVendasAdmin();
    }

    function renderConfigAdmin() {
        const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
        let diasHTML = dias.map(dia => `
            <div class="grid grid-cols-1 sm:grid-cols-10 gap-x-4 gap-y-2 items-center mb-3 pb-3 border-b last:border-b-0">
                <span class="font-semibold capitalize sm:col-span-3">${dia}-feira</span>
                <input type="time" id="${dia}-abertura" class="p-2 border rounded w-full sm:col-span-3">
                <input type="time" id="${dia}-fechamento" class="p-2 border rounded w-full sm:col-span-3">
                <label class="flex items-center gap-2 sm:justify-self-center sm:col-span-1"><input type="checkbox" id="${dia}-aberto" class="w-5 h-5"> Aberto</label>
            </div>`).join('');

        document.getElementById('content-config').innerHTML = `
            <div class="bg-white p-6 rounded-2xl shadow-lg">
                <h3 class="text-2xl font-semibold mb-4 text-purple-700">Configurações Gerais</h3>
                <div class="mb-6 p-4 border rounded-lg">
                    <label for="whatsapp-number" class="block font-semibold mb-2">Número do WhatsApp para Pedidos</label>
                    <input type="text" id="whatsapp-number" placeholder="Ex: 5511999998888" class="w-full p-2 border rounded">
                </div>
                <h3 class="text-2xl font-semibold mb-4 text-purple-700">Horário de Funcionamento</h3>
                <div class="p-4 border rounded-lg">${diasHTML}</div>
                <h3 class="text-2xl font-semibold mt-6 mb-4 text-purple-700">Mensagem (Loja Fechada)</h3>
                <textarea id="mensagem-fechado" class="w-full p-2 border rounded" rows="3" placeholder="Ex: Estamos fechados. Nosso horário é de..."></textarea>
                <button id="salvar-config-btn" class="bg-green-500 text-white p-2 rounded hover:bg-green-600 mt-4">Salvar Configurações</button>
            </div>`;
        
        document.getElementById('salvar-config-btn').addEventListener('click', salvarConfiguracoes);
        carregarConfiguracoesAdmin();
    }
    
    function renderCaixaAdmin() {
        document.getElementById('content-caixa').innerHTML = `
            <div class="bg-white p-6 rounded-2xl shadow-lg">
                <h3 class="text-2xl font-semibold mb-4 text-purple-700">Fluxo de Caixa</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-center">
                    <div class="bg-green-100 p-4 rounded-lg"><h4 class="font-semibold text-green-800">Total de Entradas</h4><p id="total-entradas" class="text-2xl font-bold text-green-600">R$0,00</p></div>
                    <div class="bg-red-100 p-4 rounded-lg"><h4 class="font-semibold text-red-800">Total de Saídas</h4><p id="total-saidas" class="text-2xl font-bold text-red-600">R$0,00</p></div>
                    <div class="bg-blue-100 p-4 rounded-lg"><h4 class="font-semibold text-blue-800">Saldo Atual</h4><p id="saldo-atual" class="text-2xl font-bold text-blue-600">R$0,00</p></div>
                </div>
                <div class="mb-6 p-4 border rounded-lg">
                    <h4 class="text-xl font-medium mb-3">Adicionar Lançamento</h4>
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <input type="hidden" id="transacao-id">
                        <input type="text" id="transacao-descricao" placeholder="Descrição" class="p-2 border rounded col-span-2">
                        <input type="number" id="transacao-valor" placeholder="Valor" step="0.01" class="p-2 border rounded">
                        <select id="transacao-tipo" class="p-2 border rounded"><option value="entrada">Entrada</option><option value="saida">Saída</option></select>
                        <button id="salvar-transacao-btn" class="bg-green-500 text-white p-2 rounded hover:bg-green-600 col-span-4 md:col-span-1">Salvar</button>
                    </div>
                </div>
                <div class="flex flex-wrap gap-4 items-center mb-4 p-4 border rounded-lg">
                    <label for="start-date-caixa">De:</label><input type="date" id="start-date-caixa" class="p-2 border rounded">
                    <label for="end-date-caixa">Até:</label><input type="date" id="end-date-caixa" class="p-2 border rounded">
                    <button id="gerar-relatorio-caixa-btn" class="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">Gerar Relatório</button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead class="bg-gray-100">
                            <tr><th class="p-3">Data</th><th class="p-3">Descrição</th><th class="p-3">Tipo</th><th class="p-3">Valor</th><th class="p-3">Ações</th></tr>
                        </thead>
                        <tbody id="caixa-table-body"></tbody>
                    </table>
                </div>
            </div>`;
        document.getElementById('salvar-transacao-btn').addEventListener('click', salvarTransacao);
        document.getElementById('gerar-relatorio-caixa-btn').addEventListener('click', () => carregarFluxoCaixa(document.getElementById('start-date-caixa').value, document.getElementById('end-date-caixa').value));
        carregarFluxoCaixa();
    }

    async function salvarProduto() {
        const id = document.getElementById('produto-id').value;
        const produto = {
            name: document.getElementById('produto-nome').value,
            price: parseFloat(document.getElementById('produto-preco').value) || 0,
            cost: parseFloat(document.getElementById('produto-custo').value) || 0,
            unit: document.getElementById('produto-unidade').value,
            icon: document.getElementById('produto-icone').value,
            category: document.getElementById('produto-categoria').value,
            isActive: true,
            default: false
        };
        if (!produto.name || produto.price <= 0) { showModal("Nome e Preço de Venda válido são obrigatórios."); return; }
        try {
            if (id) { 
                const existingProduct = produtos.find(p => p.id === id);
                if(existingProduct) {
                    produto.isActive = existingProduct.isActive;
                    produto.default = existingProduct.default;
                }
                await updateDoc(doc(db, "produtos", id), produto); 
            } else { await addDoc(collection(db, "produtos"), produto); }
            document.getElementById('produto-id').value = ''; document.getElementById('produto-nome').value = ''; document.getElementById('produto-preco').value = ''; document.getElementById('produto-custo').value = ''; document.getElementById('produto-unidade').value = ''; document.getElementById('produto-icone').value = '';
        } catch (error) { console.error("Erro ao salvar produto:", error); showModal("Não foi possível salvar o produto."); }
    }

    function carregarProdutosAdmin() {
        const container = document.getElementById('lista-produtos-admin');
        onSnapshot(query(collection(db, "produtos"), orderBy("category"), orderBy("name")), (snapshot) => {
            container.innerHTML = `<h4 class="text-xl font-medium mt-6 mb-2 text-purple-600">Produtos Cadastrados</h4>`;
            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
            if (snapshot.empty) {
                grid.innerHTML = '<p class="col-span-full text-gray-500">Nenhum produto cadastrado.</p>';
            }
            snapshot.forEach(docSnap => {
                const p = { id: docSnap.id, ...docSnap.data() };
                const isInactive = p.isActive === false;
                const activeBtnClass = isInactive ? 'bg-gray-400' : 'bg-green-500';
                const activeBtnIcon = isInactive ? '🚫' : '👁️';
                const defaultBtnClass = p.default ? 'bg-yellow-500' : 'bg-gray-400';
                const defaultBtnIcon = p.default ? '⭐' : '☆';

                grid.innerHTML += `
                <div class="border p-3 rounded-lg flex justify-between items-start ${isInactive ? 'opacity-50' : ''}">
                    <div class="flex-grow">
                        <p class="font-bold">${p.name} (${p.unit})</p>
                        <p class="text-sm text-gray-600">${p.category}</p>
                        <p class="text-md font-semibold text-green-700 mt-1">R$${(p.price || 0).toFixed(2).replace('.', ',')}</p>
                        <p class="text-sm text-gray-500">Custo: R$${(p.cost || 0).toFixed(2).replace('.', ',')}</p>
                    </div>
                    <div class="flex flex-col ml-2">
                        ${p.category === 'tamanho' ? `<button class="set-default-btn p-1 text-white rounded mb-1 ${defaultBtnClass}" data-id="${p.id}">${defaultBtnIcon}</button>` : ''}
                        <button class="toggle-product-btn p-1 text-white rounded mb-1 ${activeBtnClass}" data-id="${p.id}">${activeBtnIcon}</button>
                        <button class="edit-product-btn p-1 text-blue-500" data-id="${p.id}">✏️</button>
                        ${p.category === 'tamanho' ? `<button class="recipe-product-btn p-1 text-purple-500" data-id="${p.id}">📋</button>` : ''}
                        <button class="delete-product-btn p-1 text-red-500" data-id="${p.id}">🗑️</button>
                    </div>
                </div>`;
            });
            container.appendChild(grid);

            document.querySelectorAll('.edit-product-btn').forEach(btn => btn.addEventListener('click', (e) => editarProduto(e.currentTarget.dataset.id)));
            document.querySelectorAll('.delete-product-btn').forEach(btn => btn.addEventListener('click', (e) => deletarProduto(e.currentTarget.dataset.id)));
            document.querySelectorAll('.toggle-product-btn').forEach(btn => btn.addEventListener('click', (e) => toggleProductStatus(e.currentTarget.dataset.id)));
            document.querySelectorAll('.set-default-btn').forEach(btn => btn.addEventListener('click', (e) => setDefaultProduct(e.currentTarget.dataset.id)));
            document.querySelectorAll('.recipe-product-btn').forEach(btn => btn.addEventListener('click', (e) => openRecipeModal(e.currentTarget.dataset.id)));
        });
    }

    function editarProduto(id) {
        const p = produtos.find(produto => produto.id === id);
        if (p) { 
            document.getElementById('produto-id').value = p.id; 
            document.getElementById('produto-nome').value = p.name; 
            document.getElementById('produto-preco').value = p.price; 
            document.getElementById('produto-custo').value = p.cost; 
            document.getElementById('produto-unidade').value = p.unit; 
            document.getElementById('produto-icone').value = p.icon; 
            document.getElementById('produto-categoria').value = p.category; 
        }
    }

    function deletarProduto(id) {
        showModal(`<h3 class="text-xl font-bold mb-4">Confirmar Exclusão</h3><p class="mb-6">Tem certeza que deseja excluir este produto?</p><button id="confirm-delete-btn" class="bg-red-500 text-white px-6 py-2 rounded-lg">Excluir</button><button onclick="window.closeModal()" class="bg-gray-300 px-4 py-2 rounded-lg ml-2">Cancelar</button>`, () => {
            document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
                try { await deleteDoc(doc(db, "produtos", id)); closeModal(); } catch (error) { console.error("Erro ao excluir produto:", error); closeModal(); showModal('Ocorreu um erro ao excluir o produto.'); }
            });
        });
    }

    async function toggleProductStatus(id) {
        const produto = produtos.find(p => p.id === id);
        if (produto) {
            const newStatus = !(produto.isActive !== false);
            try { await updateDoc(doc(db, "produtos", id), { isActive: newStatus }); } 
            catch (error) { console.error("Erro ao atualizar status:", error); showModal("Não foi possível atualizar o status do produto."); }
        }
    }

    async function setDefaultProduct(id) {
        const produto = produtos.find(p => p.id === id);
        if (produto && produto.category === 'tamanho') {
            try {
                // Desmarcar o produto padrão anterior
                const currentDefault = produtos.find(p => p.category === 'tamanho' && p.default === true);
                if (currentDefault && currentDefault.id !== id) {
                    await updateDoc(doc(db, "produtos", currentDefault.id), { default: false });
                }
                // Marcar o novo produto como padrão
                await updateDoc(doc(db, "produtos", id), { default: true });
                showToast("Produto padrão atualizado!", 'success');
            } catch (error) {
                console.error("Erro ao definir produto padrão:", error);
                showModal("Não foi possível definir o produto como padrão.");
            }
        }
    }

    function carregarVendasAdmin(startDate, endDate) {
        const tableBody = document.getElementById('vendas-table-body');
        let q = query(collection(db, "pedidos"), orderBy("timestamp", "desc"));

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            q = query(collection(db, "pedidos"), where("timestamp", ">=", start), where("timestamp", "<=", end), orderBy("timestamp", "desc"));
        }
        
        if (unsubscribeVendas) unsubscribeVendas();

        unsubscribeVendas = onSnapshot(q, (snapshot) => {
            tableBody.innerHTML = '';
            let totalVendas = 0;

            if (snapshot.empty) { tableBody.innerHTML = '<tr><td colspan="7" class="text-center p-4">Nenhuma venda encontrada para o período.</td></tr>'; }
            
            snapshot.docs.forEach(docSnap => {
                const venda = { id: docSnap.id, ...docSnap.data() };
                totalVendas += venda.valorTotal || 0;

                const dataHora = venda.timestamp ? new Date(venda.timestamp.seconds * 1000).toLocaleString('pt-BR') : 'N/A';
                const itensFormatados = venda.itens.map(item => {
                    let itemStr = item.name;
                    if (item.quantity && item.quantity > 1) itemStr = `${item.quantity}x ${itemStr}`;
                    if (item.price && item.price > 0) itemStr += ` (R$${item.price.toFixed(2).replace('.', ',')})`;
                    return itemStr;
                }).join('<br>');

                const statusOptions = ['Pendente', 'Em Preparo', 'A Caminho', 'Entregue', 'Cancelado'].map(status => 
                    `<option value="${status}" ${venda.status === status ? 'selected' : ''}>${status}</option>`
                ).join('');

                tableBody.innerHTML += `
                    <tr class="border-b">
                        <td class="p-3 text-sm">${venda.id.substring(0, 6)}...</td>
                        <td class="p-3 text-sm">${dataHora}</td>
                        <td class="p-3">${venda.cliente}</td>
                        <td class="p-3 text-sm">${itensFormatados}</td>
                        <td class="p-3 font-semibold">R$${(venda.valorTotal || 0).toFixed(2).replace('.', ',')}</td>
                        <td class="p-3">
                            <select class="status-select p-1 border rounded" data-id="${venda.id}">
                                ${statusOptions}
                            </select>
                        </td>
                        <td class="p-3"><button class="delete-venda-btn bg-red-500 text-white px-2 py-1 rounded text-xs" data-id="${venda.id}">🗑️</button></td>
                    </tr>`;
            });
            document.getElementById('total-vendas').innerText = `R$${totalVendas.toFixed(2).replace('.', ',')}`;

            document.querySelectorAll('.status-select').forEach(select => {
                select.addEventListener('change', async (e) => {
                    const vendaId = e.target.dataset.id;
                    const newStatus = e.target.value;
                    try { await updateDoc(doc(db, "pedidos", vendaId), { status: newStatus }); showToast("Status atualizado!", 'success'); }
                    catch (error) { console.error("Erro ao atualizar status da venda:", error); showToast("Erro ao atualizar status.", 'error'); }
                });
            });
            document.querySelectorAll('.delete-venda-btn').forEach(btn => btn.addEventListener('click', e => deletarVenda(e.currentTarget.dataset.id)));
        });
    }

    function deletarVenda(id) {
        showModal(`<h3 class="text-xl font-bold mb-4">Confirmar Exclusão</h3><p class="mb-6">Tem certeza que deseja excluir esta venda?</p><button id="confirm-delete-venda-btn" class="bg-red-500 text-white px-6 py-2 rounded-lg">Excluir</button><button onclick="window.closeModal()" class="bg-gray-300 px-4 py-2 rounded-lg ml-2">Cancelar</button>`, () => {
            document.getElementById('confirm-delete-venda-btn').addEventListener('click', async () => {
                try { await deleteDoc(doc(db, "pedidos", id)); closeModal(); } catch (error) { console.error("Erro ao excluir venda:", error); closeModal(); showModal('Ocorreu um erro ao excluir a venda.'); }
            });
        });
    }

    async function salvarConfiguracoes() {
        const whatsappNumber = document.getElementById('whatsapp-number').value.trim();
        const mensagemFechado = document.getElementById('mensagem-fechado').value.trim();
        const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
        const horarios = {};
        dias.forEach(dia => {
            horarios[dia] = {
                aberto: document.getElementById(`${dia}-aberto`).checked,
                abertura: document.getElementById(`${dia}-abertura`).value,
                fechamento: document.getElementById(`${dia}-fechamento`).value
            };
        });

        try {
            await setDoc(doc(db, "configuracoes", "horarios"), { whatsappNumber, mensagemFechado, ...horarios });
            showToast("Configurações salvas com sucesso!", 'success');
        } catch (error) {
            console.error("Erro ao salvar configurações:", error);
            showToast("Não foi possível salvar as configurações.", 'error');
        }
    }

    async function carregarConfiguracoesAdmin() {
        const docSnap = await getDoc(doc(db, "configuracoes", "horarios"));
        if (docSnap.exists()) {
            const settings = docSnap.data();
            document.getElementById('whatsapp-number').value = settings.whatsappNumber || '';
            document.getElementById('mensagem-fechado').value = settings.mensagemFechado || '';
            const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
            dias.forEach(dia => {
                if (settings[dia]) {
                    document.getElementById(`${dia}-aberto`).checked = settings[dia].aberto;
                    document.getElementById(`${dia}-abertura`).value = settings[dia].abertura;
                    document.getElementById(`${dia}-fechamento`).value = settings[dia].fechamento;
                }
            });
        }
    }

    async function salvarTransacao() {
        const id = document.getElementById('transacao-id').value;
        const transacao = {
            descricao: document.getElementById('transacao-descricao').value,
            valor: parseFloat(document.getElementById('transacao-valor').value),
            tipo: document.getElementById('transacao-tipo').value,
            timestamp: serverTimestamp()
        };
        if (!transacao.descricao || isNaN(transacao.valor) || transacao.valor <= 0) { showModal("Descrição e valor válido são obrigatórios."); return; }
        try {
            if (id) { await updateDoc(doc(db, "fluxoCaixa", id), { descricao: transacao.descricao, valor: transacao.valor, tipo: transacao.tipo }); } 
            else { await addDoc(collection(db, "fluxoCaixa"), transacao); }
            document.getElementById('transacao-id').value = ''; document.getElementById('transacao-descricao').value = ''; document.getElementById('transacao-valor').value = '';
        } catch (error) { console.error("Erro ao salvar transação:", error); showModal("Não foi possível salvar a transação."); }
    }

    function carregarFluxoCaixa(startDate, endDate) {
        const tableBody = document.getElementById('caixa-table-body');
        let q = query(collection(db, "fluxoCaixa"), orderBy("timestamp", "desc"));

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            q = query(collection(db, "fluxoCaixa"), where("timestamp", ">=", start), where("timestamp", "<=", end), orderBy("timestamp", "desc"));
        }
        
        if (unsubscribeFluxoCaixa) unsubscribeFluxoCaixa();

        unsubscribeFluxoCaixa = onSnapshot(q, (snapshot) => {
            tableBody.innerHTML = '';
            let totalEntradas = 0, totalSaidas = 0;

            if (snapshot.empty) { tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Nenhum lançamento encontrado.</td></tr>'; }
            
            snapshot.docs.forEach(docSnap => {
                const t = { id: docSnap.id, ...docSnap.data() };
                const valor = t.valor || 0;
                if (t.tipo === 'entrada') totalEntradas += valor; else totalSaidas += valor;

                const data = t.timestamp ? new Date(t.timestamp.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A';
                const tipoClass = t.tipo === 'entrada' ? 'text-green-600' : 'text-red-600';
                tableBody.innerHTML += `
                    <tr class="border-b">
                        <td class="p-3 text-sm">${data}</td><td class="p-3">${t.descricao}</td>
                        <td class="p-3 font-semibold ${tipoClass} capitalize">${t.tipo}</td>
                        <td class="p-3 font-medium">R$${valor.toFixed(2).replace('.', ',')}</td>
                        <td class="p-3"><button class="delete-transacao-btn bg-red-500 text-white px-2 py-1 rounded text-xs" data-id="${t.id}">🗑️</button></td>
                    </tr>`;
            });
            
            document.getElementById('total-entradas').innerText = `R$${totalEntradas.toFixed(2).replace('.', ',')}`;
            document.getElementById('total-saidas').innerText = `R$${totalSaidas.toFixed(2).replace('.', ',')}`;
            document.getElementById('saldo-atual').innerText = `R$${(totalEntradas - totalSaidas).toFixed(2).replace('.', ',')}`;

            document.querySelectorAll('.delete-transacao-btn').forEach(btn => btn.addEventListener('click', e => deletarTransacao(e.currentTarget.dataset.id)));
        });
    }

    function deletarTransacao(id) {
        const confirmationHTML = `<h3 class="text-xl font-bold mb-4">Confirmar Exclusão</h3><p class="mb-6">Tem certeza que deseja excluir este lançamento?</p><button id="confirm-delete-transacao-btn" class="bg-red-500 text-white px-6 py-2 rounded-lg">Excluir</button><button onclick="window.closeModal()" class="bg-gray-300 px-4 py-2 rounded-lg ml-2">Cancelar</button>`, () => {
            document.getElementById('confirm-delete-transacao-btn').addEventListener('click', async () => {
                try { await deleteDoc(doc(db, "fluxoCaixa", id)); closeModal(); } catch (error) { console.error("Erro ao excluir transação:", error); closeModal(); showModal('Ocorreu um erro ao excluir.'); }
            });
        });
    }

    function checkStoreOpen() {
        const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
        const agora = new Date();
        const diaSemana = dias[agora.getDay()];
        const horaAtual = agora.getHours() * 60 + agora.getMinutes();
        const configDia = storeSettings[diaSemana];
        
        const avisoLojaFechada = document.getElementById('loja-fechada-aviso');
        const msgLojaFechada = document.getElementById('mensagem-loja-fechada');

        if (!configDia || !configDia.aberto || !configDia.abertura || !configDia.fechamento) { 
            isStoreOpen = true; // Assume a loja aberta se não houver configuração
        } else {
            const [aberturaH, aberturaM] = configDia.abertura.split(':').map(Number);
            const [fechamentoH, fechamentoM] = configDia.fechamento.split(':').map(Number);
            const aberturaTotal = aberturaH * 60 + aberturaM;
            const fechamentoTotal = fechamentoH * 60 + fechamentoM;
            isStoreOpen = horaAtual >= aberturaTotal && horaAtual < fechamentoTotal;
        }
        
        const buttons = [sendOrderBtnMobile, sendOrderBtnDesktop];
        buttons.forEach(btn => {
            if (btn) {
                if (isStoreOpen) { 
                    btn.disabled = false; 
                    btn.classList.remove('bg-gray-400', 'cursor-not-allowed'); 
                    btn.classList.add('bg-green-500', 'hover:bg-green-600'); 
                    avisoLojaFechada.classList.add('hidden');
                } else { 
                    btn.disabled = true; 
                    btn.classList.add('bg-gray-400', 'cursor-not-allowed'); 
                    btn.classList.remove('bg-green-500', 'hover:bg-green-600'); 
                    avisoLojaFechada.classList.remove('hidden');
                    msgLojaFechada.innerText = storeSettings.mensagemFechado || "Estamos fechados no momento.";
                }
            }
        });
    }

    function openRecipeModal(id) {
        const produtoTamanho = produtos.find(p => p.id === id);
        if (!produtoTamanho) return;

        const insumos = produtos.filter(p => p.category === 'insumo');
        let insumosHTML = insumos.map(insumo => {
            const itemReceita = produtoTamanho.recipe?.find(r => r.name === insumo.name);
            const quantidade = itemReceita ? itemReceita.quantity : 0;
            return `
                <div class="flex justify-between items-center mb-2">
                    <label for="recipe-${insumo.id}">${insumo.name} (${insumo.unit})</label>
                    <input type="number" id="recipe-${insumo.id}" data-name="${insumo.name}" value="${quantidade}" class="w-24 p-1 border rounded text-center" placeholder="Qtd.">
                </div>
            `;
        }).join('');

        const modalContent = `
            <div class="text-left">
                <h3 class="text-xl font-bold mb-4 text-purple-700">Ficha Técnica para ${produtoTamanho.name}</h3>
                <div id="recipe-form" class="max-h-96 overflow-y-auto p-2">${insumosHTML}</div>
                <div class="mt-6 text-right">
                    <button id="save-recipe-btn" class="bg-green-500 text-white px-6 py-2 rounded-lg">Salvar Receita</button>
                    <button onclick="window.closeModal()" class="bg-gray-300 px-4 py-2 rounded-lg ml-2">Cancelar</button>
                </div>
            </div>
        `;

        showModal(modalContent, () => {
            document.getElementById('save-recipe-btn').addEventListener('click', () => salvarReceita(id));
        });
    }

    async function salvarReceita(id) {
        const recipe = [];
        document.querySelectorAll('#recipe-form input').forEach(input => {
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
        renderMenu();
        calcularValor();
    }, (error) => {
        console.error("Erro ao carregar produtos:", error);
        document.getElementById('menu-container').innerHTML = '<p class="text-red-600 text-center">Não foi possível carregar o cardápio.</p>';
    });

    // Listener para os combos
    onSnapshot(collection(db, "combos"), (snapshot) => {
        combos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCombosMenu();
    }, (error) => {
        console.error("Erro ao carregar combos:", error);
        document.getElementById('combos-section').classList.add('hidden');
    });


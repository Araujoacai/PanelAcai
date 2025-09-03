// Toda a lógica de JavaScript foi mantida e não precisa de alterações.
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

    let produtos = [];
    let combos = [];
    let precosBase = {};
    let unsubscribeVendas;
    let unsubscribeFluxoCaixa;
    let storeSettings = {};
    let isStoreOpen = true; 
    let initialVendasLoadComplete = false;

    const menuContainer = document.getElementById("menu-container");
    const adminPanel = document.getElementById("admin-panel");
    const whatsappBar = document.getElementById("whatsapp-bar");
    const adminLoginBtn = document.getElementById("admin-login-button");
    const adminLogoutBtn = document.getElementById("admin-logout-button");
    const modalContainer = document.getElementById("modal-container");
    const sendOrderBtnMobile = document.getElementById("send-order-button-mobile");
    const sendOrderBtnDesktop = document.getElementById("send-order-button-desktop");

    function showModal(content, onOpen = () => {}) {
        let modalContent = content;
        if (typeof content === "string") {
            modalContent = `<p class="text-lg text-gray-800 mb-6">${content}</p><button onclick="window.closeModal()" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-8 rounded-lg transition-colors">OK</button>`;
        }
        modalContainer.innerHTML = `<div class="bg-white border border-purple-200 text-gray-800 rounded-2xl p-6 w-full max-w-md text-center shadow-xl transform transition-all scale-95 opacity-0" id="modal-box">${modalContent}</div>`;
        modalContainer.classList.remove("hidden");
        setTimeout(() => { document.getElementById("modal-box").classList.remove("scale-95", "opacity-0"); onOpen(); }, 10);
    }

    function closeModal() {
        const modalBox = document.getElementById("modal-box");
        if (modalBox) {
            modalBox.classList.add("scale-95", "opacity-0");
            setTimeout(() => { modalContainer.classList.add("hidden"); modalContainer.innerHTML = ""; }, 200);
        }
    }

    onAuthStateChanged(auth, user => {
        if (user) {
            adminLoginBtn.classList.add("hidden"); adminLogoutBtn.classList.remove("hidden"); menuContainer.classList.add("hidden"); whatsappBar.classList.add("hidden"); adminPanel.classList.remove("hidden");
            renderAdminPanel();
        } else {
            adminLoginBtn.classList.remove("hidden"); adminLogoutBtn.classList.add("hidden"); menuContainer.classList.remove("hidden");
            if (document.body.clientWidth < 1024) { 
                 whatsappBar.classList.remove("hidden");
            }
            adminPanel.classList.add("hidden");
            if (unsubscribeVendas) unsubscribeVendas();
            if (unsubscribeFluxoCaixa) unsubscribeFluxoCaixa();
        }
    });

    adminLoginBtn.addEventListener("click", () => {
        showModal(`
            <h3 class="text-2xl font-bold mb-4 text-purple-700">Login de Administrador</h3>
            <input type="email" id="admin-email" placeholder="Email" class="w-full p-3 mb-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
            <input type="password" id="admin-password" placeholder="Senha" class="w-full p-3 mb-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
            <button id="login-submit-btn" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg transition-colors w-full">Entrar</button>
            <button onclick="window.closeModal()" class="bg-gray-300 text-gray-800 font-bold py-2 px-8 rounded-lg transition-colors w-full mt-2">Cancelar</button>
        `, () => {
            document.getElementById("login-submit-btn").addEventListener("click", async () => {
                const email = document.getElementById("admin-email").value;
                const password = document.getElementById("admin-password").value;
                try {
                    await signInWithEmailAndPassword(auth, email, password);
                    closeModal();
                    showToast("Login realizado com sucesso!", "success");
                } catch (error) {
                    console.error("Erro de login:", error.message);
                    showToast("Erro ao fazer login. Verifique suas credenciais.", "error");
                }
            });
        });
    });

    adminLogoutBtn.addEventListener("click", async () => {
        try {
            await signOut(auth);
            showToast("Logout realizado com sucesso!", "success");
        } catch (error) {
            console.error("Erro ao fazer logout:", error.message);
            showToast("Erro ao fazer logout.", "error");
        }
    });

    window.closeModal = closeModal; // Torna a função acessível globalmente para o onclick no HTML do modal

    function showToast(message, type = "info") {
        const toastContainer = document.getElementById("toast-container");
        const toast = document.createElement("div");
        toast.className = `toast-notification relative p-4 pr-10 mb-3 rounded-lg shadow-md text-white flex items-center justify-between transform transition-all duration-500 ease-out ${type === "success" ? "bg-green-500" : type === "error" ? "bg-red-500" : "bg-blue-500"}`;
        toast.innerHTML = `
            <span>${message}</span>
            <button class="absolute top-1 right-1 text-white opacity-75 hover:opacity-100" onclick="this.parentElement.remove()">
                &times;
            </button>
        `;
        toastContainer.prepend(toast);
        setTimeout(() => { toast.remove(); }, 5000);
    }

    function renderMenu() {
        const tamanhosContainer = document.getElementById("tamanhos-container");
        const frutasContainer = document.getElementById("frutas-container");
        const cremesContainer = document.getElementById("cremes-container");
        const outrosContainer = document.getElementById("outros-container");

        tamanhosContainer.innerHTML = "";
        frutasContainer.innerHTML = "";
        cremesContainer.innerHTML = "";
        outrosContainer.innerHTML = "";

        precosBase = {};

        produtos.forEach(produto => {
            const isInactive = produto.isActive === false;
            const itemHTML = `
                <label class="radio-label block p-3 border-2 border-purple-200 rounded-xl cursor-pointer text-center transition-all duration-200 ${isInactive ? "opacity-50 cursor-not-allowed" : ""}">
                    <input type="${produto.category === "tamanho" ? "radio" : "checkbox"}" name="${produto.category}" value="${produto.id}" data-price="${produto.price}" data-name="${produto.name}" class="hidden" ${isInactive ? "disabled" : ""}>
                    <div class="flex flex-col items-center">
                        ${produto.iconUrl ? `<img src="${produto.iconUrl}" alt="${produto.name}" class="w-12 h-12 mb-2">` : ""}
                        <span class="font-semibold text-purple-800">${produto.name}</span>
                        ${produto.category === "tamanho" ? `<span class="text-green-600 font-bold">R$${(produto.price || 0).toFixed(2).replace(".", ",")}<
(Content truncated due to size limit. Use page ranges or line ranges to read remaining content)


import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, setDoc, runTransaction, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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
let storeSettings = {};
let isStoreOpen = true; 

const menuContainer = document.getElementById('menu-container');
const modalContainer = document.getElementById('modal-container');
const sendOrderBtnMobile = document.getElementById('send-order-button-mobile');
const sendOrderBtnDesktop = document.getElementById('send-order-button-desktop');
const whatsappBar = document.getElementById('whatsapp-bar');


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
    // No painel do cliente, apenas escondemos a barra do WhatsApp em telas grandes
    if (document.body.clientWidth >= 1024) { 
        whatsappBar.classList.add('hidden');
    } else {
        whatsappBar.classList.remove('hidden');
    }
});

function renderMenu() {
    const containers = { tamanho: document.getElementById('tamanhos-container'), fruta: document.getElementById('frutas-container'), creme: document.getElementById('cremes-container'), outro: document.getElementById('outros-container') };
    Object.values(containers).forEach(c => { if(c) c.innerHTML = ''; });
    precosBase = {};
    const produtosVisiveis = produtos.filter(p => p.category !== 'insumo' && p.isActive !== false);
    if (produtosVisiveis.length === 0) { Object.values(containers).forEach(c => { if(c) c.innerHTML = '<p class="text-red-500 text-sm col-span-full">Nenhum item disponível no momento.</p>'; }); return; }
    
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
            calcularValor();
        });
    });
    document.querySelectorAll('input, textarea').forEach(el => { el.addEventListener("change", calcularValor); el.addEventListener("input", calcularValor); });
    document.getElementById('apenas-acai-check').addEventListener('change', calcularValor);
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
       
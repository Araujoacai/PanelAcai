import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { 
    getFirestore, collection, onSnapshot, addDoc, serverTimestamp, 
    query, where, orderBy, getDocs 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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

let pedidoAtual = [];
let copoAtualIndex = 0;
let unsubscribeVendas;

// --- Inicializa pedido ---
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
    renderizarResumoPedido();
    calcularValor();
}

// --- Salvar pedido no Firestore ---
async function salvarPedido(nomeCliente, telefoneCliente, status = "pendente") {
    try {
        let total = pedidoAtual.reduce((sum, copo) => sum + (copo.preco || 0), 0);

        const pedido = {
            orderId: gerarOrderId(),
            nomeCliente,
            telefoneCliente,
            itens: pedidoAtual.map(copo => ({
                tamanho: copo.tamanho || "N/A",
                acompanhamentos: copo.acompanhamentos?.map(a => ({
                    name: a.name,
                    quantity: a.quantity
                })) || [],
                apenasAcai: !!copo.apenasAcai,
                observacoes: copo.observacoes || "",
                preco: copo.preco || 0
            })),
            total: `R$${total.toFixed(2).replace('.', ',')}`,
            status,
            timestamp: serverTimestamp()
        };

        await addDoc(collection(db, "vendas"), pedido);
        console.log("Pedido salvo:", pedido.orderId);

        inicializarPedido();
        showModal("Pedido enviado com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar pedido:", error);
        showModal("Erro ao salvar pedido, tente novamente.");
    }
}

// --- Gera ID do pedido ---
function gerarOrderId() {
    const data = new Date();
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    return `${dia}${mes}-${Math.floor(Math.random() * 1000)}`;
}

// --- Relatório Admin ---
function carregarVendasAdmin(startDate, endDate) {
    const tableBody = document.getElementById('vendas-table-body');
    let q = query(collection(db, "vendas"), orderBy("timestamp", "desc"));

    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        q = query(
            collection(db, "vendas"),
            where("timestamp", ">=", start),
            where("timestamp", "<=", end),
            orderBy("timestamp", "desc")
        );
    }

    if (unsubscribeVendas) unsubscribeVendas();

    unsubscribeVendas = onSnapshot(q, (snapshot) => {
        tableBody.innerHTML = '';
        let totalVendas = 0;

        snapshot.docs.forEach(docSnap => {
            const venda = { id: docSnap.id, ...docSnap.data() };

            const valorNumerico = parseFloat(venda.total.replace('R$', '').replace(',', '.'));
            if (!isNaN(valorNumerico)) totalVendas += valorNumerico;

            const data = venda.timestamp ? new Date(venda.timestamp.seconds * 1000).toLocaleString('pt-BR') : 'N/A';
            const statusClass = venda.status === 'pendente' ? 'text-yellow-600' : 'text-green-600';

            let pedidoHTML = '';
            if (venda.itens && Array.isArray(venda.itens)) {
                pedidoHTML = venda.itens.map((item, index) => {
                    const acompText = (item.acompanhamentos || [])
                        .map(a => `${a.name}(x${a.quantity})`)
                        .join(', ');

                    let resumoAcomp = "";
                    if (item.acompanhamentos?.length > 0) {
                        const totalPorcoes = item.acompanhamentos.reduce((sum, a) => sum + (a.quantity || 0), 0);
                        if (item.apenasAcai) {
                            resumoAcomp = `${totalPorcoes} extras`;
                        } else {
                            const inclusos = Math.min(totalPorcoes, 3);
                            const extras = Math.max(totalPorcoes - 3, 0);
                            resumoAcomp = `${inclusos} inclusos${extras > 0 ? ` + ${extras} extra(s)` : ""}`;
                        }
                    } else {
                        resumoAcomp = item.apenasAcai ? "Somente Açaí" : "Nenhum acompanhamento";
                    }

                    const precoCopo = item.preco ? `R$${item.preco.toFixed(2).replace(".", ",")}` : "—";

                    return `
                        <div class="mb-2">
                            <strong>Copo ${index + 1} (${item.tamanho}):</strong><br>
                            <small class="text-gray-500">${acompText || resumoAcomp}</small><br>
                            <small class="text-blue-600 italic">Resumo: ${resumoAcomp}</small><br>
                            <small class="text-green-700 font-semibold">Valor: ${precoCopo}</small>
                        </div>
                    `;
                }).join('<hr class="my-1">');
            }

            tableBody.innerHTML += `
                <tr class="border-b">
                    <td class="p-3 text-sm font-mono">${venda.orderId || 'N/A'}</td>
                    <td class="p-3 text-sm">${data}</td>
                    <td class="p-3 text-sm font-semibold">${venda.nomeCliente || 'N/A'}<br><small class="text-gray-500 font-normal">${venda.telefoneCliente || ''}</small></td>
                    <td class="p-3 text-sm">${pedidoHTML}</td>
                    <td class="p-3 font-medium">${venda.total}</td>
                    <td class="p-3 font-semibold ${statusClass} capitalize">${venda.status}</td>
                </tr>`;
        });

        document.getElementById('total-vendas').innerText = `R$${totalVendas.toFixed(2).replace('.', ',')}`;
    });
}

// --- Exportar CSV ---
function exportarCSV(vendas) {
    let csvContent = "OrderID;Cliente;Telefone;Data;Copo;Acompanhamentos;Resumo;Valor\n";

    vendas.forEach(venda => {
        if (venda.itens) {
            venda.itens.forEach((item, index) => {
                const acompText = (item.acompanhamentos || [])
                    .map(a => `${a.name}(x${a.quantity})`)
                    .join(', ');

                let resumoAcomp = "";
                if (item.acompanhamentos?.length > 0) {
                    const totalPorcoes = item.acompanhamentos.reduce((sum, a) => sum + (a.quantity || 0), 0);
                    if (item.apenasAcai) {
                        resumoAcomp = `${totalPorcoes} extras`;
                    } else {
                        const inclusos = Math.min(totalPorcoes, 3);
                        const extras = Math.max(totalPorcoes - 3, 0);
                        resumoAcomp = `${inclusos} inclusos${extras > 0 ? ` + ${extras} extra(s)` : ""}`;
                    }
                } else {
                    resumoAcomp = item.apenasAcai ? "Somente Açaí" : "Nenhum acompanhamento";
                }

                const precoCopo = item.preco ? `R$${item.preco.toFixed(2).replace(".", ",")}` : "—";
                const data = venda.timestamp ? new Date(venda.timestamp.seconds * 1000).toLocaleString('pt-BR') : 'N/A';

                csvContent += `${venda.orderId};${venda.nomeCliente};${venda.telefoneCliente};${data};Copo ${index + 1} (${item.tamanho});${acompText || resumoAcomp};${resumoAcomp};${precoCopo}\n`;
            });
        }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_vendas.csv`;
    link.click();
}

// --- Exportar PDF ---
async function exportarPDF(vendas) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text("Relatório de Vendas", 10, 10);

    let y = 20;
    vendas.forEach(venda => {
        doc.setFontSize(10);
        doc.text(`Pedido: ${venda.orderId} | Cliente: ${venda.nomeCliente} | Telefone: ${venda.telefoneCliente}`, 10, y);
        y += 6;

        if (venda.itens) {
            venda.itens.forEach((item, index) => {
                const acompText = (item.acompanhamentos || [])
                    .map(a => `${a.name}(x${a.quantity})`)
                    .join(', ');

                let resumoAcomp = "";
                if (item.acompanhamentos?.length > 0) {
                    const totalPorcoes = item.acompanhamentos.reduce((sum, a) => sum + (a.quantity || 0), 0);
                    if (item.apenasAcai) {
                        resumoAcomp = `${totalPorcoes} extras`;
                    } else {
                        const inclusos = Math.min(totalPorcoes, 3);
                        const extras = Math.max(totalPorcoes - 3, 0);
                        resumoAcomp = `${inclusos} inclusos${extras > 0 ? ` + ${extras} extra(s)` : ""}`;
                    }
                } else {
                    resumoAcomp = item.apenasAcai ? "Somente Açaí" : "Nenhum acompanhamento";
                }

                const precoCopo = item.preco ? `R$${item.preco.toFixed(2).replace(".", ",")}` : "—";
                doc.text(
                    `Copo ${index + 1} (${item.tamanho}) - ${acompText || resumoAcomp} | Resumo: ${resumoAcomp} | Valor: ${precoCopo}`,
                    15,
                    y
                );
                y += 6;
            });
        }

        y += 4;
        if (y > 270) {
            doc.addPage();
            y = 20;
        }
    });

    doc.save("relatorio_vendas.pdf");
}

// --- Listeners dos botões de exportação ---
document.getElementById("btn-export-csv")?.addEventListener("click", async () => {
    const vendasSnapshot = await getDocs(collection(db, "vendas"));
    const vendas = vendasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    exportarCSV(vendas);
});

document.getElementById("btn-export-pdf")?.addEventListener("click", async () => {
    const vendasSnapshot = await getDocs(collection(db, "vendas"));
    const vendas = vendasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    exportarPDF(vendas);
});

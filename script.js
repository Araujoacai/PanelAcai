let coposSelecionados = [];

// Renderizar lista de copos no cardápio
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
      </div>
    `;
  });

  calcularValor();
}

// Abrir modal para adicionar copo
document.getElementById("add-copo-btn").addEventListener("click", () => {
  abrirModalCopo();
});

function abrirModalCopo(copoExistente = null, index = null) {
  // Aqui você pode reaproveitar o renderMenu para gerar acompanhamentos
  // e no final salvar no array coposSelecionados

  let conteudo = `
    <h3 class="text-xl font-bold mb-4">Adicionar Copo</h3>
    <div id="modal-tamanhos"></div>
    <div id="modal-acompanhamentos" class="mt-4"></div>
    <button id="salvar-copo-btn" class="bg-green-500 text-white px-4 py-2 rounded-lg mt-4">Salvar Copo</button>
  `;
  showModal(conteudo, () => {
    // Renderiza tamanhos e acompanhamentos
    // (pode ser simplificado aqui para caber, mas usar produtos do firebase)
    // ...
    document.getElementById("salvar-copo-btn").addEventListener("click", () => {
      const novoCopo = {
        tamanho: "500ml", // exemplo (precisa pegar do radio)
        acompanhamentos: [] // idem
      };
      if (index !== null) coposSelecionados[index] = novoCopo;
      else coposSelecionados.push(novoCopo);
      closeModal();
      renderCoposSelecionados();
    });
  });
}

function editarCopo(index) {
  abrirModalCopo(coposSelecionados[index], index);
}
function removerCopo(index) {
  coposSelecionados.splice(index, 1);
  renderCoposSelecionados();
}

// Recalcular valor
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

// Enviar pedido ajustado
async function enviarPedido() {
  if (coposSelecionados.length === 0) {
    showModal("Adicione ao menos 1 copo ao pedido!");
    return;
  }

  const nomeCliente = document.getElementById('nome-cliente').value.trim();
  const telefoneCliente = document.getElementById('telefone-cliente').value.trim();
  const observacoes = document.getElementById('observacoes').value;

  let itensTexto = coposSelecionados.map((copo, i) => {
    let a = copo.acompanhamentos.map(x => `${x.name} (x${x.quantity})`).join(", ") || "Somente Açaí";
    return `Copo ${i+1}: ${copo.tamanho}\n   - ${a}`;
  }).join("\n\n");

  const valor = document.getElementById("valor-mobile").innerText;
  const msg = `*Novo Pedido*\n\nCliente: ${nomeCliente}\nTelefone: ${telefoneCliente}\n\n${itensTexto}\n\nObs: ${observacoes}\n\n💰 Total: ${valor}`;
  
  window.open(`https://wa.me/${storeSettings.whatsappNumber || "5514991962607"}?text=${encodeURIComponent(msg)}`, "_blank");

  // Salvar no firestore
  await addDoc(collection(db, "vendas"), {
    nomeCliente,
    telefoneCliente,
    copos: coposSelecionados,
    observacoes,
    total: valor,
    status: "pendente",
    timestamp: serverTimestamp()
  });

  showModal("Pedido enviado com sucesso!");
  coposSelecionados = [];
  renderCoposSelecionados();
}

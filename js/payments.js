// Payment management functionality

import { getDbInstance } from './firebase.js';
import { showToast } from './ui.js';
import { getCurrentLoan, calculateRemainingDebt } from './loans.js'; // Importado calculateRemainingDebt

let db;

export function setupPaymentManagement() {
  try {
    db = getDbInstance();
    if (!db) {
      console.error("Falha ao obter instância do Firestore em payments.js.");
      showToast('Erro Crítico', 'Falha ao conectar com banco de dados (Pagamentos).', 'error');
      return;
    }

    window.openPaymentModal = openPaymentModal;
    window.confirmPayment = confirmPayment;
    window.showPayments = showPayments;
    window.chargeDebt = chargeDebt;
    window.shareReceipt = shareReceipt;
    window.copyReceiptText = copyReceiptText;
    window.closeModal = closeModal;

    // REMOVIDO: window.loadDuePayments = loadDuePayments;
    // A função loadDuePayments deste arquivo pode ser renomeada ou ter outro propósito,
    // pois app.js usa a versão de dashboard.js para a UI principal de pagamentos pendentes.

    console.log("Módulo de Gerenciamento de Pagamentos configurado.");

  } catch (error) {
    console.error("Erro configurando Payment Management:", error);
    showToast('Erro', 'Falha ao iniciar módulo de pagamentos.', 'error');
  }
}

// --- Funções do Modal de Pagamento ---
export function openPaymentModal() {
  if (!db) {
    showToast('Erro', 'Banco de dados não inicializado (openPaymentModal).', 'error');
    return;
  }
  const currentLoan = getCurrentLoan();
  if (!currentLoan) {
    showToast('Atenção', 'Não há empréstimo ativo carregado para registrar pagamento.', 'warning');
    return;
  }

  // USA A FUNÇÃO IMPORTADA
  if (currentLoan.startDate && typeof currentLoan.startDate.toDate === 'function') {
      currentLoan.startDate = currentLoan.startDate.toDate();
  }
  const { totalDebt } = calculateRemainingDebt(currentLoan);
  console.log(`Abrindo modal de pagamento. Dívida atual: R$${totalDebt.toFixed(2)}`);

  const payAmountInput = document.getElementById('payAmount');
  const paymentDateInput = document.getElementById('paymentDate');
  const paymentNotesInput = document.getElementById('paymentNotes');

  if (!payAmountInput || !paymentDateInput || !paymentNotesInput) {
      showToast('Erro', 'Elementos do modal de pagamento não encontrados.', 'error');
      return;
  }

  payAmountInput.value = Math.max(0, totalDebt).toFixed(2);
  paymentDateInput.value = formatDateForInput(new Date());
  paymentNotesInput.value = '';
  showModal('paymentModal');
}

async function confirmPayment() {
  if (!db) {
    showToast('Erro', 'Banco de dados não inicializado (confirmPayment).', 'error');
    return;
  }
  try {
    const payAmountInput = document.getElementById('payAmount');
    const paymentDateInput = document.getElementById('paymentDate');
    const paymentNotesInput = document.getElementById('paymentNotes');

    if (!payAmountInput || !paymentDateInput || !paymentNotesInput) {
        showToast('Erro', 'Elementos do formulário de pagamento não encontrados.', 'error');
        return;
    }

    const payAmount = parseFloat(payAmountInput.value.replace(',', '.'));
    const paymentDateStr = paymentDateInput.value;
    const paymentNotes = paymentNotesInput.value.trim();

    if (isNaN(payAmount) || payAmount <= 0) {
      showToast('Atenção', 'Digite um valor de pagamento válido (maior que zero).', 'warning');
      payAmountInput.focus();
      return;
    }
    if (!paymentDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDateStr)) {
        showToast('Atenção', 'Selecione uma data de pagamento válida.', 'warning');
        paymentDateInput.focus();
        return;
    }
    const dateParts = paymentDateStr.split('-');
    const paymentDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));

    const currentLoan = getCurrentLoan();
    if (!currentLoan || !currentLoan.id || !currentLoan.clientId) {
      showToast('Erro', 'Empréstimo ativo não encontrado para registrar o pagamento.', 'error');
      return;
    }

    // USA A FUNÇÃO IMPORTADA
    if (currentLoan.startDate && typeof currentLoan.startDate.toDate === 'function') {
        currentLoan.startDate = currentLoan.startDate.toDate();
    }
    const { totalDebt: debtBeforePayment } = calculateRemainingDebt(currentLoan);
    console.log(`Registrando pagamento de R$${payAmount.toFixed(2)} para dívida de R$${debtBeforePayment.toFixed(2)}`);

    const paymentData = {
      loanId: currentLoan.id,
      clientId: currentLoan.clientId,
      clientName: window.currentClient?.name || '',
      amount: payAmount,
      date: firebase.firestore.Timestamp.fromDate(paymentDate),
      notes: paymentNotes,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const paymentRef = await db.collection('payments').add(paymentData);
    console.log("Pagamento adicionado com ID:", paymentRef.id);

    const newTotalPaid = (currentLoan.totalPaid || 0) + payAmount;
    const loanUpdates = {
      totalPaid: newTotalPaid,
      lastPaymentDate: firebase.firestore.Timestamp.fromDate(paymentDate)
    };

    const remainingDebtAfterPayment = debtBeforePayment - payAmount;
    if (remainingDebtAfterPayment <= 0.01) {
      console.log("Empréstimo quitado!");
      loanUpdates.status = 'paid';
      try {
          await db.collection('clients').doc(currentLoan.clientId).update({ hasLoan: false });
          console.log("Status 'hasLoan' do cliente atualizado para false.");
          if (window.currentClient && window.currentClient.id === currentLoan.clientId) {
            window.currentClient.hasLoan = false;
          }
      } catch (clientUpdateError) {
          console.error("Erro ao atualizar status do cliente (hasLoan=false):", clientUpdateError);
          showToast('Aviso', 'Pagamento registrado, mas houve erro ao atualizar status do cliente.', 'warning');
      }
    } else {
        console.log(`Dívida restante após pagamento: R$${remainingDebtAfterPayment.toFixed(2)}`);
        loanUpdates.status = 'active';
    }

    await db.collection('loans').doc(currentLoan.id).update(loanUpdates);
    console.log("Documento do empréstimo atualizado:", loanUpdates);
    showToast('Sucesso', 'Pagamento registrado com sucesso!', 'success');
    closeModal('paymentModal');

    if (typeof window.showClientProfile === 'function') {
        await window.showClientProfile(currentLoan.clientId);
    } else {
        console.error("Função window.showClientProfile não encontrada para atualizar a tela.");
    }
  } catch (error) {
    console.error('Erro ao confirmar pagamento:', error);
    showToast('Erro', 'Falha ao registrar pagamento. Tente novamente.', 'error');
  }
}

// --- Funções do Histórico de Pagamentos ---
async function showPayments() {
  if (!db) {
    showToast('Erro', 'Banco de dados não inicializado (showPayments).', 'error');
    return;
  }
  try {
    const currentClient = window.currentClient;
    const clientId = currentClient?.id;

    if (!clientId) {
      showToast('Erro', 'Nenhum cliente selecionado para ver o histórico.', 'error');
      return;
    }
    console.log(`Carregando histórico de pagamentos para cliente: ${currentClient.name} (${clientId})`);

    const paymentListEl = document.getElementById('paymentList');
    const noPaymentsMessageEl = document.getElementById('noPaymentsMessage');
    const historyModalTitleEl = document.getElementById('historyModalTitle');

    if (!paymentListEl || !noPaymentsMessageEl) {
        showToast('Erro', 'Elementos da lista de histórico não encontrados.', 'error');
        return;
    }
    if (historyModalTitleEl) {
        historyModalTitleEl.textContent = `Histórico de Pagamentos - ${currentClient.name}`;
    }

    const snapshot = await db.collection('payments')
      .where('clientId', '==', clientId)
      .orderBy('date', 'desc')
      .get();

    paymentListEl.innerHTML = '';
    if (snapshot.empty) {
      console.log("Nenhum pagamento encontrado.");
      paymentListEl.classList.add('hidden');
      noPaymentsMessageEl.classList.remove('hidden');
    } else {
      console.log(`Encontrados ${snapshot.size} pagamentos.`);
      paymentListEl.classList.remove('hidden');
      noPaymentsMessageEl.classList.add('hidden');
      snapshot.forEach(doc => {
        const payment = doc.data();
        const paymentDate = (payment.date && typeof payment.date.toDate === 'function')
                            ? formatDate(payment.date.toDate())
                            : 'Data inválida';
        const li = document.createElement('li');
        li.className = 'payment-history-item';
        li.innerHTML = `
          <div class="payment-history-header">
            <div class="payment-history-date">${paymentDate}</div>
            <div class="payment-history-amount positive">R$ ${payment.amount.toFixed(2)}</div>
          </div>
          ${payment.notes ? `<div class="payment-history-notes">Nota: ${payment.notes}</div>` : ''}
        `;
        paymentListEl.appendChild(li);
      });
    }
    showModal('historyModal');
  } catch (error) {
    console.error('Erro ao mostrar histórico de pagamentos:', error);
    showToast('Erro', 'Falha ao carregar histórico de pagamentos', 'error');
  }
}

// --- Funções de Pagamentos Pendentes (Implementação alternativa/local) ---
// Esta função calcula datas de vencimento teóricas.
// A versão em dashboard.js usa um campo 'nextPaymentDate' do banco de dados.
// Decida qual abordagem você prefere ou se ambas são necessárias para propósitos diferentes.
// Se esta não for a principal para o dashboard, considere renomeá-la.
async function loadTheoreticalDuePayments() { // Renomeado para clareza
   if (!db) {
    console.error('Banco de dados não inicializado (loadTheoreticalDuePayments).');
    clearDuePaymentsUI_Local(); // Usa uma função de limpeza UI específica se necessário
    return;
  }
  console.log("Carregando pagamentos pendentes (cálculo teórico)...");
  try {
    const loansSnapshot = await db.collection('loans')
      .where('status', '==', 'active')
      .get();

    const duePaymentsElement = document.getElementById('duePayments'); // Assumindo que usa a mesma UI
    const duePaymentCountElement = document.getElementById('duePaymentCount');
    const noDuePaymentsElement = document.getElementById('noDuePayments');

    if (!duePaymentsElement || !duePaymentCountElement || !noDuePaymentsElement) {
        console.error("Elementos da UI de pagamentos pendentes não encontrados para cálculo teórico.");
        return;
    }

    if (loansSnapshot.empty) {
      console.log("Nenhum empréstimo ativo encontrado para cálculo teórico.");
      clearDuePaymentsUI_Local();
      return;
    }

    const today = new Date();
    const dueDateLimit = new Date();
    dueDateLimit.setDate(today.getDate() + 7);

    const duePaymentsPromises = [];
    loansSnapshot.forEach(doc => {
      const loan = doc.data();
      loan.id = doc.id;
      if (loan.startDate && typeof loan.startDate.toDate === 'function') {
        loan.startDate = loan.startDate.toDate();
      } else if (!(loan.startDate instanceof Date)) {
         console.warn(`Empréstimo ${loan.id} sem data de início válida. Ignorando para pagamentos teóricos.`);
         return;
      }

      const nextDueDate = calculateNextDueDate(loan.startDate);
      if (nextDueDate && nextDueDate >= today && nextDueDate <= dueDateLimit) {
        duePaymentsPromises.push(
          (async () => {
            try {
              const clientDoc = await db.collection('clients').doc(loan.clientId).get();
              if (!clientDoc.exists) {
                  console.warn(`Cliente ${loan.clientId} não encontrado para empréstimo ${loan.id}`);
                  return null;
              }
              const client = clientDoc.data();
              // USA A FUNÇÃO IMPORTADA
              const { totalDebt } = calculateRemainingDebt(loan);
              return {
                clientId: loan.clientId,
                clientName: client.name || 'Nome não encontrado',
                clientPhotoURL: client.photoURL || null,
                dueDate: nextDueDate,
                amount: Math.max(0, totalDebt)
              };
            } catch (clientError) {
                console.error(`Erro ao buscar cliente ${loan.clientId}:`, clientError);
                return null;
            }
          })()
        );
      }
    });

    const duePaymentsResults = (await Promise.all(duePaymentsPromises)).filter(p => p !== null);
    duePaymentsResults.sort((a, b) => a.dueDate - b.dueDate);
    console.log(`Encontrados ${duePaymentsResults.length} pagamentos teóricos com vencimento próximo.`);
    updateDuePaymentsUI_Local(duePaymentsResults); // Usa uma função de UI específica se necessário
  } catch (error) {
    console.error('Erro ao carregar pagamentos pendentes (teórico):', error);
    clearDuePaymentsUI_Local();
    showToast('Erro Inesperado', 'Falha ao carregar pagamentos pendentes (teórico).', 'error');
  }
}

function calculateNextDueDate(startDate) {
    if (!(startDate instanceof Date) || isNaN(startDate)) {
        console.warn("Data de início inválida para calcular próximo vencimento:", startDate);
        return null;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDay = startDate.getDate();
    let nextDueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);
    nextDueDate.setHours(0, 0, 0, 0);
    if (nextDueDate < today) {
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
         if (nextDueDate.getDate() !== dueDay) {
             nextDueDate = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth(), 0);
         }
    }
    return nextDueDate;
}

// Funções de UI específicas para a lista de pagamentos teóricos (se a UI for diferente)
// Se a UI for a mesma do dashboard.js, você pode reutilizar as funções de lá,
// mas precisaria importá-las ou garantir que estão no escopo global corretamente.
function clearDuePaymentsUI_Local() {
    const duePaymentsElement = document.getElementById('duePayments'); // Ou um ID diferente
    const duePaymentCountElement = document.getElementById('duePaymentCount'); // Ou um ID diferente
    const noDuePaymentsElement = document.getElementById('noDuePayments'); // Ou um ID diferente

    if (duePaymentsElement) duePaymentsElement.innerHTML = '';
    if (duePaymentCountElement) duePaymentCountElement.textContent = '0';
    if (noDuePaymentsElement) noDuePaymentsElement.classList.remove('hidden');
}

function updateDuePaymentsUI_Local(duePayments) {
    const duePaymentsElement = document.getElementById('duePayments'); // Ou um ID diferente
    const duePaymentCountElement = document.getElementById('duePaymentCount'); // Ou um ID diferente
    const noDuePaymentsElement = document.getElementById('noDuePayments'); // Ou um ID diferente

     if (!duePaymentsElement || !duePaymentCountElement || !noDuePaymentsElement) return;

    duePaymentsElement.innerHTML = '';
    duePaymentCountElement.textContent = duePayments.length.toString();

    if (duePayments.length === 0) {
      noDuePaymentsElement.classList.remove('hidden');
      duePaymentsElement.classList.add('hidden');
    } else {
      noDuePaymentsElement.classList.add('hidden');
      duePaymentsElement.classList.remove('hidden');
      duePayments.forEach(payment => {
        const li = document.createElement('li');
        li.className = 'payment-list-item';
        li.dataset.clientId = payment.clientId;
        const formattedDueDate = formatDate(payment.dueDate);
        const daysRemaining = calculateDaysBetween(new Date(), payment.dueDate);
        let daysText = `(Vence em ${daysRemaining} dia${daysRemaining !== 1 ? 's' : ''})`;
        if (daysRemaining === 0) daysText = "(Vence hoje)";
        if (daysRemaining < 0) daysText = "(Vencido)";
        const avatar = payment.clientPhotoURL
            ? `<img src="${payment.clientPhotoURL}" alt="${payment.clientName}" class="avatar small">`
            : `<span class="avatar small material-icons">person</span>`;
        li.innerHTML = `
          ${avatar}
          <div class="payment-info">
            <div class="payment-client">${payment.clientName}</div>
            <div class="payment-date">Vence: ${formattedDueDate} ${daysText}</div>
          </div>
          <div class="payment-amount negative">R$ ${payment.amount.toFixed(2)}</div>
        `;
        li.addEventListener('click', () => {
          if (typeof window.showClientProfile === 'function') {
            window.showClientProfile(payment.clientId);
          } else {
            console.error("Função window.showClientProfile não encontrada.");
          }
        });
        duePaymentsElement.appendChild(li);
      });
    }
}

// --- Funções de Recibo de Cobrança ---
function chargeDebt() {
  if (!db) {
    showToast('Erro', 'Banco de dados não inicializado (chargeDebt).', 'error');
    return;
  }
  try {
    const currentLoan = getCurrentLoan();
    const currentClient = window.currentClient;

    if (!currentLoan || !currentClient) {
      showToast('Erro', 'Selecione um cliente com empréstimo ativo para gerar cobrança.', 'error');
      return;
    }

    if (currentLoan.startDate && typeof currentLoan.startDate.toDate === 'function') {
        currentLoan.startDate = currentLoan.startDate.toDate();
    } else if (!(currentLoan.startDate instanceof Date)) {
        showToast('Erro', 'Data de início do empréstimo inválida.', 'error');
        return;
    }
     if (currentLoan.lastPaymentDate && typeof currentLoan.lastPaymentDate.toDate === 'function') {
        currentLoan.lastPaymentDate = currentLoan.lastPaymentDate.toDate();
    }

    // USA A FUNÇÃO IMPORTADA
    const { totalDebt, interestAccrued } = calculateRemainingDebt(currentLoan);

    const todayFormatted = formatDate(new Date());
    const loanDateFormatted = formatDate(currentLoan.startDate);
    const lastPaymentFormatted = currentLoan.lastPaymentDate ? formatDate(currentLoan.lastPaymentDate) : 'Nenhum';

    const receiptContent = `
🧾 *RECIBO DE COBRANÇA* 🧾
---------------------------------
Data da Cobrança: ${todayFormatted}

*Cliente:* ${currentClient.name || 'Não informado'}
${currentClient.phone ? `*Telefone:* ${currentClient.phone}` : ''}
${currentClient.address ? `*Endereço:* ${currentClient.address}` : ''}

*DETALHES DO EMPRÉSTIMO:*
---------------------------------
Valor Original: R$ ${currentLoan.amount.toFixed(2)}
Data do Empréstimo: ${loanDateFormatted}
Taxa de Juros: ${currentLoan.interestRate}% a.m. (simples)
Juros Acumulados: R$ ${interestAccrued.toFixed(2)}
Total Pago: R$ ${(currentLoan.totalPaid || 0).toFixed(2)}
Último Pagamento: ${lastPaymentFormatted}

*SALDO DEVEDOR ATUAL:*
---------------------------------
💰 *R$ ${totalDebt.toFixed(2)}* 💰

---------------------------------
Por favor, entre em contato para regularizar sua situação.

Atenciosamente,
[Seu Nome/Nome da Empresa]
[Seu Contato]
`;

    const receiptContentEl = document.getElementById('receiptContent');
    if (!receiptContentEl) {
        showToast('Erro', 'Elemento #receiptContent não encontrado no modal.', 'error');
        return;
    }
    receiptContentEl.textContent = receiptContent.trim();
    window.currentReceipt = receiptContent.trim();
    showModal('receiptModal');
  } catch (error) {
    console.error('Erro ao gerar recibo de cobrança:', error);
    showToast('Erro', 'Falha ao gerar recibo de cobrança', 'error');
  }
}

function shareReceipt() {
  const currentClient = window.currentClient;
  const receiptContent = window.currentReceipt;
  if (!receiptContent) {
    showToast('Erro', 'Gere um recibo antes de tentar compartilhar.', 'error');
    return;
  }
  if (!currentClient || !currentClient.phone) {
      showToast('Atenção', 'Cliente sem telefone cadastrado.', 'warning');
      const encodedReceipt = encodeURIComponent(receiptContent);
      const whatsappUrl = `https://wa.me/?text=${encodedReceipt}`;
      window.open(whatsappUrl, '_blank');
      return;
  }
  let phone = currentClient.phone.replace(/\D/g, '');
  if (phone.length > 4 && !phone.startsWith('55')) {
    phone = '55' + phone;
  }
  const encodedReceipt = encodeURIComponent(receiptContent);
  const whatsappUrl = `https://wa.me/${phone}?text=${encodedReceipt}`;
  console.log("Abrindo WhatsApp:", whatsappUrl);
  window.open(whatsappUrl, '_blank');
}

function copyReceiptText() {
  const receiptContent = window.currentReceipt;
  if (!receiptContent) {
    showToast('Erro', 'Gere um recibo antes de tentar copiar.', 'error');
    return;
  }
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(receiptContent)
      .then(() => {
        showToast('Sucesso', 'Recibo copiado para a área de transferência!', 'success');
      })
      .catch(err => {
        console.error('Erro ao copiar para a área de transferência:', err);
        showToast('Erro', 'Falha ao copiar recibo. Verifique as permissões.', 'error');
        copyTextFallback(receiptContent);
      });
  } else {
      copyTextFallback(receiptContent);
  }
}

function copyTextFallback(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showToast('Sucesso', 'Recibo copiado (usando fallback).', 'success');
        } else {
            showToast('Erro', 'Falha ao copiar recibo (fallback).', 'error');
        }
    } catch (err) {
        console.error('Erro no fallback de cópia:', err);
        showToast('Erro', 'Falha ao copiar recibo (fallback).', 'error');
    }
    document.body.removeChild(textArea);
}

// --- Funções Auxiliares ---
function formatDate(date) {
   if (!(date instanceof Date) || isNaN(date)) {
       return 'Inválida';
   }
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatDateForInput(date) {
   if (!(date instanceof Date) || isNaN(date)) {
       date = new Date();
   }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateDaysBetween(date1, date2) {
    if (!(date1 instanceof Date) || isNaN(date1) || !(date2 instanceof Date) || isNaN(date2)) {
        return 0;
    }
    const startOfDay1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
    const startOfDay2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
    const diffTime = startOfDay2 - startOfDay1;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
      modal.classList.add('visible');
      modal.setAttribute('aria-hidden', 'false');
      const focusable = modal.querySelector('input, button, textarea, select');
      if (focusable) focusable.focus();
  } else {
      console.error(`Modal com ID "${modalId}" não encontrado.`);
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
      modal.classList.remove('visible');
      modal.setAttribute('aria-hidden', 'true');
  }
}
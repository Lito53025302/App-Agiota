// Loan management functionality

// Importar do seu firebase.js:
import { getDbInstance } from './firebase.js';
// Nota: Não precisamos de initializeFirebase, getAuthInstance ou getStorageInstance aqui.

// Importa funções de UI
import { showToast } from './ui.js'; // Certifique-se que ui.js exporta showToast

let db; // DECLARADO AQUI, mas não inicializado

let currentLoan = null; // Armazena o empréstimo ativo do cliente atual

// Função chamada por app.js para inicializar este módulo
export function setupLoanManagement() {
  try {
    // OBTÉM A INSTÂNCIA AQUI, APÓS FIREBASE SER INICIALIZADO PELO APP.JS
    db = getDbInstance();

    // Verifica se a instância foi obtida com sucesso
    if (!db) {
      console.error("Falha ao obter instância do Firestore em loans.js. O módulo pode não funcionar.");
      showToast('Erro Crítico', 'Falha ao conectar com banco de dados (Empréstimos).', 'error');
      return; // Impede a continuação se o DB não estiver disponível
    }

    // Expõe funções necessárias globalmente (mantendo padrão original)
    window.addLoan = addLoan;
    window.loadClientLoan = loadClientLoan;
    // window.calculateRemainingDebt = calculateRemainingDebt; // Expor cálculo pode não ser necessário globalmente?
                                                            // É usado internamente por loadClientLoan.
                                                            // Mantenha se precisar chamar de outro lugar.

    console.log("Módulo de Gerenciamento de Empréstimos configurado.");

  } catch (error) {
    console.error("Erro configurando Loan Management:", error);
    showToast('Erro', 'Falha ao iniciar módulo de empréstimos.', 'error');
  }
}

// Função para adicionar um novo empréstimo
async function addLoan() {
  if (!db) { // Verificação crucial
    showToast('Erro', 'Banco de dados não inicializado (addLoan).', 'error');
    return;
  }

  try {
    const amountInput = document.getElementById('loanAmount');
    const interestRateInput = document.getElementById('interestRate');

    if (!amountInput || !interestRateInput) {
        showToast('Erro', 'Elementos do formulário de empréstimo não encontrados.', 'error');
        return;
    }

    const amount = parseFloat(amountInput.value.replace(',', '.'));
    const interestRate = parseFloat(interestRateInput.value.replace(',', '.'));

    if (isNaN(amount) || amount <= 0) {
      showToast('Atenção', 'Digite um valor válido para o empréstimo (maior que zero).', 'warning');
      amountInput.focus();
      return;
    }

    if (isNaN(interestRate) || interestRate < 0) {
      showToast('Atenção', 'Digite uma taxa de juros válida (maior ou igual a zero).', 'warning');
      interestRateInput.focus();
      return;
    }

    const currentClient = window.currentClient;
    const clientId = currentClient?.id;

    if (!clientId || !currentClient) {
      showToast('Erro', 'Nenhum cliente selecionado para adicionar empréstimo.', 'error');
      return;
    }

    if (currentClient.hasLoan) {
      showToast('Atenção', `O cliente ${currentClient.name} já possui um empréstimo ativo.`, 'warning');
      return;
    }

    const loanData = {
      clientId,
      clientName: currentClient.name,
      amount,
      interestRate,
      startDate: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'active',
      totalPaid: 0,
      paymentHistory: [],
      lastPaymentDate: null
    };

    console.log("Adicionando empréstimo:", loanData);

    const loanRef = await db.collection('loans').add(loanData);
    console.log("Empréstimo adicionado com ID:", loanRef.id);

    await db.collection('clients').doc(clientId).update({
      hasLoan: true
    });
    console.log("Status 'hasLoan' do cliente atualizado para true.");

    window.currentClient.hasLoan = true;

    showToast('Sucesso', 'Empréstimo registrado com sucesso!', 'success');

    amountInput.value = '';
    interestRateInput.value = '';

    await loadClientLoan(clientId);

    const newLoanSectionEl = document.getElementById('newLoanSection');
    if (newLoanSectionEl) newLoanSectionEl.classList.add('hidden');

  } catch (error) {
    console.error('Erro ao adicionar empréstimo:', error);
    showToast('Erro', 'Falha ao registrar empréstimo. Tente novamente.', 'error');
  }
}

// Função para carregar o empréstimo ativo de um cliente
async function loadClientLoan(clientId) {
  if (!db) { // Verificação crucial
    showToast('Erro', 'Banco de dados não inicializado (loadClientLoan).', 'error');
    return;
  }
  const loanInfoEl = document.getElementById('loanInfo');
   if (!loanInfoEl) {
       console.error("Elemento #loanInfo não encontrado para exibir detalhes do empréstimo.");
       return;
   }

  console.log(`Carregando empréstimo ativo para cliente ID: ${clientId}`);
  try {
    const snapshot = await db.collection('loans')
      .where('clientId', '==', clientId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log(`Nenhum empréstimo ativo encontrado para cliente ${clientId}.`);
      loanInfoEl.innerHTML = '<p>Nenhum empréstimo ativo encontrado.</p>';
      currentLoan = null;
      window.currentLoan = null;
      const newLoanSectionEl = document.getElementById('newLoanSection');
      if (newLoanSectionEl) newLoanSectionEl.classList.remove('hidden');
      return;
    }

    const loanDoc = snapshot.docs[0];
    const loanData = loanDoc.data();
    loanData.id = loanDoc.id;

    if (loanData.startDate && typeof loanData.startDate.toDate === 'function') {
        loanData.startDate = loanData.startDate.toDate();
    }
    if (loanData.lastPaymentDate && typeof loanData.lastPaymentDate.toDate === 'function') {
        loanData.lastPaymentDate = loanData.lastPaymentDate.toDate();
    }

    currentLoan = loanData;
    window.currentLoan = currentLoan;
    console.log("Empréstimo ativo carregado:", currentLoan);

    const { totalDebt, interestAccrued, monthsElapsed } = calculateRemainingDebt(currentLoan);
    console.log(`Dívida calculada: R$${totalDebt.toFixed(2)}, Juros: R$${interestAccrued.toFixed(2)}, Meses: ${monthsElapsed.toFixed(2)}`);

    const startDateFormatted = loanData.startDate ? formatDate(loanData.startDate) : 'N/D';
    const lastPaymentDateFormatted = loanData.lastPaymentDate ? formatDate(loanData.lastPaymentDate) : 'Nenhum';
    const daysSinceStart = loanData.startDate ? calculateDaysSince(loanData.startDate) : 0;

    loanInfoEl.innerHTML = `
      <div class="loan-details-grid">
        <div class="loan-detail-item">
          <span class="label">Valor Original:</span>
          <span class="value">R$ ${loanData.amount.toFixed(2)}</span>
        </div>
        <div class="loan-detail-item">
          <span class="label">Taxa Juros:</span>
          <span class="value">${loanData.interestRate}% a.m.</span>
        </div>
        <div class="loan-detail-item">
          <span class="label">Data Início:</span>
          <span class="value">${startDateFormatted} (${daysSinceStart} dias)</span>
        </div>
         <div class="loan-detail-item">
          <span class="label">Meses Corridos:</span>
          <span class="value">${monthsElapsed.toFixed(1)}</span>
        </div>
        <div class="loan-detail-item">
          <span class="label">Total Pago:</span>
          <span class="value positive">R$ ${loanData.totalPaid.toFixed(2)}</span>
        </div>
        <div class="loan-detail-item">
          <span class="label">Juros Acumulados:</span>
          <span class="value warning">R$ ${interestAccrued.toFixed(2)}</span>
        </div>
        <div class="loan-detail-item full-width">
          <span class="label large">Dívida Atual:</span>
          <span class="value large negative">R$ ${totalDebt.toFixed(2)}</span>
        </div>
         <div class="loan-detail-item full-width">
          <span class="label">Último Pagamento:</span>
          <span class="value">${lastPaymentDateFormatted}</span>
        </div>
      </div>
    `;

    const newLoanSectionEl = document.getElementById('newLoanSection');
    if (newLoanSectionEl) newLoanSectionEl.classList.add('hidden');

  } catch (error) {
    console.error('Erro ao carregar empréstimo do cliente:', error);
    showToast('Erro', 'Falha ao carregar informações do empréstimo', 'error');
    loanInfoEl.innerHTML = '<p class="error">Erro ao carregar dados do empréstimo.</p>';
    currentLoan = null;
    window.currentLoan = null;
  }
}

// Função para calcular dívida restante (Juros Simples Mensal)
export function calculateRemainingDebt(loan) {
  if (!loan || !loan.startDate) {
    console.warn("Dados do empréstimo inválidos para cálculo.");
    return { principal: 0, interestAccrued: 0, totalDebt: 0, monthsElapsed: 0 };
  }

  const startDate = (loan.startDate instanceof Date) ? loan.startDate : (loan.startDate.toDate ? loan.startDate.toDate() : null);
  if (!startDate) {
      console.error("Data de início inválida no empréstimo:", loan.startDate);
      return { principal: 0, interestAccrued: 0, totalDebt: 0, monthsElapsed: 0 };
  }

  const principal = loan.amount || 0;
  const monthlyInterestRateDecimal = (loan.interestRate || 0) / 100;
  const totalPaid = loan.totalPaid || 0;

  const today = new Date();
  const monthsElapsed = calculateMonthsBetween(startDate, today);

  const interestAccrued = principal * monthlyInterestRateDecimal * monthsElapsed;
  let totalDebt = principal + interestAccrued - totalPaid;
  totalDebt = Math.max(0, totalDebt);

  return {
    principal,
    interestAccrued: Math.max(0, interestAccrued),
    totalDebt,
    monthsElapsed
  };
}

// Função para calcular meses (incluindo fração) entre duas datas
function calculateMonthsBetween(startDate, endDate) {
  if (!(startDate instanceof Date) || !(endDate instanceof Date) || isNaN(startDate) || isNaN(endDate)) {
      console.error("Datas inválidas para calculateMonthsBetween:", startDate, endDate);
      return 0;
  }
   if (endDate < startDate) {
       return 0;
   }

  let years = endDate.getFullYear() - startDate.getFullYear();
  let months = endDate.getMonth() - startDate.getMonth();
  let days = endDate.getDate() - startDate.getDate();

  if (days < 0) {
    months--;
    const daysInPreviousMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0).getDate();
    days += daysInPreviousMonth;
  }

  let totalMonths = years * 12 + months + (days / 30);
  return Math.max(0, totalMonths);
}

// Função para calcular dias desde uma data
function calculateDaysSince(date) {
   if (!(date instanceof Date) || isNaN(date)) {
       console.error("Data inválida para calculateDaysSince:", date);
       return 0;
   }
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = startOfToday - startOfDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Função auxiliar para formatar data (pt-BR)
function formatDate(date) {
   if (!(date instanceof Date) || isNaN(date)) {
       return 'Data inválida';
   }
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// Exporta a função para obter o empréstimo atual (se necessário)
export function getCurrentLoan() {
  return currentLoan;
}
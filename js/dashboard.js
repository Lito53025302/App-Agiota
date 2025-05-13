// dashboard.js - Funcionalidades do Dashboard

import { showToast } from './ui.js';
import { calculateRemainingDebt } from './loans.js';
import { openPaymentModal } from './payments.js';
import { getDbInstance } from './firebase.js';

// Variáveis globais do módulo (só declaradas)
let db;

// Função de setup
export function setupDashboard() {
  try {
    db = getDbInstance();
    if (!db) {
      console.error("Falha ao obter instância do Firestore em dashboard.js.");
      showToast('Erro Crítico', 'Falha ao conectar com banco de dados (Dashboard).', 'error');
      return;
    }
    console.log("Módulo do Dashboard configurado.");
    // Carrega os dados iniciais do dashboard e os pagamentos devidos
    updateDashboardData();
    loadDuePayments(); // Chama para carregar a lista de pagamentos devidos

    // Disponibiliza globalmente a função para abrir modal de pagamento, se necessário
    // Se openPaymentModal já é exportada de payments.js e usada diretamente no HTML via módulo,
    // esta linha pode não ser necessária, mas garante compatibilidade com `onclick="window.openPaymentModal(...)"`
    window.openPaymentModal = openPaymentModal;

  } catch (error) {
    console.error("Erro configurando Dashboard:", error);
    showToast('Erro', 'Falha ao iniciar módulo do dashboard.', 'error');
  }
}

// --- Atualização dos Dados do Dashboard ---

export async function updateDashboardData() {
  if (!db) {
    db = getDbInstance(); // Tenta obter novamente se não estiver inicializado
    if (!db) {
        showToast('Erro', 'Banco de dados não inicializado (updateDashboardData).', 'error');
        clearDashboardUI(); // Limpa a UI se não houver DB
        return;
    }
  }

  console.log("Carregando dados do dashboard...");
  try {
    let totalLoaned = 0;
    let totalReceived = 0;
    let totalActiveDebt = 0;
    // let totalInterestEarned = 0; // Descomente se quiser calcular/exibir juros acumulados
    let activeLoanCount = 0;
    let completedLoanCount = 0;

    const loansSnapshot = await db.collection('loans').get();

    if (loansSnapshot.empty) {
        console.log("Nenhum empréstimo encontrado no sistema.");
        clearDashboardUI(); // Limpa a UI se não houver empréstimos
        updateDashboardUI({ // Atualiza com zeros
            totalLoaned: 0, totalReceived: 0, simpleGrossProfit: 0,
            totalActiveDebt: 0, activeLoanCount: 0, completedLoanCount: 0
        });
        return;
    }

    for (const doc of loansSnapshot.docs) { // Usar for...of para permitir await dentro do loop (se necessário no futuro)
      const loan = doc.data();
      loan.id = doc.id;

      // Validação básica do valor do empréstimo
      if (typeof loan.amount !== 'number' || isNaN(loan.amount)) {
          console.warn(`Empréstimo ${loan.id} com valor inválido:`, loan.amount);
          continue; // Pula este empréstimo
      }
      totalLoaned += loan.amount;

      // Validação básica do total pago
      const paid = (typeof loan.totalPaid === 'number' && !isNaN(loan.totalPaid)) ? loan.totalPaid : 0;
      totalReceived += paid;

      if (loan.status === 'active') {
        activeLoanCount++;
        // Converte Timestamp para Date, se necessário
        if (loan.startDate && typeof loan.startDate.toDate === 'function') {
          loan.startDate = loan.startDate.toDate();
        } else if (!(loan.startDate instanceof Date)) {
           console.warn(`Empréstimo ativo ${loan.id} sem data de início válida. Não será incluído no 'A Receber'.`);
           continue; // Pula cálculo de dívida se data inválida
        }

        // Usa a função importada diretamente para calcular dívida e juros
        const { totalDebt /*, interestAccrued */ } = calculateRemainingDebt(loan); // Descomente interestAccrued se usar

        if (typeof totalDebt === 'number' && !isNaN(totalDebt)) {
            totalActiveDebt += totalDebt;
        } else {
            console.warn(`Cálculo de dívida retornou valor inválido para empréstimo ${loan.id}.`);
        }
        /* // Descomente se quiser usar juros acumulados
        if (typeof interestAccrued === 'number' && !isNaN(interestAccrued)) {
            totalInterestEarned += interestAccrued;
        } else {
            console.warn(`Cálculo de juros retornou valor inválido para empréstimo ${loan.id}.`);
        }
        */

      } else if (loan.status === 'completed' || loan.status === 'paid') {
          completedLoanCount++;
      }
    } // Fim do loop for...of

    // Lucro bruto simples (Recebido - Emprestado)
    const simpleGrossProfit = totalReceived - totalLoaned;

    console.log(`Dashboard Data: Loaned=${totalLoaned}, Received=${totalReceived}, ActiveDebt=${totalActiveDebt}, ActiveLoans=${activeLoanCount}, CompletedLoans=${completedLoanCount}`);

    // Atualiza a interface do usuário com os dados calculados
    updateDashboardUI({
        totalLoaned,
        totalReceived,
        simpleGrossProfit,
        totalActiveDebt, // Valor total a receber dos empréstimos ativos
        activeLoanCount,
        completedLoanCount
    });

  } catch (error) {
    console.error('Erro ao carregar dados do dashboard:', error);
    showToast('Erro', 'Falha ao carregar dados do dashboard.', 'error');
    clearDashboardUI(); // Limpa a UI em caso de erro
  }
}

// --- Carregamento de Pagamentos Devidos ---

export async function loadDuePayments() {
  console.log("Verificando pagamentos devidos...");
  if (!db) {
    db = getDbInstance(); // Tenta obter novamente
    if (!db) {
        console.warn("Firestore não inicializado em loadDuePayments.");
        return; // Sai se não conseguir DB
    }
  }

  const duePaymentsList = document.getElementById('duePaymentsList');
  if (!duePaymentsList) {
    console.warn("Elemento 'duePaymentsList' não encontrado para pagamentos devidos.");
    return;
  }

  duePaymentsList.innerHTML = '<li><span class="text-gray-500">Verificando...</span></li>'; // Feedback inicial

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Zera a hora para comparar apenas a data

    const loansSnapshot = await db.collection('loans')
                                  .where('status', '==', 'active') // Busca apenas empréstimos ativos
                                  .get();

    let duePaymentsHTML = '';
    let dueCount = 0;
    const clientNamesCache = {}; // Cache para nomes de clientes, evita buscas repetidas

    for (const doc of loansSnapshot.docs) {
      const loan = doc.data();
      loan.id = doc.id;

      // Converte e valida data de início
      if (loan.startDate && typeof loan.startDate.toDate === 'function') {
          loan.startDate = loan.startDate.toDate();
      } else if (!(loan.startDate instanceof Date)) {
          console.warn(`Empréstimo ${loan.id} sem data de início válida para cálculo de vencimento.`);
          continue;
      }

      // Converte e valida data do último pagamento (se existir)
      let lastPaymentDate = null;
      if (loan.lastPaymentDate && typeof loan.lastPaymentDate.toDate === 'function') {
          lastPaymentDate = loan.lastPaymentDate.toDate();
      }

      // Determina a data base para calcular o próximo vencimento
      const baseDate = lastPaymentDate instanceof Date ? lastPaymentDate : loan.startDate;

      // Calcula a próxima data de vencimento (Exemplo: +30 dias da baseDate)
      const nextDueDate = new Date(baseDate);
      nextDueDate.setDate(nextDueDate.getDate() + 30); // ADICIONA 30 DIAS - AJUSTE SE NECESSÁRIO
      nextDueDate.setHours(0, 0, 0, 0); // Zera a hora para comparação

      // Verifica se a data de vencimento é hoje ou já passou
      if (nextDueDate <= today) {
        dueCount++;

        // Busca o nome do cliente (com cache)
        let clientName = clientNamesCache[loan.clientId];
        if (!clientName) {
            try {
                const clientDoc = await db.collection('clients').doc(loan.clientId).get();
                clientName = clientDoc.exists ? clientDoc.data().name : 'Cliente Excluído';
                clientNamesCache[loan.clientId] = clientName; // Armazena no cache
            } catch (e) {
                console.error(`Erro ao buscar cliente ${loan.clientId} para pagamentos devidos`, e);
                clientName = 'Erro ao buscar';
            }
        }

        // Calcula a dívida atual usando a função importada
        const { totalDebt } = calculateRemainingDebt(loan);

        // Formata valores (usando funções auxiliares)
        const formattedDueDate = formatDate(nextDueDate);
        const formattedDebt = formatCurrency(totalDebt);

        // Monta o HTML do item da lista
        // A chamada onclick usa window.openPaymentModal para garantir acesso global
        duePaymentsHTML += `
          <li class="border-b border-gray-200 py-2 flex justify-between items-center text-sm">
            <span class="flex-grow pr-2">
              <strong class="text-gray-800">${clientName}</strong> - Venc: ${formattedDueDate}
              <span class="text-red-600 font-semibold ml-2">(${formattedDebt})</span>
            </span>
            <button class="flex-shrink-0 text-xs bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded shadow transition duration-150 ease-in-out"
                    onclick="window.openPaymentModal('${loan.id}', '${clientName}', ${totalDebt})">
              Registrar Pag.
            </button>
          </li>`;
      }
    } // Fim do loop for...of

    // Atualiza a lista no HTML
    if (dueCount === 0) {
      duePaymentsList.innerHTML = '<li><span class="text-gray-500">Nenhum pagamento devido encontrado.</span></li>';
    } else {
      duePaymentsList.innerHTML = duePaymentsHTML;
    }
    console.log(`${dueCount} pagamentos devidos encontrados.`);

  } catch (error) {
    console.error("Erro ao carregar pagamentos devidos:", error);
    showToast('Erro', 'Falha ao verificar pagamentos devidos.', 'error');
    if (duePaymentsList) {
        duePaymentsList.innerHTML = '<li><span class="text-red-500">Erro ao carregar pagamentos.</span></li>';
    }
  }
}

// --- Funções Auxiliares de UI do Dashboard ---

function updateDashboardUI(data) {
  console.log("Atualizando UI do Dashboard com dados:", data);
  // Seleciona os elementos da UI (use IDs mais específicos se necessário)
  const totalLoanedEl = document.getElementById('totalLoaned');
  const totalReceivedEl = document.getElementById('totalReceived');
  const simpleGrossProfitEl = document.getElementById('simpleGrossProfit');
  const totalActiveDebtEl = document.getElementById('totalActiveDebt');
  const activeLoanCountEl = document.getElementById('activeLoanCount');
  const completedLoanCountEl = document.getElementById('completedLoanCount');

  // Atualiza os valores, formatando como moeda onde aplicável
  if (totalLoanedEl) totalLoanedEl.textContent = formatCurrency(data.totalLoaned);
  if (totalReceivedEl) totalReceivedEl.textContent = formatCurrency(data.totalReceived);
  if (simpleGrossProfitEl) {
      simpleGrossProfitEl.textContent = formatCurrency(data.simpleGrossProfit);
      // Adiciona classe de cor baseada no valor (opcional)
      simpleGrossProfitEl.classList.toggle('text-green-600', data.simpleGrossProfit >= 0);
      simpleGrossProfitEl.classList.toggle('text-red-600', data.simpleGrossProfit < 0);
  }
  if (totalActiveDebtEl) totalActiveDebtEl.textContent = formatCurrency(data.totalActiveDebt);
  if (activeLoanCountEl) activeLoanCountEl.textContent = data.activeLoanCount;
  if (completedLoanCountEl) completedLoanCountEl.textContent = data.completedLoanCount;
}

function clearDashboardUI() {
  console.log("Limpando UI do Dashboard.");
  // Define os valores como '-' ou 0
  updateDashboardUI({
    totalLoaned: 0,
    totalReceived: 0,
    simpleGrossProfit: 0,
    totalActiveDebt: 0,
    activeLoanCount: 0,
    completedLoanCount: 0
  });
  // Limpa também a lista de pagamentos devidos
  const duePaymentsList = document.getElementById('duePaymentsList');
  if (duePaymentsList) {
      duePaymentsList.innerHTML = '<li><span class="text-gray-500">-</span></li>';
  }
}

// --- Funções Auxiliares de Formatação ---
// (Mova para um arquivo 'utils.js' se usadas em múltiplos lugares)

function formatCurrency(value) {
  if (typeof value !== 'number' || isNaN(value)) {
    // console.warn("formatCurrency recebeu valor inválido:", value);
    return 'R$ 0,00'; // Retorna um valor padrão ou 'R$ -'
  }
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(date) {
   if (!(date instanceof Date) || isNaN(date)) {
       // console.warn("formatDate recebeu data inválida:", date);
       return '--/--/----'; // Retorna um valor padrão
   }
  // Formato DD/MM/YYYY
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Função para adicionar empréstimo
export async function addLoan(event) {
  event.preventDefault();

  if (!db) {
    showToast('Erro', 'Banco de dados não inicializado (addLoan).', 'error');
    return;
  }

  const amountInput = document.getElementById('loanAmount');
  const interestInput = document.getElementById('interestRate');
  const clientId = window.currentClient ? window.currentClient.id : null;

  if (!amountInput || !interestInput || !clientId) {
    showToast('Erro', 'Preencha todos os campos do empréstimo.', 'error');
    return;
  }

  const amount = parseFloat(amountInput.value.replace(',', '.'));
  const interest = parseFloat(interestInput.value.replace(',', '.'));

  if (isNaN(amount) || isNaN(interest) || amount <= 0 || interest < 0) {
    showToast('Erro', 'Valores inválidos para empréstimo ou juros.', 'error');
    return;
  }

  try {
    const loanData = {
      clientId,
      amount,
      interest,
      status: 'active',
      startDate: new Date(),
      totalPaid: 0
    };

    await db.collection('loans').add(loanData);
    // Atualiza o status do cliente
    await db.collection('clients').doc(clientId).update({ hasLoan: true });

    showToast('Sucesso', 'Empréstimo adicionado com sucesso!', 'success');
    amountInput.value = '';
    interestInput.value = '';
    updateDashboardData();

    // Recarrega o perfil do cliente para mostrar o novo empréstimo
    if (typeof window.showClientProfile === 'function') {
      window.showClientProfile(clientId);
    }
  } catch (error) {
    console.error('Erro ao adicionar empréstimo:', error);
    showToast('Erro', 'Falha ao adicionar empréstimo.', 'error');
  }
}

// --- Fim de dashboard.js ---
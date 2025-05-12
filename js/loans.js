// Loan management functionality
import { getFirestore } from './firebase.js';
import { showToast } from './ui.js';

let db;
let currentLoan = null;

export function setupLoanManagement() {
  db = getFirestore();
  
  // Expose necessary functions globally
  window.addLoan = addLoan;
  window.loadClientLoan = loadClientLoan;
  window.calculateRemainingDebt = calculateRemainingDebt;
}

// Function to add a new loan
async function addLoan() {
  try {
    // Get input values
    const amountInput = document.getElementById('loanAmount');
    const interestRateInput = document.getElementById('interestRate');
    
    const amount = parseFloat(amountInput.value);
    const interestRate = parseFloat(interestRateInput.value);
    
    // Validate inputs
    if (isNaN(amount) || amount <= 0) {
      showToast('Atenção', 'Digite um valor válido para o empréstimo', 'warning');
      return;
    }
    
    if (isNaN(interestRate) || interestRate < 0 || interestRate > 100) {
      showToast('Atenção', 'Digite uma taxa de juros válida (0-100%)', 'warning');
      return;
    }
    
    // Get current client ID
    const clientId = window.currentClient?.id;
    
    if (!clientId) {
      showToast('Erro', 'Nenhum cliente selecionado', 'error');
      return;
    }
    
    // Check if client already has a loan
    const clientDoc = await db.collection('clients').doc(clientId).get();
    const clientData = clientDoc.data();
    
    if (clientData.hasLoan) {
      showToast('Atenção', 'Este cliente já possui um empréstimo ativo', 'warning');
      return;
    }
    
    // Create loan object
    const loan = {
      clientId,
      amount,
      interestRate,
      startDate: new Date(),
      status: 'active',
      totalPaid: 0,
      lastPaymentDate: null
    };
    
    // Add loan to Firestore
    const loanRef = await db.collection('loans').add(loan);
    
    // Update client hasLoan status
    await db.collection('clients').doc(clientId).update({
      hasLoan: true
    });
    
    // Update current client object
    window.currentClient.hasLoan = true;
    
    showToast('Sucesso', 'Empréstimo registrado com sucesso!', 'success');
    
    // Clear inputs
    amountInput.value = '';
    interestRateInput.value = '';
    
    // Reload loan info
    await loadClientLoan(clientId);
    
  } catch (error) {
    console.error('Error adding loan:', error);
    showToast('Erro', 'Falha ao registrar empréstimo. Tente novamente.', 'error');
  }
}

// Function to load client's loan
async function loadClientLoan(clientId) {
  try {
    // Query for client's loan
    const snapshot = await db.collection('loans')
      .where('clientId', '==', clientId)
      .where('status', '==', 'active')
      .get();
    
    if (snapshot.empty) {
      console.log('No active loans found for client');
      return;
    }
    
    // We should only have one active loan per client
    const loanDoc = snapshot.docs[0];
    const loan = loanDoc.data();
    loan.id = loanDoc.id;
    
    // Store current loan
    currentLoan = loan;
    window.currentLoan = currentLoan;
    
    // Calculate current debt
    const { totalDebt, interestAccrued } = calculateRemainingDebt(loan);
    
    // Update loan info in UI
    const loanInfo = document.getElementById('loanInfo');
    
    // Format dates and values
    const startDate = formatDate(loan.startDate.toDate());
    const lastPaymentDate = loan.lastPaymentDate ? formatDate(loan.lastPaymentDate.toDate()) : 'Nenhum';
    
    // Calculate how many days since the loan started
    const daysSinceStart = calculateDaysSince(loan.startDate.toDate());
    
    loanInfo.innerHTML = `
      <div class="loan-details">
        <div class="loan-detail">
          <div class="loan-detail-label">Valor Emprestado</div>
          <div class="loan-detail-value">R$ ${loan.amount.toFixed(2)}</div>
        </div>
        <div class="loan-detail">
          <div class="loan-detail-label">Taxa de Juros</div>
          <div class="loan-detail-value">${loan.interestRate}% ao mês</div>
        </div>
        <div class="loan-detail">
          <div class="loan-detail-label">Data do Empréstimo</div>
          <div class="loan-detail-value">${startDate} (${daysSinceStart} dias)</div>
        </div>
        <div class="loan-detail">
          <div class="loan-detail-label">Último Pagamento</div>
          <div class="loan-detail-value">${lastPaymentDate}</div>
        </div>
        <div class="loan-detail">
          <div class="loan-detail-label">Total Pago</div>
          <div class="loan-detail-value">R$ ${loan.totalPaid.toFixed(2)}</div>
        </div>
        <div class="loan-detail">
          <div class="loan-detail-label">Juros Acumulados</div>
          <div class="loan-detail-value">R$ ${interestAccrued.toFixed(2)}</div>
        </div>
        <div class="loan-detail">
          <div class="loan-detail-label">Valor Atual da Dívida</div>
          <div class="loan-detail-value" style="color: var(--warning); font-weight: 600;">R$ ${totalDebt.toFixed(2)}</div>
        </div>
      </div>
    `;
    
  } catch (error) {
    console.error('Error loading client loan:', error);
    showToast('Erro', 'Falha ao carregar informações do empréstimo', 'error');
  }
}

// Function to calculate remaining debt with accrued interest
function calculateRemainingDebt(loan) {
  // Get loan details
  const principal = loan.amount;
  const monthlyInterestRate = loan.interestRate / 100;
  const startDate = loan.startDate.toDate();
  const totalPaid = loan.totalPaid || 0;
  
  // Calculate time elapsed in months
  const today = new Date();
  const monthsElapsed = calculateMonthsBetween(startDate, today);
  
  // Calculate accrued interest
  const interestAccrued = principal * monthlyInterestRate * monthsElapsed;
  
  // Calculate total debt
  const totalDebt = principal + interestAccrued - totalPaid;
  
  return {
    principal,
    interestAccrued,
    totalDebt,
    monthsElapsed
  };
}

// Function to calculate months between two dates
function calculateMonthsBetween(startDate, endDate) {
  const years = endDate.getFullYear() - startDate.getFullYear();
  const months = endDate.getMonth() - startDate.getMonth();
  const days = endDate.getDate() - startDate.getDate();
  
  // Adjust for partial months
  let totalMonths = years * 12 + months + (days > 0 ? days / 30 : 0);
  
  // Ensure we never return less than 0
  return Math.max(0, totalMonths);
}

// Function to calculate days since a date
function calculateDaysSince(date) {
  const today = new Date();
  const diffTime = Math.abs(today - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Helper function to format date
function formatDate(date) {
  return date.toLocaleDateString('pt-BR');
}

// Export current loan for use in other modules
export function getCurrentLoan() {
  return currentLoan;
}
// Payment management functionality
import { getFirestore } from './firebase.js';
import { showToast } from './ui.js';
import { getCurrentLoan } from './loans.js';

let db;

export function setupPaymentManagement() {
  db = getFirestore();
  
  // Expose necessary functions globally
  window.openPaymentModal = openPaymentModal;
  window.confirmPayment = confirmPayment;
  window.showPayments = showPayments;
  window.loadDuePayments = loadDuePayments;
  window.chargeDebt = chargeDebt;
  window.shareReceipt = shareReceipt;
  window.copyReceiptText = copyReceiptText;
}

// Function to open payment modal
function openPaymentModal() {
  const currentLoan = getCurrentLoan();
  
  if (!currentLoan) {
    showToast('Atenção', 'Não há empréstimo ativo para este cliente', 'warning');
    return;
  }
  
  // Calculate current debt
  const { totalDebt } = window.calculateRemainingDebt(currentLoan);
  
  // Set default payment amount to total debt
  document.getElementById('payAmount').value = totalDebt.toFixed(2);
  
  // Set default payment date to today
  const today = new Date();
  const formattedDate = formatDateForInput(today);
  document.getElementById('paymentDate').value = formattedDate;
  
  // Clear notes
  document.getElementById('paymentNotes').value = '';
  
  // Show modal
  showModal('paymentModal');
}

// Function to confirm payment
async function confirmPayment() {
  try {
    const payAmount = parseFloat(document.getElementById('payAmount').value);
    const paymentDate = document.getElementById('paymentDate').value;
    const paymentNotes = document.getElementById('paymentNotes').value.trim();
    
    // Validate inputs
    if (isNaN(payAmount) || payAmount <= 0) {
      showToast('Atenção', 'Digite um valor válido para o pagamento', 'warning');
      return;
    }
    
    // Get current loan
    const currentLoan = getCurrentLoan();
    
    if (!currentLoan) {
      showToast('Erro', 'Nenhum empréstimo ativo encontrado', 'error');
      return;
    }
    
    // Calculate current debt
    const { totalDebt } = window.calculateRemainingDebt(currentLoan);
    
    // Create payment object
    const payment = {
      loanId: currentLoan.id,
      clientId: currentLoan.clientId,
      amount: payAmount,
      date: paymentDate ? new Date(paymentDate) : new Date(),
      notes: paymentNotes,
      createdAt: new Date()
    };
    
    // Add payment to Firestore
    await db.collection('payments').add(payment);
    
    // Update loan
    const newTotalPaid = currentLoan.totalPaid + payAmount;
    const loanUpdates = {
      totalPaid: newTotalPaid,
      lastPaymentDate: new Date()
    };
    
    // Check if loan is fully paid
    if (newTotalPaid >= totalDebt) {
      loanUpdates.status = 'paid';
      
      // Update client hasLoan status
      await db.collection('clients').doc(currentLoan.clientId).update({
        hasLoan: false
      });
      
      // Update current client object
      if (window.currentClient) {
        window.currentClient.hasLoan = false;
      }
    }
    
    // Update loan in Firestore
    await db.collection('loans').doc(currentLoan.id).update(loanUpdates);
    
    showToast('Sucesso', 'Pagamento registrado com sucesso!', 'success');
    
    // Close modal
    closeModal('paymentModal');
    
    // Reload client profile to update loan info
    await window.showClientProfile(currentLoan.clientId);
    
  } catch (error) {
    console.error('Error confirming payment:', error);
    showToast('Erro', 'Falha ao registrar pagamento. Tente novamente.', 'error');
  }
}

// Function to show payment history
async function showPayments() {
  try {
    const clientId = window.currentClient?.id;
    
    if (!clientId) {
      showToast('Erro', 'Nenhum cliente selecionado', 'error');
      return;
    }
    
    // Query for client's payments
    const snapshot = await db.collection('payments')
      .where('clientId', '==', clientId)
      .orderBy('date', 'desc')
      .get();
    
    const paymentList = document.getElementById('paymentList');
    const noPaymentsMessage = document.getElementById('noPaymentsMessage');
    
    paymentList.innerHTML = '';
    
    if (snapshot.empty) {
      paymentList.classList.add('hidden');
      noPaymentsMessage.classList.remove('hidden');
    } else {
      paymentList.classList.remove('hidden');
      noPaymentsMessage.classList.add('hidden');
      
      snapshot.forEach(doc => {
        const payment = doc.data();
        const paymentDate = formatDate(payment.date.toDate());
        
        const li = document.createElement('li');
        li.className = 'payment-history-item';
        
        li.innerHTML = `
          <div class="payment-history-header">
            <div class="payment-history-date">${paymentDate}</div>
            <div class="payment-history-amount">R$ ${payment.amount.toFixed(2)}</div>
          </div>
          ${payment.notes ? `<div class="payment-history-notes">${payment.notes}</div>` : ''}
        `;
        
        paymentList.appendChild(li);
      });
    }
    
    // Show modal
    showModal('historyModal');
    
  } catch (error) {
    console.error('Error showing payments:', error);
    showToast('Erro', 'Falha ao carregar histórico de pagamentos', 'error');
  }
}

// Function to load due payments for the dashboard
async function loadDuePayments() {
  try {
    // Get all active loans
    const loansSnapshot = await db.collection('loans')
      .where('status', '==', 'active')
      .get();
    
    if (loansSnapshot.empty) {
      document.getElementById('duePayments').innerHTML = '';
      document.getElementById('duePaymentCount').textContent = '0';
      document.getElementById('noDuePayments').classList.remove('hidden');
      return;
    }
    
    // Calculate current date and date 5 days from now
    const today = new Date();
    const fiveDaysLater = new Date();
    fiveDaysLater.setDate(today.getDate() + 5);
    
    // Array to store due payments
    const duePayments = [];
    
    // Get client details for each loan
    const clientPromises = loansSnapshot.docs.map(async doc => {
      const loan = doc.data();
      loan.id = doc.id;
      
      // Calculate next payment due date (monthly from start date)
      const startDate = loan.startDate.toDate();
      const nextDueDate = calculateNextDueDate(startDate, loan.lastPaymentDate?.toDate());
      
      // Check if due date is within the next 5 days
      if (nextDueDate >= today && nextDueDate <= fiveDaysLater) {
        // Get client details
        const clientDoc = await db.collection('clients').doc(loan.clientId).get();
        const client = clientDoc.data();
        
        // Calculate current debt
        const { totalDebt } = window.calculateRemainingDebt(loan);
        
        duePayments.push({
          clientId: loan.clientId,
          clientName: client.name,
          dueDate: nextDueDate,
          amount: totalDebt
        });
      }
    });
    
    // Wait for all client details to be fetched
    await Promise.all(clientPromises);
    
    // Sort due payments by due date (ascending)
    duePayments.sort((a, b) => a.dueDate - b.dueDate);
    
    // Update UI
    const duePaymentsElement = document.getElementById('duePayments');
    const duePaymentCount = document.getElementById('duePaymentCount');
    const noDuePayments = document.getElementById('noDuePayments');
    
    duePaymentsElement.innerHTML = '';
    duePaymentCount.textContent = duePayments.length.toString();
    
    if (duePayments.length === 0) {
      noDuePayments.classList.remove('hidden');
    } else {
      noDuePayments.classList.add('hidden');
      
      duePayments.forEach(payment => {
        const li = document.createElement('li');
        li.className = 'payment-list-item';
        
        const formattedDate = formatDate(payment.dueDate);
        
        li.innerHTML = `
          <div class="payment-info">
            <div class="payment-client">${payment.clientName}</div>
            <div class="payment-date">Vence em: ${formattedDate}</div>
          </div>
          <div class="payment-amount">R$ ${payment.amount.toFixed(2)}</div>
        `;
        
        li.addEventListener('click', () => {
          window.showClientProfile(payment.clientId);
        });
        
        duePaymentsElement.appendChild(li);
      });
    }
    
  } catch (error) {
    console.error('Error loading due payments:', error);
    if (error.code === 'permission-denied') {
      showToast('Erro', 'Sem permissão para visualizar pagamentos pendentes', 'error');
    } else {
      showToast('Erro', 'Falha ao carregar pagamentos pendentes', 'error');
    }
  }
}

// Function to calculate next due date
function calculateNextDueDate(startDate, lastPaymentDate) {
  // Start with the loan start date
  const today = new Date();
  
  // If we have a last payment date, use that instead
  const baseDate = lastPaymentDate || startDate;
  
  // Calculate months since base date
  const monthsSince = calculateMonthsSince(baseDate, today);
  
  // Calculate next due date (add one month to base date for each full month passed)
  const nextDueDate = new Date(baseDate);
  nextDueDate.setMonth(baseDate.getMonth() + Math.floor(monthsSince) + 1);
  
  return nextDueDate;
}

// Function to calculate months since a date
function calculateMonthsSince(startDate, endDate) {
  const years = endDate.getFullYear() - startDate.getFullYear();
  const months = endDate.getMonth() - startDate.getMonth();
  const days = endDate.getDate() - startDate.getDate();
  
  // Calculate total months
  let totalMonths = years * 12 + months + (days > 0 ? 0 : -1);
  
  // Ensure we never return less than 0
  return Math.max(0, totalMonths);
}

// Function to generate charge receipt
function chargeDebt() {
  try {
    const currentLoan = getCurrentLoan();
    const currentClient = window.currentClient;
    
    if (!currentLoan || !currentClient) {
      showToast('Erro', 'Informações de empréstimo ou cliente não encontradas', 'error');
      return;
    }
    
    // Calculate current debt
    const { totalDebt, interestAccrued } = window.calculateRemainingDebt(currentLoan);
    
    // Format dates
    const today = formatDate(new Date());
    const loanDate = formatDate(currentLoan.startDate.toDate());
    
    // Generate receipt content
    const receiptContent = `
RECIBO DE COBRANÇA
------------------
Data: ${today}

Cliente: ${currentClient.name}
${currentClient.phone ? `Telefone: ${currentClient.phone}` : ''}
${currentClient.address ? `Endereço: ${currentClient.address}` : ''}

DETALHES DO EMPRÉSTIMO:
* Valor emprestado: R$ ${currentLoan.amount.toFixed(2)}
* Data do empréstimo: ${loanDate}
* Taxa de juros: ${currentLoan.interestRate}% ao mês
* Juros acumulados: R$ ${interestAccrued.toFixed(2)}
* Total pago até o momento: R$ ${currentLoan.totalPaid.toFixed(2)}

VALOR ATUAL DA DÍVIDA: R$ ${totalDebt.toFixed(2)}

Por favor, entre em contato para agendar o pagamento.

Sistema Fácil
`;
    
    // Display receipt
    document.getElementById('receiptContent').textContent = receiptContent;
    
    // Store receipt for sharing
    window.currentReceipt = receiptContent;
    
    // Show modal
    showModal('receiptModal');
  
  } catch (error) {
    console.error('Error generating receipt:', error);
    showToast('Erro', 'Falha ao gerar recibo de cobrança', 'error');
  }
}

// Function to share receipt via WhatsApp
function shareReceipt() {
  const currentClient = window.currentClient;
  const receiptContent = window.currentReceipt;
  
  if (!receiptContent) {
    showToast('Erro', 'Recibo não encontrado', 'error');
    return;
  }
  
  // Format phone number (remove non-digits)
  let phone = currentClient.phone ? currentClient.phone.replace(/\D/g, '') : '';
  
  // Add country code if not present
  if (phone && !phone.startsWith('55')) {
    phone = '55' + phone;
  }
  
  // Encode receipt for WhatsApp
  const encodedReceipt = encodeURIComponent(receiptContent);
  
  // Generate WhatsApp link
  const whatsappUrl = phone 
    ? `https://wa.me/${phone}?text=${encodedReceipt}`
    : `https://wa.me/?text=${encodedReceipt}`;
  
  // Open WhatsApp in new tab
  window.open(whatsappUrl, '_blank');
}

// Function to copy receipt text
function copyReceiptText() {
  const receiptContent = window.currentReceipt;
  
  if (!receiptContent) {
    showToast('Erro', 'Recibo não encontrado', 'error');
    return;
  }
  
  // Copy to clipboard
  navigator.clipboard.writeText(receiptContent)
    .then(() => {
      showToast('Sucesso', 'Recibo copiado para a área de transferência', 'success');
    })
    .catch(err => {
      console.error('Error copying text:', err);
      showToast('Erro', 'Falha ao copiar recibo', 'error');
    });
}

// Helper function to format date for display
function formatDate(date) {
  return date.toLocaleDateString('pt-BR');
}

// Helper function to format date for input fields (YYYY-MM-DD)
function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to show modal
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.add('visible');
}

// Helper function to close modal
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('visible');
}

// Expose closeModal globally
window.closeModal = closeModal;
// Dashboard functionality
import { getFirestore } from './firebase.js';
import { showToast } from './ui.js';

let db;

export function setupDashboard() {
  db = getFirestore();
  
  // Load dashboard data
  loadDashboardData();
}

// Function to load dashboard data
async function loadDashboardData() {
  try {
    // Initialize counters
    let totalLoaned = 0;
    let totalReceived = 0;
    let totalProfit = 0;
    let totalToReceive = 0;
    
    // Load all active loans
    const loansSnapshot = await db.collection('loans').get();
    
    // Process each loan
    loansSnapshot.forEach(doc => {
      const loan = doc.data();
      
      // Add to total loaned
      totalLoaned += loan.amount;
      
      // Add to total received
      totalReceived += loan.totalPaid || 0;
      
      // Calculate current debt for active loans
      if (loan.status === 'active') {
        const { totalDebt, interestAccrued } = window.calculateRemainingDebt(loan);
        totalToReceive += totalDebt;
      }
    });
    
    // Calculate profit (interest received)
    totalProfit = totalReceived - totalLoaned;
    
    // Adjust for negative profit (can happen if not all principal is paid back yet)
    if (totalProfit < 0) totalProfit = 0;
    
    // Update UI
    document.getElementById('totalLoaned').textContent = formatCurrency(totalLoaned);
    document.getElementById('totalReceived').textContent = formatCurrency(totalReceived);
    document.getElementById('totalProfit').textContent = formatCurrency(totalProfit);
    document.getElementById('totalToReceive').textContent = formatCurrency(totalToReceive);
    
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    if (error.code === 'permission-denied') {
      showToast('Erro', 'Sem permissão para visualizar dados do dashboard', 'error');
    } else {
      showToast('Erro', 'Falha ao carregar dados do dashboard', 'error');
    }
  }
}

// Helper function to format currency
function formatCurrency(value) {
  return `R$ ${value.toFixed(2)}`;
}
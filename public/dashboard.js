// dashboard.js

function saveClientsToStorage() {
  localStorage.setItem('agi_clients', JSON.stringify(clients));
  updateDashboard();
}

function loadClientsFromStorage() {
  const data = localStorage.getItem('agi_clients');
  if (data) {
    clients = JSON.parse(data);
    clients.forEach(client => {
      if (client.loans) {
        client.loans.forEach(loan => {
          loan.dueDate = new Date(loan.dueDate);
        });
      }
    });
    clientIdCounter = clients.length + 1;
  }
  updateAllLoansInterest();
  updateDashboard();
}

function updateDashboard() {
  let totalLoaned = 0;
  let totalReceived = 0;
  let totalToReceive = 0;
  let totalProfit = 0;
  clients.forEach(client => {
    if (client.loans && client.loans.length) {
      client.loans.forEach(loan => {
        totalLoaned += loan.amount || 0;
        totalToReceive += loan.debt || 0;
        if (loan.debt > 0) {
          totalProfit += (loan.debt - loan.amount);
        }
      });
    }
    if (client.payments && client.payments.length) {
      client.payments.forEach(p => {
        totalReceived += p.amount || 0;
      });
    }
  });
  document.getElementById('totalLoaned').textContent = formatCurrency(totalLoaned);
  document.getElementById('totalReceived').textContent = formatCurrency(totalReceived);
  document.getElementById('totalProfit').textContent = formatCurrency(totalProfit);
  document.getElementById('totalToReceive').textContent = formatCurrency(totalToReceive);
}

function updateAllLoansInterest() {
  const today = new Date();
  clients.forEach(client => {
    if (client.loans) {
      client.loans.forEach(loan => {
        if (loan.debt > 0 && new Date(loan.dueDate) < today) {
          const monthsLate = Math.floor((today - new Date(loan.dueDate)) / (1000 * 60 * 60 * 24 * 30));
          if (monthsLate > 0) {
            loan.debt = loan.amount + (loan.amount * (loan.interest / 100) * monthsLate);
            loan.dueDate = addDays(new Date(loan.dueDate), 30 * monthsLate);
          }
        }
      });
    }
  });
  saveClientsToStorage();
}

// Inicialização
updateDashboard();
loadClientsFromStorage();
updateDuePaymentsList();
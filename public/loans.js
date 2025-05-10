// loans.js

// Função para adicionar dias a uma data
function addDays(date, days) {
  let result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Formata data para dd/mm/yyyy
function formatDate(d) {
  if (!(d instanceof Date)) return "";
  let day = String(d.getDate()).padStart(2, "0");
  let month = String(d.getMonth() + 1).padStart(2, "0");
  let year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Formata valor monetário com R$
function formatCurrency(value) {
  return "R$ " + value.toFixed(2).replace(".", ",");
}

// Atualiza lista mensalidades vencendo em até 5 dias
function updateDuePaymentsList() {
  const ul = document.getElementById("duePayments");
  ul.innerHTML = "";

  const today = new Date();
  const limitDate = addDays(today, 5);

  let found = false;
  for (const client of clients) {
    if (!client.loans || client.loans.length === 0) continue;
    const hasActiveLoan = client.loans.some(loan => loan.debt > 0);
    if (!hasActiveLoan) continue;
    for (const loan of client.loans) {
      let due = new Date(loan.dueDate);
      if (due >= today && due <= limitDate && loan.debt > 0) {
        found = true;
        let li = document.createElement("li");
        li.textContent = `${client.name} - ${formatCurrency(loan.debt)} - Vence em ${formatDate(due)}`;
        ul.appendChild(li);
      }
    }
  }
  if (!found) {
    let li = document.createElement("li");
    li.textContent = "Nenhuma mensalidade vencendo nos próximos 5 dias.";
    ul.appendChild(li);
  }
}

// Atualiza exibição dos empréstimos
function updateLoanInfo() {
  const loanInfo = document.getElementById("loanInfo");
  if (!currentClient.loans || currentClient.loans.length === 0) {
    loanInfo.innerHTML = "<em>Sem empréstimos registrados.</em>";
    return;
  }
  let html = "<h3>Empréstimos:</h3>";
  currentClient.loans.forEach((loan, index) => {
    html += `<div class="loan-card">
      <div class="loan-info">
        <strong>Empréstimo ${index + 1}</strong><br>
        Valor Inicial: ${formatCurrency(loan.amount)}<br>
        Juros ao Mês: ${loan.interest.toFixed(2)}%<br>
        Dívida Atual: ${formatCurrency(loan.debt)}<br>
        Vencimento: ${formatDate(new Date(loan.dueDate))}
      </div>`;
    if (loan.debt > 0) {
      html += `<button class='pay-fab' title='Pagar este empréstimo' onclick='payDebtForLoan(${index})'><span>💸</span></button>`;
    }
    html += `</div>`;
  });
  loanInfo.innerHTML = html;

  const hasDebt = currentClient.loans.some(loan => loan.debt > 0);
  const nameTitle = document.querySelector('#clientProfile h2');
  if (!hasDebt) {
    if (!document.getElementById('goodPayerBadge')) {
      const badge = document.createElement('span');
      badge.id = 'goodPayerBadge';
      badge.textContent = '  ⭐ Bom Pagador';
      badge.style.color = '#28a745';
      badge.style.fontSize = '1em';
      badge.style.marginLeft = '8px';
      nameTitle.appendChild(badge);
    }
  } else {
    const badge = document.getElementById('goodPayerBadge');
    if (badge) badge.remove();
  }
}

function payDebt() {
  if (!currentClient) return alert("Nenhum cliente selecionado.");
  if (!currentClient.loans || currentClient.loans.length === 0) {
    alert("Cliente não possui dívidas.");
    return;
  }
  document.getElementById("paymentSection").classList.remove("hidden");
  hideReminder();
}

function payDebtForLoan(loanIndex) {
  if (!currentClient) return alert("Nenhum cliente selecionado.");
  const loan = currentClient.loans[loanIndex];
  if (!loan || loan.debt <= 0) {
    alert("Este empréstimo não possui dívida a pagar.");
    return;
  }
  document.getElementById("paymentSection").classList.remove("hidden");
  hideReminder();
  window.loanToPayIndex = loanIndex;
}

function confirmPayment() {
  const payInput = document.getElementById("payAmount");
  let paidValue = parseFloat(payInput.value);
  if (isNaN(paidValue) || paidValue <= 0) {
    alert("Insira um valor válido para pagamento.");
    payInput.focus();
    return;
  }
  let loanIndex = typeof window.loanToPayIndex === 'number' ? window.loanToPayIndex : null;
  let loan = null;
  if (loanIndex !== null && currentClient.loans[loanIndex]) {
    loan = currentClient.loans[loanIndex];
  } else {
    loan = currentClient.loans.find(ln => ln.debt > 0);
  }
  if (!loan) {
    alert("Não há dívidas a pagar.");
    hidePaymentSection();
    payInput.value = "";
    return;
  }
  const currentDebt = loan.debt;
  currentClient.payments.push({ amount: paidValue, date: new Date() });
  if (paidValue >= currentDebt) {
    loan.debt = 0;
    loan.amount = 0;
    loan.dueDate = addDays(new Date(), 30);
    alert("Dívida quitada com sucesso!");
  } else {
    loan.debt -= paidValue;
    loan.dueDate = addDays(new Date(), 30);
    alert("Pagamento parcial realizado. Dívida recalculada para o próximo mês.");
  }
  payInput.value = "";
  hidePaymentSection();
  updateLoanInfo();
  updateDuePaymentsList();
  saveClientsToStorage();
  window.loanToPayIndex = null;
}

function hidePaymentSection() {
  document.getElementById("paymentSection").classList.add("hidden");
  document.getElementById("payAmount").value = "";
}

function chargeDebt() {
  if (!currentClient) return alert("Nenhum cliente selecionado.");
  if (!currentClient.loans || currentClient.loans.length === 0) {
    alert("Cliente não possui dívidas.");
    return;
  }
  let totalDebt = 0;
  for (let loan of currentClient.loans) {
    totalDebt += loan.debt;
  }

  const receiptMessage = `Olá, ${currentClient.name}!\n\n` +
    `Estamos entrando em contato para lembrar que hoje vence o pagamento do seu empréstimo pessoal no valor de ${formatCurrency(totalDebt)}.\n\n` +
    `Se precisar de mais informações ou assistência, estamos à disposição.\n\n` +
    `Agradecemos pela sua atenção e aguardamos o pagamento.\n\n` +
    `Atenciosamente,\n\n` +
    `[Seu Nome ou Nome da Empresa]`;

  document.getElementById("receiptContent").textContent = receiptMessage;
  document.getElementById("receiptModal").style.display = "block";
}

function shareReceipt() {
  const totalDebt = currentClient.loans.reduce((sum, loan) => sum + loan.debt, 0);
  const message = `Olá, ${currentClient.name}!\n\n` +
    `Estamos entrando em contato para lembrar que hoje vence o pagamento do seu empréstimo pessoal no valor de ${formatCurrency(totalDebt)}.\n\n` +
    `Se precisar de mais informações ou assistência, estamos à disposição.\n\n` +
    `Agradecemos pela sua atenção e aguardamos o pagamento.\n\n` +
    `Atenciosamente,\n\n` +
    `[Seu Nome ou Nome da Empresa]`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

function closeReceiptModal() {
  document.getElementById("receiptModal").style.display = "none";
}
// reports.js

const reportModal = document.getElementById("reportModal");

function openReportModal() {
  updateAllLoansInterest();
  renderReport();
  reportModal.style.display = "block";
}

function closeReportModal() {
  reportModal.style.display = "none";
}

function renderReport() {
  const content = document.getElementById("reportContent");
  let html = "<table style='width:100%;border-collapse:collapse;font-size:0.95em;'>";
  html += "<tr style='background:#e6f2ff;'><th>Cliente</th><th>Telefone</th><th>Dívida Total</th><th>Empréstimos</th><th>Pagamentos</th><th>Status</th></tr>";
  clients.forEach(client => {
    const totalDebt = client.loans ? client.loans.reduce((sum, l) => sum + l.debt, 0) : 0;
    const totalPaid = client.payments ? client.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
    const hasOverdue = client.loans && client.loans.some(l => l.debt > 0 && new Date(l.dueDate) < new Date());
    html += `<tr style='background:${hasOverdue ? "#fff3cd" : "#f9f9f9"};'>` +
      `<td>${client.name}</td>` +
      `<td>${client.phone}</td>` +
      `<td>${formatCurrency(totalDebt)}</td>` +
      `<td>${client.loans && client.loans.length ? client.loans.length : 0}</td>` +
      `<td>${formatCurrency(totalPaid)}</td>` +
      `<td>${hasOverdue ? '<span style="color:#d9534f;font-weight:bold;">Inadimplente</span>' : '<span style="color:#28a745;">OK</span>'}</td>` +
      `</tr>`;
  });
  html += "</table>";
  content.innerHTML = html;
}

function exportReport(type) {
  let rows = [
    ["Cliente", "Telefone", "Dívida Total", "Empréstimos", "Pagamentos", "Status"]
  ];
  clients.forEach(client => {
    const totalDebt = client.loans ? client.loans.reduce((sum, l) => sum + l.debt, 0) : 0;
    const totalPaid = client.payments ? client.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
    const hasOverdue = client.loans && client.loans.some(l => l.debt > 0 && new Date(l.dueDate) < new Date());
    rows.push([
      client.name,
      client.phone,
      totalDebt.toFixed(2).replace('.', ','),
      client.loans && client.loans.length ? client.loans.length : 0,
      totalPaid.toFixed(2).replace('.', ','),
      hasOverdue ? "Inadimplente" : "OK"
    ]);
  });
  if (type === 'csv') {
    let csv = rows.map(r => r.map(v => '"' + v + '"').join(';')).join('\n');
    downloadFile(csv, 'relatorio_agi.csv', 'text/csv');
  } else if (type === 'json') {
    downloadFile(JSON.stringify(clients, null, 2), 'relatorio_agi.json', 'application/json');
  }
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}
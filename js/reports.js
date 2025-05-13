// Reports functionality

import { getDbInstance } from './firebase.js';
import { showToast } from './ui.js';
// Importa a função de cálculo de dívida de loans.js
import { calculateRemainingDebt } from './loans.js';

let db; // Instância do Firestore

export function setupReports() {
  try {
    db = getDbInstance();
    if (!db) {
      console.error("Falha ao obter instância do Firestore em reports.js.");
      showToast('Erro Crítico', 'Falha ao conectar com banco de dados (Relatórios).', 'error');
      return;
    }

    window.openReportModal = openReportModal;
    window.generateReport = generateReport;
    window.exportReport = exportReport;

    console.log("Módulo de Relatórios configurado.");
  } catch (error) {
    console.error("Erro configurando Reports:", error);
    showToast('Erro', 'Falha ao iniciar módulo de relatórios.', 'error');
  }
}

// --- Funções do Modal de Relatórios ---

function openReportModal() {
  const reportModal = document.getElementById('reportModal');
  const reportContentEl = document.getElementById('reportContent');
  const reportTypeSelect = document.getElementById('reportType');
  const reportPeriodSelect = document.getElementById('reportPeriod');
  const exportCsvButton = document.getElementById('exportCsvButton');
  const exportJsonButton = document.getElementById('exportJsonButton');

  if (!reportModal || !reportContentEl || !reportTypeSelect || !reportPeriodSelect) {
      showToast('Erro', 'Elementos do modal de relatórios não encontrados no HTML.', 'error');
      return;
  }

  reportContentEl.innerHTML = '<p class="text-center text-gray-500">Selecione o tipo e o período do relatório e clique em "Gerar".</p>';
  reportTypeSelect.selectedIndex = 0;
  reportPeriodSelect.selectedIndex = 0;

  if (exportCsvButton) exportCsvButton.disabled = true;
  if (exportJsonButton) exportJsonButton.disabled = true;
  window.currentReportData = null;

  reportModal.classList.add('visible');
  reportModal.setAttribute('aria-hidden', 'false');
}

async function generateReport() {
  if (!db) {
    showToast('Erro', 'Banco de dados não inicializado (generateReport).', 'error');
    return;
  }

  const reportTypeSelect = document.getElementById('reportType');
  const reportPeriodSelect = document.getElementById('reportPeriod');
  const reportContentEl = document.getElementById('reportContent');
  const generateButton = document.querySelector('#reportModal button:not([onclick*="exportReport"])');
  const exportCsvButton = document.getElementById('exportCsvButton');
  const exportJsonButton = document.getElementById('exportJsonButton');

  if (!reportTypeSelect || !reportPeriodSelect || !reportContentEl) {
      showToast('Erro', 'Elementos essenciais do modal de relatórios não encontrados.', 'error');
      return;
  }

  const reportType = reportTypeSelect.value;
  const reportPeriod = reportPeriodSelect.value;

  if (!reportType || !reportPeriod) {
      showToast('Atenção', 'Selecione o tipo e o período do relatório.', 'warning');
      return;
  }

  reportContentEl.innerHTML = '<p class="text-center text-gray-500 py-4">Gerando relatório, por favor aguarde...</p>';
  if (generateButton) generateButton.disabled = true;
  if (exportCsvButton) exportCsvButton.disabled = true;
  if (exportJsonButton) exportJsonButton.disabled = true;
  window.currentReportData = null;

  console.log(`Gerando relatório: Tipo=${reportType}, Período=${reportPeriod}`);

  try {
    switch (reportType) {
      case 'summary':
        await generateSummaryReport(reportPeriod);
        break;
      case 'clients':
        await generateClientsReport(reportPeriod);
        break;
      case 'loans':
        await generateLoansReport(reportPeriod);
        break;
      case 'payments':
        await generatePaymentsReport(reportPeriod);
        break;
      default:
        showToast('Erro', 'Tipo de relatório inválido selecionado.', 'error');
        reportContentEl.innerHTML = '<p class="text-center text-red-500">Erro: Tipo de relatório inválido.</p>';
        break;
    }

    if (window.currentReportData) {
        if (exportCsvButton) exportCsvButton.disabled = false;
        if (exportJsonButton) exportJsonButton.disabled = false;
    } else {
         if (!reportContentEl.innerHTML.includes('Erro')) {
            reportContentEl.innerHTML = '<p class="text-center text-red-500">Falha ao gerar dados para exportação.</p>';
         }
    }
  } catch (error) {
    console.error(`Erro ao gerar relatório (${reportType}, ${reportPeriod}):`, error);
    showToast('Erro', `Falha ao gerar relatório de ${reportType}.`, 'error');
    reportContentEl.innerHTML = `<p class="text-center text-red-500">Ocorreu um erro ao gerar o relatório: ${error.message}</p>`;
  } finally {
      if (generateButton) generateButton.disabled = false;
  }
}

// --- Funções Geradoras de Relatórios Específicos ---

async function generateSummaryReport(period) {
  console.log("Gerando Relatório de Resumo para o período:", period);
  const reportContentEl = document.getElementById('reportContent');
  try {
    const { startDate, endDate, periodLabel } = getDateRangeForPeriod(period);

    let totalLoanedInPeriod = 0;
    let totalReceivedInPeriod = 0;
    let totalDebtAllActiveLoans = 0;
    let activeLoansCount = 0;
    let loansStartedInPeriodCount = 0;
    let totalClientsCount = 0;
    let newClientsInPeriodCount = 0;

    const loansSnapshot = await db.collection('loans').get();
    const allLoans = [];
    loansSnapshot.forEach(doc => {
        const loan = doc.data();
        loan.id = doc.id;
        if (loan.startDate && typeof loan.startDate.toDate === 'function') {
            loan.startDate = loan.startDate.toDate();
        }
        if (loan.lastPaymentDate && typeof loan.lastPaymentDate.toDate === 'function') {
            loan.lastPaymentDate = loan.lastPaymentDate.toDate();
        }
        allLoans.push(loan);
    });

    for (const loan of allLoans) {
        if (loan.startDate && loan.startDate >= startDate && loan.startDate <= endDate) {
            totalLoanedInPeriod += loan.amount;
            loansStartedInPeriodCount++;
        }
        if (loan.status === 'active') {
            activeLoansCount++;
            // USA A FUNÇÃO IMPORTADA
            if (loan.startDate instanceof Date) {
                const { totalDebt } = calculateRemainingDebt(loan);
                totalDebtAllActiveLoans += Math.max(0, totalDebt);
            } else {
                 console.warn(`Empréstimo ativo ${loan.id} sem data de início válida para cálculo de dívida.`);
            }
        }
    }

    const paymentsQuery = db.collection('payments')
                            .where('date', '>=', startDate)
                            .where('date', '<=', endDate);
    const paymentsSnapshot = await paymentsQuery.get();
    paymentsSnapshot.forEach(doc => {
      totalReceivedInPeriod += doc.data().amount;
    });

    const clientsSnapshot = await db.collection('clients').get();
    totalClientsCount = clientsSnapshot.size;

    const newClientsQuery = db.collection('clients')
                              .where('createdAt', '>=', startDate)
                              .where('createdAt', '<=', endDate);
    const newClientsSnapshot = await newClientsQuery.get();
    newClientsInPeriodCount = newClientsSnapshot.size;

    const cashFlowProfitInPeriod = totalReceivedInPeriod - totalLoanedInPeriod;

    const reportHTML = `
      <div class="report-summary">
        <h3>Relatório de Resumo</h3>
        <p>Período: ${periodLabel}</p>
        <div class="report-section">
          <h4><span class="material-icons">account_balance_wallet</span> Fluxo de Caixa no Período</h4>
          <table class="report-table">
            <tr><td>Total Emprestado (Iniciados no Período)</td><td>${formatCurrency(totalLoanedInPeriod)}</td></tr>
            <tr><td>Total Recebido (Pagamentos no Período)</td><td>${formatCurrency(totalReceivedInPeriod)}</td></tr>
            <tr><td>Resultado (Recebido - Emprestado no Período)</td><td>${formatCurrency(cashFlowProfitInPeriod)}</td></tr>
          </table>
          <p class="text-xs text-gray-500 mt-1">*Considera apenas empréstimos iniciados e pagamentos recebidos dentro do período selecionado.</p>
        </div>
        <div class="report-section">
          <h4><span class="material-icons">request_quote</span> Situação Geral dos Empréstimos</h4>
          <table class="report-table">
            <tr><td>Total de Empréstimos Ativos (Geral)</td><td>${activeLoansCount}</td></tr>
            <tr><td>Valor Total a Receber (Todos Ativos)</td><td>${formatCurrency(totalDebtAllActiveLoans)}</td></tr>
            <tr><td>Empréstimos Iniciados no Período</td><td>${loansStartedInPeriodCount}</td></tr>
          </table>
           <p class="text-xs text-gray-500 mt-1">*Valor a receber considera a dívida atual de todos os empréstimos com status 'ativo'.</p>
        </div>
        <div class="report-section">
          <h4><span class="material-icons">groups</span> Clientes</h4>
          <table class="report-table">
            <tr><td>Total de Clientes Cadastrados</td><td>${totalClientsCount}</td></tr>
            <tr><td>Novos Clientes Cadastrados no Período</td><td>${newClientsInPeriodCount}</td></tr>
          </table>
        </div>
      </div>
    `;
    reportContentEl.innerHTML = reportHTML;
    window.currentReportData = {
      reportType: 'summary', period: periodLabel, periodRaw: { start: startDate, end: endDate },
      cashFlow: { totalLoanedInPeriod, totalReceivedInPeriod, cashFlowProfitInPeriod },
      loansStatus: { activeLoansCount, totalDebtAllActiveLoans, loansStartedInPeriodCount },
      clientsStatus: { totalClientsCount, newClientsInPeriodCount }
    };
    console.log("Relatório de Resumo gerado:", window.currentReportData);
  } catch (error) {
    console.error('Erro ao gerar relatório de resumo:', error);
    showToast('Erro', 'Falha ao gerar relatório de resumo', 'error');
    reportContentEl.innerHTML = `<p class="text-center text-red-500">Erro ao gerar resumo: ${error.message}</p>`;
    window.currentReportData = null;
  }
}

async function generateClientsReport(period) {
  console.log("Gerando Relatório de Clientes para o período:", period);
  const reportContentEl = document.getElementById('reportContent');
  try {
    const { startDate, endDate, periodLabel } = getDateRangeForPeriod(period);
    let clientsQuery = db.collection('clients').orderBy('name');
    if (period !== 'all') {
      clientsQuery = clientsQuery.where('createdAt', '>=', startDate)
                                 .where('createdAt', '<=', endDate);
    }
    const clientsSnapshot = await clientsQuery.get();
    console.log(`Encontrados ${clientsSnapshot.size} clientes para o período.`);

    const clientsData = [];
    for (const doc of clientsSnapshot.docs) {
      const client = doc.data();
      client.id = doc.id;
      if (client.createdAt && typeof client.createdAt.toDate === 'function') {
          client.createdAtDate = client.createdAt.toDate();
      } else {
          client.createdAtDate = null;
      }
      client.debt = 0;
      if (client.hasLoan) {
        const loanSnapshot = await db.collection('loans')
          .where('clientId', '==', client.id)
          .where('status', '==', 'active')
          .limit(1).get();
        if (!loanSnapshot.empty) {
          const loanDoc = loanSnapshot.docs[0];
          const loan = loanDoc.data();
           if (loan.startDate && typeof loan.startDate.toDate === 'function') {
               loan.startDate = loan.startDate.toDate();
           }
           if (loan.lastPaymentDate && typeof loan.lastPaymentDate.toDate === 'function') {
               loan.lastPaymentDate = loan.lastPaymentDate.toDate();
           }
           // USA A FUNÇÃO IMPORTADA
           if (loan.startDate instanceof Date) {
               const { totalDebt } = calculateRemainingDebt(loan);
               client.debt = Math.max(0, totalDebt);
           } else {
               console.warn(`Não foi possível calcular dívida para cliente ${client.id}. Data de início do empréstimo inválida.`);
               client.debt = 'Erro';
           }
        } else {
            console.warn(`Cliente ${client.id} (${client.name}) marcado com hasLoan=true, mas nenhum empréstimo ativo encontrado.`);
        }
      }
      clientsData.push(client);
    }

    let reportHTML = `
      <div class="report-clients">
        <h3>Relatório de Clientes</h3>
        <p>Período de Cadastro: ${periodLabel}</p>
        <p>Total de Clientes Listados: ${clientsData.length}</p>
        <table class="report-table full-width striped">
          <thead><tr><th>Nome</th><th>Telefone</th><th>CPF</th><th>Cadastrado em</th><th>Status Empréstimo</th><th>Dívida Atual</th></tr></thead>
          <tbody>`;
    if (clientsData.length === 0) {
        reportHTML += '<tr><td colspan="6" class="text-center py-4">Nenhum cliente encontrado para este período.</td></tr>';
    } else {
        clientsData.forEach(client => {
          const createdAtFormatted = client.createdAtDate ? formatDate(client.createdAtDate) : 'N/D';
          const status = client.hasLoan ? 'Ativo' : 'Sem Empréstimo';
          const statusClass = client.hasLoan ? 'status-active' : 'status-inactive';
          const debtFormatted = typeof client.debt === 'number' ? formatCurrency(client.debt) : (client.debt === 'Erro' ? '<span class="text-red-500">Erro</span>' : '-');
          const debtClass = client.debt > 0 ? 'negative' : (client.debt === 0 ? 'neutral' : '');
          reportHTML += `<tr><td>${client.name || 'Sem nome'}</td><td>${client.phone || '-'}</td><td>${client.cpf || '-'}</td><td>${createdAtFormatted}</td><td><span class="${statusClass}">${status}</span></td><td class="${debtClass}">${debtFormatted}</td></tr>`;
        });
    }
    reportHTML += `</tbody></table></div>`;
    reportContentEl.innerHTML = reportHTML;
    window.currentReportData = {
      reportType: 'clients', period: periodLabel, periodRaw: { start: startDate, end: endDate },
      clientsCount: clientsData.length,
      clients: clientsData.map(client => ({
        name: client.name || '', phone: client.phone || '', cpf: client.cpf || '',
        createdAt: client.createdAtDate ? formatDate(client.createdAtDate) : '',
        hasLoan: client.hasLoan || false, debt: typeof client.debt === 'number' ? client.debt : 0
      }))
    };
    console.log("Relatório de Clientes gerado.");
  } catch (error) {
    console.error('Erro ao gerar relatório de clientes:', error);
    showToast('Erro', 'Falha ao gerar relatório de clientes', 'error');
    reportContentEl.innerHTML = `<p class="text-center text-red-500">Erro ao gerar relatório de clientes: ${error.message}</p>`;
    window.currentReportData = null;
  }
}

async function generateLoansReport(period) {
  console.log("Gerando Relatório de Empréstimos para o período:", period);
  const reportContentEl = document.getElementById('reportContent');
  try {
    const { startDate, endDate, periodLabel } = getDateRangeForPeriod(period);
    let loansQuery = db.collection('loans').orderBy('startDate', 'desc');
    if (period !== 'all') {
      loansQuery = loansQuery.where('startDate', '>=', startDate)
                             .where('startDate', '<=', endDate);
    }
    const loansSnapshot = await loansQuery.get();
    console.log(`Encontrados ${loansSnapshot.size} empréstimos para o período.`);

    const loansData = [];
    const clientNamesCache = {};
    for (const doc of loansSnapshot.docs) {
      const loan = doc.data();
      loan.id = doc.id;
       if (loan.startDate && typeof loan.startDate.toDate === 'function') {
           loan.startDate = loan.startDate.toDate();
       }
       if (loan.lastPaymentDate && typeof loan.lastPaymentDate.toDate === 'function') {
           loan.lastPaymentDate = loan.lastPaymentDate.toDate();
       }
      if (!clientNamesCache[loan.clientId]) {
          try {
              const clientDoc = await db.collection('clients').doc(loan.clientId).get();
              clientNamesCache[loan.clientId] = clientDoc.exists ? clientDoc.data().name : 'Cliente Excluído';
          } catch (e) {
              console.error(`Erro ao buscar cliente ${loan.clientId}`, e);
              clientNamesCache[loan.clientId] = 'Erro ao buscar';
          }
      }
      loan.clientName = clientNamesCache[loan.clientId];
      loan.currentDebt = 0;
      if (loan.status === 'active') {
          // USA A FUNÇÃO IMPORTADA
          if (loan.startDate instanceof Date) {
              const { totalDebt } = calculateRemainingDebt(loan);
              loan.currentDebt = Math.max(0, totalDebt);
          } else {
              console.warn(`Não foi possível calcular dívida para empréstimo ${loan.id}. Data de início inválida.`);
              loan.currentDebt = 'Erro';
          }
      }
      loansData.push(loan);
    }

    const totalLoaned = loansData.reduce((sum, loan) => sum + loan.amount, 0);
    const totalPaid = loansData.reduce((sum, loan) => sum + (loan.totalPaid || 0), 0);
    const totalCurrentDebt = loansData.reduce((sum, loan) => sum + (typeof loan.currentDebt === 'number' ? loan.currentDebt : 0), 0);

    let reportHTML = `
      <div class="report-loans">
        <h3>Relatório de Empréstimos</h3>
        <p>Período de Início: ${periodLabel}</p>
        <p>Total de Empréstimos Listados: ${loansData.length}</p>
        <div class="report-summary mb-4">
          <h4 class="text-lg font-semibold mb-2">Resumo do Período</h4>
          <table class="report-table">
            <tr><td>Total Emprestado</td><td>${formatCurrency(totalLoaned)}</td></tr>
            <tr><td>Total Pago (nestes empréstimos)</td><td>${formatCurrency(totalPaid)}</td></tr>
            <tr><td>Saldo Devedor (nestes empréstimos)</td><td>${formatCurrency(totalCurrentDebt)}</td></tr>
          </table>
        </div>
        <table class="report-table full-width striped">
          <thead><tr><th>Cliente</th><th>Valor Emprestado</th><th>Taxa Juros (%)</th><th>Data Início</th><th>Status</th><th>Total Pago</th><th>Dívida Atual</th></tr></thead>
          <tbody>`;
    if (loansData.length === 0) {
        reportHTML += '<tr><td colspan="7" class="text-center py-4">Nenhum empréstimo encontrado para este período.</td></tr>';
    } else {
        loansData.forEach(loan => {
          const startDateFormatted = loan.startDate instanceof Date ? formatDate(loan.startDate) : 'N/D';
          const statusText = loan.status === 'active' ? 'Ativo' : (loan.status === 'paid' ? 'Quitado' : loan.status);
          const statusClass = loan.status === 'active' ? 'status-active' : (loan.status === 'paid' ? 'status-paid' : 'status-inactive');
          const debtFormatted = typeof loan.currentDebt === 'number' ? formatCurrency(loan.currentDebt) : (loan.currentDebt === 'Erro' ? '<span class="text-red-500">Erro</span>' : '-');
          const debtClass = loan.currentDebt > 0 ? 'negative' : (loan.currentDebt === 0 && loan.status === 'active' ? 'neutral' : '');
          reportHTML += `<tr><td>${loan.clientName || 'N/D'}</td><td>${formatCurrency(loan.amount)}</td><td>${loan.interestRate || 0}%</td><td>${startDateFormatted}</td><td><span class="${statusClass}">${statusText}</span></td><td>${formatCurrency(loan.totalPaid || 0)}</td><td class="${debtClass}">${debtFormatted}</td></tr>`;
        });
    }
    reportHTML += `</tbody></table></div>`;
    reportContentEl.innerHTML = reportHTML;
    window.currentReportData = {
      reportType: 'loans', period: periodLabel, periodRaw: { start: startDate, end: endDate },
      summary: { totalLoaned, totalPaid, totalCurrentDebt, count: loansData.length },
      loans: loansData.map(loan => ({
        clientName: loan.clientName || '', amount: loan.amount || 0, interestRate: loan.interestRate || 0,
        startDate: loan.startDate instanceof Date ? formatDate(loan.startDate) : '',
        status: loan.status || 'unknown', totalPaid: loan.totalPaid || 0,
        currentDebt: typeof loan.currentDebt === 'number' ? loan.currentDebt : 0
      }))
    };
    console.log("Relatório de Empréstimos gerado.");
  } catch (error) {
    console.error('Erro ao gerar relatório de empréstimos:', error);
    showToast('Erro', 'Falha ao gerar relatório de empréstimos', 'error');
    reportContentEl.innerHTML = `<p class="text-center text-red-500">Erro ao gerar relatório de empréstimos: ${error.message}</p>`;
    window.currentReportData = null;
  }
}

async function generatePaymentsReport(period) {
  console.log("Gerando Relatório de Pagamentos para o período:", period);
  const reportContentEl = document.getElementById('reportContent');
  try {
    const { startDate, endDate, periodLabel } = getDateRangeForPeriod(period);
    let paymentsQuery = db.collection('payments').orderBy('date', 'desc');
    if (period !== 'all') {
      paymentsQuery = paymentsQuery.where('date', '>=', startDate)
                                   .where('date', '<=', endDate);
    }
    const paymentsSnapshot = await paymentsQuery.get();
    console.log(`Encontrados ${paymentsSnapshot.size} pagamentos para o período.`);

    const paymentsData = [];
    const clientNamesCache = {};
    for (const doc of paymentsSnapshot.docs) {
      const payment = doc.data();
      payment.id = doc.id;
      if (payment.date && typeof payment.date.toDate === 'function') {
          payment.date = payment.date.toDate();
      }
      if (payment.clientName) {
          clientNamesCache[payment.clientId] = payment.clientName;
      } else if (!clientNamesCache[payment.clientId]) {
           try {
              const clientDoc = await db.collection('clients').doc(payment.clientId).get();
              clientNamesCache[payment.clientId] = clientDoc.exists ? clientDoc.data().name : 'Cliente Excluído';
          } catch (e) {
              console.error(`Erro ao buscar cliente ${payment.clientId}`, e);
              clientNamesCache[payment.clientId] = 'Erro ao buscar';
          }
      }
      payment.clientName = clientNamesCache[payment.clientId];
      paymentsData.push(payment);
    }

    const totalReceived = paymentsData.reduce((sum, payment) => sum + payment.amount, 0);

    let reportHTML = `
      <div class="report-payments">
        <h3>Relatório de Pagamentos Recebidos</h3>
        <p>Período do Pagamento: ${periodLabel}</p>
        <p>Total de Pagamentos Listados: ${paymentsData.length}</p>
        <p>Valor Total Recebido: ${formatCurrency(totalReceived)}</p>
        <table class="report-table full-width striped">
          <thead><tr><th>Cliente</th><th>Data Pagamento</th><th>Valor Pago</th><th>Observações</th></tr></thead>
          <tbody>`;
    if (paymentsData.length === 0) {
        reportHTML += '<tr><td colspan="4" class="text-center py-4">Nenhum pagamento encontrado para este período.</td></tr>';
    } else {
        paymentsData.forEach(payment => {
          const paymentDateFormatted = payment.date instanceof Date ? formatDate(payment.date) : 'N/D';
          reportHTML += `<tr><td>${payment.clientName || 'N/D'}</td><td>${paymentDateFormatted}</td><td class="positive">${formatCurrency(payment.amount)}</td><td>${payment.notes || '-'}</td></tr>`;
        });
    }
    reportHTML += `</tbody></table></div>`;
    reportContentEl.innerHTML = reportHTML;
    window.currentReportData = {
      reportType: 'payments', period: periodLabel, periodRaw: { start: startDate, end: endDate },
      summary: { totalReceived, count: paymentsData.length },
      payments: paymentsData.map(payment => ({
        clientName: payment.clientName || '',
        date: payment.date instanceof Date ? formatDate(payment.date) : '',
        amount: payment.amount || 0, notes: payment.notes || ''
      }))
    };
    console.log("Relatório de Pagamentos gerado.");
  } catch (error) {
    console.error('Erro ao gerar relatório de pagamentos:', error);
    showToast('Erro', 'Falha ao gerar relatório de pagamentos', 'error');
    reportContentEl.innerHTML = `<p class="text-center text-red-500">Erro ao gerar relatório de pagamentos: ${error.message}</p>`;
    window.currentReportData = null;
  }
}

// --- Funções de Exportação ---
function exportReport(format) {
  console.log(`Tentando exportar relatório como ${format}`);
  try {
    if (!window.currentReportData) {
      showToast('Erro', 'Gere um relatório antes de tentar exportar.', 'error');
      return;
    }
    let dataString;
    let filename;
    let contentType;
    if (format === 'csv') {
      dataString = '\uFEFF' + convertToCSV(window.currentReportData); // Adiciona BOM
      filename = `Relatorio_${window.currentReportData.reportType}_${formatDateFilename(new Date())}.csv`;
      contentType = 'text/csv;charset=utf-8;';
    } else if (format === 'json') {
      dataString = JSON.stringify(window.currentReportData, null, 2);
      filename = `Relatorio_${window.currentReportData.reportType}_${formatDateFilename(new Date())}.json`;
      contentType = 'application/json;charset=utf-8;';
    } else {
        showToast('Erro', 'Formato de exportação inválido.', 'error');
        return;
    }
    const blob = new Blob([dataString], { type: contentType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast('Sucesso', `Relatório exportado como ${format.toUpperCase()}!`, 'success');
  } catch (error) {
    console.error('Erro ao exportar relatório:', error);
    showToast('Erro', 'Falha ao exportar relatório.', 'error');
  }
}

function convertToCSV(reportData) {
  if (!reportData || !reportData.reportType) return '';
  let csv = '';
  let headers = [];
  let rows = [];
  try {
      switch (reportData.reportType) {
        case 'summary':
          headers = ['Categoria', 'Item', 'Valor'];
          rows.push(['Fluxo de Caixa', 'Total Emprestado (Período)', reportData.cashFlow.totalLoanedInPeriod]);
          rows.push(['Fluxo de Caixa', 'Total Recebido (Período)', reportData.cashFlow.totalReceivedInPeriod]);
          rows.push(['Fluxo de Caixa', 'Resultado (Período)', reportData.cashFlow.cashFlowProfitInPeriod]);
          rows.push(['Situação Empréstimos', 'Total Ativos (Geral)', reportData.loansStatus.activeLoansCount]);
          rows.push(['Situação Empréstimos', 'Valor a Receber (Todos Ativos)', reportData.loansStatus.totalDebtAllActiveLoans]);
          rows.push(['Situação Empréstimos', 'Iniciados no Período', reportData.loansStatus.loansStartedInPeriodCount]);
          rows.push(['Clientes', 'Total Cadastrados', reportData.clientsStatus.totalClientsCount]);
          rows.push(['Clientes', 'Novos no Período', reportData.clientsStatus.newClientsInPeriodCount]);
          break;
        case 'clients':
          headers = ['Nome', 'Telefone', 'CPF', 'Data Cadastro', 'Status Empréstimo', 'Dívida Atual'];
          reportData.clients.forEach(client => {
            rows.push([client.name, client.phone, client.cpf, client.createdAt, (client.hasLoan ? 'Ativo' : 'Sem Empréstimo'), client.debt]);
          });
          break;
        case 'loans':
          headers = ['Cliente', 'Valor Emprestado', 'Taxa Juros (%)', 'Data Início', 'Status', 'Total Pago', 'Dívida Atual'];
          reportData.loans.forEach(loan => {
            rows.push([loan.clientName, loan.amount, loan.interestRate, loan.startDate, (loan.status === 'active' ? 'Ativo' : (loan.status === 'paid' ? 'Quitado' : loan.status)), loan.totalPaid, loan.currentDebt]);
          });
          break;
        case 'payments':
          headers = ['Cliente', 'Data Pagamento', 'Valor Pago', 'Observações'];
          reportData.payments.forEach(payment => {
            rows.push([payment.clientName, payment.date, payment.amount, payment.notes]);
          });
          break;
        default: return '';
      }
      const escapeCsvCell = (cell) => {
          const cellStr = String(cell === null || cell === undefined ? '' : cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
              return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
      };
      csv += headers.map(escapeCsvCell).join(',') + '\n';
      rows.forEach(row => { csv += row.map(escapeCsvCell).join(',') + '\n'; });
  } catch (e) {
      console.error("Erro ao converter dados para CSV:", e);
      showToast('Erro', 'Erro interno ao formatar dados para CSV.', 'error');
      return '';
  }
  return csv;
}

// --- Funções Auxiliares ---
function getDateRangeForPeriod(period) {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  let startDate = new Date();
  let periodLabel = '';
  switch (period) {
    case 'today': startDate.setHours(0, 0, 0, 0); periodLabel = `Hoje (${formatDate(startDate)})`; break;
    case 'week': startDate.setDate(endDate.getDate() - 7); startDate.setHours(0, 0, 0, 0); periodLabel = `Últimos 7 dias (${formatDate(startDate)} a ${formatDate(endDate)})`; break;
    case 'month': startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, endDate.getDate()); startDate.setHours(0, 0, 0, 0); periodLabel = `Último Mês (${formatDate(startDate)} a ${formatDate(endDate)})`; break;
    case 'quarter': startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 3, endDate.getDate()); startDate.setHours(0, 0, 0, 0); periodLabel = `Último Trimestre (${formatDate(startDate)} a ${formatDate(endDate)})`; break;
    case 'year': startDate = new Date(endDate.getFullYear() - 1, endDate.getMonth(), endDate.getDate()); startDate.setHours(0, 0, 0, 0); periodLabel = `Último Ano (${formatDate(startDate)} a ${formatDate(endDate)})`; break;
    case 'all': default: startDate = new Date(0); periodLabel = 'Todo o Período'; break;
  }
  return { startDate, endDate, periodLabel };
}

function formatDate(date) {
   if (!(date instanceof Date) || isNaN(date)) return 'Inválida';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateFilename(date) {
   if (!(date instanceof Date) || isNaN(date)) date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatCurrency(value) {
  if (typeof value !== 'number' || isNaN(value)) return 'R$ -';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
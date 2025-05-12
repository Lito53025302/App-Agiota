// Reports functionality
import { getFirestore } from './firebase.js';
import { showToast } from './ui.js';

let db;

export function setupReports() {
  db = getFirestore();
  
  // Expose necessary functions globally
  window.openReportModal = openReportModal;
  window.generateReport = generateReport;
  window.exportReport = exportReport;
}

// Function to open report modal
function openReportModal() {
  // Reset report content
  document.getElementById('reportContent').innerHTML = '';
  
  // Show modal
  document.getElementById('reportModal').classList.add('visible');
}

// Function to generate report
async function generateReport() {
  try {
    const reportType = document.getElementById('reportType').value;
    const reportPeriod = document.getElementById('reportPeriod').value;
    
    // Generate report based on type
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
        showToast('Erro', 'Tipo de relatório inválido', 'error');
        break;
    }
    
  } catch (error) {
    console.error('Error generating report:', error);
    showToast('Erro', 'Falha ao gerar relatório', 'error');
  }
}

// Function to generate summary report
async function generateSummaryReport(period) {
  try {
    // Get date range for period
    const { startDate, endDate } = getDateRangeForPeriod(period);
    
    // Initialize counters
    let totalLoaned = 0;
    let totalReceived = 0;
    let totalProfit = 0;
    let totalToReceive = 0;
    let activeLoansCount = 0;
    let paidLoansCount = 0;
    let clientsCount = 0;
    let newClientsCount = 0;
    
    // Load all loans
    const loansSnapshot = await db.collection('loans').get();
    
    // Process each loan
    loansSnapshot.forEach(doc => {
      const loan = doc.data();
      const loanDate = loan.startDate.toDate();
      
      // Check if loan is within period
      if (loanDate >= startDate && loanDate <= endDate) {
        // Add to total loaned
        totalLoaned += loan.amount;
      }
      
      // Count active and paid loans
      if (loan.status === 'active') {
        activeLoansCount++;
        
        // Calculate current debt
        const { totalDebt } = window.calculateRemainingDebt(loan);
        totalToReceive += totalDebt;
      } else if (loan.status === 'paid') {
        paidLoansCount++;
      }
    });
    
    // Load all payments within period
    const paymentsSnapshot = await db.collection('payments')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();
    
    // Process each payment
    paymentsSnapshot.forEach(doc => {
      const payment = doc.data();
      totalReceived += payment.amount;
    });
    
    // Calculate profit (interest received)
    totalProfit = totalReceived - totalLoaned;
    if (totalProfit < 0) totalProfit = 0;
    
    // Load clients
    const clientsSnapshot = await db.collection('clients').get();
    clientsCount = clientsSnapshot.size;
    
    // Count new clients within period
    const newClientsSnapshot = await db.collection('clients')
      .where('createdAt', '>=', startDate)
      .where('createdAt', '<=', endDate)
      .get();
    
    newClientsCount = newClientsSnapshot.size;
    
    // Generate report HTML
    const reportHTML = `
      <div class="report-summary">
        <h3>Relatório de Resumo</h3>
        <p>Período: ${formatDate(startDate)} a ${formatDate(endDate)}</p>
        
        <div class="report-section">
          <h4>Informações Financeiras</h4>
          <table class="report-table">
            <tr>
              <td>Total Emprestado</td>
              <td>${formatCurrency(totalLoaned)}</td>
            </tr>
            <tr>
              <td>Total Recebido</td>
              <td>${formatCurrency(totalReceived)}</td>
            </tr>
            <tr>
              <td>Lucro (Juros)</td>
              <td>${formatCurrency(totalProfit)}</td>
            </tr>
            <tr>
              <td>Valor a Receber</td>
              <td>${formatCurrency(totalToReceive)}</td>
            </tr>
          </table>
        </div>
        
        <div class="report-section">
          <h4>Empréstimos</h4>
          <table class="report-table">
            <tr>
              <td>Empréstimos Ativos</td>
              <td>${activeLoansCount}</td>
            </tr>
            <tr>
              <td>Empréstimos Quitados</td>
              <td>${paidLoansCount}</td>
            </tr>
            <tr>
              <td>Total de Empréstimos</td>
              <td>${activeLoansCount + paidLoansCount}</td>
            </tr>
          </table>
        </div>
        
        <div class="report-section">
          <h4>Clientes</h4>
          <table class="report-table">
            <tr>
              <td>Total de Clientes</td>
              <td>${clientsCount}</td>
            </tr>
            <tr>
              <td>Novos Clientes no Período</td>
              <td>${newClientsCount}</td>
            </tr>
          </table>
        </div>
      </div>
    `;
    
    // Update report content
    document.getElementById('reportContent').innerHTML = reportHTML;
    
    // Store report data for export
    window.currentReportData = {
      reportType: 'summary',
      period: {
        start: formatDate(startDate),
        end: formatDate(endDate)
      },
      financial: {
        totalLoaned,
        totalReceived,
        totalProfit,
        totalToReceive
      },
      loans: {
        active: activeLoansCount,
        paid: paidLoansCount,
        total: activeLoansCount + paidLoansCount
      },
      clients: {
        total: clientsCount,
        new: newClientsCount
      }
    };
    
  } catch (error) {
    console.error('Error generating summary report:', error);
    showToast('Erro', 'Falha ao gerar relatório de resumo', 'error');
  }
}

// Function to generate clients report
async function generateClientsReport(period) {
  try {
    // Get date range for period
    const { startDate, endDate } = getDateRangeForPeriod(period);
    
    // Load all clients
    let clientsQuery = db.collection('clients').orderBy('name');
    
    // Apply date filter if not "all"
    if (period !== 'all') {
      clientsQuery = clientsQuery.where('createdAt', '>=', startDate)
                                 .where('createdAt', '<=', endDate);
    }
    
    const clientsSnapshot = await clientsQuery.get();
    
    // Process clients
    const clients = [];
    
    for (const doc of clientsSnapshot.docs) {
      const client = doc.data();
      client.id = doc.id;
      
      // Check if client has active loan
      if (client.hasLoan) {
        const loanSnapshot = await db.collection('loans')
          .where('clientId', '==', client.id)
          .where('status', '==', 'active')
          .get();
          
        if (!loanSnapshot.empty) {
          const loanDoc = loanSnapshot.docs[0];
          const loan = loanDoc.data();
          
          // Calculate current debt
          const { totalDebt } = window.calculateRemainingDebt(loan);
          client.debt = totalDebt;
        }
      }
      
      clients.push(client);
    }
    
    // Generate report HTML
    let reportHTML = `
      <div class="report-clients">
        <h3>Relatório de Clientes</h3>
        <p>Período: ${formatDate(startDate)} a ${formatDate(endDate)}</p>
        <p>Total de Clientes: ${clients.length}</p>
        
        <table class="report-table full-width">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>CPF</th>
              <th>Data de Cadastro</th>
              <th>Status</th>
              <th>Dívida Atual</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    clients.forEach(client => {
      const createdAt = client.createdAt ? formatDate(client.createdAt.toDate()) : 'N/A';
      const status = client.hasLoan ? 'Com empréstimo' : 'Sem empréstimo';
      const debt = client.debt ? formatCurrency(client.debt) : '-';
      
      reportHTML += `
        <tr>
          <td>${client.name}</td>
          <td>${client.phone || '-'}</td>
          <td>${client.cpf || '-'}</td>
          <td>${createdAt}</td>
          <td>${status}</td>
          <td>${debt}</td>
        </tr>
      `;
    });
    
    reportHTML += `
          </tbody>
        </table>
      </div>
    `;
    
    // Update report content
    document.getElementById('reportContent').innerHTML = reportHTML;
    
    // Store report data for export
    window.currentReportData = {
      reportType: 'clients',
      period: {
        start: formatDate(startDate),
        end: formatDate(endDate)
      },
      clientsCount: clients.length,
      clients: clients.map(client => ({
        name: client.name,
        phone: client.phone || '',
        cpf: client.cpf || '',
        createdAt: client.createdAt ? formatDate(client.createdAt.toDate()) : '',
        hasLoan: client.hasLoan,
        debt: client.debt || 0
      }))
    };
    
  } catch (error) {
    console.error('Error generating clients report:', error);
    showToast('Erro', 'Falha ao gerar relatório de clientes', 'error');
  }
}

// Function to generate loans report
async function generateLoansReport(period) {
  try {
    // Get date range for period
    const { startDate, endDate } = getDateRangeForPeriod(period);
    
    // Load all loans
    let loansQuery = db.collection('loans').orderBy('startDate', 'desc');
    
    // Apply date filter if not "all"
    if (period !== 'all') {
      loansQuery = loansQuery.where('startDate', '>=', startDate)
                             .where('startDate', '<=', endDate);
    }
    
    const loansSnapshot = await loansQuery.get();
    
    // Process loans
    const loans = [];
    const clientNames = {}; // Cache client names
    
    for (const doc of loansSnapshot.docs) {
      const loan = doc.data();
      loan.id = doc.id;
      
      // Get client name if not cached
      if (!clientNames[loan.clientId]) {
        const clientDoc = await db.collection('clients').doc(loan.clientId).get();
        if (clientDoc.exists) {
          clientNames[loan.clientId] = clientDoc.data().name;
        } else {
          clientNames[loan.clientId] = 'Cliente não encontrado';
        }
      }
      
      loan.clientName = clientNames[loan.clientId];
      
      // Calculate current debt for active loans
      if (loan.status === 'active') {
        const { totalDebt } = window.calculateRemainingDebt(loan);
        loan.currentDebt = totalDebt;
      } else {
        loan.currentDebt = 0;
      }
      
      loans.push(loan);
    }
    
    // Calculate totals
    const totalLoaned = loans.reduce((total, loan) => total + loan.amount, 0);
    const totalPaid = loans.reduce((total, loan) => total + (loan.totalPaid || 0), 0);
    const totalDebt = loans.reduce((total, loan) => total + loan.currentDebt, 0);
    
    // Generate report HTML
    let reportHTML = `
      <div class="report-loans">
        <h3>Relatório de Empréstimos</h3>
        <p>Período: ${formatDate(startDate)} a ${formatDate(endDate)}</p>
        <p>Total de Empréstimos: ${loans.length}</p>
        
        <div class="report-summary">
          <table class="report-table">
            <tr>
              <td>Total Emprestado</td>
              <td>${formatCurrency(totalLoaned)}</td>
            </tr>
            <tr>
              <td>Total Pago</td>
              <td>${formatCurrency(totalPaid)}</td>
            </tr>
            <tr>
              <td>Total em Aberto</td>
              <td>${formatCurrency(totalDebt)}</td>
            </tr>
          </table>
        </div>
        
        <table class="report-table full-width">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Valor</th>
              <th>Taxa</th>
              <th>Data</th>
              <th>Status</th>
              <th>Pago</th>
              <th>Em Aberto</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    loans.forEach(loan => {
      const startDate = formatDate(loan.startDate.toDate());
      const status = loan.status === 'active' ? 'Ativo' : 'Quitado';
      const statusClass = loan.status === 'active' ? 'status-active' : 'status-paid';
      
      reportHTML += `
        <tr>
          <td>${loan.clientName}</td>
          <td>${formatCurrency(loan.amount)}</td>
          <td>${loan.interestRate}%</td>
          <td>${startDate}</td>
          <td class="${statusClass}">${status}</td>
          <td>${formatCurrency(loan.totalPaid || 0)}</td>
          <td>${formatCurrency(loan.currentDebt)}</td>
        </tr>
      `;
    });
    
    reportHTML += `
          </tbody>
        </table>
      </div>
    `;
    
    // Update report content
    document.getElementById('reportContent').innerHTML = reportHTML;
    
    // Store report data for export
    window.currentReportData = {
      reportType: 'loans',
      period: {
        start: formatDate(startDate),
        end: formatDate(endDate)
      },
      summary: {
        totalLoaned,
        totalPaid,
        totalDebt,
        count: loans.length
      },
      loans: loans.map(loan => ({
        clientName: loan.clientName,
        amount: loan.amount,
        interestRate: loan.interestRate,
        startDate: formatDate(loan.startDate.toDate()),
        status: loan.status,
        totalPaid: loan.totalPaid || 0,
        currentDebt: loan.currentDebt
      }))
    };
    
  } catch (error) {
    console.error('Error generating loans report:', error);
    showToast('Erro', 'Falha ao gerar relatório de empréstimos', 'error');
  }
}

// Function to generate payments report
async function generatePaymentsReport(period) {
  try {
    // Get date range for period
    const { startDate, endDate } = getDateRangeForPeriod(period);
    
    // Load all payments
    let paymentsQuery = db.collection('payments').orderBy('date', 'desc');
    
    // Apply date filter if not "all"
    if (period !== 'all') {
      paymentsQuery = paymentsQuery.where('date', '>=', startDate)
                                   .where('date', '<=', endDate);
    }
    
    const paymentsSnapshot = await paymentsQuery.get();
    
    // Process payments
    const payments = [];
    const clientNames = {}; // Cache client names
    
    for (const doc of paymentsSnapshot.docs) {
      const payment = doc.data();
      payment.id = doc.id;
      
      // Get client name if not cached
      if (!clientNames[payment.clientId]) {
        const clientDoc = await db.collection('clients').doc(payment.clientId).get();
        if (clientDoc.exists) {
          clientNames[payment.clientId] = clientDoc.data().name;
        } else {
          clientNames[payment.clientId] = 'Cliente não encontrado';
        }
      }
      
      payment.clientName = clientNames[payment.clientId];
      payments.push(payment);
    }
    
    // Calculate total
    const totalAmount = payments.reduce((total, payment) => total + payment.amount, 0);
    
    // Generate report HTML
    let reportHTML = `
      <div class="report-payments">
        <h3>Relatório de Pagamentos</h3>
        <p>Período: ${formatDate(startDate)} a ${formatDate(endDate)}</p>
        <p>Total de Pagamentos: ${payments.length}</p>
        <p>Valor Total: ${formatCurrency(totalAmount)}</p>
        
        <table class="report-table full-width">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Data</th>
              <th>Valor</th>
              <th>Observações</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    payments.forEach(payment => {
      const paymentDate = formatDate(payment.date.toDate());
      
      reportHTML += `
        <tr>
          <td>${payment.clientName}</td>
          <td>${paymentDate}</td>
          <td>${formatCurrency(payment.amount)}</td>
          <td>${payment.notes || '-'}</td>
        </tr>
      `;
    });
    
    reportHTML += `
          </tbody>
        </table>
      </div>
    `;
    
    // Update report content
    document.getElementById('reportContent').innerHTML = reportHTML;
    
    // Store report data for export
    window.currentReportData = {
      reportType: 'payments',
      period: {
        start: formatDate(startDate),
        end: formatDate(endDate)
      },
      summary: {
        totalAmount,
        count: payments.length
      },
      payments: payments.map(payment => ({
        clientName: payment.clientName,
        date: formatDate(payment.date.toDate()),
        amount: payment.amount,
        notes: payment.notes || ''
      }))
    };
    
  } catch (error) {
    console.error('Error generating payments report:', error);
    showToast('Erro', 'Falha ao gerar relatório de pagamentos', 'error');
  }
}

// Function to export report data
function exportReport(format) {
  try {
    if (!window.currentReportData) {
      showToast('Erro', 'Nenhum relatório para exportar', 'error');
      return;
    }
    
    let data;
    let filename;
    let contentType;
    
    // Format data based on export type
    if (format === 'csv') {
      data = convertToCSV(window.currentReportData);
      filename = `relatorio_${window.currentReportData.reportType}_${formatDateFilename(new Date())}.csv`;
      contentType = 'text/csv';
    } else {
      data = JSON.stringify(window.currentReportData, null, 2);
      filename = `relatorio_${window.currentReportData.reportType}_${formatDateFilename(new Date())}.json`;
      contentType = 'application/json';
    }
    
    // Create download link
    const blob = new Blob([data], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Sucesso', 'Relatório exportado com sucesso!', 'success');
    
  } catch (error) {
    console.error('Error exporting report:', error);
    showToast('Erro', 'Falha ao exportar relatório', 'error');
  }
}

// Function to convert report data to CSV
function convertToCSV(reportData) {
  let csv = '';
  
  // Generate CSV based on report type
  switch (reportData.reportType) {
    case 'summary':
      csv = 'Categoria,Item,Valor\n';
      
      // Financial data
      csv += `Financeiro,Total Emprestado,${reportData.financial.totalLoaned}\n`;
      csv += `Financeiro,Total Recebido,${reportData.financial.totalReceived}\n`;
      csv += `Financeiro,Lucro (Juros),${reportData.financial.totalProfit}\n`;
      csv += `Financeiro,Valor a Receber,${reportData.financial.totalToReceive}\n`;
      
      // Loans data
      csv += `Empréstimos,Empréstimos Ativos,${reportData.loans.active}\n`;
      csv += `Empréstimos,Empréstimos Quitados,${reportData.loans.paid}\n`;
      csv += `Empréstimos,Total de Empréstimos,${reportData.loans.total}\n`;
      
      // Clients data
      csv += `Clientes,Total de Clientes,${reportData.clients.total}\n`;
      csv += `Clientes,Novos Clientes no Período,${reportData.clients.new}\n`;
      break;
      
    case 'clients':
      csv = 'Nome,Telefone,CPF,Data de Cadastro,Status,Dívida Atual\n';
      
      reportData.clients.forEach(client => {
        const status = client.hasLoan ? 'Com empréstimo' : 'Sem empréstimo';
        csv += `"${client.name}","${client.phone}","${client.cpf}","${client.createdAt}","${status}",${client.debt}\n`;
      });
      break;
      
    case 'loans':
      csv = 'Cliente,Valor,Taxa de Juros,Data,Status,Total Pago,Em Aberto\n';
      
      reportData.loans.forEach(loan => {
        const status = loan.status === 'active' ? 'Ativo' : 'Quitado';
        csv += `"${loan.clientName}",${loan.amount},${loan.interestRate},"${loan.startDate}","${status}",${loan.totalPaid},${loan.currentDebt}\n`;
      });
      break;
      
    case 'payments':
      csv = 'Cliente,Data,Valor,Observações\n';
      
      reportData.payments.forEach(payment => {
        csv += `"${payment.clientName}","${payment.date}",${payment.amount},"${payment.notes}"\n`;
      });
      break;
  }
  
  return csv;
}

// Helper function to get date range for period
function getDateRangeForPeriod(period) {
  const endDate = new Date();
  let startDate = new Date();
  
  switch (period) {
    case 'month':
      startDate.setMonth(endDate.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(endDate.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(endDate.getFullYear() - 1);
      break;
    case 'all':
    default:
      startDate = new Date(0); // Beginning of time
      break;
  }
  
  return { startDate, endDate };
}

// Helper function to format date
function formatDate(date) {
  return date.toLocaleDateString('pt-BR');
}

// Helper function to format date for filenames
function formatDateFilename(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// Helper function to format currency
function formatCurrency(value) {
  return `R$ ${value.toFixed(2)}`;
}
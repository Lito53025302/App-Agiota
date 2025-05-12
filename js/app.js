// Main application file
import { initializeFirebase, setupAuth } from './firebase.js';
import { setupClientManagement } from './clients.js';
import { setupLoanManagement } from './loans.js';
import { setupPaymentManagement } from './payments.js';
import { setupDashboard } from './dashboard.js';
import { setupReports } from './reports.js';
import { showToast, setupScreenTransitions, setActiveScreen } from './ui.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  initApp();
});

async function initApp() {
  // Initialize Firebase
  try {
    initializeFirebase();
    
    // Setup module interactions
    setupAuth({
      onLogin: showHomeScreen,
      onLogout: showLoginScreen
    });
    
    setupScreenTransitions();
    setupEventListeners();
    
    // Show login screen if not authenticated
    if (!window.isUserLoggedIn()) {
      setActiveScreen('loginScreen');
    } else {
      showHomeScreen();
    }
  } 
  catch (error) {
    console.error('Error initializing app:', error);
    showToast('Erro', 'Falha ao inicializar o aplicativo. Tente novamente.', 'error');
  }
}

function showHomeScreen() {
  setActiveScreen('homeScreen');
  setupDashboard();
  setupClientManagement();
  setupLoanManagement();
  setupPaymentManagement();
  setupReports();
  
  // Load and display due payments
  loadDuePayments();
}

function showLoginScreen() {
  setActiveScreen('loginScreen');
}

function setupEventListeners() {
  // Login form submission
  document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const tokenInput = document.getElementById('tokenInput');
    const token = tokenInput.value.trim();
    
    if (token) {
      // Will be handled by auth module
      window.checkToken(token);
    } else {
      showToast('Atenção', 'Digite o token de acesso', 'warning');
    }
  });
  
  // Home screen buttons
  document.getElementById('newClientButton').addEventListener('click', () => {
    setActiveScreen('registerScreen');
  });
  
  document.getElementById('allClientsButton').addEventListener('click', () => {
    setActiveScreen('clientsScreen');
    window.loadAllClients();
  });
  
  document.getElementById('searchButton').addEventListener('click', () => {
    const searchTerm = document.getElementById('clientSearch').value.trim();
    if (searchTerm) {
      window.searchClient(searchTerm);
    } else {
      showToast('Atenção', 'Digite um termo para busca', 'info');
    }
  });
  
  // Client search on enter
  document.getElementById('clientSearch').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('searchButton').click();
    }
  });
  
  // Back buttons
  document.getElementById('backFromClientsButton').addEventListener('click', () => {
    setActiveScreen('homeScreen');
  });
  
  document.getElementById('backFromRegisterButton').addEventListener('click', () => {
    setActiveScreen('homeScreen');
  });
  
  document.getElementById('backFromProfileButton').addEventListener('click', () => {
    setActiveScreen('homeScreen');
  });
  
  // Register screen
  document.getElementById('formRegister').addEventListener('submit', (e) => {
    e.preventDefault();
    window.registerClient();
  });
  
  document.getElementById('cancelRegisterButton').addEventListener('click', () => {
    setActiveScreen('homeScreen');
  });
  
  // Photo upload handling
  document.getElementById('choosePhotoButton').addEventListener('click', () => {
    document.getElementById('photo').click();
  });
  
  document.getElementById('photo').addEventListener('change', (e) => {
    window.updatePhotoPreview(e);
  });
  
  document.getElementById('photoPlaceholder').addEventListener('click', () => {
    document.getElementById('photo').click();
  });
  
  // Client profile actions
  document.getElementById('editClientButton').addEventListener('click', () => {
    window.editProfile();
  });
  
  document.getElementById('addLoanButton').addEventListener('click', () => {
    window.addLoan();
  });
  
  document.getElementById('chargeButton').addEventListener('click', () => {
    window.chargeDebt();
  });
  
  document.getElementById('paymentButton').addEventListener('click', () => {
    // Open payment modal
    window.openPaymentModal();
  });
  
  document.getElementById('historyButton').addEventListener('click', () => {
    window.showPayments();
  });
  
  document.getElementById('deleteClientButton').addEventListener('click', () => {
    window.confirmDeleteClient();
  });
  
  // Modal close buttons
  document.querySelectorAll('.close-button').forEach(button => {
    button.addEventListener('click', function() {
      const modalId = this.closest('.modal').id;
      window.closeModal(modalId);
    });
  });
  
  // Payment modal
  document.getElementById('confirmPaymentButton').addEventListener('click', () => {
    window.confirmPayment();
  });
  
  document.getElementById('cancelPaymentButton').addEventListener('click', () => {
    window.closeModal('paymentModal');
  });
  
  // Receipt modal
  document.getElementById('shareReceiptButton').addEventListener('click', () => {
    window.shareReceipt();
  });
  
  document.getElementById('copyReceiptButton').addEventListener('click', () => {
    window.copyReceiptText();
  });
  
  // Report modal
  document.getElementById('reportButton').addEventListener('click', () => {
    window.openReportModal();
  });
  
  document.getElementById('generateReportButton').addEventListener('click', () => {
    window.generateReport();
  });
  
  document.getElementById('exportCsvButton').addEventListener('click', () => {
    window.exportReport('csv');
  });
  
  document.getElementById('exportJsonButton').addEventListener('click', () => {
    window.exportReport('json');
  });
  
  // Confirmation modal
  document.getElementById('confirmButton').addEventListener('click', () => {
    if (window.pendingConfirmation && typeof window.pendingConfirmation.onConfirm === 'function') {
      window.pendingConfirmation.onConfirm();
    }
    window.closeModal('confirmationModal');
  });
  
  document.getElementById('cancelConfirmButton').addEventListener('click', () => {
    if (window.pendingConfirmation && typeof window.pendingConfirmation.onCancel === 'function') {
      window.pendingConfirmation.onCancel();
    }
    window.closeModal('confirmationModal');
  });
  
  // Logout
  document.getElementById('logoutButton').addEventListener('click', () => {
    window.showConfirmation(
      'Sair do Sistema', 
      'Tem certeza que deseja sair?',
      () => window.logout(),
      null
    );
  });
}

function loadDuePayments() {
  // This will be populated by the payments module
  window.loadDuePayments();
}
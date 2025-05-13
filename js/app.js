// Main application file

// Importa as funções corretas de firebase.js (versão CDN/Compat)
// CORRIGIDO: Adicionado checkToken e logout
import { initializeFirebase, getAuthInstance, getDbInstance, getStorageInstance, checkToken, logout } from './firebase.js';
import { setupClientManagement } from './clients.js';
import { setupLoanManagement } from './loans.js';
import { setupDashboard, loadDuePayments, updateDashboardData } from './dashboard.js';
import { showToast, setupScreenTransitions, setActiveScreen, showConfirmation, closeModal } from './ui.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    try {
        // Inicializa o Firebase e aguarda
        const firebaseServices = await initializeFirebase();
        
        // Verifica se a inicialização foi bem-sucedida
        if (!firebaseServices) {
            console.error("Falha crítica na inicialização do Firebase. App não pode continuar.");
            showToast('Erro Crítico', 'Falha ao conectar com os serviços. Tente recarregar.', 'error');
            return;
        }

        // Configura os módulos APÓS o Firebase estar pronto
        setupClientManagement();
        setupScreenTransitions();
        setupEventListeners();

        // Verifica autenticação
        const auth = getAuthInstance();
        if (auth && auth.currentUser) {
            console.log("Usuário já logado, mostrando home screen.");
            showHomeScreen();
        } else {
            console.log("Nenhum usuário logado, mostrando login screen.");
            setActiveScreen('loginScreen');
        }

    } catch (error) {
        console.error('Erro inicializando o app:', error);
        showToast('Erro', 'Falha ao inicializar o aplicativo. Verifique o console.', 'error');
    }
}

function showHomeScreen() {
    setActiveScreen('homeScreen');

    if (typeof setupDashboard === 'function') {
        setupDashboard();
    }
    if (typeof updateDashboardData === 'function') {
        updateDashboardData();
    }
    if (typeof loadDuePayments === 'function') {
        loadDuePayments();
    }
}

function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tokenInput = document.getElementById('tokenInput');
            const token = tokenInput ? tokenInput.value.trim() : '';

            if (token) {
                try {
                    const loggedIn = await checkToken(token);
                    if (loggedIn) {
                        showToast('Sucesso', 'Login realizado com sucesso!', 'success');
                        showHomeScreen();
                    } else {
                        showToast('Erro', 'Token inválido. Tente novamente.', 'error');
                    }
                } catch (error) {
                    console.error("Erro durante o login:", error);
                    showToast('Erro', 'Falha ao fazer login.', 'error');
                }
            } else {
                showToast('Atenção', 'Digite o token de acesso', 'warning');
            }
        });
    }

    // Botão Novo Cliente
    const newClientButton = document.getElementById('newClientButton');
    if (newClientButton) {
        newClientButton.addEventListener('click', () => {
            setActiveScreen('registerScreen');
        });
    }

    // Botão Todos os Clientes
    const allClientsButton = document.getElementById('allClientsButton');
    if (allClientsButton) {
        allClientsButton.addEventListener('click', () => {
            setActiveScreen('clientsScreen');
            if (typeof window.loadAllClients === 'function') {
                window.loadAllClients();
            }
        });
    }

    // Busca de Clientes
    const searchButton = document.getElementById('searchButton');
    const clientSearchInput = document.getElementById('clientSearch');
    if (searchButton && clientSearchInput) {
        const performSearch = () => {
            const searchTerm = clientSearchInput.value.trim();
            if (searchTerm && typeof window.searchClient === 'function') {
                window.searchClient(searchTerm);
            } else if (!searchTerm) {
                showToast('Atenção', 'Digite um termo para busca', 'info');
            }
        };
        searchButton.addEventListener('click', performSearch);
        clientSearchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') performSearch();
        });
    }

    // Botões de Voltar
    const backButtons = {
        'backFromClientsButton': 'homeScreen',
        'backFromRegisterButton': 'homeScreen',
        'backFromProfileButton': 'clientsScreen'
    };
    Object.entries(backButtons).forEach(([id, screen]) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                setActiveScreen(screen);
                if (screen === 'clientsScreen' && typeof window.loadAllClients === 'function') {
                    window.loadAllClients();
                }
            });
        }
    });

    // Botão de Logout
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            showConfirmation(
                'Sair do Sistema',
                'Tem certeza que deseja sair?',
                async () => {
                    try {
                        const loggedOut = await logout();
                        if (loggedOut) {
                            showToast('Sucesso', 'Logout realizado com sucesso!', 'success');
                            setActiveScreen('loginScreen');
                        }
                    } catch (error) {
                        console.error("Erro ao fazer logout:", error);
                        showToast('Erro', 'Não foi possível sair.', 'error');
                    }
                }
            );
        });
    }

    // Fechar modais
    document.querySelectorAll('.modal .close-button').forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal && modal.id) closeModal(modal.id);
        });
    });

    // Botão de Relatório
    const reportButton = document.getElementById('reportButton');
    if (reportButton) {
        reportButton.addEventListener('click', () => {
            if (typeof window.openReportModal === 'function') {
                window.openReportModal();
            }
        });
    }
}
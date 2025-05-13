
// UI utility functions
import { getAuthInstance } from './firebase.js';

let auth = null; // Declarar variável para instância de Auth

/**
 * Displays a toast notification.
 * @param {string} title - The title of the toast.
 * @param {string} message - The main message of the toast.
 * @param {'info' | 'success' | 'warning' | 'error'} [type='info'] - The type of toast, affects icon and color.
 */
export function showToast(title, message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) {
    console.error('Elemento #toastContainer não encontrado no DOM. Não é possível exibir o toast.');
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');

  toast.innerHTML = `
    <div class="toast-icon" aria-hidden="true">
      <span class="material-icons">${getIconForToastType(type)}</span>
    </div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" aria-label="Fechar notificação">
      <span class="material-icons" aria-hidden="true">close</span>
    </button>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
      toast.classList.add('visible');
  });

  const closeButton = toast.querySelector('.toast-close');
  if (closeButton) {
      closeButton.addEventListener('click', () => closeToast(toast));
  }

  const autoCloseTimeout = setTimeout(() => closeToast(toast), 5000);

  toast.addEventListener('mouseenter', () => clearTimeout(autoCloseTimeout));
  toast.addEventListener('mouseleave', () => setTimeout(() => closeToast(toast), 3000));
}

/**
 * Closes and removes a specific toast element with animation.
 * @param {HTMLElement} toast - The toast element to close.
 */
function closeToast(toast) {
  if (!toast || !toast.classList.contains('visible')) return;

  toast.classList.remove('visible');
  toast.setAttribute('aria-hidden', 'true');

  toast.addEventListener('transitionend', () => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, { once: true });

   setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
   }, 500);
}

/**
 * Returns the Material Icons name based on the toast type.
 * @param {string} type - The toast type ('success', 'error', 'warning', 'info').
 * @returns {string} The Material Icons name.
 */
function getIconForToastType(type) {
  switch (type) {
    case 'success': return 'check_circle';
    case 'error': return 'error';
    case 'warning': return 'warning';
    case 'info': default: return 'info';
  }
}

// --- Gerenciamento de Telas e Modais ---

/**
 * Sets up global functions for screen transitions and confirmation dialogs.
 */
export function setupScreenTransitions() {
  // Inicializar auth após Firebase estar pronto
  auth = getAuthInstance();
  if (!auth) {
    console.error("Falha ao obter Auth em setupScreenTransitions.");
  }

  const confirmBtn = document.getElementById('confirmActionBtn');
  const cancelBtn = document.getElementById('cancelActionBtn');
  const closeModalBtn = document.getElementById('closeConfirmationModal');

  if (confirmBtn) {
      confirmBtn.addEventListener('click', handleConfirmationConfirm);
  } else {
      console.error("Botão de confirmação (#confirmActionBtn) não encontrado.");
  }

  if (cancelBtn) {
      cancelBtn.addEventListener('click', handleConfirmationCancel);
  } else {
      console.error("Botão de cancelar (#cancelActionBtn) não encontrado.");
  }

   if (closeModalBtn) {
      // Usa a nova função closeModal genérica
      closeModalBtn.addEventListener('click', () => closeModal('confirmationModal'));
   } else {
      console.warn("Botão de fechar modal (#closeConfirmationModal) não encontrado.");
   }

  console.log("Transições de tela e modal de confirmação configurados.");
}

/**
 * Hides all elements with the class 'screen' and shows the one with the specified ID.
 * @param {string} screenId - The ID of the screen element to make visible.
 */
export function setActiveScreen(screenId) {
  console.log(`Navegando para a tela: ${screenId}`);
  const screens = document.querySelectorAll('.screen');
  screens.forEach(screen => {
    screen.classList.remove('visible');
    screen.setAttribute('aria-hidden', 'true');
  });

  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('visible');
    targetScreen.removeAttribute('aria-hidden');
  } else {
    console.error(`Tela com ID "${screenId}" não encontrada!`);
  }
}

/**
 * Shows a confirmation modal dialog.
 * @param {string} title - The title of the confirmation dialog.
 * @param {string} message - The message/question for the user.
 * @param {function} onConfirm - Callback function to execute if the user confirms.
 * @param {function | null} [onCancel=null] - Callback function to execute if the user cancels.
 */
export function showConfirmation(title, message, onConfirm, onCancel = null) {
  const modal = document.getElementById('confirmationModal');
  const titleEl = document.getElementById('confirmationTitle');
  const messageEl = document.getElementById('confirmationMessage');

  if (!modal || !titleEl || !messageEl) {
      console.error("Elementos do modal de confirmação não encontrados.");
      if (confirm(`${title}\n\n${message}`)) {
          if (typeof onConfirm === 'function') onConfirm();
      } else {
          if (typeof onCancel === 'function') onCancel();
      }
      return;
  }

  titleEl.textContent = title;
  messageEl.textContent = message;

  modal._pendingConfirmation = {
    onConfirm: typeof onConfirm === 'function' ? onConfirm : () => {},
    onCancel: typeof onCancel === 'function' ? onCancel : () => {}
  };

  modal.classList.add('visible');
  modal.setAttribute('aria-hidden', 'false');

  const confirmBtn = document.getElementById('confirmActionBtn');
  if (confirmBtn) confirmBtn.focus();
}

/**
 * Handles the click on the confirmation button of the modal.
 */
function handleConfirmationConfirm() {
    const modal = document.getElementById('confirmationModal');
    if (modal && modal._pendingConfirmation && typeof modal._pendingConfirmation.onConfirm === 'function') {
        modal._pendingConfirmation.onConfirm();
    }
    closeModal('confirmationModal'); // Usa a nova função genérica
}

/**
 * Handles the click on the cancel button of the modal.
 */
function handleConfirmationCancel() {
    const modal = document.getElementById('confirmationModal');
     if (modal && modal._pendingConfirmation && typeof modal._pendingConfirmation.onCancel === 'function') {
        modal._pendingConfirmation.onCancel();
    }
    closeModal('confirmationModal'); // Usa a nova função genérica
}

/**
 * Hides a modal dialog given its ID.
 * @param {string} modalId - The ID of the modal element to hide.
 */
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
    // Limpa callbacks do modal de confirmação se for ele
    if (modalId === 'confirmationModal') {
        delete modal._pendingConfirmation;
    }
    // Adicionar limpeza para outros modais se necessário (ex: limpar formulários)
  } else {
    console.warn(`Modal com ID "${modalId}" não encontrado ao tentar fechar.`);
  }
}

/**
 * Shows a modal dialog given its ID.
 * @param {string} modalId - The ID of the modal element to show.
 */
export function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
    const focusable = modal.querySelector('input, button, textarea, select');
    if (focusable) focusable.focus();
  } else {
    console.error(`Modal com ID "${modalId}" não encontrado.`);
  }
}
// UI utility functions
export function showToast(title, message, type = 'info') {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Set content
  toast.innerHTML = `
    <div class="toast-icon">
      <span class="material-icons">
        ${getIconForToastType(type)}
      </span>
    </div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close">
      <span class="material-icons">close</span>
    </button>
  `;
  
  // Add to container
  const container = document.getElementById('toastContainer');
  container.appendChild(toast);
  
  // Show toast with animation
  setTimeout(() => {
    toast.classList.add('visible');
  }, 10);
  
  // Add close event
  const closeButton = toast.querySelector('.toast-close');
  closeButton.addEventListener('click', () => {
    closeToast(toast);
  });
  
  // Auto close after delay
  setTimeout(() => {
    closeToast(toast);
  }, 5000);
}

// Helper to close toast
function closeToast(toast) {
  toast.classList.remove('visible');
  
  // Remove from DOM after animation
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 300);
}

// Helper to get icon for toast type
function getIconForToastType(type) {
  switch (type) {
    case 'success':
      return 'check_circle';
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
    default:
      return 'info';
  }
}

// Function to setup screen transitions
export function setupScreenTransitions() {
  // Expose the setActiveScreen function globally
  window.setActiveScreen = setActiveScreen;
  window.showConfirmation = showConfirmation;
}

// Function to set active screen
export function setActiveScreen(screenId) {
  // Hide all screens
  const screens = document.querySelectorAll('.screen');
  screens.forEach(screen => {
    screen.classList.remove('visible');
  });
  
  // Show target screen
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('visible');
  }
}

// Function to show confirmation dialog
export function showConfirmation(title, message, onConfirm, onCancel) {
  // Set confirmation title and message
  document.getElementById('confirmationTitle').textContent = title;
  document.getElementById('confirmationMessage').textContent = message;
  
  // Store callbacks
  window.pendingConfirmation = {
    onConfirm,
    onCancel
  };
  
  // Show modal
  document.getElementById('confirmationModal').classList.add('visible');
}
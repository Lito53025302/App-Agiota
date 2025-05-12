// Firebase configuration and initialization

import { initializeApp }           from 'firebase/app';
import { initializeFirestore }    from 'firebase/firestore';
import { getAuth as firebaseGetAuth }       from 'firebase/auth';
import { getStorage as firebaseGetStorage } from 'firebase/storage';

let firebaseApp;
let auth;
let db;
let storage;

export function initializeFirebase() {
  // If Firebase is already initialized, return the existing instances
  if (firebaseApp) {
    return { auth, db, storage };
  }

 // Configuração Firebase (remova se já inicializou em outro arquivo)
const firebaseConfig = {
  apiKey: 'AIzaSyBBAbq0_GYTPQkKlOEX3MJp9Vzj3ZzyJ6I',
  authDomain: 'app-facil-87595.firebaseapp.com',
  projectId: 'app-facil-87595',
  storageBucket: 'app-facil-87595.appspot.com',
  messagingSenderId: '775213961118',
  appId: '1:775213961118:web:9ee69152052367b5e1d08f',
  measurementId: 'G-WXKQRJY766'
};

  // Inicializa via compat
  firebaseApp = initializeApp(firebaseConfig);
  auth        = firebaseGetAuth(firebaseApp);
  db          = initializeFirestore(firebaseApp, {
                   cache: { persistent: true }
                 });
  storage     = firebaseGetStorage(firebaseApp);
  
  return { auth, db, storage };
}

export function setupAuth({ onLogin, onLogout }) {
  // For this application, we use a custom token-based auth
  // This is a simplified version that would need to be enhanced for production
  
  // Token validation function
  window.checkToken = function(token) {
    // In a real app, we would validate the token with a secure backend
    // For this demo, we'll use a simple hardcoded token
    const validToken = "admin123"; // This should be stored securely in a real app
    
    if (token === validToken) {
      // Simulate a login
      localStorage.setItem('userToken', token);
      
      // Show success message and call onLogin callback
      if (typeof window.showToast === 'function') {
        window.showToast('Sucesso', 'Login realizado com sucesso!', 'success');
      }
      
      if (typeof onLogin === 'function') {
        onLogin();
      }
    } else {
      if (typeof window.showToast === 'function') {
        window.showToast('Erro', 'Token inválido. Tente novamente.', 'error');
      }
    }
  };
  
  // Logout function
  window.logout = function() {
    // Clear the stored token
    localStorage.removeItem('userToken');
    
    // Show logout message and call onLogout callback
    if (typeof window.showToast === 'function') {
      window.showToast('Sucesso', 'Logout realizado com sucesso!', 'success');
    }
    
    if (typeof onLogout === 'function') {
      onLogout();
    }
  };
  
  // Check if user is already logged in
  window.isUserLoggedIn = function() {
    return localStorage.getItem('userToken') !== null;
  };
}

// Export additional required functions
export function getFirebaseApp() {
  return firebaseApp;
}

// Export functions
export function getAuth() {
  return auth;
}

export function getFirestore() {
  return db;
}

export function getStorage() {
  return storage;
}
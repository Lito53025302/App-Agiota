// firebase.js - Versão para usar com Scripts CDN (Compat Mode)
// Modificado para inicialização robusta com Promise

// Variáveis de instância no escopo do módulo
let firebaseAppInstance;
let authInstance;
let dbInstance;
let storageInstance;

// Flag para garantir inicialização única
let firebaseInitialized = false;

// Token de acesso (mantido conforme seu código)
const validToken = "5302";

// --- Função de Inicialização Principal (Retorna Promise) ---
export function initializeFirebase() {
  return new Promise((resolve, reject) => {
    // Se já inicializado, resolve imediatamente com as instâncias existentes
    if (firebaseInitialized) {
      console.log("[Firebase] Já inicializado.");
      resolve({ app: firebaseAppInstance, auth: authInstance, db: dbInstance, storage: storageInstance });
      return;
    }

    // Verifica se o SDK global do Firebase está carregado
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
      const errorMsg = "[Firebase] ERRO CRÍTICO: SDK do Firebase (compat) não parece estar carregado ou completo. Verifique as tags <script> no index.html.";
      console.error(errorMsg);
      // alert(errorMsg); // Alert pode ser muito intrusivo aqui, console.error é melhor
      reject(new Error(errorMsg)); // Rejeita a promessa
      return;
    }

    // Configuração do Firebase (mantida conforme seu código)
    const firebaseConfig = {
      apiKey: "AIzaSyBBAbq0_GYTPQkKlOEX3MJp9Vzj3ZzyJ6I", // Verifique esta chave
      authDomain: "app-facil-87595.firebaseapp.com",
      projectId: "app-facil-87595",
      storageBucket: "app-facil-87595.appspot.com",
      messagingSenderId: "775213961118",
      appId: "1:775213961118:web:9ee69152052367b5e1d08f",
      measurementId: "G-WXKQRJY766"
    };

    try {
      console.log("[Firebase] Tentando inicializar Firebase com config:", firebaseConfig);
      firebaseAppInstance = firebase.initializeApp(firebaseConfig);
      console.log("[Firebase] App inicializado.");

      authInstance = firebase.auth(firebaseAppInstance); // Usando API compat
      console.log("[Firebase] Auth inicializado.");

      dbInstance = firebase.firestore(firebaseAppInstance); // Usando API compat
      console.log("[Firebase] Firestore inicializado.");

      storageInstance = firebase.storage(firebaseAppInstance); // Usando API compat
      console.log("[Firebase] Storage inicializado.");

      // Marca como inicializado ANTES de tentar a persistência (que é secundária)
      firebaseInitialized = true;
      console.log("[Firebase] Firebase inicializado com sucesso (instâncias prontas).");

      // Resolve a promessa AGORA, permitindo que app.js continue.
      // A persistência será habilitada em segundo plano.
      resolve({ app: firebaseAppInstance, auth: authInstance, db: dbInstance, storage: storageInstance });

      // Tenta habilitar a persistência do Firestore (assincronamente, não bloqueia a resolução)
      console.log("[Firebase] Tentando habilitar persistência do Firestore em segundo plano...");
      dbInstance.enablePersistence()
        .then(() => {
          console.log("[Firebase] Persistência do Firestore habilitada com sucesso (modo compat).");
        })
        .catch((err) => {
          if (err.code == 'failed-precondition') {
            console.warn('[Firebase] Falha ao habilitar persistência (compat): Múltiplas abas abertas?');
          } else if (err.code == 'unimplemented') {
            console.warn('[Firebase] Falha ao habilitar persistência (compat): Navegador não suporta.');
          } else {
            console.error("[Firebase] Erro ao habilitar persistência (compat): ", err);
          }
        });

    } catch (error) {
      console.error("[Firebase] ERRO CRÍTICO durante a inicialização do Firebase:", error);
      // alert("Erro grave ao inicializar o Firebase. Verifique o console para detalhes."); // Evitar alert se possível
      firebaseInitialized = false; // Reseta o flag em caso de erro
      reject(error); // Rejeita a promessa com o erro
    }
  });
}

// --- Funções de Autenticação (Token + Anônimo) ---

// Função EXPORTADA para verificar o token e fazer login anônimo
export async function checkToken(inputToken) {
  if (!firebaseInitialized || !authInstance) {
    console.error("[Firebase] Auth não inicializado ou Firebase não pronto. Chame e aguarde initializeFirebase() primeiro.");
    alert("Erro: Serviço de autenticação não está pronto."); // Mantido do seu código
    return false;
  }

  if (inputToken === validToken) {
    try {
      // Se já houver um usuário Firebase logado (mesmo anônimo),
      // não precisamos fazer login novamente, apenas validar o token.
      if (authInstance.currentUser) {
        console.log("[Firebase] Token válido. Usuário Firebase já existe:", authInstance.currentUser.uid);
        return true;
      } else {
        // Se não há usuário Firebase, tenta login anônimo
        console.log("[Firebase] Token válido. Tentando login anônimo...");
        await authInstance.signInAnonymously();
        console.log("[Firebase] Login anônimo realizado com sucesso após validação do token.");
        return true;
      }
    } catch (error) {
      console.error("[Firebase] Erro ao tentar fazer login anônimo:", error);
      alert("Erro ao tentar autenticar anonimamente."); // Mantido do seu código
      return false;
    }
  } else {
    // Token inválido
    console.warn("[Firebase] Token de acesso inválido fornecido.");
    return false;
  }
}

// Função EXPORTADA para fazer logout
export async function logout() {
  if (!firebaseInitialized || !authInstance) {
    console.error("[Firebase] Auth não inicializado ou Firebase não pronto para logout.");
    alert("Erro: Serviço de autenticação não está pronto para logout."); // Mantido do seu código
    return false;
  }
  try {
    await authInstance.signOut();
    console.log("[Firebase] Logout do Firebase realizado com sucesso.");
    return true;
  } catch (error) {
    console.error("[Firebase] Erro ao fazer logout:", error);
    alert("Erro ao tentar fazer logout."); // Mantido do seu código
    return false;
  }
}

// --- Funções Getter para Instâncias ---
// Estas funções devem ser chamadas APÓS initializeFirebase() ter resolvido com sucesso.

export function getAppInstance() {
  if (!firebaseInitialized) console.warn("[Firebase] getAppInstance chamado antes da inicialização completa.");
  return firebaseAppInstance;
}

export function getAuthInstance() {
  if (!firebaseInitialized) console.warn("[Firebase] getAuthInstance chamado antes da inicialização completa.");
  return authInstance;
}

export function getDbInstance() {
  if (!firebaseInitialized) console.warn("[Firebase] getDbInstance chamado antes da inicialização completa.");
  return dbInstance;
}

export function getStorageInstance() {
  if (!firebaseInitialized) console.warn("[Firebase] getStorageInstance chamado antes da inicialização completa.");
  return storageInstance;
}

// REMOVIDO: As linhas abaixo importavam a API modular (v9+) que conflita
// com o uso da API namespaced/compat (v8) no restante do arquivo.
// import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
// ... etc ...
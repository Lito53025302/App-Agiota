// Client management functionality

// Importa as funções corretas de firebase.js (versão CDN/Compat)
import { getDbInstance, getStorageInstance, getAuthInstance } from './firebase.js';
import { showToast, showModal, closeModal, setActiveScreen } from './ui.js';
import { addLoan } from './dashboard.js';

// Função para formatar moeda (se já não tiver)
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

// Variáveis globais do módulo (só declaradas, não inicializadas)
let db;
let storage;
let auth;
let currentClient = null;
let clientsListener = null;

// Função chamada por app.js para inicializar este módulo
export function setupClientManagement() {
  console.log("DEBUG: setupClientManagement iniciado");
  try {
    console.log("DEBUG: obtendo instâncias do Firebase");
    // OBTÉM AS INSTÂNCIAS AQUI, APÓS FIREBASE SER INICIALIZADO PELO APP.JS
    db = getDbInstance();
    storage = getStorageInstance();
    console.log("DEBUG: instâncias obtidas, db =", db, ", storage =", storage);

    if (!db) {
      console.error("Falha ao obter instância do Firestore em clients.js.");
      showToast('Erro Crítico', 'Falha ao conectar com banco de dados (Clientes).', 'error');
      return;
    }
    if (!storage) { // Verifica se storage foi obtido com sucesso
        console.error("Falha ao obter instância do Storage em clients.js. O módulo pode não funcionar.");
        showToast('Erro Crítico', 'Falha ao conectar com o armazenamento (Clientes).', 'error');
        // Não necessariamente retorna, pois algumas funções podem funcionar sem storage
    }
    // if (!auth && SE_PRECISAR_DE_AUTH) { ... }


    console.log("DEBUG: expondo funções de cliente no window");
    // Expõe funções necessárias para outras partes do app via objeto window
    // (Mantendo a estrutura original do seu código - idealmente, exportar e importar)
    window.registerClient = registerClient;
    window.updatePhotoPreview = updatePhotoPreview;
    window.loadAllClients = loadAllClients;
    window.searchClient = searchClient;
    window.showClientProfile = showClientProfile;
    window.editProfile = editProfile;
    window.confirmDeleteClient = confirmDeleteClient;
    // window.deleteClient = deleteClient; // deleteClient é chamada internamente

    // Expõe o cliente atual (se necessário para outros módulos)
    window.currentClient = currentClient; // Inicialmente null

    console.log("DEBUG: handlers expostos, configurando listener de submit");
    // ADICIONAR: listener de submit para o formRegister
    const formRegister = document.getElementById('formRegister');
    if (formRegister) {
      console.log("Formulário encontrado, adicionando listener...");
      formRegister.addEventListener('submit', async (event) => {
        console.log("Formulário submetido!");
        event.preventDefault();
        await registerClient();
      });
    } else {
      console.error("Formulário de cadastro não encontrado: #formRegister");
    }

    // Expõe alias para handlers inline em HTML
    window.handleClientSubmit = registerClient;

    console.log("Módulo de Gerenciamento de Clientes configurado.");
    console.log("DEBUG: setupClientManagement concluído");
  } catch (error) {
    console.error("Erro configurando Client Management:", error);
    showToast('Erro', 'Falha ao iniciar módulo de clientes.', 'error');
  }
}

// Função para registrar um novo cliente
async function registerClient() {
  if (!db) { // Verificação crucial
    showToast('Erro', 'Banco de dados não inicializado (registerClient).', 'error');
    return;
  }

  try {
    const nameInput = document.getElementById('name');
    const phoneInput = document.getElementById('phone');
    const cpfInput = document.getElementById('cpf');
    const rgInput = document.getElementById('rg');
    const addressInput = document.getElementById('address');
    const cepInput = document.getElementById('cep');
    const photoInput = document.getElementById('photo');

    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const cpf = cpfInput ? cpfInput.value.trim() : '';
    const rg = rgInput ? rgInput.value.trim() : '';
    const address = addressInput ? addressInput.value.trim() : '';
    const cep = cepInput ? cepInput.value.trim() : '';

    if (!name) {
      showToast('Atenção', 'Nome do cliente é obrigatório', 'warning');
      return;
    }

    const clientData = {
      name,
      phone,
      cpf,
      rg,
      address,
      cep,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(), // Usa o timestamp do servidor (compat)
      hasLoan: false,
      photoURL: null
    };

    const docRef = await db.collection('clients').add(clientData);
    const clientId = docRef.id;
    console.log("Cliente adicionado com ID:", clientId);

    if (photoInput && photoInput.files && photoInput.files[0]) {
      if (!storage) { // Verifica storage antes de usar
          showToast('Aviso', 'Cliente cadastrado, mas serviço de armazenamento de fotos indisponível.', 'warning');
      } else {
          console.log("Tentando fazer upload da foto...");
          try {
            const photoURL = await uploadClientPhoto(clientId, photoInput.files[0]);
            console.log("Foto enviada, URL:", photoURL);
            await db.collection('clients').doc(clientId).update({ photoURL });
            console.log("Documento do cliente atualizado com photoURL.");
          } catch (photoError) {
            console.error('Erro no upload da foto:', photoError);
            showToast('Aviso', 'Cliente cadastrado, mas erro ao salvar foto.', 'warning');
          }
      }
    }

    showToast('Sucesso', 'Cliente cadastrado com sucesso!', 'success');
    clearClientForm();

    setActiveScreen('homeScreen');

  } catch (error) {
    console.error('Erro ao registrar cliente:', error);
    showToast('Erro', 'Falha ao cadastrar cliente. Tente novamente.', 'error');
  }
}

// Função para upload da foto (usando sintaxe compat)
async function uploadClientPhoto(clientId, photoFile) {
  if (!storage) { // Verificação crucial
    throw new Error('Serviço de Storage não inicializado (uploadClientPhoto).');
  }
  try {
    const fileExtension = photoFile.name.split('.').pop();
    const fileName = `client_${clientId}_${Date.now()}.${fileExtension}`;
    const storageRef = storage.ref();
    const photoPath = `client_photos/${fileName}`;
    const photoRef = storageRef.child(photoPath);
    console.log(`Fazendo upload para: ${photoPath}`);

    const uploadTask = await photoRef.put(photoFile);
    console.log("Upload completo, obtendo URL...");

    const photoURL = await uploadTask.ref.getDownloadURL();
    return photoURL;
  } catch (error) {
     console.error("Erro detalhado no upload:", error);
     if (error.code) {
       console.error(`Storage Error Code: ${error.code}, Message: ${error.message}`);
     }
     throw error;
  }
}

// Função para preview da foto (sem alterações, puramente DOM)
function updatePhotoPreview(event) {
  const photoPreview = document.getElementById('photoPreview');
  const photoPlaceholder = document.getElementById('photoPlaceholder');
  const fileInput = event.target;

  if (fileInput && photoPreview && photoPlaceholder && fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      photoPreview.src = e.target.result;
      photoPreview.classList.remove('hidden');
      photoPlaceholder.classList.add('hidden');
    };
    reader.readAsDataURL(fileInput.files[0]);
  } else {
     console.warn("Elementos de preview de foto não encontrados ou nenhum arquivo selecionado.");
     if (photoPreview && photoPlaceholder) {
        photoPreview.src = '';
        photoPreview.classList.add('hidden');
        photoPlaceholder.classList.remove('hidden');
     }
  }
}

// Função para limpar formulário (sem alterações, puramente DOM)
function clearClientForm() {
  const form = document.getElementById('formRegister');
  if (form) {
    form.reset();
  }
  const photoPreview = document.getElementById('photoPreview');
  const photoPlaceholder = document.getElementById('photoPlaceholder');
  if (photoPreview && photoPlaceholder) {
    photoPreview.src = '';
    photoPreview.classList.add('hidden');
    photoPlaceholder.classList.remove('hidden');
  }
  if (form && form.originalSubmitHandler) {
      form.onsubmit = form.originalSubmitHandler;
      delete form.originalSubmitHandler;
  }
}


// Função para carregar todos os clientes (usando sintaxe compat)
async function loadAllClients() {
  if (!db) { // Verificação crucial
    showToast('Erro', 'Banco de dados não inicializado (loadAllClients).', 'error');
    return;
  }
  try {
    const snapshot = await db.collection('clients').orderBy('name').get();
    const clientsList = document.getElementById('allClientsList');
    const noClientsMessage = document.getElementById('noClientsMessage');

    if (!clientsList || !noClientsMessage) {
       console.error("Elementos da lista de clientes não encontrados.");
       return;
    }

    clientsList.innerHTML = '';

    if (snapshot.empty) {
      noClientsMessage.classList.remove('hidden');
      clientsList.classList.add('hidden');
    } else {
      noClientsMessage.classList.add('hidden');
      clientsList.classList.remove('hidden');
      snapshot.forEach(doc => {
        renderClientListItem(doc.id, doc.data(), clientsList);
      });
    }
  } catch (error) {
    console.error('Erro ao carregar clientes:', error);
    showToast('Erro', 'Falha ao carregar lista de clientes', 'error');
  }
}

// Função auxiliar para renderizar um item da lista de clientes
function renderClientListItem(clientId, client, targetListElement) {
    const clientItem = document.createElement('li');
    clientItem.className = 'client-item';
    clientItem.dataset.id = clientId;

    const statusClass = client.hasLoan ? 'has-loan' : '';
    const statusText = client.hasLoan ? 'Com empréstimo' : 'Sem empréstimos';

    const photoPlaceholder = `<div class="client-avatar"><span class="material-icons">person</span></div>`;
    const photoElement = client.photoURL ?
      `<img src="${client.photoURL}" alt="${client.name}" class="client-avatar" loading="lazy">` :
      photoPlaceholder;

    clientItem.innerHTML = `
      ${photoElement}
      <div class="client-info">
        <div class="client-name">${client.name || 'Nome não disponível'}</div>
        <div class="client-status ${statusClass}">${statusText}</div>
      </div>
    `;

    clientItem.addEventListener('click', () => {
      showClientProfile(clientId);
    });

    targetListElement.appendChild(clientItem);
}


// Função para buscar cliente (usando sintaxe compat e filtro client-side)
async function searchClient(searchTerm) {
  if (!db) { // Verificação crucial
    showToast('Erro', 'Banco de dados não inicializado (searchClient).', 'error');
    return;
  }
  try {
    const searchInput = document.getElementById('clientSearch');
    searchTerm = searchTerm || (searchInput ? searchInput.value.trim() : '');

    if (!searchTerm) {
      showToast('Atenção', 'Digite um nome, CPF ou telefone para buscar', 'info');
      return;
    }

    const searchTermLower = searchTerm.toLowerCase();
    console.log(`Buscando por: "${searchTermLower}"`);

    const snapshot = await db.collection('clients').get();

    if (snapshot.empty) {
      showToast('Informação', 'Nenhum cliente cadastrado no sistema.', 'info');
      return;
    }

    const matchingClients = [];
    snapshot.forEach(doc => {
      const client = doc.data();
      const clientId = doc.id;

      const nameMatch = client.name && client.name.toLowerCase().includes(searchTermLower);
      const phoneMatch = client.phone && client.phone.includes(searchTerm);
      const cpfMatch = client.cpf && client.cpf.includes(searchTerm);

      if (nameMatch || phoneMatch || cpfMatch) {
        matchingClients.push({ id: clientId, ...client });
      }
    });

    console.log(`Encontrados ${matchingClients.length} clientes.`);

    if (matchingClients.length === 0) {
      showToast('Informação', `Nenhum cliente encontrado para "${searchTerm}"`, 'info');
      const clientsList = document.getElementById('allClientsList');
      const noClientsMessage = document.getElementById('noClientsMessage');
       if(clientsList) clientsList.innerHTML = '';
       if(noClientsMessage) noClientsMessage.classList.remove('hidden');

    } else if (matchingClients.length === 1) {
      showClientProfile(matchingClients[0].id);
    } else {
      setActiveScreen('clientsScreen');
      displayFilteredClients(matchingClients);
    }

  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    showToast('Erro', 'Falha ao buscar cliente', 'error');
  }
}

// Funções auxiliares de exibição
function displayFilteredClients(clients) {
  const clientsList = document.getElementById('allClientsList');
  const noClientsMessage = document.getElementById('noClientsMessage');

  if (!clientsList || !noClientsMessage) {
     console.error("Elementos da lista de clientes não encontrados para exibir filtro.");
     return;
  }

  clientsList.innerHTML = '';

  if (clients.length === 0) {
    noClientsMessage.classList.remove('hidden');
    clientsList.classList.add('hidden');
  } else {
    noClientsMessage.classList.add('hidden');
    clientsList.classList.remove('hidden');
    clients.forEach(client => {
      renderClientListItem(client.id, client, clientsList);
    });
  }
}


// Função para mostrar perfil do cliente (usando sintaxe compat)
async function showClientProfile(clientId) {
  if (!db) { // Verificação crucial
    showToast('Erro', 'Banco de dados não inicializado (showClientProfile).', 'error');
    return;
  }
  try {
    console.log(`Carregando perfil para cliente ID: ${clientId}`);
    const docRef = db.collection('clients').doc(clientId);
    const doc = await docRef.get();

    if (!doc.exists) {
      showToast('Erro', 'Cliente não encontrado no banco de dados.', 'error');
      console.error(`Cliente com ID ${clientId} não encontrado.`);
      setActiveScreen('homeScreen');
      return;
    }

    currentClient = { id: clientId, ...doc.data() };
    window.currentClient = currentClient;
    console.log("Cliente atual definido:", currentClient);

    const clientNameEl = document.getElementById('clientName');
    const clientPhoneEl = document.getElementById('clientPhone');
    const clientAddressEl = document.getElementById('clientAddress');
    const clientIdEl = document.getElementById('clientId');
    const clientPhotoEl = document.getElementById('clientPhoto');
    const loanStatusEl = document.getElementById('loanStatus');
    const loanInfoEl = document.getElementById('loanInfo');
    const noLoanMessageEl = document.getElementById('noLoanMessage');
    const newLoanSectionEl = document.getElementById('newLoanSection');

    if (clientNameEl) clientNameEl.textContent = currentClient.name || 'Nome não disponível';
    if (clientPhoneEl) {
      clientPhoneEl.innerHTML = currentClient.phone
        ? `<span class="material-icons">phone</span><span>${currentClient.phone}</span>`
        : `<span class="material-icons">phone</span><span>Telefone não cadastrado</span>`;
    }
    if (clientAddressEl) {
      clientAddressEl.innerHTML = currentClient.address
        ? `<span class="material-icons">home</span><span>${currentClient.address}</span>`
        : `<span class="material-icons">home</span><span>Endereço não cadastrado</span>`;
    }
    if (clientIdEl) {
      let idText = 'CPF/RG não cadastrado';
      if (currentClient.cpf && currentClient.rg) idText = `CPF: ${currentClient.cpf} | RG: ${currentClient.rg}`;
      else if (currentClient.cpf) idText = `CPF: ${currentClient.cpf}`;
      else if (currentClient.rg) idText = `RG: ${currentClient.rg}`;
      clientIdEl.innerHTML = `<span class="material-icons">badge</span><span>${idText}</span>`;
    }
    if (clientPhotoEl) {
      clientPhotoEl.src = currentClient.photoURL || 'assets/user-placeholder.png';
      clientPhotoEl.alt = `Foto de ${currentClient.name || 'Cliente'}`;
    }

    if (loanStatusEl && loanInfoEl && noLoanMessageEl && newLoanSectionEl) {
      if (currentClient.hasLoan) {
        loanStatusEl.textContent = 'Ativo';
        loanStatusEl.className = 'badge has-loan';
        loanInfoEl.classList.remove('hidden');
        noLoanMessageEl.classList.add('hidden');
        newLoanSectionEl.classList.add('hidden');

        try {
    console.log("Carregando detalhes do empréstimo existente...");
    const loansSnapshot = await db.collection('loans')
        .where('clientId', '==', clientId)
        .where('status', '==', 'active')
        .get();

    if (loansSnapshot.empty) {
        console.log("Nenhum empréstimo ativo encontrado.");
        loanInfoEl.innerHTML = '<p>Cliente não possui empréstimo ativo.</p>';
        return;
    }

    const loan = loansSnapshot.docs[0].data();
    loan.id = loansSnapshot.docs[0].id;

    // Formata os valores para exibição
    const formattedAmount = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(loan.amount);

    const formattedInterest = `${loan.interest}%`;
    const startDate = loan.startDate.toDate().toLocaleDateString('pt-BR');

    // Monta o HTML com os detalhes do empréstimo
    loanInfoEl.innerHTML = `
        <div class="loan-info-grid">
            <div class="loan-detail">
                <span class="label">Valor:</span>
                <span class="value">${formattedAmount}</span>
            </div>
            <div class="loan-detail">
                <span class="label">Juros:</span>
                <span class="value">${formattedInterest}</span>
            </div>
            <div class="loan-detail">
                <span class="label">Data Início:</span>
                <span class="value">${startDate}</span>
            </div>
            <div class="loan-detail">
                <span class="label">Status:</span>
                <span class="value status-active">Ativo</span>
            </div>
        </div>
    `;

} catch (error) {
    console.error("Erro ao carregar detalhes do empréstimo:", error);
    loanInfoEl.innerHTML = '<p class="error">Erro ao carregar detalhes do empréstimo.</p>';
}
      } else {
        loanStatusEl.textContent = 'Sem empréstimos';
        loanStatusEl.className = 'badge';
        loanInfoEl.classList.add('hidden');
        loanInfoEl.innerHTML = '';
        noLoanMessageEl.classList.remove('hidden');
        newLoanSectionEl.classList.remove('hidden');
      }
    } else {
       console.error("Elementos da UI de empréstimo não encontrados no perfil.");
    }

    setActiveScreen('clientProfileScreen');

    // ADICIONAR: vincular botão de adicionar empréstimo
    const addLoanBtn = document.getElementById('addLoanButton');
    if (addLoanBtn) {
      addLoanBtn.onclick = null; // Remove handler antigo, se houver
      addLoanBtn.addEventListener('click', addLoan);
    }

    // Vincular botão de pagamento
    const paymentButton = document.getElementById('paymentButton');
    if (paymentButton) {
      paymentButton.onclick = null;
      paymentButton.addEventListener('click', () => {
        openPaymentModalForClient(currentClient.id);
      });
    }

    // Vincular botão de cobrança
    const chargeButton = document.getElementById('chargeButton');
    if (chargeButton) {
      chargeButton.onclick = null; // Remove handler antigo
      chargeButton.addEventListener('click', () => {
        generateChargeReceipt(currentClient.id);
      });
    }

    // Vincular botão de histórico
    const historyButton = document.getElementById('historyButton');
    if (historyButton) {
      historyButton.onclick = null; // Remove handler antigo
      historyButton.addEventListener('click', () => {
        showClientHistory(currentClient.id);
      });
    }
  } catch (error) {
    console.error('Erro ao mostrar perfil do cliente:', error);
    showToast('Erro', 'Falha ao carregar perfil do cliente', 'error');
  }
}

// Função para entrar no modo de edição do perfil
function editProfile() {
  if (!currentClient) {
    showToast('Erro', 'Nenhum cliente selecionado para editar.', 'error');
    return;
  }
  console.log("Entrando em modo de edição para:", currentClient.name);

  const formRegister = document.getElementById('formRegister');
  const nameInput = document.getElementById('name');
  const phoneInput = document.getElementById('phone');
  const cpfInput = document.getElementById('cpf');
  const rgInput = document.getElementById('rg');
  const addressInput = document.getElementById('address');
  const cepInput = document.getElementById('cep');
  const photoPreview = document.getElementById('photoPreview');
  const photoPlaceholder = document.getElementById('photoPlaceholder');
  const screenTitle = formRegister ? formRegister.closest('.screen').querySelector('h2') : null;

  if (!formRegister || !nameInput || !phoneInput || !cpfInput || !rgInput || !addressInput || !cepInput || !photoPreview || !photoPlaceholder) {
     console.error("Elementos do formulário de registro não encontrados para edição.");
     showToast('Erro', 'Erro ao preparar formulário para edição.', 'error');
     return;
  }

  nameInput.value = currentClient.name || '';
  phoneInput.value = currentClient.phone || '';
  cpfInput.value = currentClient.cpf || '';
  rgInput.value = currentClient.rg || '';
  addressInput.value = currentClient.address || '';
  cepInput.value = currentClient.cep || '';

  if (currentClient.photoURL) {
    photoPreview.src = currentClient.photoURL;
    photoPreview.classList.remove('hidden');
    photoPlaceholder.classList.add('hidden');
  } else {
    photoPreview.src = '';
    photoPreview.classList.add('hidden');
    photoPlaceholder.classList.remove('hidden');
  }

  if (screenTitle) {
      screenTitle.textContent = "Editar Cliente";
  }

  if (!formRegister.originalSubmitHandler) {
      formRegister.originalSubmitHandler = formRegister.onsubmit;
  }
  formRegister.onsubmit = async function(e) {
    e.preventDefault();
    console.log("Formulário de edição submetido.");
    await updateClient(currentClient.id);
  };

  setActiveScreen('registerScreen');
}

// Função para ATUALIZAR dados do cliente
async function updateClient(clientId) {
  if (!db) { // Verificação crucial
    showToast('Erro', 'Banco de dados não inicializado (updateClient).', 'error');
    return;
  }
  try {
    const nameInput = document.getElementById('name');
    const phoneInput = document.getElementById('phone');
    const cpfInput = document.getElementById('cpf');
    const rgInput = document.getElementById('rg');
    const addressInput = document.getElementById('address');
    const cepInput = document.getElementById('cep');
    const photoInput = document.getElementById('photo');

    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const cpf = cpfInput ? cpfInput.value.trim() : '';
    const rg = rgInput ? rgInput.value.trim() : '';
    const address = addressInput ? addressInput.value.trim() : '';
    const cep = cepInput ? cepInput.value.trim() : '';

    if (!name) {
      showToast('Atenção', 'Nome do cliente é obrigatório', 'warning');
      return;
    }

    const updatedData = {
      name,
      phone,
      cpf,
      rg,
      address,
      cep,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (photoInput && photoInput.files && photoInput.files[0]) {
      if (!storage) { // Verifica storage antes de usar
          showToast('Aviso', 'Cliente atualizado, mas serviço de armazenamento de fotos indisponível.', 'warning');
      } else {
          console.log("Nova foto selecionada, fazendo upload...");
          try {
            const newPhotoURL = await uploadClientPhoto(clientId, photoInput.files[0]);
            updatedData.photoURL = newPhotoURL;
            console.log("Nova foto enviada, URL:", newPhotoURL);
          } catch (photoError) {
            console.error('Erro ao fazer upload da nova foto:', photoError);
            showToast('Aviso', 'Cliente atualizado, mas erro ao salvar nova foto.', 'warning');
          }
      }
    } else {
       console.log("Nenhuma nova foto selecionada.");
    }

    console.log("Atualizando documento do cliente:", clientId, updatedData);
    await db.collection('clients').doc(clientId).update(updatedData);

    showToast('Sucesso', 'Cliente atualizado com sucesso!', 'success');
    clearClientForm();

    await showClientProfile(clientId);

  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    showToast('Erro', 'Falha ao atualizar cliente. Tente novamente.', 'error');
     const formRegister = document.getElementById('formRegister');
     if (formRegister && formRegister.originalSubmitHandler) {
         formRegister.onsubmit = formRegister.originalSubmitHandler;
         delete formRegister.originalSubmitHandler;
     }
  }
}

// Função para iniciar o processo de exclusão com confirmação
function confirmDeleteClient() {
  if (!currentClient) {
    showToast('Erro', 'Nenhum cliente selecionado para excluir.', 'error');
    return;
  }

  if (currentClient.hasLoan) {
    showToast('Ação Bloqueada', 'Não é possível excluir um cliente com empréstimo ativo.', 'error');
    return;
  }

  console.log("Solicitando confirmação para excluir:", currentClient.name);
  if (typeof showConfirmation === 'function') {
    showConfirmation(
      'Excluir Cliente',
      `Tem certeza que deseja excluir permanentemente o cliente "${currentClient.name}"? Todos os dados associados serão perdidos. Esta ação não pode ser desfeita.`,
      () => deleteClient(currentClient.id),
      null
    );
  } else {
     console.error("Função window.showConfirmation não encontrada.");
     if (confirm(`Tem certeza que deseja excluir permanentemente o cliente "${currentClient.name}"?`)) {
         deleteClient(currentClient.id);
     }
  }
}

// Função para DELETAR o cliente
async function deleteClient(clientId) {
  if (!db) { // Verificação crucial
    showToast('Erro', 'Banco de dados não inicializado (deleteClient).', 'error');
    return;
  }
  if (currentClient && currentClient.id === clientId && currentClient.hasLoan) {
      showToast('Erro', 'Não é possível excluir cliente com empréstimo ativo (verificação final).', 'error');
      return;
  }

  console.log("Excluindo cliente ID:", clientId);
  try {
    if (currentClient && currentClient.id === clientId && currentClient.photoURL) {
        if (!storage) { // Verifica storage antes de usar
            console.warn("Serviço de armazenamento indisponível, não será possível excluir a foto do cliente.");
        } else {
            try {
                console.log("Tentando excluir foto do storage:", currentClient.photoURL);
                const photoRef = storage.refFromURL(currentClient.photoURL);
                await photoRef.delete();
                console.log("Foto do storage excluída.");
            } catch (storageError) {
                console.error("Erro ao excluir foto do storage (cliente será excluído mesmo assim):", storageError);
            }
        }
    }

    await db.collection('clients').doc(clientId).delete();

    showToast('Sucesso', 'Cliente excluído com sucesso!', 'success');
    currentClient = null;
    window.currentClient = null;

    setActiveScreen('homeScreen');

  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    showToast('Erro', 'Falha ao excluir cliente. Tente novamente.', 'error');
  }
}

// Função para exportar o cliente atual
export function getCurrentClient() {
  return currentClient;
}

// Adiciona função para abrir modal de pagamento via cliente
function openPaymentModalForClient(clientId) {
  console.log("Abrindo modal de pagamento para o cliente:", clientId);
  // Aqui você pode preencher o modal com dados do cliente, se quiser.
  showModal('paymentModal');
}

// Adiciona função para gerar o recibo de cobrança
async function generateChargeReceipt(clientId) {
  console.log("Gerando recibo de cobrança para o cliente:", clientId);
  try {
    // busca o empréstimo ativo do cliente
    const loansSnapshot = await db.collection('loans')
      .where('clientId','==',clientId)
      .where('status','==','active')
      .get();
    if (loansSnapshot.empty) {
      showToast('Erro','Nenhum empréstimo ativo encontrado.','error');
      return;
    }
    const loanDoc = loansSnapshot.docs[0];
    const loan = loanDoc.data();
    loan.id = loanDoc.id;

    // calcula valores
    const valorEmprestimo = loan.amount;
    const juros = loan.interest;
    const valorPago = loan.totalPaid||0;
    const dataInicio = loan.startDate.toDate();
    const hoje = new Date();
    const diasDecorridos = Math.floor((hoje - dataInicio)/(1000*60*60*24));
    const valorJuros = valorEmprestimo*(juros/100)*(diasDecorridos/30);
    const valorDevido = valorEmprestimo+valorJuros-valorPago;

    // formata valores
    const formatMoney = v=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const receiptContent = `
      <div class="receipt-header">
        <h3>Recibo de Cobrança</h3>
        <p class="receipt-date">Data: ${hoje.toLocaleDateString('pt-BR')}</p>
      </div>
      <div class="receipt-client-info">
        <p><strong>Cliente:</strong> ${currentClient.name}</p>
        ${currentClient.cpf?`<p><strong>CPF:</strong> ${currentClient.cpf}</p>`:''}
        ${currentClient.phone?`<p><strong>Telefone:</strong> ${currentClient.phone}</p>`:''}
      </div>
      <div class="receipt-loan-info">
        <h4>Detalhes do Empréstimo</h4>
        <p><strong>Valor Emprestado:</strong> ${formatMoney(valorEmprestimo)}</p>
        <p><strong>Taxa de Juros:</strong> ${juros}% ao mês</p>
        <p><strong>Data Início:</strong> ${dataInicio.toLocaleDateString('pt-BR')}</p>
        <p><strong>Dias Decorridos:</strong> ${diasDecorridos} dias</p>
        <p><strong>Juros Acumulados:</strong> ${formatMoney(valorJuros)}</p>
        <p><strong>Valor Pago:</strong> ${formatMoney(valorPago)}</p>
        <p class="receipt-total"><strong>Valor Atual Devido:</strong> ${formatMoney(valorDevido)}</p>
      </div>
      <div class="receipt-footer">
        <p>Para efetuar o pagamento, entre em contato.</p>
      </div>
    `;

    // atualiza modal
    const receiptEl=document.getElementById('receiptContent');
    if(receiptEl) receiptEl.innerHTML=receiptContent;

    // compartilhar via WhatsApp
    const shareBtn=document.getElementById('shareReceiptButton');
    if(shareBtn){
      const txt=`*Cobrança - Sistema Fácil*\nCliente: ${currentClient.name}\nValor Devido: ${formatMoney(valorDevido)}\nData: ${hoje.toLocaleDateString('pt-BR')}`;
      shareBtn.onclick=()=>window.open(
        (currentClient.phone?.replace(/\D/g,'') 
         ?`https://wa.me/55${currentClient.phone.replace(/\D/g,'')}?text=${encodeURIComponent(txt)}`
         :`https://wa.me/?text=${encodeURIComponent(txt)}`),
        '_blank'
      );
    }

    // copiar para clipboard
    const copyBtn=document.getElementById('copyReceiptButton');
    if(copyBtn){
      copyBtn.onclick=()=>{
        navigator.clipboard.writeText(receiptEl.textContent||'')
          .then(()=>showToast('Sucesso','Recibo copiado!','success'))
          .catch(()=>showToast('Erro','Falha ao copiar.','error'));
      };
    }

    showModal('receiptModal');
  } catch(error) {
    console.error('Erro ao gerar recibo:',error);
    showToast('Erro','Falha ao gerar recibo de cobrança.','error');
  }
}

// Função para exibir histórico de empréstimos do cliente
async function showClientHistory(clientId) {
  console.log("Exibindo histórico para o cliente:", clientId);

  try {
    // Busca todos os empréstimos do cliente
    const loansSnapshot = await db.collection('loans')
      .where('clientId', '==', clientId)
      .orderBy('startDate', 'desc')
      .get();

    let historyHtml = '';

    if (loansSnapshot.empty) {
      historyHtml = '<p>Este cliente não possui histórico de empréstimos.</p>';
    } else {
      loansSnapshot.forEach(doc => {
        const loan = doc.data();
        const valor = formatCurrency(loan.amount);
        const juros = loan.interest;
        const dataInicio = loan.startDate.toDate().toLocaleDateString('pt-BR');
        const status = loan.status === 'active' ? 'Ativo' : 'Finalizado';
        const valorPago = loan.totalPaid ? formatCurrency(loan.totalPaid) : 'R$ 0,00';

        historyHtml += `
          <div class="history-loan">
            <p><strong>Valor:</strong> ${valor}</p>
            <p><strong>Juros:</strong> ${juros}%</p>
            <p><strong>Data Início:</strong> ${dataInicio}</p>
            <p><strong>Status:</strong> ${status}</p>
            <p><strong>Valor Pago:</strong> ${valorPago}</p>
            <hr>
          </div>
        `;
      });
    }

    // Atualiza o conteúdo do modal de histórico
    const historyContentEl = document.getElementById('historyContent');
    if (historyContentEl) {
      historyContentEl.innerHTML = historyHtml;
    }

    showModal('historyModal');
  } catch (error) {
    console.error('Erro ao carregar histórico:', error);
    showToast('Erro', 'Falha ao carregar histórico do cliente.', 'error');
  }
}
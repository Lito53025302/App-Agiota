// Client management functionality
import { getFirestore, getStorage } from './firebase.js';
import { showToast } from './ui.js';

let db;
let storage;
let currentClient = null;

export function setupClientManagement() {
  db = getFirestore();
  storage = getStorage();
  window.currentClient = currentClient;
  
  // Expose necessary functions to the global scope
  window.registerClient = registerClient;
  window.updatePhotoPreview = updatePhotoPreview;
  window.loadAllClients = loadAllClients;
  window.searchClient = searchClient;
  window.showClientProfile = showClientProfile;
  window.editProfile = editProfile;
  window.confirmDeleteClient = confirmDeleteClient;
  window.deleteClient = deleteClient;
}

// Function to register a new client
async function registerClient() {
  try {
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const cpf = document.getElementById('cpf').value.trim();
    const rg = document.getElementById('rg').value.trim();
    const address = document.getElementById('address').value.trim();
    const cep = document.getElementById('cep').value.trim();
    const photoInput = document.getElementById('photo');
    
    if (!name) {
      showToast('Atenção', 'Nome do cliente é obrigatório', 'warning');
      return;
    }
    
    // Create client object
    const client = {
      name,
      phone,
      cpf,
      rg,
      address,
      cep,
      createdAt: new Date(),
      hasLoan: false,
      photoURL: null
    };
    
    // Add client to Firestore
    const docRef = await db.collection('clients').add(client);
    const clientId = docRef.id;
    
    // Upload photo if available
    if (photoInput.files && photoInput.files[0]) {
      try {
        const photoURL = await uploadClientPhoto(clientId, photoInput.files[0]);
        
        // Update client document with photo URL
        await db.collection('clients').doc(clientId).update({
          photoURL
        });
      } catch (photoError) {
        console.error('Error uploading photo:', photoError);
        showToast('Aviso', 'Cliente cadastrado, mas houve um erro ao salvar a foto', 'warning');
      }
    }
    
    showToast('Sucesso', 'Cliente cadastrado com sucesso!', 'success');
    clearClientForm();
    
    // Go to home screen
    if (typeof window.setActiveScreen === 'function') {
      window.setActiveScreen('homeScreen');
    }
    
  } catch (error) {
    console.error('Error registering client:', error);
    showToast('Erro', 'Falha ao cadastrar cliente. Tente novamente.', 'error');
  }
}

// Function to upload client photo to Firebase Storage
async function uploadClientPhoto(clientId, photoFile) {
  const fileExtension = photoFile.name.split('.').pop();
  const fileName = `${clientId}_${Date.now()}.${fileExtension}`;
  const storageRef = storage.ref();
  const photoRef = storageRef.child(`client_photos/${fileName}`);
  
  // Upload file
  await photoRef.put(photoFile);
  
  // Get download URL
  const photoURL = await photoRef.getDownloadURL();
  return photoURL;
}

// Function to handle photo preview before upload
function updatePhotoPreview(event) {
  const photoPreview = document.getElementById('photoPreview');
  const photoPlaceholder = document.getElementById('photoPlaceholder');
  
  if (event.target.files && event.target.files[0]) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
      photoPreview.src = e.target.result;
      photoPreview.classList.remove('hidden');
      photoPlaceholder.classList.add('hidden');
    };
    
    reader.readAsDataURL(event.target.files[0]);
  }
}

// Function to clear client form
function clearClientForm() {
  document.getElementById('name').value = '';
  document.getElementById('phone').value = '';
  document.getElementById('cpf').value = '';
  document.getElementById('rg').value = '';
  document.getElementById('address').value = '';
  document.getElementById('cep').value = '';
  document.getElementById('photo').value = '';
  
  const photoPreview = document.getElementById('photoPreview');
  const photoPlaceholder = document.getElementById('photoPlaceholder');
  
  photoPreview.src = '';
  photoPreview.classList.add('hidden');
  photoPlaceholder.classList.remove('hidden');
}

// Function to load all clients
async function loadAllClients() {
  try {
    const snapshot = await db.collection('clients').orderBy('name').get();
    const clientsList = document.getElementById('allClientsList');
    const noClientsMessage = document.getElementById('noClientsMessage');
    
    clientsList.innerHTML = '';
    
    if (snapshot.empty) {
      noClientsMessage.classList.remove('hidden');
      return;
    }
    
    noClientsMessage.classList.add('hidden');
    
    snapshot.forEach(doc => {
      const client = doc.data();
      const clientId = doc.id;
      
      const clientItem = document.createElement('li');
      clientItem.className = 'client-item';
      clientItem.dataset.id = clientId;
      
      const statusClass = client.hasLoan ? 'has-loan' : '';
      const statusText = client.hasLoan ? 'Possui empréstimo ativo' : 'Sem empréstimos';
      
      const photoPlaceholder = `<div class="client-avatar"><span class="material-icons">person</span></div>`;
      const photoElement = client.photoURL ? 
        `<img src="${client.photoURL}" alt="${client.name}" class="client-avatar">` : 
        photoPlaceholder;
      
      clientItem.innerHTML = `
        ${photoElement}
        <div class="client-info">
          <div class="client-name">${client.name}</div>
          <div class="client-status ${statusClass}">${statusText}</div>
        </div>
      `;
      
      clientItem.addEventListener('click', () => {
        showClientProfile(clientId);
      });
      
      clientsList.appendChild(clientItem);
    });
    
  } catch (error) {
    console.error('Error loading clients:', error);
    showToast('Erro', 'Falha ao carregar lista de clientes', 'error');
  }
}

// Function to search for a client
async function searchClient(searchTerm) {
  try {
    searchTerm = searchTerm || document.getElementById('clientSearch').value.trim();
    
    if (!searchTerm) {
      showToast('Atenção', 'Digite um termo para busca', 'info');
      return;
    }
    
    // Convert search term to lowercase for case-insensitive search
    const searchTermLower = searchTerm.toLowerCase();
    
    // Get all clients and filter client-side
    // Note: Firestore doesn't support native case-insensitive search
    const snapshot = await db.collection('clients').get();
    
    if (snapshot.empty) {
      showToast('Informação', 'Nenhum cliente encontrado', 'info');
      return;
    }
    
    const matchingClients = [];
    
    snapshot.forEach(doc => {
      const client = doc.data();
      const clientId = doc.id;
      
      if (client.name.toLowerCase().includes(searchTermLower) || 
          (client.phone && client.phone.includes(searchTerm)) ||
          (client.cpf && client.cpf.includes(searchTerm))) {
        matchingClients.push({
          id: clientId,
          ...client
        });
      }
    });
    
    if (matchingClients.length === 0) {
      showToast('Informação', 'Nenhum cliente encontrado', 'info');
      return;
    }
    
    if (matchingClients.length === 1) {
      // If only one client found, show profile directly
      showClientProfile(matchingClients[0].id);
    } else {
      // If multiple clients found, navigate to clients list and show filtered results
      window.setActiveScreen('clientsScreen');
      displayFilteredClients(matchingClients);
    }
    
  } catch (error) {
    console.error('Error searching clients:', error);
    showToast('Erro', 'Falha ao buscar cliente', 'error');
  }
}

// Function to display filtered clients
function displayFilteredClients(clients) {
  const clientsList = document.getElementById('allClientsList');
  const noClientsMessage = document.getElementById('noClientsMessage');
  
  clientsList.innerHTML = '';
  
  if (clients.length === 0) {
    noClientsMessage.classList.remove('hidden');
    return;
  }
  
  noClientsMessage.classList.add('hidden');
  
  clients.forEach(client => {
    const clientItem = document.createElement('li');
    clientItem.className = 'client-item';
    clientItem.dataset.id = client.id;
    
    const statusClass = client.hasLoan ? 'has-loan' : '';
    const statusText = client.hasLoan ? 'Possui empréstimo ativo' : 'Sem empréstimos';
    
    const photoPlaceholder = `<div class="client-avatar"><span class="material-icons">person</span></div>`;
    const photoElement = client.photoURL ? 
      `<img src="${client.photoURL}" alt="${client.name}" class="client-avatar">` : 
      photoPlaceholder;
    
    clientItem.innerHTML = `
      ${photoElement}
      <div class="client-info">
        <div class="client-name">${client.name}</div>
        <div class="client-status ${statusClass}">${statusText}</div>
      </div>
    `;
    
    clientItem.addEventListener('click', () => {
      showClientProfile(client.id);
    });
    
    clientsList.appendChild(clientItem);
  });
}

// Function to show client profile
async function showClientProfile(clientId) {
  try {
    const docRef = db.collection('clients').doc(clientId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      showToast('Erro', 'Cliente não encontrado', 'error');
      return;
    }
    
    // Store current client
    currentClient = {
      id: clientId,
      ...doc.data()
    };
    window.currentClient = currentClient;
    
    // Update UI
    document.getElementById('clientName').textContent = currentClient.name;
    
    // Update phone info
    const clientPhoneElement = document.getElementById('clientPhone');
    if (currentClient.phone) {
      clientPhoneElement.innerHTML = `
        <span class="material-icons">phone</span>
        <span>${currentClient.phone}</span>
      `;
    } else {
      clientPhoneElement.innerHTML = `
        <span class="material-icons">phone</span>
        <span>Telefone não cadastrado</span>
      `;
    }
    
    // Update address info
    const clientAddressElement = document.getElementById('clientAddress');
    if (currentClient.address) {
      clientAddressElement.innerHTML = `
        <span class="material-icons">home</span>
        <span>${currentClient.address}</span>
      `;
    } else {
      clientAddressElement.innerHTML = `
        <span class="material-icons">home</span>
        <span>Endereço não cadastrado</span>
      `;
    }
    
    // Update ID info (CPF/RG)
    const clientIdElement = document.getElementById('clientId');
    let idText = 'CPF/RG não cadastrado';
    
    if (currentClient.cpf && currentClient.rg) {
      idText = `CPF: ${currentClient.cpf} | RG: ${currentClient.rg}`;
    } else if (currentClient.cpf) {
      idText = `CPF: ${currentClient.cpf}`;
    } else if (currentClient.rg) {
      idText = `RG: ${currentClient.rg}`;
    }
    
    clientIdElement.innerHTML = `
      <span class="material-icons">badge</span>
      <span>${idText}</span>
    `;
    
    // Set photo
    const clientPhoto = document.getElementById('clientPhoto');
    if (currentClient.photoURL) {
      clientPhoto.src = currentClient.photoURL;
    } else {
      clientPhoto.src = 'assets/user-placeholder.png';
    }
    
    // Check if client has loan
    const noLoanMessage = document.getElementById('noLoanMessage');
    const loanInfo = document.getElementById('loanInfo');
    const loanStatus = document.getElementById('loanStatus');
    
    if (currentClient.hasLoan) {
      noLoanMessage.classList.add('hidden');
      loanInfo.classList.remove('hidden');
      loanStatus.textContent = 'Ativo';
      loanStatus.className = 'badge has-loan';
      
      // Load loan info
      await window.loadClientLoan(clientId);
    } else {
      noLoanMessage.classList.remove('hidden');
      loanInfo.classList.add('hidden');
      loanStatus.textContent = 'Sem empréstimos';
      loanStatus.className = 'badge';
    }
    
    // Navigate to profile screen
    window.setActiveScreen('clientProfileScreen');
    
  } catch (error) {
    console.error('Error showing client profile:', error);
    showToast('Erro', 'Falha ao carregar perfil do cliente', 'error');
  }
}

// Function to edit client profile
function editProfile() {
  if (!currentClient) {
    showToast('Erro', 'Nenhum cliente selecionado', 'error');
    return;
  }
  
  // Populate form with client data
  document.getElementById('name').value = currentClient.name || '';
  document.getElementById('phone').value = currentClient.phone || '';
  document.getElementById('cpf').value = currentClient.cpf || '';
  document.getElementById('rg').value = currentClient.rg || '';
  document.getElementById('address').value = currentClient.address || '';
  document.getElementById('cep').value = currentClient.cep || '';
  
  // Update photo preview if available
  const photoPreview = document.getElementById('photoPreview');
  const photoPlaceholder = document.getElementById('photoPlaceholder');
  
  if (currentClient.photoURL) {
    photoPreview.src = currentClient.photoURL;
    photoPreview.classList.remove('hidden');
    photoPlaceholder.classList.add('hidden');
  } else {
    photoPreview.classList.add('hidden');
    photoPlaceholder.classList.remove('hidden');
  }
  
  // Change form submit handler to update instead of create
  const formRegister = document.getElementById('formRegister');
  
  // Store original submit event
  const originalSubmitHandler = formRegister.onsubmit;
  
  // Set new handler for update
  formRegister.onsubmit = async function(e) {
    e.preventDefault();
    await updateClient(currentClient.id);
    
    // Restore original handler
    formRegister.onsubmit = originalSubmitHandler;
  };
  
  // Navigate to register screen (now in edit mode)
  window.setActiveScreen('registerScreen');
}

// Function to update client
async function updateClient(clientId) {
  try {
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const cpf = document.getElementById('cpf').value.trim();
    const rg = document.getElementById('rg').value.trim();
    const address = document.getElementById('address').value.trim();
    const cep = document.getElementById('cep').value.trim();
    const photoInput = document.getElementById('photo');
    
    if (!name) {
      showToast('Atenção', 'Nome do cliente é obrigatório', 'warning');
      return;
    }
    
    // Create updated client object
    const updatedClient = {
      name,
      phone,
      cpf,
      rg,
      address,
      cep,
      updatedAt: new Date()
    };
    
    // Upload new photo if available
    if (photoInput.files && photoInput.files[0]) {
      try {
        const photoURL = await uploadClientPhoto(clientId, photoInput.files[0]);
        updatedClient.photoURL = photoURL;
      } catch (photoError) {
        console.error('Error uploading new photo:', photoError);
        showToast('Aviso', 'Cliente atualizado, mas houve um erro ao salvar a nova foto', 'warning');
      }
    }
    
    // Update client in Firestore
    await db.collection('clients').doc(clientId).update(updatedClient);
    
    showToast('Sucesso', 'Cliente atualizado com sucesso!', 'success');
    clearClientForm();
    
    // Refresh client profile
    await showClientProfile(clientId);
    
  } catch (error) {
    console.error('Error updating client:', error);
    showToast('Erro', 'Falha ao atualizar cliente. Tente novamente.', 'error');
  }
}

// Function to confirm client deletion
function confirmDeleteClient() {
  if (!currentClient) {
    showToast('Erro', 'Nenhum cliente selecionado', 'error');
    return;
  }
  
  // Show confirmation dialog
  window.showConfirmation(
    'Excluir Cliente',
    `Tem certeza que deseja excluir o cliente ${currentClient.name}? Esta ação não pode ser desfeita.`,
    () => deleteClient(currentClient.id),
    null
  );
}

// Function to delete client
async function deleteClient(clientId) {
  try {
    // Check if client has active loans
    if (currentClient.hasLoan) {
      showToast('Erro', 'Não é possível excluir cliente com empréstimo ativo', 'error');
      return;
    }
    
    // Delete client from Firestore
    await db.collection('clients').doc(clientId).delete();
    
    showToast('Sucesso', 'Cliente excluído com sucesso!', 'success');
    
    // Navigate back to home screen
    window.setActiveScreen('homeScreen');
    
  } catch (error) {
    console.error('Error deleting client:', error);
    showToast('Erro', 'Falha ao excluir cliente. Tente novamente.', 'error');
  }
}

// Export current client for use in other modules
export function getCurrentClient() {
  return currentClient;
}
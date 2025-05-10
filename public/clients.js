// clients.js

let clients = [
  {
    id: 1,
    name: "Ana Silva",
    phone: "(11) 91234-5678",
    cpf: "123.456.789-00",
    rg: "MG-12.345.678",
    address: "Rua das Flores, 123",
    cep: "12345-678",
    photo: "",
    loans: [],
    payments: []
  },
  {
    id: 2,
    name: "Carlos Souza",
    phone: "(21) 98765-4321",
    cpf: "987.654.321-00",
    rg: "RJ-87.654.321",
    address: "Av. Brasil, 456",
    cep: "87654-321",
    photo: "",
    loans: [],
    payments: []
  }
];

let clientIdCounter = clients.length + 1;
let currentClient = null;
let editingProfile = false;

// Funções relacionadas a clientes

function clearRegisterForm() {
  document.getElementById("formRegister").reset();
  const preview = document.getElementById("photoPreview");
  preview.src = "";
  preview.classList.add("hidden");
}

function openRegister() {
  document.getElementById("homeScreen").classList.add("hidden");
  document.getElementById("registerForm").classList.remove("hidden");
  document.getElementById("clientProfile").classList.add("hidden");
  clearRegisterForm();
  editingProfile = false;
}

function closeRegister() {
  document.getElementById("homeScreen").classList.remove("hidden");
  document.getElementById("registerForm").classList.add("hidden");
  document.getElementById("clientProfile").classList.add("hidden");
  clearRegisterForm();
  editingProfile = false;
}

function updatePhotoPreview(event) {
  const preview = document.getElementById("photoPreview");
  const file = event.target.files[0];
  if (file) {
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.classList.remove("hidden");
  } else {
    preview.src = "";
    preview.classList.add("hidden");
  }
}

function registerClient() {
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const cpf = document.getElementById("cpf").value.trim();
  const rg = document.getElementById("rg").value.trim();
  const address = document.getElementById("address").value.trim();
  const cep = document.getElementById("cep").value.trim();
  const photoFile = document.getElementById("photo").files[0];

  if (!name) {
    alert("Por favor, preencha o nome.");
    return;
  }

  let photoURL = "";
  if (photoFile) {
    photoURL = URL.createObjectURL(photoFile);
  }

  if (editingProfile && currentClient) {
    currentClient.name = name;
    currentClient.phone = phone;
    currentClient.cpf = cpf;
    currentClient.rg = rg;
    currentClient.address = address;
    currentClient.cep = cep;
    if (photoURL) currentClient.photo = photoURL;
    else if (!currentClient.photo) currentClient.photo = "";
  } else {
    const newClient = {
      id: clientIdCounter++,
      name,
      phone,
      cpf,
      rg,
      address,
      cep,
      photo: photoURL,
      loans: [],
      payments: []
    };
    clients.push(newClient);
    currentClient = newClient;
  }

  alert(editingProfile ? "Perfil atualizado com sucesso!" : "Cliente cadastrado com sucesso!");
  clearRegisterForm();
  saveClientsToStorage();
  showProfile(currentClient.id);
}

function searchClient() {
  const input = document.getElementById("clientSearch");
  const searchInput = input.value.trim().toLowerCase();

  if (searchInput.length < 4) {
    document.getElementById("duePayments").innerHTML = "";
    return;
  }

  const clientFound = clients.filter(c => c.name.toLowerCase().includes(searchInput));
  const ul = document.getElementById("duePayments");
  ul.innerHTML = "";

  if (clientFound.length > 0) {
    clientFound.forEach(client => {
      let li = document.createElement("li");
      li.textContent = client.name;
      li.onclick = () => showProfile(client.id);
      ul.appendChild(li);
    });
  } else {
    let li = document.createElement("li");
    li.textContent = "Nenhum cliente encontrado.";
    ul.appendChild(li);
  }
}

document.getElementById("clientSearch").addEventListener("input", searchClient);

function showAllClients() {
  const ul = document.getElementById("duePayments");
  ul.innerHTML = "";

  clients.forEach(client => {
    let li = document.createElement("li");
    li.textContent = client.name;
    li.onclick = () => showProfile(client.id);
    ul.appendChild(li);
  });
}

function showProfile(clientId) {
  const home = document.getElementById("homeScreen");
  const register = document.getElementById("registerForm");
  const profile = document.getElementById("clientProfile");
  const client = clients.find(c => c.id === clientId);
  if (!client) {
    alert("Cliente não encontrado.");
    return;
  }
  currentClient = client;
  editingProfile = false;

  home.classList.add("hidden");
  register.classList.add("hidden");
  profile.classList.remove("hidden");

  const photoSrc = client.photo || "https://via.placeholder.com/120?text=Sem+Foto";
  document.getElementById("clientPhoto").src = photoSrc;

  const dataDiv = document.getElementById("clientData");
  dataDiv.innerHTML = `
    <strong>Nome:</strong> ${client.name}<br>
    <strong>Telefone:</strong> ${client.phone}<br>
    <strong>CPF:</strong> ${client.cpf}<br>
    <strong>RG:</strong> ${client.rg}<br>
    <strong>Endereço:</strong> ${client.address}<br>
    <strong>CEP:</strong> ${client.cep}<br>
  `;

  updateLoanInfo();

  const reminderDiv = document.getElementById("reminderMessage");
  const hasOverdue = currentClient.loans && currentClient.loans.some(l => l.debt > 0 && new Date(l.dueDate) < new Date());
  if (hasOverdue) {
    reminderDiv.textContent = "⚠️ Este cliente está inadimplente! Existem dívidas vencidas.";
    reminderDiv.classList.remove("hidden");
  } else {
    hideReminder();
  }
  hidePaymentSection();
}

function editProfile() {
  if (!currentClient) {
    alert("Nenhum cliente selecionado.");
    return;
  }
  document.getElementById("name").value = currentClient.name || "";
  document.getElementById("phone").value = currentClient.phone || "";
  document.getElementById("cpf").value = currentClient.cpf || "";
  document.getElementById("rg").value = currentClient.rg || "";
  document.getElementById("address").value = currentClient.address || "";
  document.getElementById("cep").value = currentClient.cep || "";

  const preview = document.getElementById("photoPreview");
  if (currentClient.photo) {
    preview.src = currentClient.photo;
    preview.classList.remove("hidden");
  } else {
    preview.src = "";
    preview.classList.add("hidden");
  }

  document.getElementById("homeScreen").classList.add("hidden");
  document.getElementById("registerForm").classList.remove("hidden");
  document.getElementById("clientProfile").classList.add("hidden");
  editingProfile = true;
}

function backToHome() {
  document.getElementById("homeScreen").classList.remove("hidden");
  document.getElementById("registerForm").classList.add("hidden");
  document.getElementById("clientProfile").classList.add("hidden");
  updateDuePaymentsList();
}
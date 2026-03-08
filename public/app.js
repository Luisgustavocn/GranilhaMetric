const state = {
  user: null,
  cans: [],
  trucks: [],
  users: [],
  cargoItems: [],
  selectedCanId: null,
  selectedTruckId: null,
  selectedUserId: null,
  calculationMode: 'automatic',
  manualDistributionType: 'single',
  manualSingleTruckId: null,
  manualAllocations: [{ id: 1, truckId: null, quantity: 1 }],
  nextManualAllocationId: 2
};

const loginCard = document.getElementById('login-card');
const appSection = document.getElementById('app');
const adminPanel = document.getElementById('admin-panel');
const logoutBtn = document.getElementById('logout-btn');
const sessionInfo = document.getElementById('session-info');
const toast = document.getElementById('toast');
const resultBox = document.getElementById('calculation-result');

const loginForm = document.getElementById('login-form');
const userForm = document.getElementById('user-form');
const canForm = document.getElementById('can-form');
const truckForm = document.getElementById('truck-form');
const cargoItemForm = document.getElementById('cargo-item-form');
const calculateBtn = document.getElementById('calculate-btn');
const manualTruckForm = document.getElementById('manual-truck-form');
const manualMultiCalcBtn = document.getElementById('manual-multi-calc-btn');
const addManualAllocationBtn = document.getElementById('add-manual-allocation-btn');
const shapeSelect = document.getElementById('shape-select');
const manualDistributionTypeSelect = document.getElementById('manual-distribution-type');
const automaticCalcPanel = document.getElementById('automatic-calc-panel');
const manualCalcPanel = document.getElementById('manual-calc-panel');
const manualMultiPanel = document.getElementById('manual-multi-panel');

const canSelect = document.getElementById('can-select');
const quantityInput = document.getElementById('quantity-input');
const manualTruckSelect = document.getElementById('manual-truck-select');
const manualAllocationList = document.getElementById('manual-allocation-list');
const cargoBody = document.getElementById('cargo-body');
const cansBody = document.getElementById('cans-body');
const trucksBody = document.getElementById('trucks-body');
const usersBody = document.getElementById('users-body');
const manualResultBox = document.getElementById('manual-result');
const entityModalOverlay = document.getElementById('entity-modal-overlay');
const closeEntityModalBtn = document.getElementById('close-entity-modal-btn');
const entityModalTitle = document.getElementById('entity-modal-title');
const entityModalContent = document.getElementById('entity-modal-content');
const calculationModeInputs = document.querySelectorAll('input[name="calculationMode"]');

init();

async function init() {
  bindEvents();
  await tryLoadSession();
}

function bindEvents() {
  loginForm.addEventListener('submit', onLogin);
  logoutBtn.addEventListener('click', onLogout);
  userForm.addEventListener('submit', onCreateUser);
  canForm.addEventListener('submit', onCreateCan);
  truckForm.addEventListener('submit', onCreateTruck);
  cargoItemForm.addEventListener('submit', onAddCargoItem);
  calculateBtn.addEventListener('click', onCalculateAutomatic);
  manualTruckForm.addEventListener('submit', onManualSingleSimulation);
  manualMultiCalcBtn.addEventListener('click', onManualMultiSimulation);
  addManualAllocationBtn.addEventListener('click', onAddManualAllocation);
  manualDistributionTypeSelect.addEventListener('change', onManualDistributionTypeChange);
  manualTruckSelect.addEventListener('change', () => {
    const selected = Number(manualTruckSelect.value);
    state.manualSingleTruckId = Number.isInteger(selected) ? selected : null;
  });
  calculationModeInputs.forEach((input) => {
    input.addEventListener('change', onCalculationModeChange);
  });
  shapeSelect.addEventListener('change', syncCanShapeFields);
  closeEntityModalBtn.addEventListener('click', closeEntityModal);
  entityModalOverlay.addEventListener('click', (event) => {
    if (event.target === entityModalOverlay) {
      closeEntityModal();
    }
  });
  document.addEventListener('keydown', onGlobalKeydown);
  syncCalculationPanels();
  syncCanShapeFields();
}

async function tryLoadSession() {
  const response = await api('/api/me');
  if (!response.ok) {
    renderLoggedOut();
    return;
  }

  state.user = response.data.user;
  await loadData();
  renderApp();
}

async function onLogin(event) {
  event.preventDefault();
  const form = new FormData(loginForm);
  const payload = {
    email: form.get('email'),
    password: form.get('password')
  };

  const response = await api('/api/login', { method: 'POST', body: payload });
  if (!response.ok) {
    showToast(response.data.error || 'Falha no login.');
    return;
  }

  state.user = response.data.user;
  loginForm.reset();
  state.cargoItems = [];
  await loadData();
  renderApp();
  showToast('Login realizado com sucesso.');
}

async function onLogout() {
  await api('/api/logout', { method: 'POST', body: {} });
  state.user = null;
  state.cargoItems = [];
  renderLoggedOut();
}

async function loadData() {
  const [canRes, truckRes] = await Promise.all([api('/api/cans'), api('/api/trucks')]);

  if (!canRes.ok || !truckRes.ok) {
    showToast('Erro ao carregar dados iniciais.');
    return;
  }

  state.cans = canRes.data.cans;
  state.trucks = truckRes.data.trucks;
  state.cargoItems = state.cargoItems.filter((item) => state.cans.some((can) => can.id === item.canId));
  sanitizeManualSelections();

  if (state.user?.role === 'admin') {
    const usersRes = await api('/api/users');
    state.users = usersRes.ok ? usersRes.data.users : [];
  } else {
    state.users = [];
  }
}

function renderLoggedOut() {
  loginCard.classList.remove('hidden');
  appSection.classList.add('hidden');
  adminPanel.classList.add('hidden');
  logoutBtn.classList.add('hidden');
  sessionInfo.classList.add('hidden');
  sessionInfo.textContent = '';
  closeEntityModal();
}

function renderApp() {
  loginCard.classList.add('hidden');
  appSection.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');
  sessionInfo.classList.remove('hidden');
  sessionInfo.textContent = `${state.user.name} (${state.user.role})`;

  if (state.user.role === 'admin') {
    adminPanel.classList.remove('hidden');
  } else {
    adminPanel.classList.add('hidden');
  }

  renderCans();
  renderTrucks();
  renderUsers();
  renderCargoBuilder();
  syncCalculationPanels();
}

function renderCans() {
  cansBody.innerHTML = '';
  canSelect.innerHTML = '';
  const isAdmin = state.user?.role === 'admin';
  const hasSelection = state.cans.some((can) => can.id === state.selectedCanId);
  if (!hasSelection) {
    state.selectedCanId = state.cans[0]?.id ?? null;
  }
  if (!state.selectedCanId) {
    closeCanModal();
  }

  for (const can of state.cans) {
    const tr = document.createElement('tr');
    tr.classList.add('selectable-row');
    if (can.id === state.selectedCanId) {
      tr.classList.add('selected-row');
    }
    tr.innerHTML = `
      <td>${escapeHtml(can.name)}</td>
      <td>${can.shape === 'square' ? 'Quadrada' : 'Cilindrica'}</td>
      <td>${formatVolume(can.volume_cm3)}</td>
      <td class="actions-cell">
        ${
          isAdmin
            ? `<button class="row-action edit-can-btn" type="button">Editar</button>
               <button class="row-action danger delete-can-btn" type="button">Excluir</button>`
            : '-'
        }
      </td>
    `;
    tr.addEventListener('click', () => {
      state.selectedCanId = can.id;
      renderCans();
      openCanDetailsModal(can);
    });

    if (isAdmin) {
      tr.querySelector('.edit-can-btn')?.addEventListener('click', (event) => {
        event.stopPropagation();
        onEditCan(can.id);
      });
      tr.querySelector('.delete-can-btn')?.addEventListener('click', (event) => {
        event.stopPropagation();
        onDeleteCan(can.id);
      });
    }

    cansBody.appendChild(tr);

    const option = document.createElement('option');
    option.value = String(can.id);
    option.textContent = `${can.name} (${formatVolume(can.volume_cm3)})`;
    canSelect.appendChild(option);
  }

}

function renderTrucks() {
  trucksBody.innerHTML = '';
  manualTruckSelect.innerHTML = '';
  const isAdmin = state.user?.role === 'admin';

  for (const truck of state.trucks) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(truck.name)}</td>
      <td>${truck.length_cm} x ${truck.width_cm} x ${truck.height_cm} cm</td>
      <td>${formatVolume(truck.volume_cm3)}</td>
      <td class="actions-cell">
        ${
          isAdmin
            ? `<button class="row-action edit-truck-btn" type="button">Editar</button>
               <button class="row-action danger delete-truck-btn" type="button">Excluir</button>`
            : '-'
        }
      </td>
    `;

    if (isAdmin) {
      tr.querySelector('.edit-truck-btn')?.addEventListener('click', () => onEditTruck(truck.id));
      tr.querySelector('.delete-truck-btn')?.addEventListener('click', () => onDeleteTruck(truck.id));
    }

    trucksBody.appendChild(tr);

    const option = document.createElement('option');
    option.value = String(truck.id);
    option.textContent = `${truck.name} (${formatVolume(truck.volume_cm3)})`;
    manualTruckSelect.appendChild(option);
  }

  if (state.manualSingleTruckId && state.trucks.some((truck) => truck.id === state.manualSingleTruckId)) {
    manualTruckSelect.value = String(state.manualSingleTruckId);
  } else if (state.trucks[0]) {
    state.manualSingleTruckId = state.trucks[0].id;
    manualTruckSelect.value = String(state.manualSingleTruckId);
  }

  renderManualAllocationRows();
}

function renderUsers() {
  usersBody.innerHTML = '';
  if (state.user?.role !== 'admin') return;

  for (const user of state.users) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(user.name)}</td>
      <td>${escapeHtml(user.email)}</td>
      <td>${user.role}</td>
      <td class="actions-cell">
        <button class="row-action edit-user-btn" type="button">Editar</button>
        <button class="row-action danger delete-user-btn" type="button">Excluir</button>
      </td>
    `;
    tr.querySelector('.edit-user-btn')?.addEventListener('click', () => onEditUser(user.id));
    tr.querySelector('.delete-user-btn')?.addEventListener('click', () => onDeleteUser(user.id));
    usersBody.appendChild(tr);
  }
}

function renderCargoBuilder() {
  cargoBody.innerHTML = '';
  resultBox.classList.add('hidden');
  manualResultBox.classList.add('hidden');

  state.cargoItems.forEach((item, index) => {
    const can = state.cans.find((entry) => entry.id === item.canId);
    if (!can) return;

    const subtotal = can.volume_cm3 * item.quantity;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(can.name)}</td>
      <td>${item.quantity}</td>
      <td>${formatVolume(can.volume_cm3)}</td>
      <td>${formatVolume(subtotal)}</td>
      <td><button class="remove-btn" data-index="${index}" type="button">Remover</button></td>
    `;

    cargoBody.appendChild(tr);
  });

  cargoBody.querySelectorAll('.remove-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.cargoItems.splice(Number(button.dataset.index), 1);
      renderCargoBuilder();
    });
  });
}

function openCanDetailsModal(can) {
  canModalContent.innerHTML = `
    <p><strong>Nome:</strong> ${escapeHtml(can.name)}</p>
    <p><strong>Formato:</strong> ${can.shape === 'square' ? 'Lata Quadrada' : 'Balde Cilindrico'}</p>
    <p><strong>Volume:</strong> ${formatVolume(can.volume_cm3)}</p>
    <p><strong>Dimensoes:</strong> ${escapeHtml(formatCanDimensions(can))}</p>
    <p><strong>Cadastrada em:</strong> ${escapeHtml(String(can.created_at || '-'))}</p>
  `;
  canModalOverlay.classList.remove('hidden');
}

function closeCanModal() {
  canModalOverlay.classList.add('hidden');
}

function onGlobalKeydown(event) {
  if (event.key === 'Escape' && !canModalOverlay.classList.contains('hidden')) {
    closeCanModal();
  }
}

async function onCreateUser(event) {
  event.preventDefault();
  const form = new FormData(userForm);
  const payload = {
    name: form.get('name'),
    email: form.get('email'),
    password: form.get('password'),
    role: form.get('role')
  };

  const response = await api('/api/users', { method: 'POST', body: payload });
  if (!response.ok) {
    showToast(response.data.error || 'Nao foi possivel cadastrar usuario.');
    return;
  }

  userForm.reset();
  await loadData();
  renderUsers();
  showToast('Usuario cadastrado.');
}

async function onCreateCan(event) {
  event.preventDefault();
  const form = new FormData(canForm);
  const payload = {
    name: form.get('name'),
    shape: form.get('shape'),
    heightCm: Number(form.get('heightCm')),
    side1Cm: Number(form.get('side1Cm')),
    side2Cm: Number(form.get('side2Cm')),
    diameterCm: Number(form.get('diameterCm'))
  };

  const response = await api('/api/cans', { method: 'POST', body: payload });
  if (!response.ok) {
    showToast(response.data.error || 'Nao foi possivel cadastrar lata.');
    return;
  }

  canForm.reset();
  syncCanShapeFields();
  await loadData();
  renderApp();
  showToast('Lata cadastrada.');
}

async function onCreateTruck(event) {
  event.preventDefault();
  const form = new FormData(truckForm);
  const payload = {
    name: form.get('name'),
    lengthCm: Number(form.get('lengthCm')),
    widthCm: Number(form.get('widthCm')),
    heightCm: Number(form.get('heightCm'))
  };

  const response = await api('/api/trucks', { method: 'POST', body: payload });
  if (!response.ok) {
    showToast(response.data.error || 'Nao foi possivel cadastrar caminhao.');
    return;
  }

  truckForm.reset();
  await loadData();
  renderApp();
  showToast('Caminhao cadastrado.');
}

async function onEditCan(canId) {
  const can = state.cans.find((entry) => entry.id === canId);
  if (!can) {
    showToast('Lata nao encontrada.');
    return;
  }

  const name = askRequiredText('Nome da lata:', can.name);
  if (name === null) return;

  const shapeInput = askRequiredText(
    'Formato (quadrada/cilindrica):',
    can.shape === 'square' ? 'quadrada' : 'cilindrica'
  );
  if (shapeInput === null) return;

  const shape = normalizeShapeInput(shapeInput);
  if (!shape) {
    showToast('Formato invalido. Use quadrada ou cilindrica.');
    return;
  }

  const heightCm = askPositiveNumber('Altura (cm):', can.height_cm);
  if (heightCm === null) return;

  const payload = { name, shape, heightCm };

  if (shape === 'square') {
    const side1Cm = askPositiveNumber('Lado 1 (cm):', can.length_cm);
    if (side1Cm === null) return;
    const side2Cm = askPositiveNumber('Lado 2 (cm):', can.width_cm);
    if (side2Cm === null) return;
    payload.side1Cm = side1Cm;
    payload.side2Cm = side2Cm;
  } else {
    const diameterCm = askPositiveNumber('Diametro (cm):', can.diameter_cm);
    if (diameterCm === null) return;
    payload.diameterCm = diameterCm;
  }

  const response = await api(`/api/cans/${canId}`, { method: 'PUT', body: payload });
  if (!response.ok) {
    showToast(response.data.error || 'Nao foi possivel editar a lata.');
    return;
  }

  await loadData();
  renderApp();
  showToast('Lata atualizada.');
}

async function onDeleteCan(canId) {
  const can = state.cans.find((entry) => entry.id === canId);
  if (!can) {
    showToast('Lata nao encontrada.');
    return;
  }

  if (!window.confirm(`Excluir a lata \"${can.name}\"?`)) {
    return;
  }

  const response = await api(`/api/cans/${canId}`, { method: 'DELETE' });
  if (!response.ok) {
    showToast(response.data.error || 'Nao foi possivel excluir a lata.');
    return;
  }

  await loadData();
  renderApp();
  showToast('Lata excluida.');
}

async function onEditTruck(truckId) {
  const truck = state.trucks.find((entry) => entry.id === truckId);
  if (!truck) {
    showToast('Caminhao nao encontrado.');
    return;
  }

  const name = askRequiredText('Nome do caminhao:', truck.name);
  if (name === null) return;

  const lengthCm = askPositiveNumber('Comprimento interno (cm):', truck.length_cm);
  if (lengthCm === null) return;
  const widthCm = askPositiveNumber('Largura interna (cm):', truck.width_cm);
  if (widthCm === null) return;
  const heightCm = askPositiveNumber('Altura interna (cm):', truck.height_cm);
  if (heightCm === null) return;

  const response = await api(`/api/trucks/${truckId}`, {
    method: 'PUT',
    body: { name, lengthCm, widthCm, heightCm }
  });

  if (!response.ok) {
    showToast(response.data.error || 'Nao foi possivel editar o caminhao.');
    return;
  }

  await loadData();
  renderApp();
  showToast('Caminhao atualizado.');
}

async function onDeleteTruck(truckId) {
  const truck = state.trucks.find((entry) => entry.id === truckId);
  if (!truck) {
    showToast('Caminhao nao encontrado.');
    return;
  }

  if (!window.confirm(`Excluir o caminhao \"${truck.name}\"?`)) {
    return;
  }

  const response = await api(`/api/trucks/${truckId}`, { method: 'DELETE' });
  if (!response.ok) {
    showToast(response.data.error || 'Nao foi possivel excluir o caminhao.');
    return;
  }

  await loadData();
  renderApp();
  showToast('Caminhao excluido.');
}

async function onEditUser(userId) {
  const user = state.users.find((entry) => entry.id === userId);
  if (!user) {
    showToast('Usuario nao encontrado.');
    return;
  }

  const name = askRequiredText('Nome do usuario:', user.name);
  if (name === null) return;
  const email = askRequiredText('Email do usuario:', user.email);
  if (email === null) return;

  const roleInput = askRequiredText('Perfil (admin/user):', user.role);
  if (roleInput === null) return;
  const role = normalizeRoleInput(roleInput);
  if (!role) {
    showToast('Perfil invalido. Use admin ou user.');
    return;
  }

  const passwordInput = window.prompt('Nova senha (deixe em branco para manter a atual):', '');
  if (passwordInput === null) return;

  const payload = { name, email, role };
  if (passwordInput.trim()) {
    payload.password = passwordInput;
  }

  const response = await api(`/api/users/${userId}`, { method: 'PUT', body: payload });
  if (!response.ok) {
    showToast(response.data.error || 'Nao foi possivel editar o usuario.');
    return;
  }

  await loadData();
  renderApp();
  showToast('Usuario atualizado.');
}

async function onDeleteUser(userId) {
  const user = state.users.find((entry) => entry.id === userId);
  if (!user) {
    showToast('Usuario nao encontrado.');
    return;
  }

  if (!window.confirm(`Excluir o usuario \"${user.name}\"?`)) {
    return;
  }

  const response = await api(`/api/users/${userId}`, { method: 'DELETE' });
  if (!response.ok) {
    showToast(response.data.error || 'Nao foi possivel excluir o usuario.');
    return;
  }

  await loadData();
  renderApp();
  showToast('Usuario excluido.');
}

function onAddCargoItem(event) {
  event.preventDefault();

  const canId = Number(canSelect.value);
  const quantity = Number(quantityInput.value);

  if (!Number.isInteger(canId) || !Number.isInteger(quantity) || quantity <= 0) {
    showToast('Selecione uma lata e uma quantidade valida.');
    return;
  }

  const existing = state.cargoItems.find((item) => item.canId === canId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    state.cargoItems.push({ canId, quantity });
  }

  quantityInput.value = '1';
  resultBox.classList.add('hidden');
  manualResultBox.classList.add('hidden');
  renderCargoBuilder();
}

async function onCalculateAutomatic() {
  if (!state.cargoItems.length) {
    showToast('Adicione ao menos um item para calcular.');
    return;
  }

  const response = await api('/api/calculate', {
    method: 'POST',
    body: { mode: 'automatic', items: state.cargoItems }
  });

  if (!response.ok) {
    resultBox.classList.remove('hidden');
    resultBox.innerHTML = `<strong>Falha:</strong> ${escapeHtml(response.data.error || 'Nao foi possivel calcular.')}`;
    return;
  }

  resultBox.classList.remove('hidden');
  renderCalculationResult(resultBox, response.data, 'automatic');
}

async function onManualSingleSimulation(event) {
  event.preventDefault();

  if (!state.cargoItems.length) {
    showToast('Adicione ao menos um item para simular.');
    return;
  }

  const truckId = Number(manualTruckSelect.value);
  if (!Number.isInteger(truckId)) {
    showToast('Selecione um caminhao para simulacao manual.');
    return;
  }

  const response = await api('/api/calculate', {
    method: 'POST',
    body: {
      mode: 'manual',
      items: state.cargoItems,
      manual: { type: 'single', truckId }
    }
  });

  if (!response.ok) {
    manualResultBox.classList.remove('hidden');
    manualResultBox.innerHTML = `<strong>Falha:</strong> ${escapeHtml(response.data.error || 'Nao foi possivel simular.')}`;
    return;
  }

  manualResultBox.classList.remove('hidden');
  renderCalculationResult(manualResultBox, response.data, 'manual');
}

async function onManualMultiSimulation() {
  if (!state.cargoItems.length) {
    showToast('Adicione ao menos um item para simular.');
    return;
  }

  const allocations = state.manualAllocations
    .map((row) => ({ truckId: Number(row.truckId), quantity: Number(row.quantity) }))
    .filter((row) => Number.isInteger(row.truckId) && Number.isInteger(row.quantity) && row.quantity > 0);

  if (!allocations.length) {
    showToast('Adicione pelo menos um caminhao com quantidade valida.');
    return;
  }

  const response = await api('/api/calculate', {
    method: 'POST',
    body: {
      mode: 'manual',
      items: state.cargoItems,
      manual: { type: 'multi', allocations }
    }
  });

  if (!response.ok) {
    manualResultBox.classList.remove('hidden');
    manualResultBox.innerHTML = `<strong>Falha:</strong> ${escapeHtml(response.data.error || 'Nao foi possivel simular.')}`;
    return;
  }

  manualResultBox.classList.remove('hidden');
  renderCalculationResult(manualResultBox, response.data, 'manual');
}

function sanitizeManualSelections() {
  const validTruckIds = new Set(state.trucks.map((truck) => truck.id));

  if (!validTruckIds.has(state.manualSingleTruckId)) {
    state.manualSingleTruckId = state.trucks[0]?.id ?? null;
  }

  state.manualAllocations = state.manualAllocations
    .map((row) => ({
      ...row,
      truckId: validTruckIds.has(row.truckId) ? row.truckId : state.trucks[0]?.id ?? null,
      quantity: Number.isInteger(Number(row.quantity)) && Number(row.quantity) > 0 ? Number(row.quantity) : 1
    }))
    .filter((row) => row.truckId !== null);

  if (!state.manualAllocations.length && state.trucks[0]) {
    state.manualAllocations = [{ id: state.nextManualAllocationId++, truckId: state.trucks[0].id, quantity: 1 }];
  }
}

function onCalculationModeChange() {
  const selected = Array.from(calculationModeInputs).find((input) => input.checked)?.value || 'automatic';
  state.calculationMode = selected === 'manual' ? 'manual' : 'automatic';
  syncCalculationPanels();
}

function onManualDistributionTypeChange() {
  state.manualDistributionType = manualDistributionTypeSelect.value === 'multi' ? 'multi' : 'single';
  syncCalculationPanels();
}

function syncCalculationPanels() {
  calculationModeInputs.forEach((input) => {
    input.checked = input.value === state.calculationMode;
  });
  automaticCalcPanel.classList.toggle('hidden', state.calculationMode !== 'automatic');
  manualCalcPanel.classList.toggle('hidden', state.calculationMode !== 'manual');

  manualDistributionTypeSelect.value = state.manualDistributionType;
  manualTruckForm.classList.toggle('hidden', state.manualDistributionType !== 'single');
  manualMultiPanel.classList.toggle('hidden', state.manualDistributionType !== 'multi');
  resultBox.classList.add('hidden');
  manualResultBox.classList.add('hidden');
}

function onAddManualAllocation() {
  if (!state.trucks.length) {
    showToast('Cadastre caminhoes antes de distribuir manualmente.');
    return;
  }

  state.manualAllocations.push({
    id: state.nextManualAllocationId++,
    truckId: state.trucks[0].id,
    quantity: 1
  });
  renderManualAllocationRows();
}

function renderManualAllocationRows() {
  manualAllocationList.innerHTML = '';

  for (const row of state.manualAllocations) {
    const wrapper = document.createElement('div');
    wrapper.className = 'allocation-row';

    const selectLabel = document.createElement('label');
    selectLabel.textContent = 'Caminhao';
    const select = document.createElement('select');
    for (const truck of state.trucks) {
      const option = document.createElement('option');
      option.value = String(truck.id);
      option.textContent = `${truck.name} (${formatVolume(truck.volume_cm3)})`;
      select.appendChild(option);
    }
    select.value = String(row.truckId);
    select.addEventListener('change', () => {
      row.truckId = Number(select.value);
    });
    selectLabel.appendChild(select);

    const qtyLabel = document.createElement('label');
    qtyLabel.textContent = 'Quantidade';
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '1';
    qtyInput.step = '1';
    qtyInput.value = String(row.quantity);
    qtyInput.addEventListener('change', () => {
      const qty = Number(qtyInput.value);
      row.quantity = Number.isInteger(qty) && qty > 0 ? qty : 1;
      qtyInput.value = String(row.quantity);
    });
    qtyLabel.appendChild(qtyInput);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'row-action danger';
    removeBtn.textContent = 'Remover';
    removeBtn.addEventListener('click', () => {
      if (state.manualAllocations.length <= 1) {
        showToast('Mantenha ao menos um item de caminhao na distribuicao manual.');
        return;
      }
      state.manualAllocations = state.manualAllocations.filter((entry) => entry.id !== row.id);
      renderManualAllocationRows();
    });

    wrapper.appendChild(selectLabel);
    wrapper.appendChild(qtyLabel);
    wrapper.appendChild(removeBtn);
    manualAllocationList.appendChild(wrapper);
  }
}

function renderCalculationResult(targetBox, payload, sourceMode) {
  const allocation = payload?.allocation;
  if (!allocation) {
    targetBox.innerHTML = `<strong>Falha:</strong> Resultado de calculo invalido.`;
    return;
  }

  const title =
    sourceMode === 'automatic'
      ? payload.strategy === 'single'
        ? 'Resultado automatico (1 caminhao)'
        : 'Resultado automatico (distribuido em varios caminhoes)'
      : payload.strategy === 'single'
        ? 'Resultado manual (1 caminhao)'
        : 'Resultado manual (distribuido)';

  const trucksHtml = allocation.trucks
    .map((truck) => {
      return `<li>${truck.quantity}x ${escapeHtml(truck.name)} (${formatVolume(truck.totalCapacityCm3)} de capacidade)</li>`;
    })
    .join('');

  const statusLine = allocation.fits
    ? `<p><strong>Status:</strong> Carga comportada.</p>`
    : `<p><strong>Status:</strong> Espaco insuficiente.</p>`;

  const trailing = allocation.fits
    ? `<p><strong>Sobra de espaco:</strong> ${formatVolume(allocation.leftoverCm3)}</p>`
    : `<p><strong>Carga que ficaria de fora:</strong> ${formatVolume(allocation.missingCm3)}</p>`;

  targetBox.innerHTML = `
    <h3>${title}</h3>
    <p><strong>Volume total da carga:</strong> ${formatVolume(payload.totalVolumeCm3 || 0)}</p>
    <p><strong>Capacidade total selecionada:</strong> ${formatVolume(allocation.totalCapacityCm3 || 0)}</p>
    <p><strong>Caminhoes usados:</strong></p>
    <ul>${trucksHtml}</ul>
    ${statusLine}
    ${trailing}
    <p><strong>Ocupacao:</strong> ${((allocation.occupancyRate || 0) * 100).toFixed(2)}%</p>
  `;
}

function askRequiredText(label, currentValue) {
  const input = window.prompt(label, String(currentValue ?? ''));
  if (input === null) return null;
  const value = input.trim();
  if (!value) {
    showToast('Este campo e obrigatorio.');
    return null;
  }
  return value;
}

function askPositiveNumber(label, currentValue) {
  const input = window.prompt(label, String(currentValue ?? ''));
  if (input === null) return null;
  const numeric = Number(String(input).replace(',', '.'));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    showToast('Informe um numero maior que zero.');
    return null;
  }
  return numeric;
}

function normalizeShapeInput(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (['square', 'quadrada', 'quadrado', 'lata quadrada'].includes(normalized)) {
    return 'square';
  }

  if (['cylinder', 'cilindrica', 'cilindrico', 'balde cilindrico'].includes(normalized)) {
    return 'cylinder';
  }

  return '';
}

function normalizeRoleInput(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'admin' || normalized === 'administrador') return 'admin';
  if (normalized === 'user' || normalized === 'usuario') return 'user';
  return '';
}

function syncCanShapeFields() {
  const shape = shapeSelect.value;
  document.querySelectorAll('.shape-square').forEach((element) => {
    element.classList.toggle('hidden', shape !== 'square');
    const input = element.querySelector('input');
    input.required = shape === 'square';
  });

  document.querySelectorAll('.shape-cylinder').forEach((element) => {
    element.classList.toggle('hidden', shape !== 'cylinder');
    const input = element.querySelector('input');
    input.required = shape === 'cylinder';
  });
}

function formatCanDimensions(can) {
  if (can.shape === 'square') {
    return `Alt ${can.height_cm} | Lado 1 ${can.length_cm} | Lado 2 ${can.width_cm} cm`;
  }

  return `Alt ${can.height_cm} | Diam ${can.diameter_cm} cm`;
}

function formatVolume(volumeCm3) {
  const liters = volumeCm3 / 1000;
  return `${liters.toFixed(2)} L`;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  return { ok: response.ok, status: response.status, data };
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

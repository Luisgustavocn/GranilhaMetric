const state = {
  user: null,
  cans: [],
  trucks: [],
  users: [],
  orders: [],
  cargoItems: [],
  selectedCanId: null,
  selectedTruckId: null,
  selectedUserId: null,
  selectedOrderId: null,
  unavailableTruckIds: [],
  truckAvailabilityById: {},
  todayBusyTruckIds: [],
  todayBusyTrucks: [],
  todayTruckAvailabilityById: {},
  calculationMode: 'automatic',
  manualDistributionType: 'single',
  manualSingleTruckId: null,
  manualAllocations: [{ id: 1, truckId: null, quantity: 1 }],
  nextManualAllocationId: 2,
  lastCalculation: null,
  currentView: 'inicio-section',
  modal: null,
  confirmModal: null
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
const launchOrderBtn = document.getElementById('launch-order-btn');
const shapeSelect = document.getElementById('shape-select');
const manualDistributionTypeSelect = document.getElementById('manual-distribution-type');
const automaticCalcPanel = document.getElementById('automatic-calc-panel');
const manualCalcPanel = document.getElementById('manual-calc-panel');
const manualMultiPanel = document.getElementById('manual-multi-panel');
const orderStartDateInput = document.getElementById('order-start-date-input');
const orderEndDateInput = document.getElementById('order-end-date-input');
const legacyOrderDateInput = document.getElementById('order-date-input');
const dateAvailabilityHint = document.getElementById('date-availability-hint');

const canSelect = document.getElementById('can-select');
const quantityInput = document.getElementById('quantity-input');
const manualTruckSelect = document.getElementById('manual-truck-select');
const manualAllocationList = document.getElementById('manual-allocation-list');
const cargoBody = document.getElementById('cargo-body');
const cansBody = document.getElementById('cans-body');
const trucksBody = document.getElementById('trucks-body');
const usersBody = document.getElementById('users-body');
const ordersBody = document.getElementById('orders-body');
const manualResultBox = document.getElementById('manual-result');
const entityModalOverlay = document.getElementById('entity-modal-overlay');
const closeEntityModalBtn = document.getElementById('close-entity-modal-btn');
const entityModalTitle = document.getElementById('entity-modal-title');
const entityModalContent = document.getElementById('entity-modal-content');
const confirmModalOverlay = document.getElementById('confirm-modal-overlay');
const closeConfirmModalBtn = document.getElementById('close-confirm-modal-btn');
const confirmModalTitle = document.getElementById('confirm-modal-title');
const confirmModalContent = document.getElementById('confirm-modal-content');
const confirmModalCancelBtn = document.getElementById('confirm-modal-cancel-btn');
const confirmModalConfirmBtn = document.getElementById('confirm-modal-confirm-btn');
const calculationModeInputs = document.querySelectorAll('input[name="calculationMode"]');
const sideNavItems = document.querySelectorAll('.nav-list li[data-target]');
const navAdminItem = document.getElementById('nav-admin-item');
const viewPanes = document.querySelectorAll('.view-pane');
const summaryStats = document.getElementById('summary-stats');
const inicioOrdersList = document.getElementById('inicio-orders-list');
const inicioTrucksList = document.getElementById('inicio-trucks-list');
const inicioAlertsList = document.getElementById('inicio-alerts-list');
const inicioCapacityList = document.getElementById('inicio-capacity-list');
const inicioDateLabel = document.getElementById('inicio-date-label');

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
  launchOrderBtn.addEventListener('click', onLaunchOrder);
  orderStartDateInput.addEventListener('change', onOrderDateChange);
  orderEndDateInput.addEventListener('change', onOrderDateChange);
  manualDistributionTypeSelect.addEventListener('change', onManualDistributionTypeChange);
  manualTruckSelect.addEventListener('change', () => {
    const selected = Number(manualTruckSelect.value);
    state.manualSingleTruckId = Number.isInteger(selected) ? selected : null;
    state.lastCalculation = null;
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
  closeConfirmModalBtn.addEventListener('click', () => closeConfirmModal(false));
  confirmModalCancelBtn.addEventListener('click', () => closeConfirmModal(false));
  confirmModalOverlay.addEventListener('click', (event) => {
    if (event.target === confirmModalOverlay) {
      closeConfirmModal(false);
    }
  });
  confirmModalConfirmBtn.addEventListener('click', async () => {
    const handler = state.confirmModal?.onConfirm;
    closeConfirmModal(true);
    if (typeof handler === 'function') {
      await handler();
    }
  });
  sideNavItems.forEach((item) => {
    item.addEventListener('click', () => onSideNavClick(item));
  });
  document.addEventListener('keydown', onGlobalKeydown);
  orderStartDateInput.value = getTodayDateIso();
  orderEndDateInput.value = getTodayDateIso();
  syncLegacyOrderDateInput();
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
  const todayIso = getTodayDateIso();
  const [canRes, truckRes, ordersRes, todayAvailabilityRes] = await Promise.all([
    api('/api/cans'),
    api('/api/trucks'),
    api('/api/orders'),
    api(`/api/truck-availability?startDate=${encodeURIComponent(todayIso)}&endDate=${encodeURIComponent(todayIso)}`)
  ]);

  if (!canRes.ok || !truckRes.ok || !ordersRes.ok) {
    showToast('Erro ao carregar dados iniciais.');
    return;
  }

  state.cans = canRes.data.cans;
  state.trucks = truckRes.data.trucks;
  state.orders = ordersRes.data.orders;
  state.todayBusyTruckIds = todayAvailabilityRes.ok ? todayAvailabilityRes.data.busyTruckIds || [] : [];
  state.todayBusyTrucks = todayAvailabilityRes.ok ? todayAvailabilityRes.data.busyTrucks || [] : [];
  state.todayTruckAvailabilityById = buildTruckAvailabilityLookup(todayAvailabilityRes.ok ? todayAvailabilityRes.data.availability : []);
  state.cargoItems = state.cargoItems.filter((item) => state.cans.some((can) => can.id === item.canId));
  await syncTruckAvailabilityForRange(false);
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
  state.unavailableTruckIds = [];
  state.truckAvailabilityById = {};
  state.todayTruckAvailabilityById = {};
  state.todayBusyTruckIds = [];
  state.todayBusyTrucks = [];
  state.lastCalculation = null;
  state.currentView = 'inicio-section';
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
    navAdminItem?.classList.remove('hidden');
  } else {
    adminPanel.classList.add('hidden');
    navAdminItem?.classList.add('hidden');
    if (state.currentView === 'admin-panel') {
      state.currentView = 'inicio-section';
    }
  }

  renderHomeOverview();
  renderCans();
  renderTrucks();
  renderDateAvailabilityHint();
  renderUsers();
  renderOrders();
  renderCargoBuilder();
  syncCalculationPanels();
  setCurrentView(state.currentView);
}

function onSideNavClick(item) {
  const targetId = item.dataset.target;
  if (!targetId) return;
  setCurrentView(targetId);
}

function setActiveSideNav(targetId) {
  sideNavItems.forEach((entry) => {
    entry.classList.toggle('active', entry.dataset.target === targetId);
  });
}

function setCurrentView(targetId) {
  const target = document.getElementById(targetId);
  if (!target || (targetId === 'admin-panel' && state.user?.role !== 'admin')) {
    state.currentView = 'inicio-section';
  } else {
    state.currentView = targetId;
  }

  viewPanes.forEach((pane) => {
    pane.classList.toggle('hidden', pane.id !== state.currentView);
  });
  setActiveSideNav(state.currentView);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderHomeOverview() {
  const todayIso = getTodayDateIso();
  const openOrders = state.orders.filter((order) => order.status === 'open');
  const completedOrders = state.orders.filter((order) => order.status === 'completed');
  const ordersToday = state.orders.filter((order) => doesOrderOverlapDate(order, todayIso));
  const busyTodayCount = state.trucks.reduce((sum, truck) => {
    const reserved = Number(getTodayAvailabilityInfo(truck.id).reservedQuantity || 0);
    return sum + reserved;
  }, 0);
  const totalTruckUnits = state.trucks.reduce((sum, truck) => sum + Number(truck.quantity || 1), 0);
  const availableTodayCount = Math.max(0, totalTruckUnits - busyTodayCount);
  const totalCapacityLiters = state.trucks.reduce((sum, truck) => sum + Number(truck.volume_cm3 || 0) * Number(truck.quantity || 1), 0) / 1000;
  const openVolumeLiters = openOrders.reduce((sum, order) => sum + Number(order.total_volume_cm3 || 0), 0) / 1000;

  inicioDateLabel.textContent = formatDate(todayIso);

  const stats = [
    { label: 'Entregas concluidas', value: completedOrders.length, detail: 'Pedidos finalizados no sistema', tone: 'neutral' },
    { label: 'Pedidos em aberto', value: openOrders.length, detail: 'Demandas aguardando conclusao', tone: 'warning' },
    { label: 'Caminhoes disponiveis hoje', value: `${availableTodayCount}/${totalTruckUnits}`, detail: `Unidades livres em ${formatDate(todayIso)}`, tone: 'success' },
    { label: 'Latas cadastradas', value: state.cans.length, detail: 'Modelos ativos para simulacao', tone: 'neutral' },
    { label: 'Modelos de caminhao', value: state.trucks.length, detail: `${totalTruckUnits} unidade(s) cadastrada(s)`, tone: 'neutral' },
    { label: state.user?.role === 'admin' ? 'Usuarios ativos' : 'Pedidos para hoje', value: state.user?.role === 'admin' ? state.users.length : ordersToday.length, detail: state.user?.role === 'admin' ? 'Contas cadastradas no sistema' : 'Entregas programadas para hoje', tone: 'accent' }
  ];

  summaryStats.innerHTML = stats
    .map((item) => {
      return `
        <article class="summary-card tone-${item.tone}">
          <span class="summary-label">${escapeHtml(item.label)}</span>
          <strong class="summary-value">${escapeHtml(String(item.value))}</strong>
          <span class="summary-detail">${escapeHtml(item.detail)}</span>
        </article>
      `;
    })
    .join('');

  inicioOrdersList.innerHTML = buildOverviewListHtml(
    state.orders.slice(0, 5).map((order) => ({
      title: `Pedido #${order.id} • ${order.created_by_name}`,
      meta: `${formatOrderRange(order)} • ${formatVolume(order.total_volume_cm3)} • ${order.status === 'completed' ? 'Concluido' : 'Aberto'}`,
      tone: order.status === 'completed' ? 'success' : 'warning'
    })),
    'Nenhum pedido cadastrado ainda.'
  );

  const truckItems = [
    ...state.todayBusyTrucks.slice(0, 3).map((truck) => ({
      title: truck.truck_name,
      meta: `${Number(truck.quantity_reserved || 1)} unidade(s) reservada(s) hoje • Pedido #${truck.order_id}`,
      tone: 'warning'
    })),
    ...state.trucks
      .filter((truck) => Number(getTodayAvailabilityInfo(truck.id).availableQuantity || truck.quantity || 1) > 0)
      .slice(0, 3)
      .map((truck) => ({
        title: truck.name,
        meta: `${getTodayAvailabilityInfo(truck.id).availableQuantity || truck.quantity || 1} unidade(s) livre(s) hoje • ${formatVolume(truck.volume_cm3)}`,
        tone: 'success'
      }))
  ].slice(0, 6);

  inicioTrucksList.innerHTML = buildOverviewListHtml(truckItems, 'Nenhuma informacao de frota disponivel.');

  const alerts = [
    `${openOrders.length} pedido(s) em aberto aguardando tratativa.`,
    `${ordersToday.length} pedido(s) com entrega ativa hoje.`,
    `${busyTodayCount} unidade(s) de caminhao reservada(s) na operacao de hoje.`,
    `${openVolumeLiters.toFixed(2)} L em pedidos ainda abertos.`
  ];

  inicioAlertsList.innerHTML = buildOverviewListHtml(
    alerts.map((text, index) => ({
      title: text,
      meta: index === 0 ? 'Monitoramento operacional' : 'Resumo automatico do sistema',
      tone: index < 2 ? 'warning' : 'neutral'
    })),
    'Sem alertas no momento.'
  );

  const capacityItems = [
    { title: `${totalCapacityLiters.toFixed(2)} L`, meta: 'Capacidade total de transporte cadastrada', tone: 'accent' },
    { title: `${state.cans.length} formatos`, meta: 'Tipos de latas/baldes disponiveis', tone: 'neutral' },
    { title: `${totalTruckUnits} veiculos`, meta: 'Unidades totais da frota configurada', tone: 'neutral' }
  ];

  inicioCapacityList.innerHTML = buildOverviewListHtml(capacityItems, 'Sem capacidade cadastrada.');
}

function buildOverviewListHtml(items, emptyMessage) {
  if (!items.length) {
    return `<div class="overview-empty">${escapeHtml(emptyMessage)}</div>`;
  }

  return items
    .map((item) => {
      return `
        <article class="overview-item tone-${item.tone || 'neutral'}">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.meta || '')}</span>
        </article>
      `;
    })
    .join('');
}

function renderCans() {
  cansBody.innerHTML = '';
  canSelect.innerHTML = '';
  const hasSelection = state.cans.some((can) => can.id === state.selectedCanId);
  if (!hasSelection) {
    state.selectedCanId = state.cans[0]?.id ?? null;
  }
  if (!state.selectedCanId && state.modal?.type === 'can') {
    closeEntityModal();
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
    `;
    tr.addEventListener('click', () => {
      state.selectedCanId = can.id;
      renderCans();
      openCanModal(can.id);
    });

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
  const hasSelection = state.trucks.some((truck) => truck.id === state.selectedTruckId);
  if (!hasSelection) {
    state.selectedTruckId = state.trucks[0]?.id ?? null;
  }
  if (!state.selectedTruckId && state.modal?.type === 'truck') {
    closeEntityModal();
  }

  for (const truck of state.trucks) {
    const availability = getTruckAvailabilityInfo(truck.id);
    const availableUnits = Number(availability.availableQuantity ?? truck.quantity ?? 1);
    const reservedUnits = Number(availability.reservedQuantity || 0);
    const totalUnits = Number(availability.totalQuantity ?? truck.quantity ?? 1);
    const isUnavailable = availableUnits <= 0;
    const tr = document.createElement('tr');
    tr.classList.add('selectable-row');
    if (truck.id === state.selectedTruckId) {
      tr.classList.add('selected-row');
    }
    tr.innerHTML = `
      <td>${escapeHtml(truck.name)}${isUnavailable ? ' <span class="truck-busy-tag">Indisponivel no periodo</span>' : ''}</td>
      <td>${truck.length_cm} x ${truck.width_cm} x ${truck.height_cm} cm</td>
      <td>${availableUnits}/${totalUnits}</td>
      <td>${formatVolume(truck.volume_cm3)}</td>
    `;
    tr.addEventListener('click', () => {
      state.selectedTruckId = truck.id;
      renderTrucks();
      openTruckModal(truck.id);
    });

    trucksBody.appendChild(tr);

    const option = document.createElement('option');
    option.value = String(truck.id);
    option.textContent = `${truck.name} (${formatVolume(truck.volume_cm3)}) - ${availableUnits}/${totalUnits} disponivel(is)`;
    option.disabled = isUnavailable;
    manualTruckSelect.appendChild(option);
  }

  if (state.manualSingleTruckId && state.trucks.some((truck) => truck.id === state.manualSingleTruckId && getTruckAvailabilityInfo(truck.id).availableQuantity > 0)) {
    manualTruckSelect.value = String(state.manualSingleTruckId);
  } else {
    const firstAvailable = state.trucks.find((truck) => getTruckAvailabilityInfo(truck.id).availableQuantity > 0);
    if (firstAvailable) {
      state.manualSingleTruckId = firstAvailable.id;
      manualTruckSelect.value = String(state.manualSingleTruckId);
    } else if (state.trucks[0]) {
      state.manualSingleTruckId = state.trucks[0].id;
      manualTruckSelect.value = String(state.manualSingleTruckId);
    } else {
      state.manualSingleTruckId = null;
    }
  }

  if (!manualTruckSelect.value && state.manualSingleTruckId !== null) {
    manualTruckSelect.value = String(state.manualSingleTruckId);
  }

  renderManualAllocationRows();
}

function renderUsers() {
  usersBody.innerHTML = '';
  if (state.user?.role !== 'admin') return;

  const hasSelection = state.users.some((user) => user.id === state.selectedUserId);
  if (!hasSelection) {
    state.selectedUserId = state.users[0]?.id ?? null;
  }
  if (!state.selectedUserId && state.modal?.type === 'user') {
    closeEntityModal();
  }

  for (const user of state.users) {
    const tr = document.createElement('tr');
    tr.classList.add('selectable-row');
    if (user.id === state.selectedUserId) {
      tr.classList.add('selected-row');
    }
    tr.innerHTML = `
      <td>${escapeHtml(user.name)}</td>
      <td>${escapeHtml(user.email)}</td>
      <td>${user.role}</td>
    `;
    tr.addEventListener('click', () => {
      state.selectedUserId = user.id;
      renderUsers();
      openUserModal(user.id);
    });
    usersBody.appendChild(tr);
  }
}

function renderOrders() {
  ordersBody.innerHTML = '';

  const hasSelection = state.orders.some((order) => order.id === state.selectedOrderId);
  if (!hasSelection) {
    state.selectedOrderId = state.orders[0]?.id ?? null;
  }
  if (!state.selectedOrderId && state.modal?.type === 'order') {
    closeEntityModal();
  }

  if (!state.orders.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="8">Nenhum pedido lancado.</td>';
    ordersBody.appendChild(tr);
    return;
  }

  for (const order of state.orders) {
    const tr = document.createElement('tr');
    tr.classList.add('selectable-row');
    if (order.id === state.selectedOrderId) {
      tr.classList.add('selected-row');
    }

    tr.innerHTML = `
      <td>#${order.id}</td>
      <td>${escapeHtml(order.created_by_name)}</td>
      <td>${escapeHtml(formatOrderRange(order))}</td>
      <td>${escapeHtml(formatDateTime(order.created_at))}</td>
      <td>${order.total_cans}</td>
      <td>${formatVolume(order.total_volume_cm3)}</td>
      <td><span class="status-badge ${order.status === 'completed' ? 'status-completed' : 'status-open'}">${order.status === 'completed' ? 'Concluido' : 'Aberto'}</span></td>
      <td>${state.user?.role === 'admin' ? '<button class="row-action view-order-btn" type="button">Ver</button>' : '-'}</td>
    `;

    tr.addEventListener('click', () => {
      state.selectedOrderId = order.id;
      renderOrders();
      openOrderModal(order.id);
    });

    const viewBtn = tr.querySelector('.view-order-btn');
    if (viewBtn) {
      viewBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        state.selectedOrderId = order.id;
        renderOrders();
        openOrderModal(order.id);
      });
    }

    ordersBody.appendChild(tr);
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
      state.lastCalculation = null;
      renderCargoBuilder();
    });
  });
}

async function onLaunchOrder() {
  if (!state.cargoItems.length) {
    showToast('Monte uma carga antes de lancar o pedido.');
    return;
  }

  const orderRange = getSelectedOrderRange(true);
  if (!orderRange) return;

  if (!state.lastCalculation) {
    showToast('Calcule a carga para o periodo selecionado antes de lancar o pedido.');
    return;
  }

  const currentSignature = buildCargoSignature(state.cargoItems);
  if (
    state.lastCalculation.startDate !== orderRange.startDate ||
    state.lastCalculation.endDate !== orderRange.endDate ||
    state.lastCalculation.cargoSignature !== currentSignature
  ) {
    showToast('A carga ou o periodo foi alterado. Recalcule antes de lancar o pedido.');
    return;
  }

  if (!state.lastCalculation.allocation?.fits) {
    showToast('A carga nao cabe. Ajuste os caminhoes antes de lancar o pedido.');
    return;
  }

  const response = await api('/api/orders', {
    method: 'POST',
    body: {
      items: state.cargoItems,
      startDate: orderRange.startDate,
      endDate: orderRange.endDate,
      allocation: state.lastCalculation.allocation
    }
  });

  if (!response.ok) {
    showToast(response.data.error || 'Nao foi possivel lancar o pedido.');
    return;
  }

  state.cargoItems = [];
  state.lastCalculation = null;
  await loadData();
  renderApp();
  showToast(`Pedido #${response.data.orderId} lancado com sucesso.`);
}

async function openOrderModal(orderId) {
  const response = await api(`/api/orders/${orderId}`);
  if (!response.ok) {
    showToast(response.data.error || 'Nao foi possivel carregar o pedido.');
    return;
  }

  const order = response.data.order;
  const items = Array.isArray(response.data.items) ? response.data.items : [];
  const trucks = Array.isArray(response.data.trucks) ? response.data.trucks : [];
  state.modal = { type: 'order', id: order.id };
  entityModalTitle.textContent = `Pedido #${order.id}`;

  const itemsRows = items
    .map((item) => {
      return `
        <tr>
          <td>${escapeHtml(item.can_name)}</td>
          <td>${item.can_shape === 'square' ? 'Quadrada' : 'Cilindrica'}</td>
          <td>${item.quantity}</td>
          <td>${formatVolume(item.unit_volume_cm3)}</td>
          <td>${formatVolume(item.total_volume_cm3)}</td>
        </tr>
      `;
    })
    .join('');

  const completionInfo =
    order.status === 'completed'
      ? `
        <p><strong>Concluido em:</strong> ${escapeHtml(formatDateTime(order.completed_at))}</p>
        <p><strong>Concluido por:</strong> ${escapeHtml(order.completed_by_name || '-')}</p>
      `
      : '';

  const trucksHtml = trucks.length
    ? `<ul>${trucks.map((truck) => `<li>${Number(truck.quantity_reserved || 1)}x ${escapeHtml(truck.truck_name)}</li>`).join('')}</ul>`
    : '<p>Nenhum caminhao vinculado.</p>';

  const canManage = canManageOrderOnClient(order);
  const modalActions = canManage || state.user?.role === 'admin'
    ? `
      <div class="modal-actions">
        ${order.status === 'open' && canManage ? '<button type="button" id="modal-edit-order-btn" class="btn btn-primary">Editar pedido</button>' : ''}
        ${order.status === 'open' && state.user?.role === 'admin' ? '<button type="button" id="modal-conclude-order-btn" class="btn btn-primary">Concluir pedido</button>' : ''}
        ${canManage ? '<button type="button" id="modal-delete-order-btn" class="row-action danger">Excluir pedido</button>' : ''}
      </div>
    `
    : '';

  entityModalContent.innerHTML = `
    <p><strong>Status:</strong> ${order.status === 'completed' ? 'Concluido' : 'Aberto'}</p>
    <p><strong>Solicitante:</strong> ${escapeHtml(order.created_by_name)}</p>
    <p><strong>Periodo do pedido:</strong> ${escapeHtml(formatOrderRange(order))}</p>
    <p><strong>Criado em:</strong> ${escapeHtml(formatDateTime(order.created_at))}</p>
    <p><strong>Total de latas:</strong> ${order.total_cans}</p>
    <p><strong>Volume total:</strong> ${formatVolume(order.total_volume_cm3)}</p>
    <p><strong>Caminhoes reservados:</strong></p>
    ${trucksHtml}
    ${completionInfo}
    <table>
      <thead>
        <tr>
          <th>Lata</th>
          <th>Formato</th>
          <th>Qtd</th>
          <th>Volume unit.</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemsRows || '<tr><td colspan="5">Sem itens.</td></tr>'}</tbody>
    </table>
    ${modalActions}
  `;

  entityModalOverlay.classList.remove('hidden');

  const editBtn = document.getElementById('modal-edit-order-btn');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      openOrderEditModal(order, items);
    });
  }

  const concludeBtn = document.getElementById('modal-conclude-order-btn');
  if (concludeBtn) {
    concludeBtn.addEventListener('click', () => {
      openConfirmModal({
        title: 'Concluir pedido',
        message: `Confirma a conclusao do pedido #${order.id}? Essa acao libera os caminhoes reservados imediatamente.`,
        confirmLabel: 'Concluir pedido',
        onConfirm: async () => {
          const concludeRes = await api(`/api/orders/${order.id}/conclude`, { method: 'POST', body: {} });
          if (!concludeRes.ok) {
            showToast(concludeRes.data.error || 'Nao foi possivel concluir o pedido.');
            return;
          }
          showToast(`Pedido #${order.id} concluido.`);
          await loadData();
          renderApp();
          openOrderModal(order.id);
        }
      });
    });
  }

  const deleteBtn = document.getElementById('modal-delete-order-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      openConfirmModal({
        title: 'Excluir pedido',
        message: `Confirma a exclusao do pedido #${order.id}? Essa acao nao pode ser desfeita.`,
        confirmLabel: 'Excluir pedido',
        danger: true,
        onConfirm: async () => {
          const deleteRes = await api(`/api/orders/${order.id}`, { method: 'DELETE' });
          if (!deleteRes.ok) {
            showToast(deleteRes.data.error || 'Nao foi possivel excluir o pedido.');
            return;
          }
          showToast(`Pedido #${order.id} excluido.`);
          closeEntityModal();
          await loadData();
          renderApp();
        }
      });
    });
  }
}

function openOrderEditModal(order, items) {
  const canManage = canManageOrderOnClient(order);
  if (!canManage) {
    showToast('Voce nao tem permissao para editar este pedido.');
    return;
  }

  const initialRows = items.length
    ? items.map((item, index) => ({
        id: index + 1,
        canId: Number(item.can_id),
        quantity: Number(item.quantity)
      }))
    : [{ id: 1, canId: state.cans[0]?.id ?? null, quantity: 1 }];

  state.modal = { type: 'order-edit', id: order.id };
  entityModalTitle.textContent = `Editar pedido #${order.id}`;
  entityModalContent.innerHTML = `
    <form id="modal-order-form" class="grid-form">
      <label>Data inicial
        <input name="startDate" type="date" value="${escapeHtml(getOrderStartDate(order) || '')}" required />
      </label>
      <label>Data final
        <input name="endDate" type="date" value="${escapeHtml(getOrderEndDate(order) || '')}" required />
      </label>
      <div class="form-section">
        <div class="section-head">
          <div>
            <span class="eyebrow">Itens</span>
            <h3>Composicao do pedido</h3>
          </div>
          <button type="button" id="modal-add-order-item-btn" class="row-action">Adicionar item</button>
        </div>
        <div id="modal-order-items-list" class="allocation-list"></div>
      </div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">Salvar pedido</button>
        <button type="button" id="modal-cancel-order-edit-btn" class="row-action">Cancelar</button>
      </div>
    </form>
  `;
  entityModalOverlay.classList.remove('hidden');

  const form = document.getElementById('modal-order-form');
  const itemsList = document.getElementById('modal-order-items-list');
  const addItemBtn = document.getElementById('modal-add-order-item-btn');
  const cancelBtn = document.getElementById('modal-cancel-order-edit-btn');
  let nextRowId = initialRows.length + 1;
  const rows = [...initialRows];

  const renderRows = () => {
    itemsList.innerHTML = '';
    rows.forEach((row) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'allocation-row';

      const canLabel = document.createElement('label');
      canLabel.textContent = 'Lata';
      const canSelect = document.createElement('select');
      state.cans.forEach((can) => {
        const option = document.createElement('option');
        option.value = String(can.id);
        option.textContent = `${can.name} (${formatVolume(can.volume_cm3)})`;
        canSelect.appendChild(option);
      });
      canSelect.value = String(row.canId ?? state.cans[0]?.id ?? '');
      canSelect.addEventListener('change', () => {
        row.canId = Number(canSelect.value);
      });
      canLabel.appendChild(canSelect);

      const qtyLabel = document.createElement('label');
      qtyLabel.textContent = 'Qtd';
      const qtyInput = document.createElement('input');
      qtyInput.type = 'number';
      qtyInput.min = '1';
      qtyInput.step = '1';
      qtyInput.value = String(row.quantity || 1);
      qtyInput.addEventListener('input', () => {
        row.quantity = Math.max(1, Number(qtyInput.value || 1));
        qtyInput.value = String(row.quantity);
      });
      qtyLabel.appendChild(qtyInput);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'row-action danger';
      removeBtn.textContent = 'Remover';
      removeBtn.addEventListener('click', () => {
        if (rows.length <= 1) {
          showToast('Mantenha ao menos um item no pedido.');
          return;
        }
        const index = rows.findIndex((entry) => entry.id === row.id);
        if (index >= 0) rows.splice(index, 1);
        renderRows();
      });

      wrapper.appendChild(canLabel);
      wrapper.appendChild(qtyLabel);
      wrapper.appendChild(removeBtn);
      itemsList.appendChild(wrapper);
    });
  };

  renderRows();

  addItemBtn.addEventListener('click', () => {
    rows.push({
      id: nextRowId++,
      canId: state.cans[0]?.id ?? null,
      quantity: 1
    });
    renderRows();
  });

  cancelBtn.addEventListener('click', () => openOrderModal(order.id));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      startDate: String(formData.get('startDate') || '').trim(),
      endDate: String(formData.get('endDate') || '').trim(),
      items: rows
        .map((row) => ({
          canId: Number(row.canId),
          quantity: Number(row.quantity)
        }))
        .filter((row) => Number.isInteger(row.canId) && Number.isInteger(row.quantity) && row.quantity > 0)
    };

    const response = await api(`/api/orders/${order.id}`, {
      method: 'PUT',
      body: payload
    });
    if (!response.ok) {
      showToast(response.data.error || 'Nao foi possivel atualizar o pedido.');
      return;
    }

    showToast(`Pedido #${order.id} atualizado.`);
    await loadData();
    renderApp();
    openOrderModal(order.id);
  });
}

function openCanModal(canId) {
  const can = state.cans.find((entry) => entry.id === canId);
  if (!can) {
    showToast('Lata nao encontrada.');
    return;
  }

  state.modal = { type: 'can', id: can.id };
  entityModalTitle.textContent = 'Detalhes da lata';
  const isAdmin = state.user?.role === 'admin';

  if (!isAdmin) {
    entityModalContent.innerHTML = `
      <p><strong>Nome:</strong> ${escapeHtml(can.name)}</p>
      <p><strong>Formato:</strong> ${can.shape === 'square' ? 'Lata Quadrada' : 'Balde Cilindrico'}</p>
      <p><strong>Volume:</strong> ${formatVolume(can.volume_cm3)}</p>
      <p><strong>Dimensoes:</strong> ${escapeHtml(formatCanDimensions(can))}</p>
      <p><strong>Cadastrada em:</strong> ${escapeHtml(String(can.created_at || '-'))}</p>
    `;
    entityModalOverlay.classList.remove('hidden');
    return;
  }

  entityModalContent.innerHTML = `
    <form id="modal-can-form" class="grid-form">
      <label>Nome
        <input name="name" value="${escapeHtml(can.name)}" required />
      </label>
      <label>Formato
        <select name="shape" id="modal-can-shape">
          <option value="square" ${can.shape === 'square' ? 'selected' : ''}>Lata Quadrada</option>
          <option value="cylinder" ${can.shape === 'cylinder' ? 'selected' : ''}>Balde Cilindrico</option>
        </select>
      </label>
      <label>Altura (cm)
        <input name="heightCm" type="number" min="0.1" step="0.1" value="${can.height_cm}" required />
      </label>
      <label class="modal-shape-square">Lado 1 (cm)
        <input name="side1Cm" type="number" min="0.1" step="0.1" value="${can.length_cm ?? ''}" />
      </label>
      <label class="modal-shape-square">Lado 2 (cm)
        <input name="side2Cm" type="number" min="0.1" step="0.1" value="${can.width_cm ?? ''}" />
      </label>
      <label class="modal-shape-cylinder">Diametro (cm)
        <input name="diameterCm" type="number" min="0.1" step="0.1" value="${can.diameter_cm ?? ''}" />
      </label>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">Salvar alteracoes</button>
        <button type="button" id="modal-delete-can-btn" class="row-action danger">Excluir lata</button>
      </div>
    </form>
  `;

  entityModalOverlay.classList.remove('hidden');
  const form = document.getElementById('modal-can-form');
  const shapeInput = document.getElementById('modal-can-shape');
  const deleteBtn = document.getElementById('modal-delete-can-btn');
  syncModalCanShapeFields(shapeInput.value);
  shapeInput.addEventListener('change', () => syncModalCanShapeFields(shapeInput.value));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') || '').trim(),
      shape: String(formData.get('shape') || ''),
      heightCm: Number(formData.get('heightCm')),
      side1Cm: Number(formData.get('side1Cm')),
      side2Cm: Number(formData.get('side2Cm')),
      diameterCm: Number(formData.get('diameterCm'))
    };

    const response = await api(`/api/cans/${can.id}`, { method: 'PUT', body: payload });
    if (!response.ok) {
      showToast(response.data.error || 'Nao foi possivel atualizar a lata.');
      return;
    }

    showToast('Lata atualizada.');
    await loadData();
    renderApp();
    openCanModal(can.id);
  });

  deleteBtn.addEventListener('click', async () => {
    if (!window.confirm(`Excluir a lata "${can.name}"?`)) return;
    const response = await api(`/api/cans/${can.id}`, { method: 'DELETE' });
    if (!response.ok) {
      showToast(response.data.error || 'Nao foi possivel excluir a lata.');
      return;
    }
    showToast('Lata excluida.');
    closeEntityModal();
    await loadData();
    renderApp();
  });
}

function openTruckModal(truckId) {
  const truck = state.trucks.find((entry) => entry.id === truckId);
  if (!truck) {
    showToast('Caminhao nao encontrado.');
    return;
  }

  state.modal = { type: 'truck', id: truck.id };
  entityModalTitle.textContent = 'Detalhes do caminhao';
  const isAdmin = state.user?.role === 'admin';
  const availability = getTruckAvailabilityInfo(truck.id);

  if (!isAdmin) {
    entityModalContent.innerHTML = `
      <p><strong>Nome:</strong> ${escapeHtml(truck.name)}</p>
      <p><strong>Dimensoes internas:</strong> ${truck.length_cm} x ${truck.width_cm} x ${truck.height_cm} cm</p>
      <p><strong>Quantidade cadastrada:</strong> ${availability.totalQuantity || truck.quantity || 1}</p>
      <p><strong>Volume total:</strong> ${formatVolume(truck.volume_cm3)}</p>
      <p><strong>Cadastrado em:</strong> ${escapeHtml(String(truck.created_at || '-'))}</p>
    `;
    entityModalOverlay.classList.remove('hidden');
    return;
  }

  entityModalContent.innerHTML = `
    <form id="modal-truck-form" class="grid-form">
      <label>Nome
        <input name="name" value="${escapeHtml(truck.name)}" required />
      </label>
      <label>Comprimento interno (cm)
        <input name="lengthCm" type="number" min="0.1" step="0.1" value="${Number(truck.length_cm)}" required />
      </label>
      <label>Largura interna (cm)
        <input name="widthCm" type="number" min="0.1" step="0.1" value="${Number(truck.width_cm)}" required />
      </label>
      <label>Altura interna (cm)
        <input name="heightCm" type="number" min="0.1" step="0.1" value="${Number(truck.height_cm)}" required />
      </label>
      <label>Quantidade
        <input name="quantity" type="number" min="1" step="1" value="${Number(truck.quantity || 1)}" required />
      </label>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">Salvar alteracoes</button>
        <button type="button" id="modal-delete-truck-btn" class="row-action danger">Excluir caminhao</button>
      </div>
    </form>
  `;

  entityModalOverlay.classList.remove('hidden');
  const form = document.getElementById('modal-truck-form');
  const deleteBtn = document.getElementById('modal-delete-truck-btn');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') || '').trim(),
      lengthCm: Number(formData.get('lengthCm')),
      widthCm: Number(formData.get('widthCm')),
      heightCm: Number(formData.get('heightCm')),
      quantity: Number(formData.get('quantity'))
    };
    const response = await api(`/api/trucks/${truck.id}`, { method: 'PUT', body: payload });
    if (!response.ok) {
      showToast(response.data.error || 'Nao foi possivel atualizar o caminhao.');
      return;
    }
    showToast('Caminhao atualizado.');
    await loadData();
    renderApp();
    openTruckModal(truck.id);
  });

  deleteBtn.addEventListener('click', async () => {
    if (!window.confirm(`Excluir o caminhao "${truck.name}"?`)) return;
    const response = await api(`/api/trucks/${truck.id}`, { method: 'DELETE' });
    if (!response.ok) {
      showToast(response.data.error || 'Nao foi possivel excluir o caminhao.');
      return;
    }
    showToast('Caminhao excluido.');
    closeEntityModal();
    await loadData();
    renderApp();
  });
}

function openUserModal(userId) {
  const user = state.users.find((entry) => entry.id === userId);
  if (!user) {
    showToast('Usuario nao encontrado.');
    return;
  }

  state.modal = { type: 'user', id: user.id };
  entityModalTitle.textContent = 'Detalhes do usuario';

  entityModalContent.innerHTML = `
    <form id="modal-user-form" class="grid-form">
      <label>Nome
        <input name="name" value="${escapeHtml(user.name)}" required />
      </label>
      <label>Email
        <input name="email" type="email" value="${escapeHtml(user.email)}" required />
      </label>
      <label>Perfil
        <select name="role">
          <option value="user" ${user.role === 'user' ? 'selected' : ''}>Usuario</option>
          <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrador</option>
        </select>
      </label>
      <label>Nova senha (opcional)
        <input name="password" type="password" />
      </label>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">Salvar alteracoes</button>
        <button type="button" id="modal-delete-user-btn" class="row-action danger">Excluir usuario</button>
      </div>
    </form>
  `;

  entityModalOverlay.classList.remove('hidden');
  const form = document.getElementById('modal-user-form');
  const deleteBtn = document.getElementById('modal-delete-user-btn');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      role: String(formData.get('role') || 'user')
    };
    const password = String(formData.get('password') || '').trim();
    if (password) payload.password = password;

    const response = await api(`/api/users/${user.id}`, { method: 'PUT', body: payload });
    if (!response.ok) {
      showToast(response.data.error || 'Nao foi possivel atualizar o usuario.');
      return;
    }
    showToast('Usuario atualizado.');
    await loadData();
    renderApp();
    openUserModal(user.id);
  });

  deleteBtn.addEventListener('click', async () => {
    if (!window.confirm(`Excluir o usuario "${user.name}"?`)) return;
    const response = await api(`/api/users/${user.id}`, { method: 'DELETE' });
    if (!response.ok) {
      showToast(response.data.error || 'Nao foi possivel excluir o usuario.');
      return;
    }
    showToast('Usuario excluido.');
    closeEntityModal();
    await loadData();
    renderApp();
  });
}

function syncModalCanShapeFields(shape) {
  const squareFields = entityModalContent.querySelectorAll('.modal-shape-square');
  const cylinderFields = entityModalContent.querySelectorAll('.modal-shape-cylinder');
  const isSquare = shape === 'square';

  squareFields.forEach((field) => {
    field.classList.toggle('hidden', !isSquare);
    const input = field.querySelector('input');
    if (input) input.required = isSquare;
  });

  cylinderFields.forEach((field) => {
    field.classList.toggle('hidden', isSquare);
    const input = field.querySelector('input');
    if (input) input.required = !isSquare;
  });
}

function closeEntityModal() {
  entityModalOverlay.classList.add('hidden');
  entityModalContent.innerHTML = '';
  state.modal = null;
}

function onGlobalKeydown(event) {
  if (event.key === 'Escape' && !confirmModalOverlay.classList.contains('hidden')) {
    closeConfirmModal(false);
    return;
  }

  if (event.key === 'Escape' && !entityModalOverlay.classList.contains('hidden')) {
    closeEntityModal();
  }
}

function openConfirmModal({ title, message, confirmLabel = 'Confirmar', danger = false, onConfirm }) {
  state.confirmModal = { onConfirm };
  confirmModalTitle.textContent = title || 'Confirmar acao';
  confirmModalContent.innerHTML = `<p>${escapeHtml(message || 'Deseja continuar?')}</p>`;
  confirmModalConfirmBtn.textContent = confirmLabel;
  confirmModalConfirmBtn.classList.toggle('btn-danger', danger);
  confirmModalConfirmBtn.classList.toggle('btn-primary', !danger);
  confirmModalOverlay.classList.remove('hidden');
}

function closeConfirmModal(_confirmed = false) {
  confirmModalOverlay.classList.add('hidden');
  confirmModalContent.innerHTML = '';
  state.confirmModal = null;
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
    heightCm: Number(form.get('heightCm')),
    quantity: Number(form.get('quantity'))
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
  state.lastCalculation = null;
  resultBox.classList.add('hidden');
  manualResultBox.classList.add('hidden');
  renderCargoBuilder();
}

async function onCalculateAutomatic() {
  if (!state.cargoItems.length) {
    showToast('Adicione ao menos um item para calcular.');
    return;
  }

  const orderRange = getSelectedOrderRange(true);
  if (!orderRange) return;

  const response = await api('/api/calculate', {
    method: 'POST',
    body: { mode: 'automatic', items: state.cargoItems, startDate: orderRange.startDate, endDate: orderRange.endDate }
  });

  if (!response.ok) {
    state.lastCalculation = null;
    resultBox.classList.remove('hidden');
    resultBox.innerHTML = `<strong>Falha:</strong> ${escapeHtml(response.data.error || 'Nao foi possivel calcular.')}`;
    return;
  }

  resultBox.classList.remove('hidden');
  renderCalculationResult(resultBox, response.data, 'automatic');
  storeLastCalculation(response.data, orderRange);
}

async function onManualSingleSimulation(event) {
  event.preventDefault();

  if (!state.cargoItems.length) {
    showToast('Adicione ao menos um item para simular.');
    return;
  }

  const orderRange = getSelectedOrderRange(true);
  if (!orderRange) return;

  const truckId = Number(manualTruckSelect.value);
  if (!Number.isInteger(truckId)) {
    showToast('Selecione um caminhao para simulacao manual.');
    return;
  }

  const response = await api('/api/calculate', {
    method: 'POST',
    body: {
      mode: 'manual',
      startDate: orderRange.startDate,
      endDate: orderRange.endDate,
      items: state.cargoItems,
      manual: { type: 'single', truckId }
    }
  });

  if (!response.ok) {
    state.lastCalculation = null;
    manualResultBox.classList.remove('hidden');
    manualResultBox.innerHTML = `<strong>Falha:</strong> ${escapeHtml(response.data.error || 'Nao foi possivel simular.')}`;
    return;
  }

  manualResultBox.classList.remove('hidden');
  renderCalculationResult(manualResultBox, response.data, 'manual');
  storeLastCalculation(response.data, orderRange);
}

async function onManualMultiSimulation() {
  if (!state.cargoItems.length) {
    showToast('Adicione ao menos um item para simular.');
    return;
  }

  const orderRange = getSelectedOrderRange(true);
  if (!orderRange) return;

  const allocations = state.manualAllocations
    .map((row) => ({ truckId: Number(row.truckId), quantity: Number(row.quantity || 1) }))
    .filter((row) => Number.isInteger(row.truckId));

  if (!allocations.length) {
    showToast('Adicione pelo menos um caminhao valido.');
    return;
  }

  const response = await api('/api/calculate', {
    method: 'POST',
    body: {
      mode: 'manual',
      startDate: orderRange.startDate,
      endDate: orderRange.endDate,
      items: state.cargoItems,
      manual: { type: 'multi', allocations }
    }
  });

  if (!response.ok) {
    state.lastCalculation = null;
    manualResultBox.classList.remove('hidden');
    manualResultBox.innerHTML = `<strong>Falha:</strong> ${escapeHtml(response.data.error || 'Nao foi possivel simular.')}`;
    return;
  }

  manualResultBox.classList.remove('hidden');
  renderCalculationResult(manualResultBox, response.data, 'manual');
  storeLastCalculation(response.data, orderRange);
}

function sanitizeManualSelections() {
  const validTruckIds = new Set(state.trucks.map((truck) => truck.id));
  const availableTrucks = state.trucks.filter((truck) => getTruckAvailabilityInfo(truck.id).availableQuantity > 0);
  const firstAvailableId = availableTrucks[0]?.id ?? null;

  if (!validTruckIds.has(state.manualSingleTruckId) || getTruckAvailabilityInfo(state.manualSingleTruckId).availableQuantity <= 0) {
    state.manualSingleTruckId = firstAvailableId;
  }

  const sanitized = [];
  for (const row of state.manualAllocations) {
    const truckIdCandidate =
      validTruckIds.has(row.truckId) && getTruckAvailabilityInfo(row.truckId).availableQuantity > 0 ? row.truckId : firstAvailableId;
    if (!truckIdCandidate) continue;
    const maxQuantity = Math.max(1, Number(getTruckAvailabilityInfo(truckIdCandidate).availableQuantity || 1));
    sanitized.push({
      id: row.id,
      truckId: truckIdCandidate,
      quantity: Math.min(Math.max(1, Number(row.quantity || 1)), maxQuantity)
    });
  }
  state.manualAllocations = sanitized;

  if (!state.manualAllocations.length && firstAvailableId) {
    state.manualAllocations = [{ id: state.nextManualAllocationId++, truckId: firstAvailableId, quantity: 1 }];
  }
}

function onCalculationModeChange() {
  const selected = Array.from(calculationModeInputs).find((input) => input.checked)?.value || 'automatic';
  state.calculationMode = selected === 'manual' ? 'manual' : 'automatic';
  state.lastCalculation = null;
  syncCalculationPanels();
}

function onManualDistributionTypeChange() {
  state.manualDistributionType = manualDistributionTypeSelect.value === 'multi' ? 'multi' : 'single';
  state.lastCalculation = null;
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
  const usedTruckIds = new Set(state.manualAllocations.map((entry) => entry.truckId));
  const candidate = state.trucks.find((truck) => getTruckAvailabilityInfo(truck.id).availableQuantity > 0 && !usedTruckIds.has(truck.id));

  if (!candidate) {
    showToast('Nao ha mais modelos de caminhao disponiveis para adicionar nesse periodo.');
    return;
  }

  state.manualAllocations.push({
    id: state.nextManualAllocationId++,
    truckId: candidate.id,
    quantity: 1
  });
  state.lastCalculation = null;
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
    const usedByOtherRows = new Set(
      state.manualAllocations.filter((entry) => entry.id !== row.id).map((entry) => Number(entry.truckId))
    );
    for (const truck of state.trucks) {
      const option = document.createElement('option');
      option.value = String(truck.id);
      const availableUnits = Number(getTruckAvailabilityInfo(truck.id).availableQuantity || 0);
      const totalUnits = Number(getTruckAvailabilityInfo(truck.id).totalQuantity || truck.quantity || 1);
      const isUnavailable = availableUnits <= 0;
      option.textContent = `${truck.name} (${formatVolume(truck.volume_cm3)}) - ${availableUnits}/${totalUnits} disponivel(is)`;
      option.disabled = isUnavailable || usedByOtherRows.has(truck.id);
      select.appendChild(option);
    }
    select.value = String(row.truckId);
    select.addEventListener('change', () => {
      row.truckId = Number(select.value);
      row.quantity = 1;
      state.lastCalculation = null;
      renderManualAllocationRows();
    });
    selectLabel.appendChild(select);

    const quantityLabel = document.createElement('label');
    quantityLabel.textContent = 'Qtd';
    const quantityInput = document.createElement('input');
    quantityInput.type = 'number';
    quantityInput.min = '1';
    quantityInput.step = '1';
    quantityInput.max = String(Math.max(1, Number(getTruckAvailabilityInfo(row.truckId).availableQuantity || 1)));
    quantityInput.value = String(Math.min(Math.max(1, Number(row.quantity || 1)), Number(quantityInput.max)));
    quantityInput.addEventListener('input', () => {
      const max = Math.max(1, Number(getTruckAvailabilityInfo(row.truckId).availableQuantity || 1));
      row.quantity = Math.min(Math.max(1, Number(quantityInput.value || 1)), max);
      quantityInput.value = String(row.quantity);
      state.lastCalculation = null;
    });
    quantityLabel.appendChild(quantityInput);

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
      state.lastCalculation = null;
      renderManualAllocationRows();
    });

    wrapper.appendChild(selectLabel);
    wrapper.appendChild(quantityLabel);
    wrapper.appendChild(removeBtn);
    manualAllocationList.appendChild(wrapper);
  }
}

async function onOrderDateChange() {
  syncLegacyOrderDateInput();
  state.lastCalculation = null;
  await syncTruckAvailabilityForRange(true);
  sanitizeManualSelections();
  renderTrucks();
  renderDateAvailabilityHint();
  resultBox.classList.add('hidden');
  manualResultBox.classList.add('hidden');
}

async function syncTruckAvailabilityForRange(showErrorToast) {
  const range = getSelectedOrderRange(false);
  if (!range) {
    state.unavailableTruckIds = [];
    return;
  }

  const response = await api(
    `/api/truck-availability?startDate=${encodeURIComponent(range.startDate)}&endDate=${encodeURIComponent(range.endDate)}`
  );
  if (!response.ok) {
    state.unavailableTruckIds = [];
    if (showErrorToast) {
      showToast(response.data.error || 'Nao foi possivel carregar disponibilidade de caminhoes.');
    }
    return;
  }

  state.unavailableTruckIds = Array.isArray(response.data.busyTruckIds) ? response.data.busyTruckIds : [];
  state.truckAvailabilityById = buildTruckAvailabilityLookup(response.data.availability);
}

function renderDateAvailabilityHint() {
  const range = getSelectedOrderRange(false);
  if (!range) {
    dateAvailabilityHint.textContent = 'Selecione o periodo para verificar disponibilidade de caminhoes.';
    return;
  }

  const reservedUnits = state.trucks.reduce((sum, truck) => sum + Number(getTruckAvailabilityInfo(truck.id).reservedQuantity || 0), 0);
  const unavailableModels = state.unavailableTruckIds.length;
  if (!reservedUnits) {
    dateAvailabilityHint.textContent = `Todos os caminhoes estao disponiveis entre ${formatDate(range.startDate)} e ${formatDate(range.endDate)}.`;
    return;
  }

  dateAvailabilityHint.textContent =
    `${reservedUnits} unidade(s) reservada(s) entre ${formatDate(range.startDate)} e ${formatDate(range.endDate)}. ${unavailableModels} modelo(s) sem disponibilidade total.`;
}

function getSelectedOrderRange(showToastOnError) {
  const startDate = String(orderStartDateInput.value || '').trim();
  const endDate = String(orderEndDateInput.value || '').trim();

  if ((!startDate || !endDate) && showToastOnError) {
    showToast('Selecione a data inicial e final do pedido.');
    return null;
  }

  if (!startDate || !endDate) {
    return null;
  }

  if (startDate > endDate) {
    if (showToastOnError) {
      showToast('A data final deve ser maior ou igual a data inicial.');
    }
    return null;
  }

  return { startDate, endDate };
}

function syncLegacyOrderDateInput() {
  if (!legacyOrderDateInput) return;
  const startDate = String(orderStartDateInput?.value || '').trim();
  const endDate = String(orderEndDateInput?.value || '').trim();
  legacyOrderDateInput.value = startDate || endDate || '';
}

function storeLastCalculation(payload, orderRange) {
  const allocation = normalizeAllocationFromPayload(payload);
  if (!allocation) {
    state.lastCalculation = null;
    return;
  }

  state.lastCalculation = {
    startDate: orderRange.startDate,
    endDate: orderRange.endDate,
    cargoSignature: buildCargoSignature(state.cargoItems),
    allocation
  };
}

function buildCargoSignature(items) {
  const normalized = [...items]
    .map((item) => ({ canId: Number(item.canId), quantity: Number(item.quantity) }))
    .filter((item) => Number.isInteger(item.canId) && Number.isInteger(item.quantity) && item.quantity > 0)
    .sort((a, b) => a.canId - b.canId);
  return JSON.stringify(normalized);
}

function getTodayDateIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function renderCalculationResult(targetBox, payload, sourceMode) {
  const allocation = normalizeAllocationFromPayload(payload);
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

  const range = {
    startDate: payload?.startDate || getSelectedOrderRange(false)?.startDate || null,
    endDate: payload?.endDate || getSelectedOrderRange(false)?.endDate || null
  };
  const rangeLine =
    range.startDate && range.endDate
      ? `<p><strong>Periodo do pedido:</strong> ${escapeHtml(formatDateRange(range.startDate, range.endDate))}</p>`
      : '';

  targetBox.innerHTML = `
    <h3>${title}</h3>
    ${rangeLine}
    <p><strong>Volume total da carga:</strong> ${formatVolume(payload.totalVolumeCm3 || 0)}</p>
    <p><strong>Capacidade total selecionada:</strong> ${formatVolume(allocation.totalCapacityCm3 || 0)}</p>
    <p><strong>Caminhoes usados:</strong></p>
    <ul>${trucksHtml}</ul>
    ${statusLine}
    ${trailing}
    <p><strong>Ocupacao:</strong> ${((allocation.occupancyRate || 0) * 100).toFixed(2)}%</p>
  `;
}

function buildCurrentLoadSummaryFromClient() {
  if (!state.cargoItems.length) return null;

  let totalVolumeCm3 = 0;
  let totalCans = 0;
  const breakdown = [];

  for (const item of state.cargoItems) {
    const can = state.cans.find((entry) => entry.id === item.canId);
    if (!can) continue;

    const quantity = Number(item.quantity);
    const subtotal = Number(can.volume_cm3) * quantity;
    totalVolumeCm3 += subtotal;
    totalCans += quantity;

    breakdown.push({
      canId: can.id,
      canName: can.name,
      quantity,
      unitVolumeCm3: Number(can.volume_cm3),
      totalVolumeCm3: subtotal
    });
  }

  if (!(totalVolumeCm3 > 0)) return null;
  return { totalVolumeCm3, totalCans, breakdown };
}

function buildAutomaticPayloadFromClient() {
  const summary = buildCurrentLoadSummaryFromClient();
  if (!summary || !state.trucks.length) return null;

  const sortedAsc = [...state.trucks].sort((a, b) => Number(a.volume_cm3) - Number(b.volume_cm3));
  const single = sortedAsc.find((truck) => Number(truck.volume_cm3) >= summary.totalVolumeCm3);

  if (single) {
    return {
      mode: 'automatic',
      strategy: 'single',
      totalVolumeCm3: summary.totalVolumeCm3,
      totalCans: summary.totalCans,
      breakdown: summary.breakdown,
      allocation: buildClientAllocation(summary.totalVolumeCm3, [
        {
          truckId: single.id,
          name: single.name,
          quantity: 1,
          unitVolumeCm3: Number(single.volume_cm3)
        }
      ])
    };
  }

  const fleet = findBestFleetClient(summary.totalVolumeCm3, state.trucks);
  if (!fleet) return null;

  return {
    mode: 'automatic',
    strategy: 'multi',
    totalVolumeCm3: summary.totalVolumeCm3,
    totalCans: summary.totalCans,
    breakdown: summary.breakdown,
    allocation: buildClientAllocation(summary.totalVolumeCm3, fleet)
  };
}

function buildManualSinglePayloadFromClient(truckId) {
  const summary = buildCurrentLoadSummaryFromClient();
  if (!summary) return null;

  const truck = state.trucks.find((entry) => entry.id === truckId);
  if (!truck) return null;

  return {
    mode: 'manual',
    strategy: 'single',
    totalVolumeCm3: summary.totalVolumeCm3,
    totalCans: summary.totalCans,
    breakdown: summary.breakdown,
    allocation: buildClientAllocation(summary.totalVolumeCm3, [
      {
        truckId: truck.id,
        name: truck.name,
        quantity: 1,
        unitVolumeCm3: Number(truck.volume_cm3)
      }
    ])
  };
}

function buildManualMultiPayloadFromClient(rawAllocations) {
  const summary = buildCurrentLoadSummaryFromClient();
  if (!summary) return null;

  const grouped = new Map();
  for (const row of rawAllocations) {
    const truck = state.trucks.find((entry) => entry.id === Number(row.truckId));
    if (!truck) continue;
    const key = truck.id;
    grouped.set(key, {
      truckId: truck.id,
      name: truck.name,
      quantity: (grouped.get(key)?.quantity || 0) + Number(row.quantity),
      unitVolumeCm3: Number(truck.volume_cm3)
    });
  }

  const allocations = [...grouped.values()].filter((entry) => entry.quantity > 0);
  if (!allocations.length) return null;

  return {
    mode: 'manual',
    strategy: 'multi',
    totalVolumeCm3: summary.totalVolumeCm3,
    totalCans: summary.totalCans,
    breakdown: summary.breakdown,
    allocation: buildClientAllocation(summary.totalVolumeCm3, allocations)
  };
}

function buildClientAllocation(totalVolumeCm3, allocations) {
  const trucks = allocations.map((entry) => {
    const quantity = Number(entry.quantity);
    const unit = Number(entry.unitVolumeCm3);
    return {
      truckId: entry.truckId,
      name: entry.name,
      quantity,
      unitVolumeCm3: unit,
      totalCapacityCm3: quantity * unit
    };
  });

  const totalCapacityCm3 = trucks.reduce((sum, item) => sum + item.totalCapacityCm3, 0);
  const missingCm3 = Math.max(0, totalVolumeCm3 - totalCapacityCm3);
  const leftoverCm3 = Math.max(0, totalCapacityCm3 - totalVolumeCm3);

  return {
    fits: missingCm3 === 0,
    trucks,
    totalCapacityCm3,
    leftoverCm3,
    missingCm3,
    occupancyRate: totalCapacityCm3 > 0 ? Number((totalVolumeCm3 / totalCapacityCm3).toFixed(4)) : 0
  };
}

function findBestFleetClient(totalVolumeCm3, trucksInput) {
  const trucks = [...trucksInput].sort((a, b) => Number(b.volume_cm3) - Number(a.volume_cm3));
  if (!trucks.length) return null;

  const largestCap = Number(trucks[0].volume_cm3);
  const minCount = Math.max(2, Math.ceil(totalVolumeCm3 / largestCap));
  const maxCount = Math.min(18, minCount + 6);

  let best = null;

  for (let targetCount = minCount; targetCount <= maxCount; targetCount += 1) {
    const counts = new Array(trucks.length).fill(0);

    const visit = (startIndex, remaining, currentCapacity) => {
      if (remaining === 0) {
        if (currentCapacity < totalVolumeCm3) return;
        const leftover = currentCapacity - totalVolumeCm3;
        if (!best || leftover < best.leftoverCm3) {
          best = {
            leftoverCm3: leftover,
            allocations: counts
              .map((qty, index) => ({ qty, truck: trucks[index] }))
              .filter((item) => item.qty > 0)
              .map((item) => ({
                truckId: item.truck.id,
                name: item.truck.name,
                quantity: item.qty,
                unitVolumeCm3: Number(item.truck.volume_cm3)
              }))
          };
        }
        return;
      }

      if (currentCapacity + remaining * largestCap < totalVolumeCm3) return;
      if (best && currentCapacity >= totalVolumeCm3 && currentCapacity - totalVolumeCm3 >= best.leftoverCm3) return;

      for (let i = startIndex; i < trucks.length; i += 1) {
        counts[i] += 1;
        visit(i, remaining - 1, currentCapacity + Number(trucks[i].volume_cm3));
        counts[i] -= 1;
      }
    };

    visit(0, targetCount, 0);
    if (best) return best.allocations;
  }

  return null;
}

function normalizeAllocationFromPayload(payload) {
  if (payload?.allocation && Array.isArray(payload.allocation.trucks)) {
    return payload.allocation;
  }

  const totalVolumeCm3 = Number(payload?.totalVolumeCm3 || 0);
  if (!(totalVolumeCm3 > 0)) return null;

  if (payload?.bestTruck && Number(payload.bestTruck.volume_cm3) > 0) {
    const capacity = Number(payload.bestTruck.volume_cm3);
    return {
      fits: capacity >= totalVolumeCm3,
      trucks: [
        {
          truckId: payload.bestTruck.id,
          name: payload.bestTruck.name,
          quantity: 1,
          unitVolumeCm3: capacity,
          totalCapacityCm3: capacity
        }
      ],
      totalCapacityCm3: capacity,
      leftoverCm3: Math.max(0, capacity - totalVolumeCm3),
      missingCm3: Math.max(0, totalVolumeCm3 - capacity),
      occupancyRate: capacity > 0 ? Number((totalVolumeCm3 / capacity).toFixed(4)) : 0
    };
  }

  return null;
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

function buildTruckAvailabilityLookup(items) {
  const list = Array.isArray(items) ? items : [];
  return Object.fromEntries(
    list
      .filter((item) => Number.isInteger(Number(item?.id)))
      .map((item) => [
        Number(item.id),
        {
          totalQuantity: Number(item.totalQuantity ?? item.quantity ?? 1),
          reservedQuantity: Number(item.reservedQuantity ?? 0),
          availableQuantity: Number(item.availableQuantity ?? item.quantity ?? 1)
        }
      ])
  );
}

function getTruckAvailabilityInfo(truckId) {
  const fallbackTruck = state.trucks.find((truck) => truck.id === truckId);
  return (
    state.truckAvailabilityById?.[truckId] || {
      totalQuantity: Number(fallbackTruck?.quantity || 0),
      reservedQuantity: 0,
      availableQuantity: Number(fallbackTruck?.quantity || 0)
    }
  );
}

function getTodayAvailabilityInfo(truckId) {
  const fallbackTruck = state.trucks.find((truck) => truck.id === truckId);
  return (
    state.todayTruckAvailabilityById?.[truckId] || {
      totalQuantity: Number(fallbackTruck?.quantity || 0),
      reservedQuantity: 0,
      availableQuantity: Number(fallbackTruck?.quantity || 0)
    }
  );
}

function canManageOrderOnClient(order) {
  if (!state.user || !order) return false;
  return state.user.role === 'admin' || Number(order.created_by_user_id) === Number(state.user.id);
}

function getOrderStartDate(order) {
  return String(order?.start_date || order?.scheduled_date || '').trim() || null;
}

function getOrderEndDate(order) {
  return String(order?.end_date || order?.scheduled_date || '').trim() || null;
}

function doesOrderOverlapDate(order, dateIso) {
  const startDate = getOrderStartDate(order);
  const endDate = getOrderEndDate(order);
  if (!startDate || !endDate || !dateIso) return false;
  return startDate <= dateIso && endDate >= dateIso;
}

function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return '-';
  if (startDate && endDate && startDate === endDate) {
    return formatDate(startDate);
  }
  return `${formatDate(startDate)} ate ${formatDate(endDate)}`;
}

function formatOrderRange(order) {
  return formatDateRange(getOrderStartDate(order), getOrderEndDate(order));
}

function formatDate(value) {
  if (!value) return '-';
  const raw = String(value);
  const normalized = raw.includes('T') ? raw : `${raw}T00:00:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('pt-BR');
}

function formatDateTime(value) {
  if (!value) return '-';
  const raw = String(value);
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('pt-BR');
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

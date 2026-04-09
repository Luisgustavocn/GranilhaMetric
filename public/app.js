const state = {
  user: null,
  availableModules: [],
  companies: [],
  cans: [],
  trucks: [],
  users: [],
  orders: [],
  categories: [],
  clients: [],
  selectedClientId: null,
  cargoItems: [],
  selectedCanId: null,
  selectedTruckId: null,
  selectedUserId: null,
  selectedOrderId: null,
  selectedCompanyId: null,
  unavailableTruckIds: [],
  truckAvailabilityById: {},
  todayBusyTruckIds: [],
  todayBusyTrucks: [],
  todayTruckAvailabilityById: {},
  truckSchedule: null,
  calculationMode: 'automatic',
  manualDistributionType: 'single',
  manualSingleTruckId: null,
  manualAllocations: [{ id: 1, truckId: null, quantity: 1 }],
  nextManualAllocationId: 2,
  lastCalculation: null,
  agendaStartDate: null,
  agendaEndDate: null,
  orderFilters: {
    search: '',
    status: 'all',
    requester: '',
    startDate: '',
    endDate: ''
  },
  canFilters: {
    search: '',
    category: 'all',
    shape: 'all'
  },
  cargoFilters: {
    search: '',
    client: 'all'
  },
  platformSection: 'portfolio',
  companyWizardStep: 1,
  expandedModuleKey: 'loading3d',
  currentView: 'inicio-section',
  csrfToken: null,
  modal: null,
  confirmModal: null
};

const MODULE_DEFINITIONS = [
  {
    key: 'loading3d',
    label: 'Carregamento 3D',
    views: ['inicio-section', 'calculadora-section', 'pedidos-section', 'agenda-section', 'clientes-section', 'latas-section', 'caminhoes-section'],
    navItems: [
      { target: 'inicio-section', label: 'Inicio' },
      { target: 'calculadora-section', label: 'Lancar pedido' },
      { target: 'pedidos-section', label: 'Pedidos' },
      { target: 'agenda-section', label: 'Agenda' },
      { target: 'clientes-section', label: 'Clientes' },
      { target: 'latas-section', label: 'Produtos' },
      { target: 'caminhoes-section', label: 'Caminhoes' }
    ]
  }
];

const VIEW_MODULE_MAP = new Map(
  MODULE_DEFINITIONS.flatMap((module) => module.views.map((view) => [view, module.key]))
);

const loginCard = document.getElementById('login-card');
const appSection = document.getElementById('app');
const adminPanel = document.getElementById('admin-panel');
const accountMenu = document.getElementById('account-menu');
const accountMenuToggle = document.getElementById('account-menu-toggle');
const accountMenuPanel = document.getElementById('account-menu-panel');
const accountMenuAvatar = document.getElementById('account-menu-avatar');
const logoutBtn = document.getElementById('logout-btn');
const sessionInfo = document.getElementById('session-info');
const toast = document.getElementById('toast');
const resultBox = document.getElementById('calculation-result');

const loginForm = document.getElementById('login-form');
const companyForm = document.getElementById('company-form');
const clientForm = document.getElementById('client-form');
const userForm = document.getElementById('user-form');
const userModulesInputs = document.getElementById('user-modules-inputs');
const companyModulesInputs = document.getElementById('company-modules-inputs');
const companyFormBackBtn = document.getElementById('company-form-back-btn');
const companyFormNextBtn = document.getElementById('company-form-next-btn');
const companyFormSubmitBtn = document.getElementById('company-form-submit-btn');
const categoryForm = document.getElementById('category-form');
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
const agendaStartDateInput = document.getElementById('agenda-start-date-input');
const agendaEndDateInput = document.getElementById('agenda-end-date-input');
const agendaRefreshBtn = document.getElementById('agenda-refresh-btn');

const canSelect = document.getElementById('can-select');
const selectedClient = document.getElementById('selected-client');
const newClientLabel = document.getElementById('new-client-label');
const newClientInput = document.getElementById('new-client-input');
const createClientBtn = document.getElementById('create-client-btn');
const currentClientName = document.getElementById('current-client-name');
const stepClient = document.getElementById('step-client');
const stepItems = document.getElementById('step-items');
const stepLaunch = document.getElementById('step-launch');
const clientSelectionSection = document.getElementById('client-selection-section');
const itemsSection = document.getElementById('items-section');
const multiClientActions = document.getElementById('multi-client-actions');
const addMoreClientsBtn = document.getElementById('add-more-clients-btn');
const finishClientsBtn = document.getElementById('finish-clients-btn');
const backToItemsBtn = document.getElementById('back-to-items-btn');
const launchSection = document.getElementById('launch-section');
const clientInput = document.getElementById('client-input');
const quantityInput = document.getElementById('quantity-input');
const manualTruckSelect = document.getElementById('manual-truck-select');
const manualAllocationList = document.getElementById('manual-allocation-list');
const cargoBody = document.getElementById('cargo-body');
const cargoClientHeader = document.getElementById('cargo-client-header');
const cansBody = document.getElementById('cans-body');
const cansSearchInput = document.getElementById('cans-search-input');
const cansCategoryFilter = document.getElementById('cans-category-filter');
const cansShapeFilter = document.getElementById('cans-shape-filter');
const cansClearFiltersBtn = document.getElementById('cans-clear-filters-btn');
const cansFilterCount = document.getElementById('cans-filter-count');
const cargoSearchInput = document.getElementById('cargo-search-input');
const cargoClientFilter = document.getElementById('cargo-client-filter');
const cargoClearFiltersBtn = document.getElementById('cargo-clear-filters-btn');
const cargoFilterCount = document.getElementById('cargo-filter-count');
const categoriesBody = document.getElementById('categories-body');
const categoriesOperationalBody = document.getElementById('categories-body-operational');
const clientsBody = document.getElementById('clients-body');
const trucksBody = document.getElementById('trucks-body');
const usersBody = document.getElementById('users-body');
const companiesGrid = document.getElementById('companies-grid');
const ordersBody = document.getElementById('orders-body');
const manualResultBox = document.getElementById('manual-result');
const entityModalOverlay = document.getElementById('entity-modal-overlay');
const entityModalCard = entityModalOverlay?.querySelector('.modal-card');
const closeEntityModalBtn = document.getElementById('close-entity-modal-btn');
const entityModalTitle = document.getElementById('entity-modal-title');
const entityModalContent = document.getElementById('entity-modal-content');
const confirmModalOverlay = document.getElementById('confirm-modal-overlay');
const closeConfirmModalBtn = document.getElementById('close-confirm-modal-btn');
const confirmModalTitle = document.getElementById('confirm-modal-title');
const confirmModalContent = document.getElementById('confirm-modal-content');
const confirmModalCancelBtn = document.getElementById('confirm-modal-cancel-btn');
const confirmModalConfirmBtn = document.getElementById('confirm-modal-confirm-btn');
const clientModalOverlay = document.getElementById('client-modal-overlay');
const closeClientModalBtn = document.getElementById('close-client-modal-btn');
const clientModalTitle = document.getElementById('client-modal-title');
const clientModalForm = document.getElementById('client-modal-form');
const cancelClientBtn = document.getElementById('cancel-client-btn');
const addClientBtn = document.getElementById('add-client-btn');
const addCategoryBtn = document.getElementById('add-category-btn');
const addCanBtn = document.getElementById('add-can-btn');
const addTruckBtn = document.getElementById('add-truck-btn');
const clientSearch = document.getElementById('client-search');
const clientStatusFilter = document.getElementById('client-status-filter');
const clientStateFilter = document.getElementById('client-state-filter');
const exportClientsBtn = document.getElementById('export-clients-btn');
const refreshClientsBtn = document.getElementById('refresh-clients-btn');
const calculationModeInputs = document.querySelectorAll('input[name="calculationMode"]');
const sideNavItems = document.querySelectorAll('.nav-option[data-target]');
const sideNavGroups = document.querySelectorAll('.nav-module-group[data-module-key]');
const sideNavModuleToggles = document.querySelectorAll('.nav-module-toggle[data-module-key]');
const navAdminItem = document.getElementById('nav-admin-item-accordion');
const mobileNavSelect = document.getElementById('mobile-nav-select');
const mobileNavAdminOption = document.getElementById('mobile-nav-admin-option');
const viewPanes = document.querySelectorAll('.view-pane');
const summaryStats = document.getElementById('summary-stats');
const adminPanelDescription = document.getElementById('admin-panel-description');
const platformAdminShell = document.getElementById('platform-admin-shell');
const companyAdminShell = document.getElementById('company-admin-shell');
const companyAdminUserCard = document.getElementById('company-admin-user-card');
const companyAdminPlatformOnlyCards = [];
const masterPortfolioBtn = document.getElementById('master-portfolio-btn');
const masterOnboardingBtn = document.getElementById('master-onboarding-btn');
const masterTabPortfolio = document.getElementById('master-tab-portfolio');
const masterTabOnboarding = document.getElementById('master-tab-onboarding');
const platformPortfolioPanel = document.getElementById('platform-portfolio-panel');
const platformOnboardingPanel = document.getElementById('platform-onboarding-panel');
const inicioOrdersList = document.getElementById('inicio-orders-list');
const inicioTrucksList = document.getElementById('inicio-trucks-list');
const inicioAlertsList = document.getElementById('inicio-alerts-list');
const inicioCapacityList = document.getElementById('inicio-capacity-list');
const inicioDateLabel = document.getElementById('inicio-date-label');
const inicioChartsGrid = document.getElementById('inicio-charts-grid');
const agendaSummary = document.getElementById('agenda-summary');
const agendaRangeLabel = document.getElementById('agenda-range-label');
const agendaCalendarTable = document.getElementById('agenda-calendar-table');
const agendaReservationsList = document.getElementById('agenda-reservations-list');
const toggle3DBtn = document.getElementById('toggle-3d-btn');
const toggle3DText = document.getElementById('toggle-text');
const visualization3DContainer = document.getElementById('visualization-3d-container');
const visualization3DHelper = document.getElementById('visualization-3d-helper');
const launchOrder3DIframe = document.getElementById('launch-order-3d-iframe');
const launchSummaryContent = document.getElementById('launch-summary-content');
const agendaTrucksList = document.getElementById('agenda-trucks-list');
const ordersSearchInput = document.getElementById('orders-search-input');
const ordersStatusFilter = document.getElementById('orders-status-filter');
const ordersRequesterFilter = document.getElementById('orders-requester-filter');
const ordersStartFilter = document.getElementById('orders-start-filter');
const ordersEndFilter = document.getElementById('orders-end-filter');
const ordersClearFiltersBtn = document.getElementById('orders-clear-filters-btn');
const ordersFilterCount = document.getElementById('orders-filter-count');

init();

async function init() {
  bindEvents();
  await tryLoadSession();
}

function bindEvents() {
  loginForm.addEventListener('submit', onLogin);
  logoutBtn.addEventListener('click', onLogout);
  accountMenuToggle?.addEventListener('click', onAccountMenuToggle);
  companyForm?.addEventListener('submit', onCreateCompany);
  clientForm?.addEventListener('submit', onCreateOperationalClient);
  companyFormBackBtn?.addEventListener('click', () => setCompanyWizardStep(state.companyWizardStep - 1));
  companyFormNextBtn?.addEventListener('click', onAdvanceCompanyWizard);
  userForm.addEventListener('submit', onCreateUser);
  userForm?.elements?.namedItem('role')?.addEventListener('change', syncUserFormAccess);
  masterPortfolioBtn?.addEventListener('click', () => setPlatformSection('portfolio'));
  masterOnboardingBtn?.addEventListener('click', () => setPlatformSection('onboarding'));
  masterTabPortfolio?.addEventListener('click', () => setPlatformSection('portfolio'));
  masterTabOnboarding?.addEventListener('click', () => setPlatformSection('onboarding'));
  categoryForm.addEventListener('submit', onCreateCategory);
  canForm.addEventListener('submit', onCreateCan);
  truckForm.addEventListener('submit', onCreateTruck);
  cargoItemForm.addEventListener('submit', onAddCargoItem);
  calculateBtn.addEventListener('click', onCalculateAutomatic);
  selectedClient.addEventListener('change', onSelectedClientChange);
  createClientBtn.addEventListener('click', onCreateNewClient);
  addMoreClientsBtn.addEventListener('click', onAddMoreClients);
  finishClientsBtn.addEventListener('click', onFinishClients);
  backToItemsBtn?.addEventListener('click', onBackToItems);
  manualTruckForm.addEventListener('submit', onManualSingleSimulation);
  manualMultiCalcBtn.addEventListener('click', onManualMultiSimulation);
  addManualAllocationBtn.addEventListener('click', onAddManualAllocation);
  launchOrderBtn.addEventListener('click', onLaunchOrder);
  addClientBtn.addEventListener('click', onOpenClientModal);
  addCategoryBtn?.addEventListener('click', onOpenCategoryModal);
  addCanBtn?.addEventListener('click', onOpenCanCreateModal);
  addTruckBtn?.addEventListener('click', onOpenTruckCreateModal);
  closeClientModalBtn.addEventListener('click', onCloseClientModal);
  cancelClientBtn.addEventListener('click', onCloseClientModal);
  clientModalForm.addEventListener('submit', onSaveClient);
  clientSearch.addEventListener('input', onClientSearch);
  clientStatusFilter.addEventListener('change', onClientFilter);
  clientStateFilter.addEventListener('change', onClientFilter);
  refreshClientsBtn.addEventListener('click', onRefreshClients);
  orderStartDateInput.addEventListener('change', onOrderDateChange);
  orderEndDateInput.addEventListener('change', onOrderDateChange);
  agendaStartDateInput?.addEventListener('change', onAgendaRangeChange);
  agendaEndDateInput?.addEventListener('change', onAgendaRangeChange);
  agendaRefreshBtn?.addEventListener('click', () => {
    loadTruckSchedule(true);
  });
  ordersSearchInput?.addEventListener('input', onOrderFiltersChange);
  ordersStatusFilter?.addEventListener('change', onOrderFiltersChange);
  ordersRequesterFilter?.addEventListener('input', onOrderFiltersChange);
  ordersStartFilter?.addEventListener('change', onOrderFiltersChange);
  ordersEndFilter?.addEventListener('change', onOrderFiltersChange);
  ordersClearFiltersBtn?.addEventListener('click', clearOrderFilters);
  cansSearchInput?.addEventListener('input', onCanFiltersChange);
  cansCategoryFilter?.addEventListener('change', onCanFiltersChange);
  cansShapeFilter?.addEventListener('change', onCanFiltersChange);
  cansClearFiltersBtn?.addEventListener('click', clearCanFilters);
  cargoSearchInput?.addEventListener('input', onCargoFiltersChange);
  cargoClientFilter?.addEventListener('change', onCargoFiltersChange);
  cargoClearFiltersBtn?.addEventListener('click', clearCargoFilters);
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
  sideNavModuleToggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const moduleKey = toggle.dataset.moduleKey;
      if (!moduleKey) return;
      state.expandedModuleKey = moduleKey;
      syncExpandedModules();
    });
  });
  document.addEventListener('click', onDocumentClick);
  mobileNavSelect?.addEventListener('change', () => {
    if (mobileNavSelect.value) {
      setCurrentView(mobileNavSelect.value);
    }
  });
  document.addEventListener('keydown', onGlobalKeydown);
  const todayIso = getTodayDateIso();
  orderStartDateInput.value = todayIso;
  orderEndDateInput.value = todayIso;
  state.agendaStartDate = todayIso;
  state.agendaEndDate = addDaysIso(todayIso, 6);
  if (agendaStartDateInput) agendaStartDateInput.value = state.agendaStartDate;
  if (agendaEndDateInput) agendaEndDateInput.value = state.agendaEndDate;
  syncLegacyOrderDateInput();
  syncCalculationPanels();
  syncCanShapeFields();
  syncOrderFilterInputs();
}

function getAvailableModules() {
  const allowedKeys = new Set(MODULE_DEFINITIONS.map((module) => module.key));
  const source = Array.isArray(state.availableModules) && state.availableModules.length
    ? state.availableModules
    : MODULE_DEFINITIONS;

  const normalized = source.filter((module) => allowedKeys.has(module.key));
  return normalized.length ? normalized : MODULE_DEFINITIONS;
}

function getPlatformSection() {
  return state.platformSection === 'onboarding' ? 'onboarding' : 'portfolio';
}

function setPlatformSection(section) {
  state.platformSection = section === 'onboarding' ? 'onboarding' : 'portfolio';
  syncPlatformSection();
}

function syncPlatformSection() {
  const isOnboarding = getPlatformSection() === 'onboarding';
  platformPortfolioPanel?.classList.toggle('hidden', isOnboarding);
  platformOnboardingPanel?.classList.toggle('hidden', !isOnboarding);
  masterTabPortfolio?.classList.toggle('active', !isOnboarding);
  masterTabOnboarding?.classList.toggle('active', isOnboarding);
}

function setCompanyWizardStep(step) {
  const nextStep = Math.max(1, Math.min(3, Number(step) || 1));
  state.companyWizardStep = nextStep;

  document.querySelectorAll('[data-company-step]').forEach((section) => {
    section.classList.toggle('hidden', Number(section.dataset.companyStep) !== nextStep);
  });

  [1, 2, 3].forEach((currentStep) => {
    const indicator = document.getElementById(`company-step-${currentStep}-indicator`);
    if (!indicator) return;
    indicator.classList.toggle('active', currentStep === nextStep);
    indicator.classList.toggle('done', currentStep < nextStep);
  });

  if (companyFormBackBtn) companyFormBackBtn.classList.toggle('hidden', nextStep === 1);
  if (companyFormNextBtn) companyFormNextBtn.classList.toggle('hidden', nextStep === 3);
  if (companyFormSubmitBtn) companyFormSubmitBtn.classList.toggle('hidden', nextStep !== 3);
}

function getCompanyWizardFields(step) {
  const fieldsByStep = {
    1: ['name', 'status', 'contactName', 'contactEmail', 'contactPhone', 'document'],
    2: ['adminName', 'adminEmail', 'adminPassword', 'notes'],
    3: ['billingAmount', 'billingDueDay', 'paymentStatus', 'lastPaymentDate']
  };
  return fieldsByStep[step] || [];
}

function validateCompanyWizardStep(step) {
  if (!companyForm) return true;
  for (const fieldName of getCompanyWizardFields(step)) {
    const field = companyForm.elements.namedItem(fieldName);
    if (field && typeof field.reportValidity === 'function' && !field.reportValidity()) {
      return false;
    }
  }
  return true;
}

function onAdvanceCompanyWizard() {
  if (!validateCompanyWizardStep(state.companyWizardStep)) {
    return;
  }
  setCompanyWizardStep(state.companyWizardStep + 1);
}

function getUserModules() {
  return Array.isArray(state.user?.modules) ? state.user.modules : [];
}

function isPlatformAdmin() {
  return Boolean(state.user?.isPlatformAdmin);
}

function hasModuleAccess(moduleKey) {
  if (!state.user) return false;
  if (isPlatformAdmin()) return false;
  if (state.user.role === 'admin') {
    return Array.isArray(state.user.companyModules) && state.user.companyModules.includes(moduleKey);
  }
  return getUserModules().includes(moduleKey);
}

function canManageOperationalData() {
  return Boolean(state.user) && !isPlatformAdmin() && hasModuleAccess('loading3d');
}

function getAllowedViewIds() {
  const viewIds = MODULE_DEFINITIONS
    .filter((module) => hasModuleAccess(module.key))
    .flatMap((module) => module.views);

  if (state.user?.role === 'admin') {
    viewIds.push('admin-panel');
  }

  return Array.from(new Set(viewIds));
}

function getDefaultView() {
  return getAllowedViewIds()[0] || 'inicio-section';
}

function formatModuleList(modules = []) {
  const labelsByKey = new Map(getAvailableModules().map((module) => [module.key, module.label]));
  if (!Array.isArray(modules) || !modules.length) {
    return 'Nenhum modulo liberado';
  }

  return modules.map((moduleKey) => labelsByKey.get(moduleKey) || moduleKey).join(', ');
}

function formatCompanyModuleScope(modules = []) {
  const base = formatModuleList(modules);
  if (!modules.length) return base;
  return `${base} • inclui Dashboard, Operacoes, Clientes, Produtos e Caminhoes`;
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPaymentStatus(status) {
  const map = {
    pending: 'Pendente',
    paid: 'Pago',
    overdue: 'Em atraso'
  };
  return map[String(status || '').trim()] || 'Nao informado';
}

function buildModuleCheckboxes(selectedModules = [], disabled = false) {
  const selected = new Set(selectedModules);
  return getAvailableModules().map((module) => `
    <label class="module-option module-option-full ${disabled ? 'module-option-disabled' : ''}">
      <div class="module-option-main">
        <input
          type="checkbox"
          name="modules"
          value="${escapeHtml(module.key)}"
          ${selected.has(module.key) ? 'checked' : ''}
          ${disabled ? 'disabled' : ''}
        />
        <span>${escapeHtml(module.label)}</span>
      </div>
      <small class="module-option-description">Inclui Dashboard, Operacoes, Clientes, Produtos e Caminhoes.</small>
    </label>
  `).join('');
}

async function tryLoadSession() {
  const response = await api('/api/me');
  if (!response.ok) {
    state.csrfToken = null;
    renderLoggedOut();
    return;
  }

  state.user = response.data.user;
  state.availableModules = response.data.availableModules || MODULE_DEFINITIONS;
  state.csrfToken = response.data.csrfToken || null;
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
  state.availableModules = response.data.availableModules || MODULE_DEFINITIONS;
  state.csrfToken = response.data.csrfToken || null;
  loginForm.reset();
  state.cargoItems = [];
  await loadData();
  renderApp();
  showToast('Login realizado com sucesso.');
}

async function onLogout() {
  closeAccountMenu();
  await api('/api/logout', { method: 'POST', body: {} });
  state.user = null;
  state.availableModules = [];
  state.csrfToken = null;
  state.cargoItems = [];
  renderLoggedOut();
}

async function loadData() {
  if (isPlatformAdmin()) {
    const companiesRes = await api('/api/platform/companies');
    state.companies = companiesRes.ok ? companiesRes.data.companies : [];
    state.users = [];
    state.cans = [];
    state.categories = [];
    state.clients = [];
    state.trucks = [];
    state.orders = [];
    state.todayBusyTruckIds = [];
    state.todayBusyTrucks = [];
    state.todayTruckAvailabilityById = {};
    state.unavailableTruckIds = [];
    state.truckAvailabilityById = {};
    state.truckSchedule = null;
    return;
  }

  const todayIso = getTodayDateIso();
  const inventoryAllowed = hasModuleAccess('loading3d');
  const clientsAllowed = inventoryAllowed;
  const fleetAllowed = inventoryAllowed;
  const operationsAllowed = inventoryAllowed;

  const [canRes, categoryRes, clientRes, truckRes, ordersRes, todayAvailabilityRes] = await Promise.all([
    inventoryAllowed ? api('/api/cans') : Promise.resolve({ ok: true, data: { cans: [] } }),
    inventoryAllowed ? api('/api/can-categories') : Promise.resolve({ ok: true, data: { categories: [] } }),
    clientsAllowed ? api('/api/clients') : Promise.resolve({ ok: true, data: { clients: [] } }),
    fleetAllowed ? api('/api/trucks') : Promise.resolve({ ok: true, data: { trucks: [] } }),
    operationsAllowed ? api('/api/orders') : Promise.resolve({ ok: true, data: { orders: [] } }),
    operationsAllowed
      ? api(`/api/truck-availability?startDate=${encodeURIComponent(todayIso)}&endDate=${encodeURIComponent(todayIso)}`)
      : Promise.resolve({ ok: true, data: { availability: [], busyTruckIds: [], busyTrucks: [] } })
  ]);

  if (!canRes.ok || !categoryRes.ok || !clientRes.ok || !truckRes.ok || !ordersRes.ok || !todayAvailabilityRes.ok) {
    showToast('Erro ao carregar dados iniciais.');
    return;
  }

  state.cans = canRes.data.cans;
  state.categories = categoryRes.data.categories;
  state.clients = clientRes.data.clients;
  state.trucks = truckRes.data.trucks;
  state.orders = ordersRes.data.orders;
  state.todayBusyTruckIds = todayAvailabilityRes.data.busyTruckIds || [];
  state.todayBusyTrucks = todayAvailabilityRes.data.busyTrucks || [];
  state.todayTruckAvailabilityById = buildTruckAvailabilityLookup(todayAvailabilityRes.data.availability || []);
  state.cargoItems = state.cargoItems.filter((item) => state.cans.some((can) => can.id === item.canId));
  if (operationsAllowed) {
    await syncTruckAvailabilityForRange(false);
    await loadTruckSchedule(false);
  } else {
    state.unavailableTruckIds = [];
    state.truckAvailabilityById = {};
    state.truckSchedule = null;
  }
  sanitizeManualSelections();

  if (state.user?.role === 'admin') {
    const usersRes = await api('/api/users');
    state.users = usersRes.ok ? usersRes.data.users : [];
  } else {
    state.users = [];
  }
  state.companies = [];
}

function renderLoggedOut() {
  document.body.classList.add('login-mode');
  loginCard.classList.remove('hidden');
  appSection.classList.add('hidden');
  adminPanel.classList.add('hidden');
  accountMenu?.classList.add('hidden');
  closeAccountMenu();
  sessionInfo.textContent = '';
  if (accountMenuAvatar) {
    accountMenuAvatar.textContent = 'G';
  }
  state.unavailableTruckIds = [];
  state.truckAvailabilityById = {};
  state.todayTruckAvailabilityById = {};
  state.todayBusyTruckIds = [];
  state.todayBusyTrucks = [];
  state.truckSchedule = null;
  state.lastCalculation = null;
  state.csrfToken = null;
  state.availableModules = [];
  state.companies = [];
  state.platformSection = 'portfolio';
  state.companyWizardStep = 1;
  state.expandedModuleKey = MODULE_DEFINITIONS[0]?.key || null;
  state.currentView = 'inicio-section';
  closeEntityModal();
}

function syncNavigationAccess() {
  const accessibleModuleKeys = new Set();
  sideNavItems.forEach((item) => {
    const targetId = item.dataset.target;
    const moduleKey = VIEW_MODULE_MAP.get(targetId);
    const allowed = targetId === 'admin-panel'
      ? state.user?.role === 'admin'
      : !moduleKey || hasModuleAccess(moduleKey);
    item.classList.toggle('hidden', !allowed);
    if (allowed && moduleKey) {
      accessibleModuleKeys.add(moduleKey);
    }
  });

  sideNavGroups.forEach((group) => {
    const moduleKey = group.dataset.moduleKey;
    const allowed = accessibleModuleKeys.has(moduleKey);
    group.classList.toggle('hidden', !allowed);
  });

  if (mobileNavSelect) {
    Array.from(mobileNavSelect.options).forEach((option) => {
      const targetId = option.value;
      const moduleKey = VIEW_MODULE_MAP.get(targetId);
      const allowed = targetId === 'admin-panel'
        ? state.user?.role === 'admin'
        : !moduleKey || hasModuleAccess(moduleKey);
      option.hidden = !allowed;
      option.disabled = !allowed;
    });
  }

  const expandedAllowed = state.expandedModuleKey && accessibleModuleKeys.has(state.expandedModuleKey);
  if (!expandedAllowed) {
    state.expandedModuleKey = accessibleModuleKeys.values().next().value || MODULE_DEFINITIONS[0]?.key || null;
  }
  syncExpandedModules();
}

function syncExpandedModules() {
  sideNavGroups.forEach((group) => {
    const moduleKey = group.dataset.moduleKey;
    const expanded = moduleKey === state.expandedModuleKey;
    group.classList.toggle('expanded', expanded);
    const toggle = group.querySelector('.nav-module-toggle');
    toggle?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  });
}

function syncUserFormAccess() {
  if (!userModulesInputs) return;

  const roleSelect = userForm?.elements?.namedItem('role');
  const canManageAdminRoles = isPlatformAdmin();
  if (roleSelect && !canManageAdminRoles) {
    roleSelect.value = 'user';
    roleSelect.disabled = true;
  } else if (roleSelect) {
    roleSelect.disabled = false;
  }
  const selectedModules = Array.from(userModulesInputs.querySelectorAll('input[name="modules"]:checked'))
    .map((input) => input.value);
  const companyModules = Array.isArray(state.user?.companyModules) && state.user.companyModules.length
    ? state.user.companyModules
    : ['loading3d'];
  const isAdminRole = roleSelect?.value === 'admin';
  const fallbackModules = canManageAdminRoles
    ? (selectedModules.length ? selectedModules : companyModules)
    : companyModules;
  userModulesInputs.innerHTML = buildModuleCheckboxes(
    fallbackModules,
    !canManageAdminRoles || isAdminRole
  );
}

function syncCompanyFormAccess() {
  if (!companyModulesInputs) return;
  const selectedModules = Array.from(companyModulesInputs.querySelectorAll('input[name="modules"]:checked'))
    .map((input) => input.value);
  const fallbackModules = selectedModules.length ? selectedModules : ['loading3d'];
  companyModulesInputs.innerHTML = buildModuleCheckboxes(fallbackModules);
}

function renderApp() {
  document.body.classList.remove('login-mode');
  loginCard.classList.add('hidden');
  appSection.classList.remove('hidden');
  accountMenu?.classList.remove('hidden');
  closeAccountMenu();
  sessionInfo.textContent = isPlatformAdmin()
    ? `${state.user.name} (master da plataforma)`
    : `${state.user.name} (${state.user.role}) • ${state.user.companyName || ''}`;
  if (accountMenuAvatar) {
    accountMenuAvatar.textContent = getUserInitials(state.user.name);
  }

  syncNavigationAccess();
  syncUserFormAccess();
  syncCompanyFormAccess();
  syncPlatformSection();
  setCompanyWizardStep(state.companyWizardStep);

  if (adminPanelDescription) {
    adminPanelDescription.textContent = isPlatformAdmin()
      ? 'Painel master da plataforma: acompanhe carteira, onboarding e cobranca dos clientes SaaS.'
      : 'Somente administradores da empresa podem cadastrar usuarios, produtos e caminhoes da propria base.';
  }

  platformAdminShell?.classList.toggle('hidden', !isPlatformAdmin());
  companyAdminShell?.classList.toggle('hidden', isPlatformAdmin());
  companyAdminPlatformOnlyCards?.forEach((card) => {
    card.classList.toggle('hidden', !isPlatformAdmin());
  });
  createClientBtn?.classList.toggle('hidden', !canManageOperationalData());
  addClientBtn?.classList.toggle('hidden', !canManageOperationalData());
  addCategoryBtn?.classList.toggle('hidden', !canManageOperationalData());
  addCanBtn?.classList.toggle('hidden', !canManageOperationalData());
  addTruckBtn?.classList.toggle('hidden', !canManageOperationalData());

  if (state.user.role === 'admin') {
    adminPanel.classList.remove('hidden');
    navAdminItem?.classList.remove('hidden');
    mobileNavAdminOption?.removeAttribute('hidden');
    if (mobileNavAdminOption) mobileNavAdminOption.disabled = false;
  } else {
    adminPanel.classList.add('hidden');
    navAdminItem?.classList.add('hidden');
    mobileNavAdminOption?.setAttribute('hidden', 'hidden');
    if (mobileNavAdminOption) mobileNavAdminOption.disabled = true;
    if (state.currentView === 'admin-panel') {
      state.currentView = getDefaultView();
    }
  }

  if (!getAllowedViewIds().includes(state.currentView) && !(state.user.role === 'admin' && state.currentView === 'admin-panel')) {
    state.currentView = getDefaultView();
  }

  renderHomeOverview();
  renderCans();
  renderCategories();
  renderClients();
  renderTrucks();
  renderDateAvailabilityHint();
  renderUsers();
  renderCompanies();
  renderOrders();
  renderCargoBuilder();
  renderTruckSchedule();
  syncCalculationPanels();
  setCurrentView(state.currentView);
}

function onSideNavClick(item) {
  const targetId = item.dataset.target;
  if (!targetId) return;
  const moduleKey = item.dataset.moduleKey;
  if (moduleKey) {
    state.expandedModuleKey = moduleKey;
    syncExpandedModules();
  }
  setCurrentView(targetId);
}

function setActiveSideNav(targetId) {
  sideNavItems.forEach((entry) => {
    entry.classList.toggle('active', entry.dataset.target === targetId);
  });
  const activeModuleKey = VIEW_MODULE_MAP.get(targetId);
  if (activeModuleKey) {
    state.expandedModuleKey = activeModuleKey;
    syncExpandedModules();
  }
  if (mobileNavSelect) {
    mobileNavSelect.value = targetId;
  }
}

function setCurrentView(targetId) {
  const target = document.getElementById(targetId);
  const moduleKey = VIEW_MODULE_MAP.get(targetId);
  const allowed = targetId === 'admin-panel'
    ? state.user?.role === 'admin'
    : !moduleKey || hasModuleAccess(moduleKey);

  if (!target || !allowed) {
    state.currentView = getDefaultView();
  } else {
    state.currentView = targetId;
  }

  viewPanes.forEach((pane) => {
    pane.classList.toggle('hidden', pane.id !== state.currentView);
  });
  setActiveSideNav(state.currentView);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function onAccountMenuToggle(event) {
  event.stopPropagation();
  if (!accountMenu || accountMenu.classList.contains('hidden')) {
    return;
  }

  const shouldOpen = accountMenuPanel.classList.contains('hidden');
  accountMenuPanel.classList.toggle('hidden', !shouldOpen);
  accountMenuToggle?.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
}

function onDocumentClick(event) {
  if (!accountMenu || accountMenu.classList.contains('hidden')) {
    return;
  }

  if (!accountMenu.contains(event.target)) {
    closeAccountMenu();
  }
}

function closeAccountMenu() {
  accountMenuPanel?.classList.add('hidden');
  accountMenuToggle?.setAttribute('aria-expanded', 'false');
}

function renderHomeOverview() {
  if (isPlatformAdmin()) {
    const activeCompanies = state.companies.filter((company) => company.status === 'active');
    const totalUsers = state.companies.reduce((sum, company) => sum + Number(company.total_users || 0), 0);
    const activeUsers = state.companies.reduce((sum, company) => sum + Number(company.active_users || 0), 0);
    inicioDateLabel.textContent = 'Plataforma';
    summaryStats.innerHTML = [
      { label: 'Clientes SaaS', value: state.companies.length, detail: 'Empresas cadastradas na plataforma', tone: 'neutral' },
      { label: 'Clientes ativos', value: activeCompanies.length, detail: 'Empresas com acesso liberado', tone: 'success' },
      { label: 'Usuários ativos', value: activeUsers, detail: 'Contas ativas nas empresas', tone: 'accent' },
      { label: 'Usuários totais', value: totalUsers, detail: 'Contas vinculadas aos clientes', tone: 'warning' }
    ].map((item) => `
      <article class="summary-card tone-${item.tone}">
        <span class="summary-label">${escapeHtml(item.label)}</span>
        <strong class="summary-value">${escapeHtml(String(item.value))}</strong>
        <span class="summary-detail">${escapeHtml(item.detail)}</span>
      </article>
    `).join('');

    inicioOrdersList.innerHTML = buildOverviewListHtml(
      state.companies.slice(0, 5).map((company) => ({
        title: company.name,
        meta: `${company.active_users || 0} usuário(s) ativo(s) • ${formatModuleList(company.modules)}`,
        tone: company.status === 'active' ? 'success' : 'warning'
      })),
      'Nenhum cliente SaaS cadastrado ainda.'
    );
    inicioTrucksList.innerHTML = buildOverviewListHtml([], 'Visão operacional indisponível para o usuário master.');
    inicioAlertsList.innerHTML = buildOverviewListHtml(
      activeCompanies.slice(0, 4).map((company) => ({
        title: `${company.name} com ${company.active_users || 0} usuário(s) ativo(s)`,
        meta: company.status === 'active' ? 'Cliente ativo na plataforma' : 'Cliente inativo',
        tone: company.status === 'active' ? 'success' : 'warning'
      })),
      'Sem alertas da plataforma.'
    );
    inicioCapacityList.innerHTML = buildOverviewListHtml(
      state.companies.slice(0, 4).map((company) => ({
        title: company.name,
        meta: `${company.modules.length} módulo(s): ${formatModuleList(company.modules)}`,
        tone: 'neutral'
      })),
      'Nenhum módulo contratado ainda.'
    );
    inicioChartsGrid.innerHTML = '';
    return;
  }

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
    { label: 'Entregas concluídas', value: completedOrders.length, detail: 'Pedidos finalizados no sistema', tone: 'neutral' },
    { label: 'Pedidos em aberto', value: openOrders.length, detail: 'Demandas aguardando conclusão', tone: 'warning' },
    { label: 'Caminhões disponíveis hoje', value: `${availableTodayCount}/${totalTruckUnits}`, detail: `Unidades livres em ${formatDate(todayIso)}`, tone: 'success' },
    { label: 'Produtos cadastrados', value: state.cans.length, detail: 'Modelos ativos para simulação', tone: 'neutral' },
    { label: 'Modelos de caminhão', value: state.trucks.length, detail: `${totalTruckUnits} unidade(s) cadastrada(s)`, tone: 'neutral' },
    { label: state.user?.role === 'admin' ? 'Usuários ativos' : 'Pedidos para hoje', value: state.user?.role === 'admin' ? state.users.length : ordersToday.length, detail: state.user?.role === 'admin' ? 'Contas cadastradas no sistema' : 'Entregas programadas para hoje', tone: 'accent' }
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
      meta: `${formatOrderRange(order)} • ${formatVolume(order.total_volume_cm3)} • ${order.status === 'completed' ? 'Concluído' : 'Aberto'}`,
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

  inicioTrucksList.innerHTML = buildOverviewListHtml(truckItems, 'Nenhuma informação de frota disponível.');

  const alerts = [
    `${openOrders.length} pedido(s) em aberto aguardando tratativa.`,
    `${ordersToday.length} pedido(s) com entrega ativa hoje.`,
    `${busyTodayCount} unidade(s) de caminhão reservada(s) na operação de hoje.`,
    `${openVolumeLiters.toFixed(2)} L em pedidos ainda abertos.`
  ];

  inicioAlertsList.innerHTML = buildOverviewListHtml(
    alerts.map((text, index) => ({
      title: text,
      meta: index === 0 ? 'Monitoramento operacional' : 'Resumo automático do sistema',
      tone: index < 2 ? 'warning' : 'neutral'
    })),
    'Sem alertas no momento.'
  );

  const capacityItems = [
    { title: `${totalCapacityLiters.toFixed(2)} L`, meta: 'Capacidade total de transporte cadastrada', tone: 'accent' },
    { title: `${state.cans.length} formatos`, meta: 'Tipos de produtos disponiveis', tone: 'neutral' },
    { title: `${totalTruckUnits} veículos`, meta: 'Unidades totais da frota configurada', tone: 'neutral' }
  ];

  inicioCapacityList.innerHTML = buildOverviewListHtml(capacityItems, 'Sem capacidade cadastrada.');
  renderGeneralCharts();
}

function renderGeneralCharts() {
  if (!inicioChartsGrid) return;

  const todayIso = getTodayDateIso();
  const openOrders = state.orders.filter((order) => order.status === 'open');
  const completedOrders = state.orders.filter((order) => order.status === 'completed');
  const totalOrders = state.orders.length;
  const openOrdersPct = totalOrders > 0 ? (openOrders.length / totalOrders) * 100 : 0;

  const totalTruckUnits = state.trucks.reduce((sum, truck) => sum + Number(truck.quantity || 1), 0);
  const busyTodayCount = state.trucks.reduce((sum, truck) => {
    const reserved = Number(getTodayAvailabilityInfo(truck.id).reservedQuantity || 0);
    return sum + reserved;
  }, 0);
  const fleetUsagePct = totalTruckUnits > 0 ? (busyTodayCount / totalTruckUnits) * 100 : 0;

  const weekSeries = buildWeekDemandSeries(todayIso, 7);
  const maxSeriesValue = Math.max(1, ...weekSeries.map((item) => item.orders));
  const weekBarsHtml = weekSeries
    .map((item) => {
      const percent = Math.max(8, Math.round((item.orders / maxSeriesValue) * 100));
      return `
        <div class="chart-bar-item">
          <span class="chart-bar-value">${item.orders}</span>
          <div class="chart-bar-track">
            <span class="chart-bar-fill" style="height: ${percent}%"></span>
          </div>
          <span class="chart-bar-label">${escapeHtml(item.label)}</span>
        </div>
      `;
    })
    .join('');

  const canSquareCount = state.cans.filter((can) => can.shape === 'square').length;
  const canCylinderCount = state.cans.filter((can) => can.shape === 'cylinder').length;
  const canTotal = state.cans.length;
  const squarePct = canTotal > 0 ? (canSquareCount / canTotal) * 100 : 0;
  const cylinderPct = canTotal > 0 ? (canCylinderCount / canTotal) * 100 : 0;
  const averageCanVolumeLiters =
    canTotal > 0
      ? state.cans.reduce((sum, can) => sum + Number(can.volume_cm3 || 0), 0) / canTotal / 1000
      : 0;

  inicioChartsGrid.innerHTML = `
    <article class="chart-card">
      <header class="chart-card-head">
        <h4>Status dos pedidos</h4>
        <span>${totalOrders} total</span>
      </header>
      <div class="chart-donut-wrap">
        <div class="chart-donut" style="--chart-fill: ${openOrdersPct.toFixed(2)}%"></div>
        <div class="chart-donut-legend">
          <p><strong>${openOrders.length}</strong> aberto(s)</p>
          <p><strong>${completedOrders.length}</strong> concluído(s)</p>
          <small>${openOrdersPct.toFixed(0)}% em aberto</small>
        </div>
      </div>
    </article>

    <article class="chart-card">
      <header class="chart-card-head">
        <h4>Utilização da frota hoje</h4>
        <span>${formatDate(todayIso)}</span>
      </header>
      <div class="chart-donut-wrap">
        <div class="chart-donut chart-donut-fleet" style="--chart-fill: ${fleetUsagePct.toFixed(2)}%"></div>
        <div class="chart-donut-legend">
          <p><strong>${busyTodayCount}</strong> reservado(s)</p>
          <p><strong>${Math.max(0, totalTruckUnits - busyTodayCount)}</strong> livre(s)</p>
          <small>${fleetUsagePct.toFixed(0)}% da frota em uso</small>
        </div>
      </div>
    </article>

    <article class="chart-card chart-card-wide">
      <header class="chart-card-head">
        <h4>Demanda dos próximos 7 dias</h4>
        <span>Pedidos ativos por dia</span>
      </header>
      <div class="chart-bars">${weekBarsHtml}</div>
    </article>

    <article class="chart-card chart-card-wide">
      <header class="chart-card-head">
        <h4>Perfil de embalagens</h4>
        <span>${canTotal} modelo(s)</span>
      </header>
      <div class="shape-metrics">
        <div class="shape-metric-row">
          <span>Produtos retangulares</span>
          <strong>${canSquareCount} (${squarePct.toFixed(0)}%)</strong>
        </div>
        <div class="shape-progress">
          <span style="width: ${squarePct.toFixed(2)}%"></span>
        </div>
        <div class="shape-metric-row">
          <span>Produtos cilindricos</span>
          <strong>${canCylinderCount} (${cylinderPct.toFixed(0)}%)</strong>
        </div>
        <div class="shape-progress shape-progress-dark">
          <span style="width: ${cylinderPct.toFixed(2)}%"></span>
        </div>
        <p class="chart-footnote">Volume médio cadastrado: <strong>${averageCanVolumeLiters.toFixed(2)} L</strong></p>
      </div>
    </article>
  `;
}

function buildWeekDemandSeries(startIso, days = 7) {
  const startDate = parseDateIso(startIso);
  if (!startDate) return [];
  const series = [];

  for (let offset = 0; offset < days; offset += 1) {
    const cursor = new Date(startDate);
    cursor.setDate(startDate.getDate() + offset);
    const cursorIso = toIsoDate(cursor);
    const count = state.orders.filter((order) => doesOrderOverlapDate(order, cursorIso)).length;
    series.push({
      dateIso: cursorIso,
      label: formatAgendaDayHeader(cursorIso).slice(0, 6),
      orders: count
    });
  }

  return series;
}

function parseDateIso(dateIso) {
  if (!dateIso) return null;
  const date = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

function onCanFiltersChange() {
  state.canFilters.search = String(cansSearchInput?.value || '').trim();
  state.canFilters.category = String(cansCategoryFilter?.value || 'all').trim() || 'all';
  state.canFilters.shape = String(cansShapeFilter?.value || 'all').trim() || 'all';
  renderCans();
}

function clearCanFilters() {
  state.canFilters = {
    search: '',
    category: 'all',
    shape: 'all'
  };
  syncCanFilterInputs();
  renderCans();
}

function syncCanFilterInputs() {
  if (cansSearchInput) cansSearchInput.value = state.canFilters.search;
  if (cansCategoryFilter) cansCategoryFilter.value = state.canFilters.category;
  if (cansShapeFilter) cansShapeFilter.value = state.canFilters.shape;
}

function getFilteredCans() {
  const { search, category, shape } = state.canFilters;
  const normalizedSearch = normalizeText(search);

  return state.cans.filter((can) => {
    if (category !== 'all' && String(can.category_id || '') !== category) {
      return false;
    }

    if (shape !== 'all' && can.shape !== shape) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return normalizeText(`${can.name} ${can.category_name || ''} ${can.shape}`).includes(normalizedSearch);
  });
}

function renderCans() {
  cansBody.innerHTML = '';
  canSelect.innerHTML = '';

  for (const can of state.cans) {
    const option = document.createElement('option');
    option.value = String(can.id);
    option.textContent = `${can.name} (${formatVolume(can.volume_cm3)})`;
    canSelect.appendChild(option);
  }
  
  // Popular select de categorias no formulario de produtos
  const categorySelect = document.getElementById('category-select');
  if (categorySelect) {
    categorySelect.innerHTML = '<option value="">Sem categoria</option>';
    for (const category of state.categories) {
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.name;
      categorySelect.appendChild(option);
    }
  }

  if (cansCategoryFilter) {
    cansCategoryFilter.innerHTML = '<option value="all">Todas</option>';
    for (const category of state.categories) {
      const option = document.createElement('option');
      option.value = String(category.id);
      option.textContent = category.name;
      cansCategoryFilter.appendChild(option);
    }
  }
  syncCanFilterInputs();

  const filteredCans = getFilteredCans();
  if (cansFilterCount) {
    const total = state.cans.length;
    cansFilterCount.textContent = filteredCans.length === total
      ? `${filteredCans.length} produto(s)`
      : `${filteredCans.length} de ${total} produto(s)`;
  }
  
  const hasSelection = filteredCans.some((can) => can.id === state.selectedCanId);
  if (!hasSelection) {
    state.selectedCanId = filteredCans[0]?.id ?? null;
  }
  if (!state.selectedCanId && state.modal?.type === 'can') {
    closeEntityModal();
  }

  if (!filteredCans.length) {
    cansBody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum produto encontrado com os filtros atuais.</td></tr>';
  }

  for (const can of filteredCans) {
    const tr = document.createElement('tr');
    tr.classList.add('selectable-row');
    if (can.id === state.selectedCanId) {
      tr.classList.add('selected-row');
    }
    tr.innerHTML = `
      <td>${escapeHtml(can.name)}</td>
      <td>${escapeHtml(can.category_name || 'Sem categoria')}</td>
      <td>${can.shape === 'square' ? 'Retangular' : 'Cilindrico'}</td>
      <td>${formatVolume(can.volume_cm3)}</td>
    `;
    tr.addEventListener('click', () => {
      state.selectedCanId = can.id;
      renderCans();
      openCanModal(can.id);
    });

    cansBody.appendChild(tr);
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
      <td>${escapeHtml(truck.name)}${isUnavailable ? ' <span class="truck-busy-tag">Indisponível no período</span>' : ''}</td>
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
    option.textContent = `${truck.name} (${formatVolume(truck.volume_cm3)}) - ${availableUnits}/${totalUnits} disponível(is)`;
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

function renderCategories() {
  const categoryTargets = [categoriesBody, categoriesOperationalBody].filter(Boolean);
  categoryTargets.forEach((target) => {
    target.innerHTML = '';
  });
  if (!canManageOperationalData()) return;

  for (const category of state.categories) {
    for (const target of categoryTargets) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(category.name)}</td>
        <td>
          <button class="row-action danger" onclick="onDeleteCategory(${category.id}, '${escapeHtml(category.name)}')">Excluir</button>
        </td>
      `;
      target.appendChild(tr);
    }
  }
}

async function onDeleteCategory(categoryId, categoryName) {
  if (!confirm(`Tem certeza que deseja excluir a categoria "${categoryName}"?`)) {
    return;
  }

  const response = await api(`/api/can-categories/${categoryId}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    showToast(response.data.error || 'Não foi possível excluir a categoria.');
    return;
  }

  showToast('Categoria excluída com sucesso!');
  await loadData();
  renderApp();
}

function renderClients() {
  clientsBody.innerHTML = '';
  
  // Atualizar estatísticas
  updateClientStats();
  
  // Filtrar clientes
  let filteredClients = [...state.clients];
  
  const searchTerm = clientSearch?.value.toLowerCase() || '';
  const statusFilter = clientStatusFilter?.value || '';
  const stateFilter = clientStateFilter?.value || '';
  
  if (searchTerm) {
    filteredClients = filteredClients.filter(client => 
      client.name.toLowerCase().includes(searchTerm) ||
      (client.email && client.email.toLowerCase().includes(searchTerm)) ||
      (client.cnpj_cpf && client.cnpj_cpf.toLowerCase().includes(searchTerm)) ||
      (client.contact_person && client.contact_person.toLowerCase().includes(searchTerm))
    );
  }
  
  if (statusFilter) {
    filteredClients = filteredClients.filter(client => client.status === statusFilter);
  }
  
  if (stateFilter) {
    filteredClients = filteredClients.filter(client => client.state === stateFilter);
  }
  
  if (!filteredClients.length) {
    clientsBody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhum cliente encontrado.</td></tr>';
    return;
  }
  
  filteredClients.forEach(client => {
    const tr = document.createElement('tr');
    const statusClass = client.status;
    const statusText = client.status === 'active' ? '✅ Ativo' : 
                      client.status === 'inactive' ? '⏸️ Inativo' : '🚫 Suspenso';
    
    tr.innerHTML = `
      <td>
        <div style="font-weight: 600; color: var(--text);">${escapeHtml(client.name)}</div>
        ${client.contact_person ? `<div style="font-size: 0.85rem; color: var(--muted);">${escapeHtml(client.contact_person)}</div>` : ''}
      </td>
      <td>${client.email ? `<a href="mailto:${escapeHtml(client.email)}" style="color: var(--brand-yellow);">${escapeHtml(client.email)}</a>` : '-'}</td>
      <td>${client.phone || '-'}</td>
      <td>${client.city && client.state ? `${escapeHtml(client.city)}/${client.state}` : '-'}</td>
      <td><span class="client-status ${statusClass}">${statusText}</span></td>
      <td>
        <div style="font-weight: 600;">${client.total_orders || 0}</div>
        ${client.last_order_date ? `<div style="font-size: 0.75rem; color: var(--muted);">${formatDate(client.last_order_date)}</div>` : '<div style="font-size: 0.75rem; color: var(--muted);">Nenhuma compra</div>'}
      </td>
      <td>${client.last_order_date ? formatDate(client.last_order_date) : '-'}</td>
      <td>
        <div class="client-actions">
          <button class="btn btn-view" onclick="onViewClient(${client.id})">👁️</button>
          <button class="btn btn-edit" onclick="openClientEditModal(${client.id})">✏️</button>
          <button class="btn btn-delete" onclick="onDeleteClient(${client.id}, '${escapeHtml(client.name)}')">🗑️</button>
        </div>
      </td>
    `;
    
    clientsBody.appendChild(tr);
  });
}

function updateClientStats() {
  const totalClients = state.clients.length;
  const activeClients = state.clients.filter(c => c.status === 'active').length;
  
  // Calcular novos clientes este mês
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const newClientsMonth = state.clients.filter(c => {
    const createdDate = new Date(c.created_at);
    return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
  }).length;
  
  // Total de pedidos (soma de todos os clientes)
  const totalOrders = state.clients.reduce((sum, client) => sum + (client.total_orders || 0), 0);
  
  // Atualizar os cards
  const totalClientsEl = document.getElementById('total-clients');
  const activeClientsEl = document.getElementById('active-clients');
  const newClientsMonthEl = document.getElementById('new-clients-month');
  const totalOrdersEl = document.getElementById('total-orders');
  
  if (totalClientsEl) totalClientsEl.textContent = totalClients;
  if (activeClientsEl) activeClientsEl.textContent = activeClients;
  if (newClientsMonthEl) newClientsMonthEl.textContent = newClientsMonth;
  if (totalOrdersEl) totalOrdersEl.textContent = totalOrders;
}

function onCargoFiltersChange() {
  state.cargoFilters.search = String(cargoSearchInput?.value || '').trim();
  state.cargoFilters.client = String(cargoClientFilter?.value || 'all').trim() || 'all';
  renderCargoBuilder({ preserveResults: true });
}

function clearCargoFilters() {
  state.cargoFilters = {
    search: '',
    client: 'all'
  };
  syncCargoFilterInputs();
  renderCargoBuilder({ preserveResults: true });
}

function syncCargoFilterInputs() {
  if (cargoSearchInput) cargoSearchInput.value = state.cargoFilters.search;
  if (cargoClientFilter) cargoClientFilter.value = state.cargoFilters.client;
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
      <td>${escapeHtml(user.role === 'admin' ? 'admin' : 'user')}</td>
      <td>${user.is_active ? 'Ativo' : 'Inativo'}</td>
      <td>${escapeHtml(formatModuleList(user.modules))}</td>
    `;
    tr.addEventListener('click', () => {
      state.selectedUserId = user.id;
      renderUsers();
      openUserModal(user.id);
    });
    usersBody.appendChild(tr);
  }
}

function renderCompanies() {
  if (!companiesGrid) return;
  companiesGrid.innerHTML = '';
  if (!isPlatformAdmin()) return;

  if (!state.companies.length) {
    companiesGrid.innerHTML = `
      <article class="company-empty-state">
        <strong>Nenhum cliente SaaS cadastrado.</strong>
        <span>Use o formulário ao lado para iniciar a base de clientes da plataforma.</span>
      </article>
    `;
    return;
  }

  companiesGrid.innerHTML = state.companies.map((company) => `
    <article class="company-card ${company.status === 'active' ? 'company-card-active' : 'company-card-inactive'}">
      <div class="company-card-top">
        <div>
          <span class="company-card-label">Empresa</span>
          <h4>${escapeHtml(company.name)}</h4>
        </div>
        <span class="company-status-badge ${company.status === 'active' ? 'company-status-badge-active' : 'company-status-badge-inactive'}">
          ${company.status === 'active' ? 'Ativa' : 'Inativa'}
        </span>
      </div>
      <div class="company-card-stats">
        <div class="company-stat">
          <strong>${escapeHtml(String(company.active_users || 0))}</strong>
          <span>Usuários ativos</span>
        </div>
        <div class="company-stat">
          <strong>${escapeHtml(String(company.total_users || 0))}</strong>
          <span>Usuários totais</span>
        </div>
      </div>
      <div class="company-card-module">
        <span class="company-card-label">Módulo liberado</span>
        <strong>${escapeHtml(formatModuleList(company.modules))}</strong>
      </div>
    </article>
  `).join('');
}

function renderCompanies() {
  if (!companiesGrid) return;
  companiesGrid.innerHTML = '';
  if (!isPlatformAdmin()) return;

  if (!state.companies.length) {
    companiesGrid.innerHTML = `
      <article class="company-empty-state">
        <strong>Nenhum cliente SaaS cadastrado.</strong>
        <span>Abra a aba de onboarding para cadastrar a primeira empresa da plataforma.</span>
      </article>
    `;
    return;
  }

  companiesGrid.innerHTML = state.companies.map((company) => `
    <article class="company-card ${company.status === 'active' ? 'company-card-active' : 'company-card-inactive'}">
      <div class="company-card-top">
        <div>
          <span class="company-card-label">Empresa</span>
          <h4>${escapeHtml(company.name)}</h4>
          <p class="company-card-subtitle">${escapeHtml(company.admin?.name || 'Sem admin principal')}</p>
        </div>
        <span class="company-status-badge ${company.status === 'active' ? 'company-status-badge-active' : 'company-status-badge-inactive'}">
          ${company.status === 'active' ? 'Ativa' : 'Inativa'}
        </span>
      </div>
      <div class="company-card-stats">
        <div class="company-stat">
          <strong>${escapeHtml(String(company.active_users || 0))}</strong>
          <span>Usuarios ativos</span>
        </div>
        <div class="company-stat">
          <strong>${escapeHtml(String(company.total_users || 0))}</strong>
          <span>Usuarios totais</span>
        </div>
      </div>
      <div class="company-card-meta">
        <div>
          <span class="company-card-label">Pagamento</span>
          <strong>${escapeHtml(formatPaymentStatus(company.payment_status))}</strong>
        </div>
        <div>
          <span class="company-card-label">Mensalidade</span>
          <strong>${escapeHtml(formatCurrency(company.billing_amount || 0))}</strong>
        </div>
      </div>
      <div class="company-card-module">
        <span class="company-card-label">Modulo contratado</span>
        <strong>${escapeHtml(formatCompanyModuleScope(company.modules))}</strong>
      </div>
      <div class="company-card-footer">
        <span>${company.billing_due_day ? `Vence dia ${escapeHtml(String(company.billing_due_day))}` : 'Vencimento nao definido'}</span>
        <button type="button" class="btn btn-primary company-manage-btn" data-company-id="${company.id}">Gerenciar cliente</button>
      </div>
    </article>
  `).join('');

  companiesGrid.querySelectorAll('.company-manage-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const companyId = Number(button.dataset.companyId);
      if (Number.isInteger(companyId)) {
        openCompanyModal(companyId);
      }
    });
  });
}

function renderOrders() {
  ordersBody.innerHTML = '';
  const filteredOrders = getFilteredOrders();

  const hasSelection = filteredOrders.some((order) => order.id === state.selectedOrderId);
  if (!hasSelection) {
    state.selectedOrderId = filteredOrders[0]?.id ?? null;
  }
  if (!state.selectedOrderId && state.modal?.type === 'order') {
    closeEntityModal();
  }

  if (ordersFilterCount) {
    const total = state.orders.length;
    const visible = filteredOrders.length;
    ordersFilterCount.textContent = visible === total ? `${visible} pedido(s)` : `${visible} de ${total} pedido(s)`;
  }

  if (!filteredOrders.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="8">Nenhum pedido encontrado com os filtros atuais.</td>';
    ordersBody.appendChild(tr);
    return;
  }

  for (const order of filteredOrders) {
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
      <td><span class="status-badge ${order.status === 'completed' ? 'status-completed' : 'status-open'}">${order.status === 'completed' ? 'Concluído' : 'Aberto'}</span></td>
      <td><button class="row-action view-order-btn" type="button">Ver</button></td>
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

function onOrderFiltersChange() {
  state.orderFilters.search = String(ordersSearchInput?.value || '').trim();
  state.orderFilters.status = String(ordersStatusFilter?.value || 'all').trim() || 'all';
  state.orderFilters.requester = String(ordersRequesterFilter?.value || '').trim();
  state.orderFilters.startDate = String(ordersStartFilter?.value || '').trim();
  state.orderFilters.endDate = String(ordersEndFilter?.value || '').trim();
  renderOrders();
}

function clearOrderFilters() {
  state.orderFilters = {
    search: '',
    status: 'all',
    requester: '',
    startDate: '',
    endDate: ''
  };
  syncOrderFilterInputs();
  renderOrders();
}

function syncOrderFilterInputs() {
  if (ordersSearchInput) ordersSearchInput.value = state.orderFilters.search;
  if (ordersStatusFilter) ordersStatusFilter.value = state.orderFilters.status;
  if (ordersRequesterFilter) ordersRequesterFilter.value = state.orderFilters.requester;
  if (ordersStartFilter) ordersStartFilter.value = state.orderFilters.startDate;
  if (ordersEndFilter) ordersEndFilter.value = state.orderFilters.endDate;
}

function getFilteredOrders() {
  const { search, status, requester, startDate, endDate } = state.orderFilters;
  const normalizedSearch = normalizeText(search);
  const normalizedRequester = normalizeText(requester);

  return state.orders.filter((order) => {
    if (status !== 'all' && order.status !== status) {
      return false;
    }

    if (normalizedRequester && !normalizeText(order.created_by_name).includes(normalizedRequester)) {
      return false;
    }

    const orderStartDate = getOrderStartDate(order) || '';
    const orderEndDate = getOrderEndDate(order) || '';
    if (startDate && orderEndDate && orderEndDate < startDate) {
      return false;
    }
    if (endDate && orderStartDate && orderStartDate > endDate) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    const haystack = normalizeText(
      [
        `#${order.id}`,
        order.created_by_name,
        formatOrderRange(order),
        formatDateTime(order.created_at),
        formatVolume(order.total_volume_cm3),
        order.status === 'completed' ? 'concluido' : 'aberto'
      ].join(' ')
    );

    return haystack.includes(normalizedSearch);
  });
}

function renderTruckSchedule() {
  if (!agendaSummary || !agendaCalendarTable || !agendaReservationsList || !agendaTrucksList || !agendaRangeLabel) {
    return;
  }

  const schedule = state.truckSchedule;
  if (!schedule || !Array.isArray(schedule.trucks) || !Array.isArray(schedule.dates)) {
    agendaSummary.innerHTML = '';
    agendaCalendarTable.innerHTML = '';
    agendaRangeLabel.textContent = 'Selecione um período para carregar a agenda.';
    agendaReservationsList.innerHTML = buildOverviewListHtml([], 'Nenhuma reserva carregada.');
    agendaTrucksList.innerHTML = buildOverviewListHtml([], 'Nenhuma informação de frota carregada.');
    return;
  }

  agendaRangeLabel.textContent = `Período consultado: ${formatDateRange(schedule.startDate, schedule.endDate)}.`;

  const flattenedReservations = schedule.trucks
    .flatMap((truck) =>
      (truck.reservations || []).map((reservation) => ({
        ...reservation,
        truckId: truck.id,
        truckName: truck.name,
        totalQuantity: Number(truck.totalQuantity || 0)
      }))
    )
    .sort((a, b) => `${a.startDate}-${a.truckName}`.localeCompare(`${b.startDate}-${b.truckName}`));

  const peakReservedUnits = schedule.trucks.reduce((sum, truck) => {
    const peak = buildAgendaDayLookup(truck, schedule.dates).peakReservedQuantity;
    return sum + peak;
  }, 0);
  const trucksWithReservations = schedule.trucks.filter((truck) => (truck.reservations || []).length > 0).length;
  const totalTruckUnits = schedule.trucks.reduce((sum, truck) => sum + Number(truck.totalQuantity || 0), 0);

  const summaryCards = [
    { label: 'Modelos monitorados', value: schedule.trucks.length, detail: `${totalTruckUnits} unidade(s) na frota`, tone: 'neutral' },
    { label: 'Reservas abertas', value: flattenedReservations.length, detail: 'Pedidos em andamento no período', tone: 'warning' },
    { label: 'Caminhões ocupados', value: `${trucksWithReservations}/${schedule.trucks.length}`, detail: 'Modelos com alguma reserva ativa', tone: 'accent' },
    { label: 'Pico de unidades reservadas', value: peakReservedUnits, detail: 'Soma do maior uso simultâneo por modelo', tone: 'success' }
  ];

  agendaSummary.innerHTML = summaryCards
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

  renderAgendaCalendar(schedule);

  agendaReservationsList.innerHTML = buildOverviewListHtml(
    flattenedReservations.map((reservation) => ({
      title: `${reservation.truckName} • Pedido #${reservation.orderId}`,
      meta: `${formatDateRange(reservation.startDate, reservation.endDate)} • ${reservation.createdByName} • ${reservation.quantityReserved} unidade(s)`,
      tone: 'warning'
    })),
    'Nenhuma reserva aberta no período selecionado.'
  );

  agendaTrucksList.innerHTML = buildOverviewListHtml(
    schedule.trucks.map((truck) => {
      const dayInfo = buildAgendaDayLookup(truck, schedule.dates);
      const peakFree = Math.max(0, Number(truck.totalQuantity || 0) - dayInfo.peakReservedQuantity);
      return {
        title: truck.name,
        meta: `${dayInfo.busyDays} dia(s) ocupado(s) • pico ${dayInfo.peakReservedQuantity}/${truck.totalQuantity} reservados • mínimo ${peakFree} livre(s)`,
        tone: dayInfo.busyDays ? 'warning' : 'success'
      };
    }),
    'Nenhum caminhão cadastrado.'
  );
}

function renderAgendaCalendar(schedule) {
  const headerCells = schedule.dates
    .map((date) => {
      return `<th>${escapeHtml(formatAgendaDayHeader(date))}</th>`;
    })
    .join('');

  const rowsHtml = schedule.trucks
    .map((truck) => {
      const dayLookup = buildAgendaDayLookup(truck, schedule.dates);
      const cellsHtml = schedule.dates
        .map((date) => {
          const info = dayLookup.byDate[date] || { reservedQuantity: 0, ordersCount: 0 };
          const total = Number(truck.totalQuantity || 0);
          const available = Math.max(0, total - info.reservedQuantity);
          const toneClass = info.reservedQuantity <= 0 ? 'agenda-cell-free' : available <= 0 ? 'agenda-cell-full' : 'agenda-cell-partial';
          const subLabel = info.ordersCount > 0 ? `${info.ordersCount} pedido(s)` : 'livre';
          return `
            <td class="${toneClass}">
              <strong>${available}/${total}</strong>
              <span>${escapeHtml(subLabel)}</span>
            </td>
          `;
        })
        .join('');

      return `
        <tr>
          <th class="agenda-truck-cell">
            <strong>${escapeHtml(truck.name)}</strong>
            <span>${formatVolume(truck.volumeCm3)} • ${truck.totalQuantity} un.</span>
          </th>
          ${cellsHtml}
        </tr>
      `;
    })
    .join('');

  agendaCalendarTable.innerHTML = `
    <thead>
      <tr>
        <th>Caminhão</th>
        ${headerCells}
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="100%">Nenhum caminhão cadastrado.</td></tr>'}
    </tbody>
  `;
}

function buildAgendaDayLookup(truck, dates) {
  const byDate = {};
  let busyDays = 0;
  let peakReservedQuantity = 0;

  for (const date of dates) {
    const overlapping = (truck.reservations || []).filter((reservation) => reservation.startDate <= date && reservation.endDate >= date);
    const reservedQuantity = overlapping.reduce((sum, reservation) => sum + Number(reservation.quantityReserved || 0), 0);
    const ordersCount = overlapping.length;
    byDate[date] = { reservedQuantity, ordersCount };
    if (reservedQuantity > 0) busyDays += 1;
    if (reservedQuantity > peakReservedQuantity) {
      peakReservedQuantity = reservedQuantity;
    }
  }

  return { byDate, busyDays, peakReservedQuantity };
}

function renderCargoBuilder(options = {}) {
  const preserveResults = options.preserveResults === true;
  cargoBody.innerHTML = '';
  if (!preserveResults) {
    resultBox.classList.add('hidden');
    manualResultBox.classList.add('hidden');
  }

  // Popular select de clientes
  selectedClient.innerHTML = '<option value="">Selecione um cliente...</option><option value="_new">+ Criar novo cliente</option>';
  for (const client of state.clients) {
    const option = document.createElement('option');
    option.value = client.id;
    option.textContent = client.name;
    selectedClient.appendChild(option);
  }

  if (cargoClientFilter) {
    const currentClients = [...new Set(state.cargoItems.map((item) => item.clientName || 'Sem nome'))];
    cargoClientFilter.innerHTML = '<option value="all">Todos</option>';
    currentClients.forEach((clientName) => {
      const option = document.createElement('option');
      option.value = clientName;
      option.textContent = clientName;
      cargoClientFilter.appendChild(option);
    });
    if (!currentClients.includes(state.cargoFilters.client)) {
      state.cargoFilters.client = 'all';
    }
  }
  syncCargoFilterInputs();

  // Se não tiver itens, mostrar mensagem diferente
  if (!state.cargoItems.length) {
    if (cargoClientHeader) {
      cargoClientHeader.style.display = '';
    }
    multiClientActions.style.display = 'none';
    if (cargoFilterCount) {
      cargoFilterCount.textContent = '0 item(ns)';
    }
    cargoBody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum item na carga. Selecione um cliente e adicione itens.</td></tr>';
    renderLaunchReviewSummary();
    syncVisualization3DPanel();
    return;
  }

  // Agrupar itens por cliente para exibição
  const itemsByClient = {};
  const clientOrder = [];
  state.cargoItems.forEach(item => {
    const clientName = item.clientName || 'Sem nome';
    if (!itemsByClient[clientName]) {
      itemsByClient[clientName] = [];
      clientOrder.push(clientName);
    }
    itemsByClient[clientName].push(item);
  });

  const normalizedCargoSearch = normalizeText(state.cargoFilters.search);
  const filteredItemsByClient = {};
  const filteredClientOrder = [];

  clientOrder.forEach((clientName) => {
    if (state.cargoFilters.client !== 'all' && clientName !== state.cargoFilters.client) {
      return;
    }

    const matchingItems = (itemsByClient[clientName] || []).filter((item) => {
      if (!normalizedCargoSearch) return true;
      const can = state.cans.find((entry) => entry.id === item.canId);
      return normalizeText(`${clientName} ${can?.name || ''}`).includes(normalizedCargoSearch);
    });

    if (!matchingItems.length) return;
    filteredItemsByClient[clientName] = matchingItems;
    filteredClientOrder.push(clientName);
  });

  const visibleItemCount = filteredClientOrder.reduce((sum, clientName) => sum + (filteredItemsByClient[clientName]?.length || 0), 0);
  if (cargoFilterCount) {
    cargoFilterCount.textContent = visibleItemCount === state.cargoItems.length
      ? `${visibleItemCount} item(ns)`
      : `${visibleItemCount} de ${state.cargoItems.length} item(ns)`;
  }

  // Mostrar/esconder botões de múltiplos clientes
  const showClientColumn = Object.keys(itemsByClient).length > 1;
  if (cargoClientHeader) {
    cargoClientHeader.style.display = showClientColumn ? '' : 'none';
  }

  if (Object.keys(itemsByClient).length > 0) {
    multiClientActions.style.display = 'block';
  } else {
    multiClientActions.style.display = 'none';
  }

  if (!filteredClientOrder.length) {
    cargoBody.innerHTML = `<tr><td colspan="${showClientColumn ? 6 : 5}" class="text-center">Nenhum item encontrado com os filtros atuais.</td></tr>`;
    renderLaunchReviewSummary();
    syncVisualization3DPanel();
    return;
  }

  filteredClientOrder.forEach((clientName, clientIndex) => {
    const items = filteredItemsByClient[clientName] || [];
    // Adicionar header do cliente se tiver múltiplos clientes
    if (Object.keys(itemsByClient).length > 1) {
      const headerRow = document.createElement('tr');
      headerRow.className = 'client-header-row';
      headerRow.innerHTML = `
        <td colspan="6">
          <div class="client-header-toolbar">
            <span>📦 Cliente: ${escapeHtml(clientName || 'Sem nome')}</span>
            <div class="client-order-actions">
              <button class="client-order-btn" data-client="${escapeHtml(clientName)}" data-direction="up" type="button" ${clientIndex === 0 ? 'disabled' : ''}>↑</button>
              <button class="client-order-btn" data-client="${escapeHtml(clientName)}" data-direction="down" type="button" ${clientIndex === filteredClientOrder.length - 1 ? 'disabled' : ''}>↓</button>
            </div>
          </div>
        </td>
      `;
      cargoBody.appendChild(headerRow);
    }

    // Adicionar itens do cliente
    items.forEach((item, index) => {
      const can = state.cans.find((entry) => entry.id === item.canId);
      if (!can) return;

      const subtotal = can.volume_cm3 * item.quantity;
      const globalIndex = state.cargoItems.indexOf(item);
      const tr = document.createElement('tr');
      
      // Se for múltiplos clientes, mostrar o nome, senão não mostra
      const clientCell = showClientColumn ? 
        `<td>${escapeHtml(clientName || 'Sem nome')}</td>` : '';
      
      tr.innerHTML = `
        ${clientCell}
        <td>${escapeHtml(can.name)}</td>
        <td>${item.quantity}</td>
        <td>${formatVolume(can.volume_cm3)}</td>
        <td>${formatVolume(subtotal)}</td>
        <td><button class="remove-btn" data-index="${globalIndex}" type="button">Remover</button></td>
      `;

      cargoBody.appendChild(tr);
    });
  });

  cargoBody.querySelectorAll('.remove-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.cargoItems.splice(Number(button.dataset.index), 1);
      state.lastCalculation = null;
      renderCargoBuilder();
      
      // Esconder seção de lançamento se não tiver mais itens
      if (state.cargoItems.length === 0) {
        launchSection.style.display = 'none';
        updateProgress('items');
      }
    });
  });

  cargoBody.querySelectorAll('.client-order-btn').forEach((button) => {
    button.addEventListener('click', () => {
      reorderCargoClientGroup(button.dataset.client, button.dataset.direction);
    });
  });

  renderLaunchReviewSummary();
  syncVisualization3DPanel();
}

function reorderCargoClientGroup(clientName, direction) {
  const normalizedClientName = String(clientName || '');
  const orderedClients = [...new Set(state.cargoItems.map((item) => item.clientName || 'Sem nome'))];
  const currentIndex = orderedClients.indexOf(normalizedClientName);
  if (currentIndex === -1) return;

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= orderedClients.length) return;

  const reorderedClients = [...orderedClients];
  const [movedClient] = reorderedClients.splice(currentIndex, 1);
  reorderedClients.splice(targetIndex, 0, movedClient);

  const itemsByClient = new Map();
  state.cargoItems.forEach((item) => {
    const key = item.clientName || 'Sem nome';
    if (!itemsByClient.has(key)) {
      itemsByClient.set(key, []);
    }
    itemsByClient.get(key).push(item);
  });

  state.cargoItems = reorderedClients.flatMap((key) => itemsByClient.get(key) || []);
  state.lastCalculation = null;
  renderCargoBuilder();
  renderLaunchReviewSummary();
}

function buildLaunchClientSummary() {
  const grouped = new Map();
  state.cargoItems.forEach((item) => {
    const key = item.clientName || 'Sem nome';
    if (!grouped.has(key)) {
      grouped.set(key, { name: key, totalItems: 0, distinctItems: 0, seenCans: new Set() });
    }
    const entry = grouped.get(key);
    entry.totalItems += Number(item.quantity || 0);
    if (!entry.seenCans.has(item.canId)) {
      entry.seenCans.add(item.canId);
      entry.distinctItems += 1;
    }
  });

  return Array.from(grouped.values());
}

function renderLaunchReviewSummary() {
  if (!launchSummaryContent) return;

  if (!state.cargoItems.length) {
    launchSummaryContent.innerHTML = '<p class="launch-summary-empty">Monte a carga para visualizar o resumo final.</p>';
    return;
  }

  const orderRange = getSelectedOrderRange(false);
  const clientSummary = buildLaunchClientSummary();
  const totalUnits = state.cargoItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalDistinct = state.cargoItems.length;
  const trucks = state.lastCalculation?.allocation?.trucks || [];
  const truckNames = trucks.map((truck) => `${escapeHtml(truck.name)} x${Number(truck.quantity || 1)}`).join(', ') || 'Ainda não calculado';
  const spatialValidation = state.lastCalculation?.spatialValidation || null;
  const statusText = spatialValidation?.checked && !spatialValidation.fits
    ? `Validação 3D reprovada: ${spatialValidation.missingCount} volume(s) ficaram de fora`
    : state.lastCalculation?.allocation?.fits
      ? 'Carga comportada'
      : 'Calcule a carga para validar';

  const clientsHtml = clientSummary.map((client) => {
    const color = getOrderColor(client.name).toString(16).padStart(6, '0');
    return `
      <li class="launch-client-item">
        <span class="launch-client-chip">
          <span class="launch-client-swatch" style="background:#${color};"></span>
          ${escapeHtml(client.name)}
        </span>
        <span>${client.totalItems} volumes • ${client.distinctItems} item(ns)</span>
      </li>
    `;
  }).join('');

  launchSummaryContent.innerHTML = `
    <div class="launch-summary-header">
      <span class="eyebrow">Resumo Final</span>
      <h4>Revisão completa do pedido</h4>
    </div>
    <div class="launch-summary-grid">
      <div class="launch-summary-metric">
        <span class="launch-summary-label">Clientes</span>
        <strong>${clientSummary.length}</strong>
      </div>
      <div class="launch-summary-metric">
        <span class="launch-summary-label">Volumes</span>
        <strong>${totalUnits}</strong>
      </div>
      <div class="launch-summary-metric">
        <span class="launch-summary-label">Itens cadastrados</span>
        <strong>${totalDistinct}</strong>
      </div>
      <div class="launch-summary-metric">
        <span class="launch-summary-label">Período</span>
        <strong>${orderRange ? `${escapeHtml(formatDate(orderRange.startDate))} a ${escapeHtml(formatDate(orderRange.endDate))}` : 'Não definido'}</strong>
      </div>
    </div>
    <div class="launch-summary-section">
      <span class="launch-summary-label">Caminhões calculados</span>
      <p>${truckNames}</p>
    </div>
    <div class="launch-summary-section">
      <span class="launch-summary-label">Status da carga</span>
      <p>${statusText}</p>
    </div>
    <div class="launch-summary-section">
      <span class="launch-summary-label">Ordem de carregamento dos clientes</span>
      <ul class="launch-client-list">${clientsHtml}</ul>
    </div>
  `;
}

async function onLaunchOrder() {
  if (!state.cargoItems.length) {
    showToast('Monte uma carga antes de lançar o pedido.');
    return;
  }

  const orderRange = getSelectedOrderRange(true);
  if (!orderRange) return;

  if (!state.lastCalculation) {
    showToast('Calcule a carga para o período selecionado antes de lançar o pedido.');
    return;
  }

  const currentSignature = buildCargoSignature(state.cargoItems);
  if (
    state.lastCalculation.startDate !== orderRange.startDate ||
    state.lastCalculation.endDate !== orderRange.endDate ||
    state.lastCalculation.cargoSignature !== currentSignature
  ) {
    showToast('A carga ou o período foi alterado. Recalcule antes de lançar o pedido.');
    return;
  }

  if (!state.lastCalculation.allocation?.fits) {
    showToast('A carga não cabe. Ajuste os caminhões antes de lançar o pedido.');
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
    showToast(response.data.error || 'Não foi possível lançar o pedido.');
    return;
  }

  closeEntityModal();
  closeConfirmModal();
  if (isEditing) {
    onCloseClientModal();
    showToast('Cliente atualizado com sucesso!');
    await loadData();
    renderApp();
    return;
  }

  onCloseClientModal();
  state.cargoItems = [];
  state.lastCalculation = null;
  state.selectedClientId = null;
  selectedClient.value = '';
  currentClientName.textContent = '';
  newClientLabel.style.display = 'none';
  clientSelectionSection.style.display = '';
  itemsSection.style.display = 'none';
  launchSection.style.display = 'none';
  state.selectedOrderId = Number(response.data.orderId) || null;
  updateProgress('client');
  state.currentView = 'pedidos-section';
  await loadData();
  renderApp();
  setCurrentView('pedidos-section');
  showToast(`Pedido #${response.data.orderId} lançado com sucesso.`);
}

function getOrderItemVisualizationDimensions(item) {
  const height = Number(item.can_height_cm || 0) / 100;
  if (!(height > 0)) return null;

  if (item.can_shape === 'cylinder') {
    const diameter = Number(item.can_diameter_cm || item.can_length_cm || item.can_width_cm || 0) / 100;
    if (!(diameter > 0)) return null;
    return { width: diameter, height, depth: diameter };
  }

  const width = Number(item.can_length_cm || item.can_width_cm || item.can_depth_cm || 0) / 100;
  const depth = Number(item.can_width_cm || item.can_depth_cm || item.can_length_cm || 0) / 100;
  if (!(width > 0) || !(depth > 0)) return null;
  return { width, height, depth };
}

function getOrderItemVisualizationShape(item) {
  return item.can_shape === 'cylinder' ? 'cylinder' : 'box';
}

function getOrderItemRenderDimensions(item) {
  const height = Number(item.can_height_cm || 0) / 100;
  if (!(height > 0)) return null;

  if (item.can_shape === 'cylinder') {
    const diameter = Number(item.can_diameter_cm || item.can_length_cm || item.can_width_cm || 0) / 100;
    if (!(diameter > 0)) return null;
    return [diameter, height, diameter];
  }

  const width = Number(item.can_length_cm || item.can_width_cm || item.can_depth_cm || 0) / 100;
  const depth = Number(item.can_width_cm || item.can_depth_cm || item.can_length_cm || 0) / 100;
  if (!(width > 0) || !(depth > 0)) return null;
  return [width, height, depth];
}

function buildOrderVisualizationPayload(order, groupedItems) {
  const clients = {};

  groupedItems.forEach((clientGroup, index) => {
    const key = `pedido-${order.id}-cliente-${index + 1}`;
    const items = clientGroup.items
      .map((item) => {
        const dimensions = getOrderItemVisualizationDimensions(item);
        const renderDimensions = getOrderItemRenderDimensions(item);
        if (!dimensions || !renderDimensions) return null;
        return {
          name: item.can_name,
          dimensions: [dimensions.width, dimensions.height, dimensions.depth],
          shape: getOrderItemVisualizationShape(item),
          renderDimensions,
          quantity: Math.max(0, Number(item.quantity || 0))
        };
      })
      .filter(Boolean);

    if (items.length) {
      clients[key] = {
        name: clientGroup.clientName,
        items
      };
    }
  });

  return {
    orderId: order.id,
    title: `Pedido #${order.id}`,
    clients
  };
}

function buildCurrentLoadVisualizationPayload() {
  const groupedClients = new Map();

  state.cargoItems.forEach((row) => {
    const can = state.cans.find((entry) => entry.id === row.canId);
    if (!can) return;

    const dimensions = getCanPackingDimensions(can);
    const renderDimensions = getCanRenderDimensions(can);
    if (!(dimensions.width > 0) || !(dimensions.height > 0) || !(dimensions.depth > 0)) {
      return;
    }
    if (!renderDimensions) {
      return;
    }

    const clientName = String(row.clientName || 'Pedido sem cliente').trim() || 'Pedido sem cliente';
    if (!groupedClients.has(clientName)) {
      groupedClients.set(clientName, []);
    }

    groupedClients.get(clientName).push({
      name: can.name,
      dimensions: [dimensions.width, dimensions.height, dimensions.depth],
      shape: can.shape === 'cylinder' ? 'cylinder' : 'box',
      renderDimensions,
      quantity: Math.max(0, Number(row.quantity || 0))
    });
  });

  const clients = {};
  let index = 0;
  groupedClients.forEach((items, clientName) => {
    if (!items.length) return;
    const key = `carga-atual-cliente-${index + 1}`;
    clients[key] = {
      name: clientName,
      items
    };
    index += 1;
  });

  return {
    title: 'Carga atual',
    clients
  };
}

function prepareSavedOrder3DPreview(order, groupedItems) {
  const payload = buildOrderVisualizationPayload(order, groupedItems);
  if (!Object.keys(payload.clients).length) {
    showToast('Esse pedido não possui dados suficientes para gerar o 3D.');
    return null;
  }

  try {
    window.localStorage.setItem(ORDER_PREVIEW_STORAGE_KEY, JSON.stringify(payload));
  } catch (_error) {
    showToast('Não foi possível preparar a visualização 3D do pedido.');
    return null;
  }
  return `/visualizacao_3d_nova.html?preview=order&embed=1&t=${Date.now()}`;
}

function prepareCurrentLoad3DPreview() {
  const payload = buildCurrentLoadVisualizationPayload();
  if (!Object.keys(payload.clients).length) {
    showToast('Adicione itens válidos para gerar a visualização 3D.');
    return null;
  }

  try {
    window.localStorage.setItem(ORDER_PREVIEW_STORAGE_KEY, JSON.stringify(payload));
  } catch (_error) {
    showToast('Não foi possível preparar a visualização 3D da carga.');
    return null;
  }

  return `/visualizacao_3d_nova.html?preview=current&embed=1&t=${Date.now()}`;
}

async function openOrderModal(orderId) {
  const response = await api(`/api/orders/${orderId}`);
  if (!response.ok) {
    showToast(response.data.error || 'Não foi possível carregar o pedido.');
    return;
  }

  const order = response.data.order;
  const items = Array.isArray(response.data.items) ? response.data.items : [];
  const trucks = Array.isArray(response.data.trucks) ? response.data.trucks : [];
  state.modal = { type: 'order', id: order.id };
  entityModalTitle.textContent = `Pedido #${order.id}`;

  const itemsRows = items
    .map((clientGroup) => {
      const clientRows = clientGroup.items
        .map((item) => {
          return `
            <tr>
              <td>${escapeHtml(item.can_name)}</td>
              <td>${item.can_shape === 'square' ? 'Retangular' : 'Cilindrico'}</td>
              <td>${item.quantity}</td>
              <td>${formatVolume(item.unit_volume_cm3)}</td>
              <td>${formatVolume(item.total_volume_cm3)}</td>
            </tr>
          `;
        })
        .join('');

      return `
        <tr class="client-group-header">
          <td colspan="5"><strong>Cliente: ${escapeHtml(clientGroup.clientName)}</strong></td>
        </tr>
        <tr class="client-group-subheader">
          <td><em>Resumo do cliente:</em></td>
          <td colspan="2"><em>${clientGroup.totalCans} produto(s)</em></td>
          <td colspan="2"><em>${formatVolume(clientGroup.totalVolumeCm3)}</em></td>
        </tr>
        ${clientRows}
        <tr class="client-group-spacer"><td colspan="5"></td></tr>
      `;
    })
    .join('');

  const completionInfo =
    order.status === 'completed'
      ? `
        <p><strong>Concluído em:</strong> ${escapeHtml(formatDateTime(order.completed_at))}</p>
        <p><strong>Concluído por:</strong> ${escapeHtml(order.completed_by_name || '-')}</p>
      `
      : '';

  const trucksHtml = trucks.length
    ? `<ul>${trucks.map((truck) => `<li>${Number(truck.quantity_reserved || 1)}x ${escapeHtml(truck.truck_name)}</li>`).join('')}</ul>`
    : '<p>Nenhum caminhão vinculado.</p>';

  const canManage = canManageOrderOnClient(order);
  const modalActions = canManage || state.user?.role === 'admin'
    ? `
      <div class="modal-actions">
        <button type="button" id="modal-view-order-3d-btn" class="btn btn-secondary">Mostrar 3D do pedido</button>
        ${order.status === 'open' && canManage ? '<button type="button" id="modal-edit-order-btn" class="btn btn-primary">Editar pedido</button>' : ''}
        ${order.status === 'open' && canManage ? '<button type="button" id="modal-conclude-order-btn" class="btn btn-primary">Concluir pedido</button>' : ''}
        ${canManage ? '<button type="button" id="modal-delete-order-btn" class="row-action danger">Excluir pedido</button>' : ''}
      </div>
    `
    : `
      <div class="modal-actions">
        <button type="button" id="modal-view-order-3d-btn" class="btn btn-secondary">Mostrar 3D do pedido</button>
      </div>
    `;

  entityModalContent.innerHTML = `
    <p><strong>Status:</strong> ${order.status === 'completed' ? 'Concluído' : 'Aberto'}</p>
    <p><strong>Solicitante:</strong> ${escapeHtml(order.created_by_name)}</p>
    <p><strong>Período do pedido:</strong> ${escapeHtml(formatOrderRange(order))}</p>
    <p><strong>Criado em:</strong> ${escapeHtml(formatDateTime(order.created_at))}</p>
    <p><strong>Total de produtos:</strong> ${order.total_cans}</p>
    <p><strong>Volume total:</strong> ${formatVolume(order.total_volume_cm3)}</p>
    <p><strong>Caminhões reservados:</strong></p>
    ${trucksHtml}
    ${completionInfo}
    ${modalActions}
    <section id="modal-order-3d-preview" class="launch-preview-card modal-order-preview hidden">
      <div class="cargo-preview-head">
        <div>
          <span class="eyebrow">Apoio Visual</span>
          <h4>Previa 3D da carga do pedido</h4>
        </div>
      </div>
      <p class="cargo-preview-helper">Visualização do pedido salvo no mesmo layout da etapa final.</p>
      <iframe id="modal-order-3d-iframe" class="modal-order-3d-iframe" title="Prévia 3D do pedido" loading="lazy"></iframe>
    </section>
    <table>
      <thead>
        <tr>
          <th>Produto</th>
          <th>Formato</th>
          <th>Qtd</th>
          <th>Volume unit.</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemsRows || '<tr><td colspan="5">Sem itens.</td></tr>'}</tbody>
    </table>
  `;

  entityModalCard?.classList.add('modal-card-order');
  entityModalOverlay.classList.remove('hidden');

  const preview3DBtn = document.getElementById('modal-view-order-3d-btn');
  const previewSection = document.getElementById('modal-order-3d-preview');
  const previewIframe = document.getElementById('modal-order-3d-iframe');
  if (preview3DBtn) {
    preview3DBtn.addEventListener('click', () => {
      if (!previewSection || !previewIframe) return;
      if (previewSection.classList.contains('hidden')) {
        const previewUrl = prepareSavedOrder3DPreview(order, items);
        if (!previewUrl) return;
        previewIframe.src = previewUrl;
        previewSection.classList.remove('hidden');
        preview3DBtn.textContent = 'Ocultar 3D do pedido';
      } else {
        previewSection.classList.add('hidden');
        previewIframe.src = 'about:blank';
        preview3DBtn.textContent = 'Mostrar 3D do pedido';
      }
    });
  }

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
        message: `Confirma a conclusão do pedido #${order.id}? Essa ação libera os caminhões reservados imediatamente.`,
        confirmLabel: 'Concluir pedido',
        onConfirm: async () => {
          const concludeRes = await api(`/api/orders/${order.id}/conclude`, { method: 'POST', body: {} });
          if (!concludeRes.ok) {
            showToast(concludeRes.data.error || 'Não foi possível concluir o pedido.');
            return;
          }
          showToast(`Pedido #${order.id} concluído.`);
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
        message: `Confirma a exclusão do pedido #${order.id}? Essa ação não pode ser desfeita.`,
        confirmLabel: 'Excluir pedido',
        danger: true,
        onConfirm: async () => {
          const deleteRes = await api(`/api/orders/${order.id}`, { method: 'DELETE' });
          if (!deleteRes.ok) {
            showToast(deleteRes.data.error || 'Não foi possível excluir o pedido.');
            return;
          }
          showToast(`Pedido #${order.id} excluído.`);
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
    showToast('Você não tem permissão para editar este pedido.');
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

      const clientLabel = document.createElement('label');
      clientLabel.textContent = 'Cliente';
      const clientInput = document.createElement('input');
      clientInput.type = 'text';
      clientInput.placeholder = 'Nome do cliente (opcional)';
      clientInput.value = String(row.clientName || '');
      clientInput.addEventListener('input', () => {
        row.clientName = clientInput.value.trim();
      });
      clientLabel.appendChild(clientInput);

      const canLabel = document.createElement('label');
      canLabel.textContent = 'Produto';
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

      wrapper.appendChild(clientLabel);
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
      quantity: 1,
      clientName: ''
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
          quantity: Number(row.quantity),
          clientName: row.clientName || null
        }))
        .filter((row) => Number.isInteger(row.canId) && Number.isInteger(row.quantity) && row.quantity > 0)
    };

    const response = await api(`/api/orders/${order.id}`, {
      method: 'PUT',
      body: payload
    });
    if (!response.ok) {
      showToast(response.data.error || 'Não foi possível atualizar o pedido.');
      return;
    }

    showToast(`Pedido #${order.id} atualizado.`);
    await loadData();
    renderApp();
    openOrderModal(order.id);
  });
}

function onOpenCategoryModal() {
  if (!canManageOperationalData()) return;

  state.modal = { type: 'category-create' };
  entityModalTitle.textContent = 'Nova categoria';
  entityModalContent.innerHTML = `
    <form id="modal-category-form" class="grid-form">
      <label>Nome da categoria
        <input name="name" required />
      </label>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">Salvar categoria</button>
      </div>
    </form>
  `;
  entityModalOverlay.classList.remove('hidden');

  const form = document.getElementById('modal-category-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const response = await api('/api/can-categories', {
      method: 'POST',
      body: {
        name: String(formData.get('name') || '').trim()
      }
    });

    if (!response.ok) {
      showToast(response.data.error || 'Nao foi possivel cadastrar a categoria.');
      return;
    }

    closeEntityModal();
    await loadData();
    renderApp();
    showToast('Categoria cadastrada.');
  });
}

function onOpenCanCreateModal() {
  if (!canManageOperationalData()) return;

  state.modal = { type: 'can-create' };
  entityModalTitle.textContent = 'Novo produto';
  entityModalContent.innerHTML = `
    <form id="modal-can-create-form" class="grid-form">
      <label>Nome
        <input name="name" required />
      </label>
      <label>Categoria
        <select name="categoryId">
          <option value="">Sem categoria</option>
          ${state.categories
            .map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`)
            .join('')}
        </select>
      </label>
      <label>Formato
        <select name="shape" id="modal-can-create-shape">
          <option value="square">Produto Retangular</option>
          <option value="cylinder">Produto Cilindrico</option>
        </select>
      </label>
      <label>Altura (cm)
        <input name="heightCm" type="number" min="0.1" step="0.1" required />
      </label>
      <label class="modal-shape-square">Lado 1 (cm)
        <input name="side1Cm" type="number" min="0.1" step="0.1" />
      </label>
      <label class="modal-shape-square">Lado 2 (cm)
        <input name="side2Cm" type="number" min="0.1" step="0.1" />
      </label>
      <label class="modal-shape-cylinder hidden">Diâmetro (cm)
        <input name="diameterCm" type="number" min="0.01" step="0.01" />
      </label>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">Cadastrar produto</button>
      </div>
    </form>
  `;
  entityModalOverlay.classList.remove('hidden');

  const form = document.getElementById('modal-can-create-form');
  const shapeInput = document.getElementById('modal-can-create-shape');
  syncModalCanShapeFields(shapeInput.value);
  shapeInput.addEventListener('change', () => syncModalCanShapeFields(shapeInput.value));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const response = await api('/api/cans', {
      method: 'POST',
      body: {
        name: String(formData.get('name') || '').trim(),
        categoryId: formData.get('categoryId') ? Number(formData.get('categoryId')) : null,
        shape: String(formData.get('shape') || ''),
        heightCm: Number(formData.get('heightCm')),
        side1Cm: Number(formData.get('side1Cm')),
        side2Cm: Number(formData.get('side2Cm')),
        diameterCm: Number(formData.get('diameterCm'))
      }
    });

    if (!response.ok) {
      showToast(response.data.error || 'Nao foi possivel cadastrar o produto.');
      return;
    }

    closeEntityModal();
    await loadData();
    renderApp();
    showToast('Produto cadastrado.');
  });
}

function onOpenTruckCreateModal() {
  if (!canManageOperationalData()) return;

  state.modal = { type: 'truck-create' };
  entityModalTitle.textContent = 'Novo caminhão';
  entityModalContent.innerHTML = `
    <form id="modal-truck-create-form" class="grid-form">
      <label>Nome
        <input name="name" required />
      </label>
      <label>Comprimento interno (cm)
        <input name="lengthCm" type="number" min="0.1" step="0.1" required />
      </label>
      <label>Largura interna (cm)
        <input name="widthCm" type="number" min="0.1" step="0.1" required />
      </label>
      <label>Altura interna (cm)
        <input name="heightCm" type="number" min="0.1" step="0.1" required />
      </label>
      <label>Quantidade
        <input name="quantity" type="number" min="1" step="1" value="1" required />
      </label>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">Cadastrar caminhão</button>
      </div>
    </form>
  `;
  entityModalOverlay.classList.remove('hidden');

  const form = document.getElementById('modal-truck-create-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const response = await api('/api/trucks', {
      method: 'POST',
      body: {
        name: String(formData.get('name') || '').trim(),
        lengthCm: Number(formData.get('lengthCm')),
        widthCm: Number(formData.get('widthCm')),
        heightCm: Number(formData.get('heightCm')),
        quantity: Number(formData.get('quantity'))
      }
    });

    if (!response.ok) {
      showToast(response.data.error || 'Nao foi possivel cadastrar o caminhão.');
      return;
    }

    closeEntityModal();
    await loadData();
    renderApp();
    showToast('Caminhão cadastrado.');
  });
}

function openCanModal(canId) {
  const can = state.cans.find((entry) => entry.id === canId);
  if (!can) {
    showToast('Produto nao encontrado.');
    return;
  }

  state.modal = { type: 'can', id: can.id };
  entityModalTitle.textContent = 'Detalhes do produto';
  const canManage = canManageOperationalData();

  if (!canManage) {
    entityModalContent.innerHTML = `
      <p><strong>Nome:</strong> ${escapeHtml(can.name)}</p>
      <p><strong>Formato:</strong> ${can.shape === 'square' ? 'Produto Retangular' : 'Produto Cil?ndrico'}</p>
      <p><strong>Volume:</strong> ${formatVolume(can.volume_cm3)}</p>
      <p><strong>Dimensões:</strong> ${escapeHtml(formatCanDimensions(can))}</p>
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
      <label>Categoria
        <select name="categoryId">
          <option value="">Sem categoria</option>
          ${state.categories
            .map((category) => {
              const selected = Number(can.category_id) === Number(category.id) ? 'selected' : '';
              return `<option value="${category.id}" ${selected}>${escapeHtml(category.name)}</option>`;
            })
            .join('')}
        </select>
      </label>
      <label>Formato
        <select name="shape" id="modal-can-shape">
          <option value="square" ${can.shape === 'square' ? 'selected' : ''}>Produto Retangular</option>
          <option value="cylinder" ${can.shape === 'cylinder' ? 'selected' : ''}>Produto Cil?ndrico</option>
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
      <label class="modal-shape-cylinder">Diâmetro (cm)
        <input name="diameterCm" type="number" min="0.01" step="0.01" value="${formatDiameterCm(can.diameter_cm)}" />
      </label>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">Salvar alterações</button>
        <button type="button" id="modal-delete-can-btn" class="row-action danger">Excluir produto</button>
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
      categoryId: formData.get('categoryId') ? Number(formData.get('categoryId')) : null,
      shape: String(formData.get('shape') || ''),
      heightCm: Number(formData.get('heightCm')),
      side1Cm: Number(formData.get('side1Cm')),
      side2Cm: Number(formData.get('side2Cm')),
      diameterCm: Number(formData.get('diameterCm'))
    };

    const response = await api(`/api/cans/${can.id}`, { method: 'PUT', body: payload });
    if (!response.ok) {
      showToast('Nao foi possivel atualizar o produto.');
      return;
    }

    showToast('Produto atualizado.');
    closeEntityModal();
    await loadData();
    renderApp();
  });

  deleteBtn.addEventListener('click', async () => {
    if (!window.confirm(`Excluir o produto "${can.name}"?`)) return;
    const response = await api(`/api/cans/${can.id}`, { method: 'DELETE' });
    if (!response.ok) {
      showToast('Nao foi possivel excluir o produto.');
      return;
    }
    showToast('Produto excluido.');
    closeEntityModal();
    await loadData();
    renderApp();
  });
}

function openTruckModal(truckId) {
  const truck = state.trucks.find((entry) => entry.id === truckId);
  if (!truck) {
    showToast('Caminhão não encontrado.');
    return;
  }

  state.modal = { type: 'truck', id: truck.id };
  entityModalTitle.textContent = 'Detalhes do caminhão';
  const canManage = canManageOperationalData();
  const availability = getTruckAvailabilityInfo(truck.id);

  if (!canManage) {
    entityModalContent.innerHTML = `
      <p><strong>Nome:</strong> ${escapeHtml(truck.name)}</p>
      <p><strong>Dimensões internas:</strong> ${truck.length_cm} x ${truck.width_cm} x ${truck.height_cm} cm</p>
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
        <button type="submit" class="btn btn-primary">Salvar alterações</button>
        <button type="button" id="modal-delete-truck-btn" class="row-action danger">Excluir caminhão</button>
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
      showToast(response.data.error || 'Não foi possível atualizar o caminhão.');
      return;
    }
    showToast('Caminhão atualizado.');
    await loadData();
    renderApp();
    openTruckModal(truck.id);
  });

  deleteBtn.addEventListener('click', async () => {
    if (!window.confirm(`Excluir o caminhão "${truck.name}"?`)) return;
    const response = await api(`/api/trucks/${truck.id}`, { method: 'DELETE' });
    if (!response.ok) {
      showToast(response.data.error || 'Não foi possível excluir o caminhão.');
      return;
    }
    showToast('Caminhão excluído.');
    closeEntityModal();
    await loadData();
    renderApp();
  });
}

function openCompanyModal(companyId) {
  const company = state.companies.find((entry) => entry.id === companyId);
  if (!company) return;

  state.selectedCompanyId = companyId;
  state.modal = { type: 'company', id: companyId };
  entityModalTitle.textContent = `Cliente SaaS: ${company.name}`;
  entityModalContent.innerHTML = `
    <form id="modal-company-form" class="grid-form">
      <label>Empresa
        <input name="name" required value="${escapeHtml(company.name)}" />
      </label>
      <label>Status
        <select name="status">
          <option value="active" ${company.status === 'active' ? 'selected' : ''}>Ativa</option>
          <option value="inactive" ${company.status === 'inactive' ? 'selected' : ''}>Inativa</option>
        </select>
      </label>
      <label>Contato principal
        <input name="contactName" value="${escapeHtml(company.contact_name || '')}" />
      </label>
      <label>Email comercial
        <input name="contactEmail" type="email" value="${escapeHtml(company.contact_email || '')}" />
      </label>
      <label>Telefone
        <input name="contactPhone" value="${escapeHtml(company.contact_phone || '')}" />
      </label>
      <label>CNPJ/Documento
        <input name="document" value="${escapeHtml(company.document || '')}" />
      </label>
      <label>Admin principal
        <input name="adminName" required value="${escapeHtml(company.admin?.name || '')}" />
      </label>
      <label>Email do admin
        <input name="adminEmail" type="email" required value="${escapeHtml(company.admin?.email || '')}" />
      </label>
      <label>Mensalidade
        <input name="billingAmount" type="number" min="0" step="0.01" value="${escapeHtml(String(company.billing_amount || 0))}" />
      </label>
      <label>Vencimento
        <input name="billingDueDay" type="number" min="1" max="31" value="${escapeHtml(company.billing_due_day ? String(company.billing_due_day) : '')}" />
      </label>
      <label>Status do pagamento
        <select name="paymentStatus">
          <option value="pending" ${company.payment_status === 'pending' ? 'selected' : ''}>Pendente</option>
          <option value="paid" ${company.payment_status === 'paid' ? 'selected' : ''}>Pago</option>
          <option value="overdue" ${company.payment_status === 'overdue' ? 'selected' : ''}>Em atraso</option>
        </select>
      </label>
      <label>Ultimo pagamento
        <input name="lastPaymentDate" type="date" value="${escapeHtml(company.last_payment_date || '')}" />
      </label>
      <label>Observacoes
        <textarea name="notes" rows="4" placeholder="Resumo contratual, observacoes internas ou pendencias">${escapeHtml(company.notes || '')}</textarea>
      </label>
      <fieldset class="module-fieldset">
        <legend>Modulo contratado</legend>
        <p class="hint">Este modulo unico libera Dashboard, Operacoes, Clientes, Produtos e Caminhoes.</p>
        <div id="modal-company-modules" class="module-grid">${buildModuleCheckboxes(company.modules)}</div>
      </fieldset>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">Salvar alteracoes</button>
      </div>
    </form>
  `;

  entityModalOverlay.classList.remove('hidden');
  const form = document.getElementById('modal-company-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      name: formData.get('name'),
      status: formData.get('status'),
      contactName: formData.get('contactName'),
      contactEmail: formData.get('contactEmail'),
      contactPhone: formData.get('contactPhone'),
      document: formData.get('document'),
      adminName: formData.get('adminName'),
      adminEmail: formData.get('adminEmail'),
      billingAmount: Number(formData.get('billingAmount') || 0),
      billingDueDay: formData.get('billingDueDay'),
      paymentStatus: formData.get('paymentStatus'),
      lastPaymentDate: formData.get('lastPaymentDate'),
      notes: formData.get('notes'),
      modules: formData.getAll('modules').map((value) => String(value))
    };

    const response = await api(`/api/platform/companies/${companyId}`, { method: 'PUT', body: payload });
    if (!response.ok) {
      showToast(response.data.error || 'Nao foi possivel atualizar o cliente SaaS.');
      return;
    }

    await loadData();
    renderCompanies();
    renderHomeOverview();
    closeEntityModal();
    showToast('Cliente SaaS atualizado.');
  });
}

function openUserModal(userId) {
  const user = state.users.find((entry) => entry.id === userId);
  if (!user) {
    showToast('Usuário não encontrado.');
    return;
  }

  state.modal = { type: 'user', id: user.id };
  entityModalTitle.textContent = 'Detalhes do usuário';

  entityModalContent.innerHTML = `
    <form id="modal-user-form" class="grid-form">
      <label>Nome
        <input name="name" value="${escapeHtml(user.name)}" required />
      </label>
      <label>Email
        <input name="email" type="email" value="${escapeHtml(user.email)}" required />
      </label>
      <label>Perfil
        <select name="role" ${isPlatformAdmin() ? '' : 'disabled'}>
          <option value="user" ${user.role === 'user' ? 'selected' : ''}>Usuário</option>
          ${isPlatformAdmin() ? `<option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrador</option>` : ''}
        </select>
      </label>
      <label>Status
        <select name="isActive">
          <option value="true" ${user.is_active ? 'selected' : ''}>Ativo</option>
          <option value="false" ${!user.is_active ? 'selected' : ''}>Inativo</option>
        </select>
      </label>
      <label>Nova senha (opcional)
        <input name="password" type="password" />
      </label>
      <fieldset class="module-fieldset">
        <legend>Módulos liberados</legend>
        <div id="modal-user-modules" class="module-grid">
          ${buildModuleCheckboxes(isPlatformAdmin() ? user.modules : (state.user?.companyModules || ['loading3d']), !isPlatformAdmin() || user.role === 'admin')}
        </div>
      </fieldset>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">Salvar alterações</button>
        <button type="button" id="modal-delete-user-btn" class="row-action danger">Excluir usuário</button>
      </div>
    </form>
  `;

  entityModalOverlay.classList.remove('hidden');
  const form = document.getElementById('modal-user-form');
  const deleteBtn = document.getElementById('modal-delete-user-btn');
  const roleSelect = form.querySelector('select[name="role"]');
  const modulesContainer = document.getElementById('modal-user-modules');
  const syncModules = () => {
    const selectedModules = Array.from(modulesContainer.querySelectorAll('input[name="modules"]:checked'))
      .map((input) => input.value);
    const isAdminRole = isPlatformAdmin() && roleSelect.value === 'admin';
    modulesContainer.innerHTML = buildModuleCheckboxes(
      isAdminRole
        ? getAvailableModules().map((module) => module.key)
        : (isPlatformAdmin() ? selectedModules : (state.user?.companyModules || ['loading3d'])),
      !isPlatformAdmin() || isAdminRole
    );
  };
  roleSelect.addEventListener('change', syncModules);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      role: isPlatformAdmin() ? String(formData.get('role') || 'user') : 'user',
      isActive: String(formData.get('isActive') || 'true') === 'true',
      modules: formData.getAll('modules').map((value) => String(value))
    };
    const password = String(formData.get('password') || '').trim();
    if (password) payload.password = password;

    const response = await api(`/api/users/${user.id}`, { method: 'PUT', body: payload });
    if (!response.ok) {
      showToast(response.data.error || 'Não foi possível atualizar o usuário.');
      return;
    }
    showToast('Usuário atualizado.');
    await loadData();
    renderApp();
    openUserModal(user.id);
  });

  deleteBtn.addEventListener('click', async () => {
    if (!window.confirm(`Excluir o usuário "${user.name}"?`)) return;
    const response = await api(`/api/users/${user.id}`, { method: 'DELETE' });
    if (!response.ok) {
      showToast(response.data.error || 'Não foi possível excluir o usuário.');
      return;
    }
    showToast('Usuário excluído.');
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
  entityModalCard?.classList.remove('modal-card-order');
  state.modal = null;
}

function onGlobalKeydown(event) {
  if (event.key === 'Escape' && accountMenu && !accountMenuPanel.classList.contains('hidden')) {
    closeAccountMenu();
    return;
  }

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
  confirmModalTitle.textContent = title || 'Confirmar ação';
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

function getUserInitials(name) {
  const initials = String(name || 'Conta')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  return initials || 'C';
}

async function onCreateCategory(event) {
  event.preventDefault();
  const form = new FormData(categoryForm);
  const payload = {
    name: form.get('name')
  };

  const response = await api('/api/can-categories', {
    method: 'POST',
    body: payload
  });

  if (!response.ok) {
    showToast(response.data.error || 'Não foi possível criar a categoria.');
    return;
  }

  categoryForm.reset();
  showToast('Categoria criada com sucesso!');
  await loadData();
  renderApp();
}

async function onCreateCompany(event) {
  event.preventDefault();
  if (state.companyWizardStep < 3) {
    onAdvanceCompanyWizard();
    return;
  }
  const form = new FormData(companyForm);
  const payload = {
    name: form.get('name'),
    status: form.get('status'),
    contactName: form.get('contactName'),
    contactEmail: form.get('contactEmail'),
    contactPhone: form.get('contactPhone'),
    document: form.get('document'),
    adminName: form.get('adminName'),
    adminEmail: form.get('adminEmail'),
    adminPassword: form.get('adminPassword'),
    billingAmount: Number(form.get('billingAmount') || 0),
    billingDueDay: form.get('billingDueDay'),
    paymentStatus: form.get('paymentStatus'),
    lastPaymentDate: form.get('lastPaymentDate'),
    notes: form.get('notes'),
    modules: form.getAll('modules').map((value) => String(value))
  };

  const response = await api('/api/platform/companies', { method: 'POST', body: payload });
  if (!response.ok) {
    showToast(response.data.error || 'Nao foi possivel cadastrar o cliente SaaS.');
    return;
  }

  companyForm.reset();
  syncCompanyFormAccess();
  setCompanyWizardStep(1);
  setPlatformSection('portfolio');
  await loadData();
  renderCompanies();
  renderHomeOverview();
  showToast('Cliente SaaS cadastrado.');
}

async function onCreateUser(event) {
  event.preventDefault();
  const form = new FormData(userForm);
  const payload = {
    name: form.get('name'),
    email: form.get('email'),
    password: form.get('password'),
    role: form.get('role'),
    isActive: String(form.get('isActive') || 'true') === 'true',
    modules: form.getAll('modules').map((value) => String(value))
  };

  const response = await api('/api/users', { method: 'POST', body: payload });
  if (!response.ok) {
    showToast(response.data.error || 'Não foi possível cadastrar usuário.');
    return;
  }

  userForm.reset();
  syncUserFormAccess();
  await loadData();
  renderUsers();
  showToast('Usuário cadastrado.');
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
    showToast('Nao foi possivel cadastrar produto.');
    return;
  }

  canForm.reset();
  syncCanShapeFields();
  await loadData();
  renderApp();
  showToast('Produto cadastrado.');
}

function formatDiameterCm(value) {
  const diameter = Number(value || 0);
  if (!(diameter > 0)) return '';
  return diameter.toFixed(2);
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
    showToast(response.data.error || 'Não foi possível cadastrar caminhão.');
    return;
  }

  truckForm.reset();
  await loadData();
  renderApp();
  showToast('Caminhão cadastrado.');
}

function updateProgress(currentStep) {
  // Resetar todos os steps
  [stepClient, stepItems, stepLaunch].forEach(step => {
    step.classList.remove('active', 'completed');
  });

  // Marcar steps completados
  if (currentStep === 'items' || currentStep === 'launch') {
    stepClient.classList.add('completed');
  }
  if (currentStep === 'launch') {
    stepItems.classList.add('completed');
  }

  // Marcar step atual
  if (currentStep === 'client') {
    stepClient.classList.add('active');
  } else if (currentStep === 'items') {
    stepItems.classList.add('active');
  } else if (currentStep === 'launch') {
    stepLaunch.classList.add('active');
  }
}

function onSelectedClientChange() {
  const selectedValue = selectedClient.value;
  
  if (selectedValue === '_new') {
    // Mostrar campo para criar novo cliente
    newClientLabel.style.display = 'block';
    newClientInput.required = true;
    clientSelectionSection.style.display = '';
    itemsSection.style.display = 'none';
    launchSection.style.display = 'none';
    state.selectedClientId = null;
    updateProgress('client');
  } else if (selectedValue) {
    // Selecionar cliente existente
    const selectedClientObj = state.clients.find(c => c.id == selectedValue);
    newClientLabel.style.display = 'none';
    clientSelectionSection.style.display = '';
    itemsSection.style.display = 'block';
    launchSection.style.display = 'none';
    state.selectedClientId = Number(selectedValue);
    
    if (selectedClientObj) {
      currentClientName.textContent = selectedClientObj.name;
    }
    updateProgress('items');
    renderCargoBuilder();
  } else {
    // Limpar seleção - mas manter itens existentes
    newClientLabel.style.display = 'none';
    clientSelectionSection.style.display = '';
    itemsSection.style.display = 'block';
    launchSection.style.display = 'none';
    state.selectedClientId = null;
    currentClientName.textContent = 'Todos os Clientes';
    updateProgress('items');
    renderCargoBuilder();
  }
}

async function onCreateNewClient() {
  const clientName = newClientInput.value.trim();
  
  if (!clientName) {
    showToast('Digite o nome do cliente.');
    return;
  }

  const response = await api('/api/clients', {
    method: 'POST',
    body: { name: clientName }
  });

  if (!response.ok) {
    showToast(response.data.error || 'Não foi possível criar o cliente.');
    return;
  }

  // Atualizar lista de clientes e selecionar o novo cliente
  await loadData();
  const newClient = state.clients.find(c => c.name === clientName);
  if (newClient) {
    selectedClient.value = newClient.id;
    onSelectedClientChange();
    showToast(`Cliente "${clientName}" criado com sucesso!`);
  }
}

function onAddMoreClients() {
  // Resetar seleção de cliente para permitir adicionar outro
  selectedClient.value = '';
  state.selectedClientId = null;
  currentClientName.textContent = 'Selecione outro cliente...';
  onSelectedClientChange();
  showToast('Agora selecione outro cliente para adicionar mais itens.');
}

function onFinishClients() {
  if (state.cargoItems.length > 0) {
    const orderRange = getSelectedOrderRange(true);
    if (!orderRange) return;
    if (!state.lastCalculation) {
      showToast('Calcule a carga antes de avançar para o resumo.');
      return;
    }
    const currentSignature = buildCargoSignature(state.cargoItems);
    if (
      state.lastCalculation.startDate !== orderRange.startDate ||
      state.lastCalculation.endDate !== orderRange.endDate ||
      state.lastCalculation.cargoSignature !== currentSignature
    ) {
      showToast('A carga mudou. Recalcule antes de avançar para o resumo.');
      return;
    }

    renderLaunchReviewSummary();
    clientSelectionSection.style.display = 'none';
    launchSection.style.display = 'block';
    itemsSection.style.display = 'none';
    updateProgress('launch');
    showToast('Carga pronta. Revise o resumo do pedido antes de lançar.');
  } else {
    showToast('Adicione pelo menos um item antes de finalizar.');
  }
}

function onBackToItems() {
  launchSection.style.display = 'none';
  clientSelectionSection.style.display = '';
  itemsSection.style.display = 'block';
  updateProgress('items');
}

function onOpenClientModal() {
  clientModalTitle.textContent = 'Cadastrar Novo Cliente';
  clientModalForm.reset();
  delete clientModalForm.dataset.clientId;
  clientModalForm.dataset.mode = 'create';
  clientModalOverlay.classList.remove('hidden');
}

function onCloseClientModal() {
  clientModalOverlay.classList.add('hidden');
  clientModalForm.reset();
  delete clientModalForm.dataset.clientId;
  clientModalForm.dataset.mode = 'create';
}

function fillClientForm(formElement, client = null) {
  formElement.elements.namedItem('name').value = client?.name || '';
  formElement.elements.namedItem('email').value = client?.email || '';
  formElement.elements.namedItem('phone').value = client?.phone || '';
  formElement.elements.namedItem('address').value = client?.address || '';
  formElement.elements.namedItem('city').value = client?.city || '';
  formElement.elements.namedItem('state').value = client?.state || '';
  formElement.elements.namedItem('cnpj_cpf').value = client?.cnpj_cpf || '';
  formElement.elements.namedItem('contact_person').value = client?.contact_person || '';
  formElement.elements.namedItem('status').value = client?.status || 'active';
  formElement.elements.namedItem('notes').value = client?.notes || '';
}

function openClientEditModal(clientId) {
  const client = state.clients.find((entry) => entry.id === clientId);
  if (!client) {
    showToast('Cliente nao encontrado.');
    return;
  }

  clientModalTitle.textContent = 'Editar Cliente';
  clientModalForm.reset();
  fillClientForm(clientModalForm, client);
  clientModalForm.dataset.mode = 'edit';
  clientModalForm.dataset.clientId = String(client.id);
  clientModalOverlay.classList.remove('hidden');
}

function buildClientPayloadFromForm(formData) {
  return {
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    city: formData.get('city'),
    state: formData.get('state'),
    cnpj_cpf: formData.get('cnpj_cpf'),
    contact_person: formData.get('contact_person'),
    status: formData.get('status'),
    notes: formData.get('notes')
  };
}

async function createOperationalClientFromForm(formElement) {
  const formData = new FormData(formElement);
  return api('/api/clients', {
    method: 'POST',
    body: buildClientPayloadFromForm(formData)
  });
}

async function onCreateOperationalClient(event) {
  event.preventDefault();

  const response = await createOperationalClientFromForm(clientForm);
  if (!response.ok) {
    showToast(response.data.error || 'Nao foi possivel cadastrar o cliente.');
    return;
  }

  clientForm.reset();
  await loadData();
  renderClients();
  showToast('Cliente operacional cadastrado.');
}

async function onSaveClient(event) {
  event.preventDefault();

  const formData = new FormData(clientModalForm);
  const payload = buildClientPayloadFromForm(formData);
  const clientId = Number(clientModalForm.dataset.clientId || 0);
  const isEditing = clientModalForm.dataset.mode === 'edit' && clientId > 0;
  const response = await api(isEditing ? `/api/clients/${clientId}` : '/api/clients', {
    method: isEditing ? 'PUT' : 'POST',
    body: payload
  });

  if (!response.ok) {
    showToast(response.data.error || 'Não foi possível cadastrar o cliente.');
    return;
  }

  onCloseClientModal();
  showToast('Cliente cadastrado com sucesso!');
  await loadData();
  renderApp();
}

function onClientSearch() {
  renderClients();
}

function onClientFilter() {
  renderClients();
}

async function onRefreshClients() {
  showToast('Atualizando clientes...');
  await loadData();
  renderClients();
  showToast('Clientes atualizados!');
}

function onViewClient(clientId) {
  const client = state.clients.find(c => c.id === clientId);
  if (!client) return;
  
  // Implementar visualização do cliente
  showToast(`Visualizando: ${client.name}`);
}

function onEditClient(clientId) {
  const client = state.clients.find(c => c.id === clientId);
  if (!client) return;
  
  // Implementar edição do cliente
  showToast(`Editando: ${client.name}`);
}

async function onDeleteClient(clientId, clientName) {
  if (!confirm(`Tem certeza que deseja excluir o cliente "${clientName}"?`)) {
    return;
  }

  const response = await api(`/api/clients/${clientId}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    showToast(response.data.error || 'Não foi possível excluir o cliente.');
    return;
  }

  showToast('Cliente excluído com sucesso!');
  await loadData();
  renderApp();
}

function onOrderClientChange() {
  const selectedValue = orderClientSelect.value;
  
  if (selectedValue === '_new') {
    // Mostrar campo para criar novo cliente
    clientInput.style.display = 'block';
    clientInput.required = true;
    clientInput.placeholder = 'Nome do novo cliente...';
  } else if (selectedValue) {
    // Ocultar campo e preencher com nome do cliente selecionado
    const selectedClient = state.clients.find(c => c.id == selectedValue);
    clientInput.style.display = 'none';
    clientInput.required = false;
    if (selectedClient) {
      clientInput.value = selectedClient.name;
    }
  } else {
    // Limpar tudo
    clientInput.style.display = 'block';
    clientInput.required = false;
    clientInput.value = '';
    clientInput.placeholder = 'Nome do cliente (opcional)';
  }
}

async function onAddCargoItem(event) {
  event.preventDefault();

  const canId = Number(canSelect.value);
  const quantity = Number(quantityInput.value);

  if (!Number.isInteger(canId) || !Number.isInteger(quantity) || quantity <= 0) {
    showToast('Selecione um produto e uma quantidade valida.');
    return;
  }

  let clientName = '';
  
  // Se tiver um cliente selecionado, usar o nome dele
  if (state.selectedClientId) {
    const selectedClientObj = state.clients.find(c => c.id === state.selectedClientId);
    clientName = selectedClientObj ? selectedClientObj.name : '';
  } else {
    // Se não tiver cliente selecionado, não adicionar item
    showToast('Selecione um cliente para adicionar itens.');
    return;
  }

  const existing = state.cargoItems.find((item) => item.canId === canId && item.clientName === clientName);
  if (existing) {
    existing.quantity += quantity;
  } else {
    state.cargoItems.push({ canId, quantity, clientName });
  }

  quantityInput.value = '1';
  state.lastCalculation = null;
  resultBox.classList.add('hidden');
  manualResultBox.classList.add('hidden');
  renderCargoBuilder();
  updateProgress('items');
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
    resultBox.innerHTML = `<strong>Falha:</strong> ${escapeHtml(response.data.error || 'Não foi possível calcular.')}`;
    return;
  }

  attachSpatialValidationToPayload(response.data);
  resultBox.classList.remove('hidden');
  renderCalculationResult(resultBox, response.data, 'automatic');
  storeLastCalculation(response.data, orderRange);
  renderLaunchReviewSummary();
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
    showToast('Selecione um caminhão para simulação manual.');
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
    manualResultBox.innerHTML = `<strong>Falha:</strong> ${escapeHtml(response.data.error || 'Não foi possível simular.')}`;
    return;
  }

  attachSpatialValidationToPayload(response.data);
  manualResultBox.classList.remove('hidden');
  renderCalculationResult(manualResultBox, response.data, 'manual');
  storeLastCalculation(response.data, orderRange);
  renderLaunchReviewSummary();
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
    showToast('Adicione pelo menos um caminhão válido.');
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
    manualResultBox.innerHTML = `<strong>Falha:</strong> ${escapeHtml(response.data.error || 'Não foi possível simular.')}`;
    return;
  }

  attachSpatialValidationToPayload(response.data);
  manualResultBox.classList.remove('hidden');
  renderCalculationResult(manualResultBox, response.data, 'manual');
  storeLastCalculation(response.data, orderRange);
  renderLaunchReviewSummary();
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
    showToast('Não há mais modelos de caminhão disponíveis para adicionar nesse período.');
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
    selectLabel.textContent = 'Caminhão';
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
      option.textContent = `${truck.name} (${formatVolume(truck.volume_cm3)}) - ${availableUnits}/${totalUnits} disponível(is)`;
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
        showToast('Mantenha ao menos um item de caminhão na distribuição manual.');
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

async function onAgendaRangeChange() {
  const range = getSelectedAgendaRange(false);
  if (!range) {
    state.truckSchedule = null;
    renderTruckSchedule();
    return;
  }

  state.agendaStartDate = range.startDate;
  state.agendaEndDate = range.endDate;
  await loadTruckSchedule(true);
  renderTruckSchedule();
}

async function loadTruckSchedule(showErrorToast) {
  const range = getSelectedAgendaRange(showErrorToast);
  if (!range) {
    state.truckSchedule = null;
    return;
  }

  state.agendaStartDate = range.startDate;
  state.agendaEndDate = range.endDate;

  const response = await api(
    `/api/truck-schedule?startDate=${encodeURIComponent(range.startDate)}&endDate=${encodeURIComponent(range.endDate)}`
  );

  if (!response.ok) {
    state.truckSchedule = null;
    if (showErrorToast) {
      showToast(response.data.error || 'Não foi possível carregar a agenda da frota.');
    }
    return;
  }

  state.truckSchedule = response.data;
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
      showToast(response.data.error || 'Não foi possível carregar disponibilidade de caminhões.');
    }
    return;
  }

  state.unavailableTruckIds = Array.isArray(response.data.busyTruckIds) ? response.data.busyTruckIds : [];
  state.truckAvailabilityById = buildTruckAvailabilityLookup(response.data.availability);
}

function renderDateAvailabilityHint() {
  const range = getSelectedOrderRange(false);
  if (!range) {
    dateAvailabilityHint.textContent = 'Selecione o período para verificar disponibilidade de caminhões.';
    return;
  }

  const reservedUnits = state.trucks.reduce((sum, truck) => sum + Number(getTruckAvailabilityInfo(truck.id).reservedQuantity || 0), 0);
  const unavailableModels = state.unavailableTruckIds.length;
  if (!reservedUnits) {
    dateAvailabilityHint.textContent = `Todos os caminhões estão disponíveis entre ${formatDate(range.startDate)} e ${formatDate(range.endDate)}.`;
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

function getSelectedAgendaRange(showToastOnError) {
  const startDate = String(agendaStartDateInput?.value || state.agendaStartDate || '').trim();
  const endDate = String(agendaEndDateInput?.value || state.agendaEndDate || '').trim();

  if ((!startDate || !endDate) && showToastOnError) {
    showToast('Selecione a data inicial e final da agenda.');
    return null;
  }

  if (!startDate || !endDate) {
    return null;
  }

  if (startDate > endDate) {
    if (showToastOnError) {
      showToast('A data final da agenda deve ser maior ou igual à data inicial.');
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
    allocation,
    spatialValidation: payload?.spatialValidation || null
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

function addDaysIso(dateIso, days) {
  const date = new Date(`${dateIso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function renderCalculationResult(targetBox, payload, sourceMode) {
  const allocation = normalizeAllocationFromPayload(payload);
  if (!allocation) {
    targetBox.innerHTML = `<strong>Falha:</strong> Resultado de cálculo inválido.`;
    return;
  }
  const spatialValidation = payload?.spatialValidation || null;
  const hasSpatialIssue = spatialValidation?.checked && !spatialValidation.fits;

  const title =
    sourceMode === 'automatic'
      ? payload.strategy === 'single'
        ? 'Resultado automático (1 caminhão)'
        : 'Resultado automático (distribuído em vários caminhões)'
      : payload.strategy === 'single'
        ? 'Resultado manual (1 caminhão)'
        : 'Resultado manual (distribuído)';

  const trucksHtml = allocation.trucks
    .map((truck) => {
      return `<li>${truck.quantity}x ${escapeHtml(truck.name)} (${formatVolume(truck.totalCapacityCm3)} de capacidade)</li>`;
    })
    .join('');

  const statusLine = hasSpatialIssue
    ? `<p><strong>Status:</strong> O volume comporta a carga, mas a distribuição 3D deixou itens de fora.</p>`
    : allocation.fits
      ? `<p><strong>Status:</strong> Carga comportada.</p>`
      : `<p><strong>Status:</strong> Espaço insuficiente.</p>`;

  const trailing = hasSpatialIssue
    ? `<p><strong>Validação 3D:</strong> ${spatialValidation.placedCount}/${spatialValidation.totalCount} volumes acomodados em ${escapeHtml(spatialValidation.truckName)}. ${spatialValidation.missingCount} volume(s) ficaram de fora.</p>`
    : allocation.fits
      ? `<p><strong>Sobra de espaço:</strong> ${formatVolume(allocation.leftoverCm3)}</p>`
      : `<p><strong>Carga que ficaria de fora:</strong> ${formatVolume(allocation.missingCm3)}</p>`;

  const range = {
    startDate: payload?.startDate || getSelectedOrderRange(false)?.startDate || null,
    endDate: payload?.endDate || getSelectedOrderRange(false)?.endDate || null
  };
  const rangeLine =
    range.startDate && range.endDate
      ? `<p><strong>Período do pedido:</strong> ${escapeHtml(formatDateRange(range.startDate, range.endDate))}</p>`
      : '';

  targetBox.innerHTML = `
    <h3>${title}</h3>
    ${rangeLine}
    <p><strong>Volume real da carga:</strong> ${formatVolume(payload.totalVolumeCm3 || 0)}</p>
    ${payload.totalEffectiveVolumeCm3 && payload.totalEffectiveVolumeCm3 !== payload.totalVolumeCm3 ? 
      `<p><strong>Volume efetivo (com espaços vazios):</strong> ${formatVolume(payload.totalEffectiveVolumeCm3)}</p>` : ''}
    ${payload.packingEfficiency && payload.packingEfficiency < 1 ? 
      `<p><strong>Eficiência de empacotamento:</strong> ${(payload.packingEfficiency * 100).toFixed(1)}%</p>` : ''}
    ${payload.truckEfficiency ? 
      `<p><strong>Eficiência do caminhão:</strong> ${(payload.truckEfficiency * 100).toFixed(0)}% (volume útil)</p>` : ''}
    <p><strong>Capacidade total selecionada:</strong> ${formatVolume(allocation.totalCapacityCm3 || 0)}</p>
    <p><strong>Caminhoes usados:</strong></p>
    <ul>${trucksHtml}</ul>
    ${statusLine}
    ${trailing}
    <p><strong>Ocupação:</strong> ${((allocation.occupancyRate || 0) * 100).toFixed(2)}%</p>
    ${hasSpatialIssue ? `
      <div class="logistic-analysis" style="margin-top: 16px; padding: 12px 14px; border: 2px solid #f0b429; border-radius: 8px; background: #fff8db;">
        <strong style="color: var(--brand-black)">Aviso:</strong> a análise volumétrica aprovou a carga, mas o empacotador 3D não conseguiu acomodar todos os volumes no caminhão selecionado.
      </div>
    ` : ''}
    
    ${payload.logisticAnalysis ? `
      <div class="logistic-analysis" style="margin-top: 20px; padding: 15px; border: 2px solid #e0e0e0; border-radius: 8px; background: #f8f9fa;">
        <h4 style="margin: 0 0 10px 0; color: var(--brand-black);">📊 Análise Logística Profissional</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.9rem;">
          <div><strong>Volume útil caminhão:</strong> ${payload.logisticAnalysis.volumeUtilCaminhao.toFixed(2)} m³</div>
          <div><strong>Taxa de ocupação:</strong> ${payload.logisticAnalysis.taxaOcupacao}%</div>
          <div><strong>Espaço restante:</strong> ${payload.logisticAnalysis.espacoRestante.toFixed(2)} m³</div>
          <div><strong>Nível de risco:</strong> <span style="color: ${payload.logisticAnalysis.nivelRisco === 'ALTA' ? '#dc3545' : payload.logisticAnalysis.nivelRisco === 'MÉDIA' ? '#ffc107' : '#28a745'}">${payload.logisticAnalysis.nivelRisco}</span></div>
        </div>
        <div style="margin-top: 10px; padding: 10px; background: white; border-radius: 6px; border-left: 4px solid var(--brand-yellow);">
          <strong style="color: var(--brand-black)">Conclusão:</strong> ${payload.logisticAnalysis.conclusao}
        </div>
        <div style="margin-top: 10px; font-size: 0.85rem; color: var(--muted); font-style: italic;">
          💡 ${payload.logisticAnalysis.recomendacao}
        </div>
      </div>
    ` : ''}
  `;
}

function buildCurrentLoadSummaryFromClient() {
  if (!state.cargoItems.length) return null;

  let totalVolumeCm3 = 0;
  let totalEffectiveVolumeCm3 = 0;
  let totalCans = 0;
  const breakdown = [];

  for (const item of state.cargoItems) {
    const can = state.cans.find((entry) => entry.id === item.canId);
    if (!can) continue;

    const quantity = Number(item.quantity);
    const nominalSubtotal = Number(can.volume_cm3) * quantity;
    const packingDimensions = getCanPackingDimensions(can);
    const effectiveUnitVolumeCm3 =
      Number(packingDimensions.width || 0) *
      Number(packingDimensions.height || 0) *
      Number(packingDimensions.depth || 0) *
      1000000;
    const effectiveSubtotal = effectiveUnitVolumeCm3 * quantity;

    totalVolumeCm3 += nominalSubtotal;
    totalEffectiveVolumeCm3 += effectiveSubtotal;
    totalCans += quantity;

    breakdown.push({
      canId: can.id,
      canName: can.name,
      quantity,
      unitVolumeCm3: Number(can.volume_cm3),
      totalVolumeCm3: nominalSubtotal,
      effectiveVolumeCm3: effectiveSubtotal
    });
  }

  if (!(totalVolumeCm3 > 0)) return null;
  return { totalVolumeCm3, totalEffectiveVolumeCm3, totalCans, breakdown };
}

function buildAutomaticPayloadFromClient() {
  const summary = buildCurrentLoadSummaryFromClient();
  if (!summary || !state.trucks.length) return null;
  const requiredVolumeCm3 = summary.totalEffectiveVolumeCm3 || summary.totalVolumeCm3;

  const sortedAsc = [...state.trucks].sort((a, b) => Number(a.volume_cm3) - Number(b.volume_cm3));
  const single = sortedAsc.find((truck) => Number(truck.volume_cm3) >= requiredVolumeCm3);

  if (single) {
    return {
      mode: 'automatic',
      strategy: 'single',
      totalVolumeCm3: summary.totalVolumeCm3,
      totalEffectiveVolumeCm3: summary.totalEffectiveVolumeCm3,
      totalCans: summary.totalCans,
      breakdown: summary.breakdown,
      allocation: buildClientAllocation(requiredVolumeCm3, [
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
    totalEffectiveVolumeCm3: summary.totalEffectiveVolumeCm3,
    totalCans: summary.totalCans,
    breakdown: summary.breakdown,
    allocation: buildClientAllocation(requiredVolumeCm3, fleet)
  };
}

function buildManualSinglePayloadFromClient(truckId) {
  const summary = buildCurrentLoadSummaryFromClient();
  if (!summary) return null;
  const requiredVolumeCm3 = summary.totalEffectiveVolumeCm3 || summary.totalVolumeCm3;

  const truck = state.trucks.find((entry) => entry.id === truckId);
  if (!truck) return null;

  return {
    mode: 'manual',
    strategy: 'single',
    totalVolumeCm3: summary.totalVolumeCm3,
    totalEffectiveVolumeCm3: summary.totalEffectiveVolumeCm3,
    totalCans: summary.totalCans,
    breakdown: summary.breakdown,
    allocation: buildClientAllocation(requiredVolumeCm3, [
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
  const requiredVolumeCm3 = summary.totalEffectiveVolumeCm3 || summary.totalVolumeCm3;

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
    totalEffectiveVolumeCm3: summary.totalEffectiveVolumeCm3,
    totalCans: summary.totalCans,
    breakdown: summary.breakdown,
    allocation: buildClientAllocation(requiredVolumeCm3, allocations)
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

  return `Alt ${can.height_cm} | Diam ${formatDiameterCm(can.diameter_cm)} cm`;
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

function formatAgendaDayHeader(dateIso) {
  const date = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateIso;
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const dayMonth = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${weekday} ${dayMonth}`;
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

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function api(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };

  if (options.body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (state.csrfToken && !['GET', 'HEAD'].includes(method)) {
    headers['X-CSRF-Token'] = state.csrfToken;
  }

  const response = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (response.status === 401) {
    state.csrfToken = null;
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

const ORDER_PREVIEW_STORAGE_KEY = 'granilha_metric_order_3d_preview';

let isVisualization3DVisible = false;
let truckDimensions3D = { length: 14.5, width: 2.45, height: 1.70, name: 'Caminhão padrão' };
let packingMetrics3D = null;

// Cores fixas por pedido/cliente na visualização 3D
const ORDER_COLOR_PALETTE = [
    0xe76f51,
    0x2a9d8f,
    0xe9c46a,
    0x264653,
    0xf4a261,
    0x457b9d,
    0x8d99ae,
    0xef476f,
    0x06d6a0,
    0x118ab2,
    0xbc6c25,
    0x6a4c93
];

function getOrderColor(orderKey) {
    const normalizedKey = String(orderKey || 'pedido-sem-nome');
    let hash = 0;

    for (let index = 0; index < normalizedKey.length; index++) {
        hash = ((hash << 5) - hash) + normalizedKey.charCodeAt(index);
        hash |= 0;
    }

    return ORDER_COLOR_PALETTE[Math.abs(hash) % ORDER_COLOR_PALETTE.length];
}

function resolveVisualizationTruckConfigFromAllocation(allocation) {
    const candidateTruckIds = [];

    if (Array.isArray(allocation?.trucks)) {
        allocation.trucks.forEach((entry) => {
            const truckId = Number(entry?.truckId);
            if (Number.isInteger(truckId)) {
                candidateTruckIds.push(truckId);
            }
        });
    }

    const bestTruckId = Number(state.lastCalculation?.bestTruck?.id);
    if (Number.isInteger(bestTruckId)) {
        candidateTruckIds.unshift(bestTruckId);
    }

    const resolvedTruck = [...new Set(candidateTruckIds)]
        .map((truckId) => state.trucks.find((truck) => truck.id === truckId))
        .filter(Boolean)
        .sort((a, b) => Number(b.volume_cm3 || 0) - Number(a.volume_cm3 || 0))[0]
        || [...state.trucks].sort((a, b) => Number(b.volume_cm3 || 0) - Number(a.volume_cm3 || 0))[0];

    if (!resolvedTruck) {
        return { name: 'Caminhão padrão', length: 14.5, width: 2.45, height: 1.70 };
    }

    return {
        name: resolvedTruck.name || 'Caminhão',
        length: Number(resolvedTruck.length_cm || 1450) / 100,
        width: Number(resolvedTruck.width_cm || 245) / 100,
        height: Number(resolvedTruck.height_cm || 170) / 100,
        truckId: Number(resolvedTruck.id || 0) || null
    };
}

function syncVisualizationTruckMetrics() {
    const floorY = Math.min(0.015, truckDimensions3D.height * 0.04);
    packingMetrics3D = {
        gap: 0.002,
        orderGap: 0.015,
        positionEpsilon: 0.0015,
        floorY,
        minX: -truckDimensions3D.length / 2 + 0.008,
        rearX: truckDimensions3D.length / 2 - 0.008,
        minZ: -truckDimensions3D.width / 2 + 0.008,
        maxZ: truckDimensions3D.width / 2 - 0.008,
        usableHeight: truckDimensions3D.height - floorY * 2
    };
}

function getCanPackingDimensions(can) {
    const height = Number(can.height_cm || 0) / 100;

    if (can.shape === 'cylinder') {
        const diameter = Number(can.diameter_cm || can.length_cm || can.width_cm || 0) / 100;
        return { width: diameter, height, depth: diameter };
    }

    return {
        width: Number(can.length_cm || can.width_cm || 0) / 100,
        height,
        depth: Number(can.width_cm || can.length_cm || 0) / 100
    };
}

function getCanRenderDimensions(can) {
    const height = Number(can.height_cm || 0) / 100;
    if (!(height > 0)) {
        return null;
    }

    if (can.shape === 'cylinder') {
        const diameter = Number(can.diameter_cm || can.length_cm || can.width_cm || 0) / 100;
        if (!(diameter > 0)) {
            return null;
        }
        return [diameter, height, diameter];
    }

    const width = Number(can.length_cm || can.width_cm || 0) / 100;
    const depth = Number(can.width_cm || can.length_cm || 0) / 100;
    if (!(width > 0) || !(depth > 0)) {
        return null;
    }

    return [width, height, depth];
}

function buildVisualizationItems() {
    const items = [];

    state.cargoItems.forEach((row) => {
        const can = state.cans.find((entry) => entry.id === row.canId);
        if (!can) return;

        const dimensions = getCanPackingDimensions(can);
        if (!(dimensions.width > 0) || !(dimensions.height > 0) || !(dimensions.depth > 0)) {
            return;
        }

        const quantity = Math.max(0, Number(row.quantity || 0));
        const clientName = String(row.clientName || 'Pedido sem cliente').trim() || 'Pedido sem cliente';
        const color = getOrderColor(clientName);
        for (let index = 0; index < quantity; index++) {
            items.push({
                name: can.name,
                clientKey: clientName,
                clientName,
                color,
                dimensions: [dimensions.width, dimensions.height, dimensions.depth]
            });
        }
    });

    return items;
}

function buildVisualizationGroups(items, clientKey) {
    const groups = new Map();

    items
        .filter((item) => item.clientKey === clientKey)
        .forEach((item) => {
            const key = `${item.name}:${item.dimensions.join('x')}`;
            if (!groups.has(key)) {
                const [width, height, depth] = item.dimensions;
                groups.set(key, {
                    key,
                    clientKey,
                    clientName: item.clientName,
                    color: item.color,
                    name: item.name,
                    itemWidth: width,
                    itemHeight: height,
                    itemDepth: depth,
                    footprint: width * depth,
                    volume: width * height * depth,
                    items: []
                });
            }
            groups.get(key).items.push(item);
        });

    return Array.from(groups.values()).sort((a, b) => {
        return b.footprint - a.footprint ||
            b.volume - a.volume ||
            b.itemHeight - a.itemHeight ||
            b.items.length - a.items.length;
    });
}

function buildVisualizationBlocks(items) {
    const clientKeys = [...new Set(items.map((item) => item.clientKey))];
    return clientKeys
        .map((clientKey) => {
            const groups = buildVisualizationGroups(items, clientKey);
            const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);
            const totalVolume = groups.reduce((sum, group) => sum + group.volume * group.items.length, 0);
            const weightedFootprint = groups.reduce((sum, group) => sum + (group.footprint * group.items.length), 0);
            const maxFootprint = groups.reduce((maxValue, group) => Math.max(maxValue, group.footprint), 0);
            const minFloorSpan = groups.reduce((minValue, group) => {
                return Math.min(minValue, Math.min(group.itemWidth, group.itemDepth));
            }, Number.POSITIVE_INFINITY);
            const maxGroupWidth = groups.reduce((maxValue, group) => Math.max(maxValue, group.itemWidth), 0);

            return {
                clientKey,
                clientName: clientKey,
                groups,
                totalVolume,
                averageFootprint: totalItems ? weightedFootprint / totalItems : 0,
                maxFootprint,
                minFloorSpan: Number.isFinite(minFloorSpan) ? minFloorSpan : 0,
                maxGroupWidth,
                minimalLength: Math.max(
                    maxGroupWidth + packingMetrics3D.gap * 2,
                    totalVolume / Math.max((packingMetrics3D.maxZ - packingMetrics3D.minZ) * packingMetrics3D.usableHeight, packingMetrics3D.positionEpsilon)
                )
            };
        });
}

function getVisualizationOrientations(width, height, depth) {
    return [
        { width, height, depth, rotated: false },
        { width: depth, height, depth: width, rotated: true }
    ].filter((orientation, index, list) => {
        return index === list.findIndex((candidate) =>
            Math.abs(candidate.width - orientation.width) <= packingMetrics3D.positionEpsilon &&
            Math.abs(candidate.depth - orientation.depth) <= packingMetrics3D.positionEpsilon
        );
    });
}

function scoreVisualizationLayout(layout, minFloorSpan) {
    const fragments = layout.map((slot) => ({
        area: (slot.xMax - slot.xMin) * (slot.zMax - slot.zMin),
        minSpan: Math.min(slot.xMax - slot.xMin, slot.zMax - slot.zMin)
    }));

    return {
        unusableCount: fragments.filter((fragment) => fragment.minSpan < minFloorSpan - packingMetrics3D.positionEpsilon).length,
        maxSpan: fragments.reduce((value, fragment) => Math.max(value, fragment.minSpan), 0),
        maxArea: fragments.reduce((value, fragment) => Math.max(value, fragment.area), 0)
    };
}

function chooseBestVisualizationRemainder(layouts, minFloorSpan) {
    return layouts.reduce((bestLayout, currentLayout) => {
        if (!bestLayout) return currentLayout;

        const bestScore = scoreVisualizationLayout(bestLayout, minFloorSpan);
        const currentScore = scoreVisualizationLayout(currentLayout, minFloorSpan);
        if (currentScore.unusableCount !== bestScore.unusableCount) {
            return currentScore.unusableCount < bestScore.unusableCount ? currentLayout : bestLayout;
        }
        if (Math.abs(currentScore.maxSpan - bestScore.maxSpan) > packingMetrics3D.positionEpsilon) {
            return currentScore.maxSpan > bestScore.maxSpan ? currentLayout : bestLayout;
        }
        return currentScore.maxArea > bestScore.maxArea + packingMetrics3D.positionEpsilon ? currentLayout : bestLayout;
    }, null) || [];
}

function getVisualizationAnchors(slot, placement) {
    const centeredZMin = slot.zMin + Math.max(0, ((slot.zMax - slot.zMin) - placement.depth) / 2);
    return [slot.zMin, centeredZMin, slot.zMax - placement.depth].filter((anchor, index, list) => {
        return anchor >= slot.zMin - packingMetrics3D.positionEpsilon &&
            anchor + placement.depth <= slot.zMax + packingMetrics3D.positionEpsilon &&
            index === list.findIndex((candidate) => Math.abs(candidate - anchor) <= packingMetrics3D.positionEpsilon);
    });
}

function buildVisualizationRemainders(slot, placement, usedZMin) {
    const usedXMin = slot.xMax - placement.width;
    const usedZMax = usedZMin + placement.depth;

    const widthFirst = [];
    if (usedXMin - slot.xMin > packingMetrics3D.positionEpsilon) {
        widthFirst.push({ xMin: slot.xMin, xMax: usedXMin, zMin: slot.zMin, zMax: slot.zMax, baseY: slot.baseY, stackLevel: slot.stackLevel, groupKey: slot.groupKey });
    }
    if (usedZMin - slot.zMin > packingMetrics3D.positionEpsilon) {
        widthFirst.push({ xMin: usedXMin, xMax: slot.xMax, zMin: slot.zMin, zMax: usedZMin, baseY: slot.baseY, stackLevel: slot.stackLevel, groupKey: slot.groupKey });
    }
    if (slot.zMax - usedZMax > packingMetrics3D.positionEpsilon) {
        widthFirst.push({ xMin: usedXMin, xMax: slot.xMax, zMin: usedZMax, zMax: slot.zMax, baseY: slot.baseY, stackLevel: slot.stackLevel, groupKey: slot.groupKey });
    }

    const depthFirst = [];
    if (usedZMin - slot.zMin > packingMetrics3D.positionEpsilon) {
        depthFirst.push({ xMin: slot.xMin, xMax: slot.xMax, zMin: slot.zMin, zMax: usedZMin, baseY: slot.baseY, stackLevel: slot.stackLevel, groupKey: slot.groupKey });
    }
    if (slot.zMax - usedZMax > packingMetrics3D.positionEpsilon) {
        depthFirst.push({ xMin: slot.xMin, xMax: slot.xMax, zMin: usedZMax, zMax: slot.zMax, baseY: slot.baseY, stackLevel: slot.stackLevel, groupKey: slot.groupKey });
    }
    if (usedXMin - slot.xMin > packingMetrics3D.positionEpsilon) {
        depthFirst.push({ xMin: slot.xMin, xMax: usedXMin, zMin: usedZMin, zMax: usedZMax, baseY: slot.baseY, stackLevel: slot.stackLevel, groupKey: slot.groupKey });
    }

    return { usedXMin, usedXMax: slot.xMax, usedZMin, usedZMax, layouts: [widthFirst, depthFirst] };
}

function nearlyEqualVisualization(a, b) {
    return Math.abs(a - b) <= packingMetrics3D.positionEpsilon;
}

function rangesTouchVisualization(minA, maxA, minB, maxB) {
    return Math.abs(maxA - minB) <= packingMetrics3D.positionEpsilon || Math.abs(maxB - minA) <= packingMetrics3D.positionEpsilon;
}

function buildMergedVisualizationSlot(state, slotIndex) {
    const seedSlot = state.slots[slotIndex];
    const consumedIndexes = new Set([slotIndex]);
    const mergedSlot = {
        xMin: seedSlot.xMin,
        xMax: seedSlot.xMax,
        zMin: seedSlot.zMin,
        zMax: seedSlot.zMax,
        baseY: seedSlot.baseY,
        stackLevel: seedSlot.stackLevel,
        groupKey: seedSlot.groupKey
    };

    let changed = true;
    while (changed) {
        changed = false;

        for (let index = 0; index < state.slots.length; index++) {
            if (consumedIndexes.has(index)) continue;
            const slot = state.slots[index];

            if (!nearlyEqualVisualization(slot.baseY, mergedSlot.baseY) || slot.stackLevel !== mergedSlot.stackLevel) {
                continue;
            }

            if (
                nearlyEqualVisualization(slot.xMin, mergedSlot.xMin) &&
                nearlyEqualVisualization(slot.xMax, mergedSlot.xMax) &&
                rangesTouchVisualization(mergedSlot.zMin, mergedSlot.zMax, slot.zMin, slot.zMax)
            ) {
                mergedSlot.zMin = Math.min(mergedSlot.zMin, slot.zMin);
                mergedSlot.zMax = Math.max(mergedSlot.zMax, slot.zMax);
                consumedIndexes.add(index);
                changed = true;
                continue;
            }

            if (
                nearlyEqualVisualization(slot.zMin, mergedSlot.zMin) &&
                nearlyEqualVisualization(slot.zMax, mergedSlot.zMax) &&
                rangesTouchVisualization(mergedSlot.xMin, mergedSlot.xMax, slot.xMin, slot.xMax)
            ) {
                mergedSlot.xMin = Math.min(mergedSlot.xMin, slot.xMin);
                mergedSlot.xMax = Math.max(mergedSlot.xMax, slot.xMax);
                consumedIndexes.add(index);
                changed = true;
            }
        }
    }

    return {
        slot: mergedSlot,
        slotIndexes: [...consumedIndexes].sort((a, b) => b - a)
    };
}

function previewVisualizationPlacement(slot, entry, maxLayers = Infinity) {
    if (slot.baseY + entry.itemHeight > truckDimensions3D.height - packingMetrics3D.floorY + packingMetrics3D.positionEpsilon) {
        return null;
    }

    const supportWidth = slot.xMax - slot.xMin;
    const supportDepth = slot.zMax - slot.zMin;
    let best = null;

    for (const orientation of getVisualizationOrientations(entry.itemWidth, entry.itemHeight, entry.itemDepth)) {
        if (orientation.width > supportWidth + packingMetrics3D.positionEpsilon || orientation.depth > supportDepth + packingMetrics3D.positionEpsilon) {
            continue;
        }
        if (slot.stackLevel + 1 > maxLayers) {
            continue;
        }

        const placement = {
            width: orientation.width,
            height: entry.itemHeight,
            depth: orientation.depth,
            rotated: orientation.rotated,
            y: slot.baseY + entry.itemHeight / 2,
            baseY: slot.baseY,
            layer: slot.baseY <= packingMetrics3D.floorY + packingMetrics3D.positionEpsilon ? 'fundo_chao' : 'fundo_empilhado',
            supportArea: supportWidth * supportDepth,
            wasteArea: supportWidth * supportDepth - orientation.width * orientation.depth,
            topY: slot.baseY + entry.itemHeight,
            stackLevel: slot.stackLevel + 1
        };

        if (!best || placement.wasteArea < best.wasteArea - packingMetrics3D.positionEpsilon) {
            best = placement;
        }
    }

    return best;
}

function getBestVisualizationAnchor(state, slot, placement) {
    const anchors = slot.baseY <= packingMetrics3D.floorY + packingMetrics3D.positionEpsilon
        ? getVisualizationAnchors(slot, placement)
        : [slot.zMin];
    let bestAnchor = null;

    anchors.forEach((anchorZMin) => {
        const layoutCandidate = buildVisualizationRemainders(slot, placement, anchorZMin);
        const remainderLayout = chooseBestVisualizationRemainder(layoutCandidate.layouts, state.minFloorSpan);
        const layoutScore = scoreVisualizationLayout(remainderLayout, state.minFloorSpan);
        const candidate = { ...layoutCandidate, remainders: remainderLayout, layoutScore };

        if (!bestAnchor) {
            bestAnchor = candidate;
            return;
        }

        if (layoutScore.unusableCount !== bestAnchor.layoutScore.unusableCount) {
            if (layoutScore.unusableCount < bestAnchor.layoutScore.unusableCount) {
                bestAnchor = candidate;
            }
            return;
        }

        if (Math.abs(layoutScore.maxSpan - bestAnchor.layoutScore.maxSpan) > packingMetrics3D.positionEpsilon) {
            if (layoutScore.maxSpan > bestAnchor.layoutScore.maxSpan) {
                bestAnchor = candidate;
            }
            return;
        }

        if (layoutScore.maxArea > bestAnchor.layoutScore.maxArea + packingMetrics3D.positionEpsilon) {
            bestAnchor = candidate;
        }
    });

    return bestAnchor;
}

function isBetterVisualizationFloor(current, best) {
    if (!best) return true;
    if (Math.abs(current.slot.xMax - best.slot.xMax) > packingMetrics3D.positionEpsilon) {
        return current.slot.xMax > best.slot.xMax;
    }
    if (current.anchorLayout.layoutScore.unusableCount !== best.anchorLayout.layoutScore.unusableCount) {
        return current.anchorLayout.layoutScore.unusableCount < best.anchorLayout.layoutScore.unusableCount;
    }
    if (Math.abs(current.anchorLayout.layoutScore.maxSpan - best.anchorLayout.layoutScore.maxSpan) > packingMetrics3D.positionEpsilon) {
        return current.anchorLayout.layoutScore.maxSpan > best.anchorLayout.layoutScore.maxSpan;
    }
    if (Math.abs(current.placement.supportArea - best.placement.supportArea) > packingMetrics3D.positionEpsilon) {
        return current.placement.supportArea > best.placement.supportArea;
    }
    return current.placement.wasteArea < best.placement.wasteArea - packingMetrics3D.positionEpsilon;
}

function isBetterVisualizationTop(current, best) {
    if (!best) return true;
    if (current.placement.stackLevel !== best.placement.stackLevel) {
        return current.placement.stackLevel < best.placement.stackLevel;
    }
    if (Math.abs(current.placement.supportArea - best.placement.supportArea) > packingMetrics3D.positionEpsilon) {
        return current.placement.supportArea > best.placement.supportArea;
    }
    if (Math.abs(current.placement.wasteArea - best.placement.wasteArea) > packingMetrics3D.positionEpsilon) {
        return current.placement.wasteArea < best.placement.wasteArea;
    }
    if (Math.abs(current.placement.topY - best.placement.topY) > packingMetrics3D.positionEpsilon) {
        return current.placement.topY < best.placement.topY;
    }
    return current.sameGroup && !best.sameGroup;
}

function findBestVisualizationFloor(state, entry) {
    let best = null;
    for (let slotIndex = 0; slotIndex < state.slots.length; slotIndex++) {
        const merged = buildMergedVisualizationSlot(state, slotIndex);
        const slot = merged.slot;
        if (slot.baseY > packingMetrics3D.floorY + packingMetrics3D.positionEpsilon) continue;
        const placement = previewVisualizationPlacement(slot, entry);
        if (!placement) continue;
        const candidate = { slotIndexes: merged.slotIndexes, slot, placement, anchorLayout: getBestVisualizationAnchor(state, slot, placement) };
        if (candidate.anchorLayout && isBetterVisualizationFloor(candidate, best)) {
            best = candidate;
        }
    }
    return best;
}

function findBestVisualizationTop(state, entry, maxLayers = Infinity) {
    let best = null;
    for (let slotIndex = 0; slotIndex < state.slots.length; slotIndex++) {
        const merged = buildMergedVisualizationSlot(state, slotIndex);
        const slot = merged.slot;
        if (slot.baseY <= packingMetrics3D.floorY + packingMetrics3D.positionEpsilon) continue;
        const placement = previewVisualizationPlacement(slot, entry, maxLayers);
        if (!placement) continue;
        const candidate = {
            slotIndexes: merged.slotIndexes,
            slot,
            placement,
            anchorLayout: getBestVisualizationAnchor(state, slot, placement),
            sameGroup: slot.groupKey === entry.groupKey
        };
        if (isBetterVisualizationTop(candidate, best)) {
            best = candidate;
        }
    }
    return best;
}

function placeVisualizationCandidate(state, candidate, groupKey) {
    const slot = candidate.slot;
    const slotIndexes = Array.isArray(candidate.slotIndexes) ? candidate.slotIndexes : [];
    slotIndexes.forEach((index) => {
        state.slots.splice(index, 1);
    });
    const anchor = candidate.anchorLayout || getBestVisualizationAnchor(state, slot, candidate.placement);
    if (!anchor) return null;

    anchor.remainders.forEach((remainder) => state.slots.push(remainder));

    const nextStackLevel = slot.stackLevel + 1;
    if (slot.baseY + candidate.placement.height < truckDimensions3D.height - packingMetrics3D.floorY - packingMetrics3D.positionEpsilon) {
        state.slots.push({
            xMin: anchor.usedXMin,
            xMax: anchor.usedXMax,
            zMin: anchor.usedZMin,
            zMax: anchor.usedZMax,
            baseY: slot.baseY + candidate.placement.height,
            stackLevel: nextStackLevel,
            groupKey
        });
    }

    if (slot.baseY <= packingMetrics3D.floorY + packingMetrics3D.positionEpsilon && slot.groupKey === state.floorGroupKey) {
        state.currentBlockFrontEdgeX = Math.min(state.currentBlockFrontEdgeX, anchor.usedXMin);
    }

    return {
        x: (anchor.usedXMin + anchor.usedXMax) / 2,
        y: candidate.placement.y,
        z: (anchor.usedZMin + anchor.usedZMax) / 2,
        width: candidate.placement.width,
        height: candidate.placement.height,
        depth: candidate.placement.depth,
        rotated: candidate.placement.rotated,
        layer: candidate.placement.layer,
        stackLevel: candidate.placement.stackLevel
    };
}

function buildVisualizationState(block, rearX, frontX, carriedSlots = []) {
    const floorGroupKey = `__floor__:${block.clientKey}`;
    return {
        currentBlockFrontEdgeX: rearX,
        minFloorSpan: block.minFloorSpan,
        largeFootprintThreshold: Math.max(block.averageFootprint * 1.15, block.maxFootprint * 0.55),
        floorGroupKey,
        slots: [
            ...carriedSlots.map((slot) => ({ ...slot })),
            {
                xMin: frontX,
                xMax: rearX,
                zMin: packingMetrics3D.minZ,
                zMax: packingMetrics3D.maxZ,
                baseY: packingMetrics3D.floorY,
                stackLevel: 0,
                groupKey: floorGroupKey
            }
        ]
    };
}

function buildVisualizationEntries(block) {
    const entries = [];
    block.groups.forEach((group) => {
        group.items.forEach((item) => {
            entries.push({
                item,
                groupKey: group.key,
                itemWidth: group.itemWidth,
                itemHeight: group.itemHeight,
                itemDepth: group.itemDepth,
                footprint: group.footprint,
                volume: group.volume
            });
        });
    });

    return entries.sort((a, b) => b.footprint - a.footprint || b.volume - a.volume || b.itemHeight - a.itemHeight);
}

function chooseVisualizationPlacement(state, entry, compactMode = false, aggressiveMode = false) {
    const floorCandidate = findBestVisualizationFloor(state, entry);
    const topCandidate = findBestVisualizationTop(state, entry, compactMode || aggressiveMode ? Infinity : 4);
    const isLargeItem = entry.footprint >= state.largeFootprintThreshold - packingMetrics3D.positionEpsilon;

    if (floorCandidate && topCandidate) {
        if (isLargeItem) {
            return placeVisualizationCandidate(state, floorCandidate, entry.groupKey);
        }

        const floorExpandsFront = floorCandidate.anchorLayout.usedXMin < state.currentBlockFrontEdgeX - packingMetrics3D.positionEpsilon;
        const floorFragmentsBadly = floorCandidate.anchorLayout.layoutScore.unusableCount > 0;
        const topUsesUpperSpace = topCandidate.placement.supportArea > (entry.itemWidth * entry.itemDepth) + packingMetrics3D.positionEpsilon;
        const topFillsBroaderBase = topCandidate.placement.supportArea > floorCandidate.placement.supportArea + packingMetrics3D.positionEpsilon;

        if ((aggressiveMode && floorExpandsFront) || (topUsesUpperSpace && (floorExpandsFront || floorFragmentsBadly || topFillsBroaderBase))) {
            return placeVisualizationCandidate(state, topCandidate, entry.groupKey);
        }

        return placeVisualizationCandidate(state, floorCandidate, entry.groupKey);
    }

    return floorCandidate
        ? placeVisualizationCandidate(state, floorCandidate, entry.groupKey)
        : topCandidate
            ? placeVisualizationCandidate(state, topCandidate, entry.groupKey)
            : null;
}

function evaluateVisualizationResult(candidate, best) {
    if (!best) return true;
    if (candidate.placements.length !== best.placements.length) {
        return candidate.placements.length > best.placements.length;
    }
    if ((candidate.layerStats.fundo_chao || 0) !== (best.layerStats.fundo_chao || 0)) {
        return (candidate.layerStats.fundo_chao || 0) > (best.layerStats.fundo_chao || 0);
    }
    if (candidate.maxStackLevel !== best.maxStackLevel) {
        return candidate.maxStackLevel < best.maxStackLevel;
    }
    return (candidate.layerStats.fundo_empilhado || 0) < (best.layerStats.fundo_empilhado || 0);
}

function packVisualizationItems(items) {
    const blocks = buildVisualizationBlocks(items);

    const runPacking = (compactMode = false, aggressiveMode = false) => {
        const placements = [];
        const layerStats = { fundo_chao: 0, fundo_empilhado: 0 };
        let totalEffectiveVolume = 0;
        let maxStackLevel = 0;
        let currentRearX = packingMetrics3D.rearX;
        let carriedTopSlots = [];
        const orderGap = aggressiveMode ? Math.min(packingMetrics3D.orderGap, 0.005) : compactMode ? Math.min(packingMetrics3D.orderGap, 0.015) : packingMetrics3D.orderGap;

        for (const block of blocks) {
            const remainingBlocks = blocks.slice(blocks.indexOf(block) + 1);
            const reserveForRemaining = remainingBlocks.reduce((sum, remainingBlock) => sum + remainingBlock.minimalLength, 0) + orderGap * remainingBlocks.length;
            const frontLimit = Math.max(
                packingMetrics3D.minX,
                currentRearX - Math.max(block.minimalLength, currentRearX - packingMetrics3D.minX - reserveForRemaining)
            );
            const state = buildVisualizationState(block, currentRearX, frontLimit, carriedTopSlots);
            const entries = buildVisualizationEntries(block);

            entries.forEach((entry) => {
                const position = chooseVisualizationPlacement(state, entry, compactMode, aggressiveMode);
                if (!position) return;

                placements.push({ item: entry.item, position });
                totalEffectiveVolume += position.width * position.height * position.depth;
                layerStats[position.layer] = (layerStats[position.layer] || 0) + 1;
                maxStackLevel = Math.max(maxStackLevel, position.stackLevel || 0);
            });

            carriedTopSlots = state.slots
                .filter((slot) => slot.baseY > packingMetrics3D.floorY + packingMetrics3D.positionEpsilon)
                .map((slot) => ({ ...slot }));

            currentRearX = state.currentBlockFrontEdgeX - orderGap;
        }

        return { placements, layerStats, totalEffectiveVolume, maxStackLevel };
    };

    let best = runPacking(false, false);
    const compact = runPacking(true, false);
    if (evaluateVisualizationResult(compact, best)) {
        best = compact;
    }
    const aggressive = runPacking(true, true);
    if (evaluateVisualizationResult(aggressive, best)) {
        best = aggressive;
    }

    return best;
}

function attachSpatialValidationToPayload(payload) {
    const allocation = normalizeAllocationFromPayload(payload);
    if (!allocation) {
        return payload;
    }

    const totalTruckUnits = allocation.trucks.reduce((sum, truck) => sum + Number(truck.quantity || 0), 0);
    if (allocation.trucks.length !== 1 || totalTruckUnits !== 1) {
        payload.spatialValidation = { checked: false, fits: Boolean(allocation.fits) };
        return payload;
    }

    const items = buildVisualizationItems();
    if (!items.length) {
        payload.spatialValidation = { checked: false, fits: Boolean(allocation.fits) };
        return payload;
    }

    const previousTruckDimensions = { ...truckDimensions3D };
    const previousMetrics = packingMetrics3D ? { ...packingMetrics3D } : null;
    const validationTruck = resolveVisualizationTruckConfigFromAllocation(allocation);

    truckDimensions3D = validationTruck;
    syncVisualizationTruckMetrics();
    const packingResult = packVisualizationItems(items);

    truckDimensions3D = previousTruckDimensions;
    packingMetrics3D = previousMetrics;

    const missingCount = Math.max(0, items.length - packingResult.placements.length);
    payload.spatialValidation = {
        checked: true,
        fits: missingCount === 0,
        placedCount: packingResult.placements.length,
        totalCount: items.length,
        missingCount,
        truckName: validationTruck.name || 'Caminhão'
    };

    if (missingCount > 0 && payload.allocation) {
        payload.allocation = {
            ...payload.allocation,
            fits: false
        };
    }

    return payload;
}

function syncVisualization3DPanel() {
    if (!toggle3DBtn || !toggle3DText || !visualization3DHelper || !visualization3DContainer || !launchOrder3DIframe) return;

    const totalUnits = state.cargoItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const distinctItems = state.cargoItems.length;
    const clientCount = new Set(state.cargoItems.map((item) => item.clientName).filter(Boolean)).size;

    if (!totalUnits) {
        toggle3DBtn.disabled = true;
        toggle3DText.textContent = 'Mostrar 3D';
        visualization3DHelper.textContent = 'Adicione itens para liberar a previa 3D da carga.';
        visualization3DContainer.classList.add('hidden');
        launchOrder3DIframe.src = 'about:blank';
        isVisualization3DVisible = false;
        return;
    }

    toggle3DBtn.disabled = false;
    visualization3DHelper.textContent = `${totalUnits} volumes, ${distinctItems} itens cadastrados e ${Math.max(clientCount, 1)} cliente(s) na carga.`;

    if (isVisualization3DVisible) {
        const previewUrl = prepareCurrentLoad3DPreview();
        if (previewUrl) {
            launchOrder3DIframe.src = previewUrl;
        }
    }
}

// Event listeners para visualização 3D estática
document.addEventListener('DOMContentLoaded', () => {
    if (toggle3DBtn && launchOrder3DIframe) {
        toggle3DBtn.addEventListener('click', () => {
            if (!visualization3DContainer || toggle3DBtn.disabled) {
                return;
            }

            if (visualization3DContainer.classList.contains('hidden')) {
                const previewUrl = prepareCurrentLoad3DPreview();
                if (!previewUrl) return;
                visualization3DContainer.classList.remove('hidden');
                toggle3DText.textContent = 'Ocultar 3D';
                isVisualization3DVisible = true;
                launchOrder3DIframe.src = previewUrl;
            } else {
                visualization3DContainer.classList.add('hidden');
                toggle3DText.textContent = 'Mostrar 3D';
                launchOrder3DIframe.src = 'about:blank';
                isVisualization3DVisible = false;
            }
        });
    }

    syncVisualization3DPanel();
});

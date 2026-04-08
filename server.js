const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const MAX_JSON_PAYLOAD_BYTES = 1_000_000;
const LOGIN_WINDOW_MS = 1000 * 60 * 15;
const LOGIN_MAX_ATTEMPTS = 8;
const API_READ_WINDOW_MS = 1000 * 60 * 5;
const API_READ_MAX_REQUESTS = 600;
const API_WRITE_WINDOW_MS = 1000 * 60 * 5;
const API_WRITE_MAX_REQUESTS = 180;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_PATH = path.join(__dirname, 'database.sqlite');
const AVAILABLE_MODULES = [
  { key: 'loading3d', label: 'Carregamento 3D' }
];
const MODULE_KEYS = new Set(AVAILABLE_MODULES.map((module) => module.key));
const PLATFORM_ADMIN_EMAIL = 'master@granilha.local';
const PLATFORM_ADMIN_PASSWORD = 'Master@123456';
const DEFAULT_COMPANY_NAME = 'Empresa Padrao';

const db = new DatabaseSync(DB_PATH);
const sessions = new Map();
const loginAttempts = new Map();
const apiRateLimits = new Map();

initDb();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (url.pathname.startsWith('/api/')) {
      if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) {
        sendText(res, 405, 'Método não permitido.');
        return;
      }

      await handleApi(req, res, url);
      return;
    }

    if (!['GET', 'HEAD'].includes(method)) {
      sendText(res, 405, 'Método não permitido.');
      return;
    }

    serveStaticFile(res, url.pathname, method);
  } catch (error) {
    console.error(error);
    if (error?.message === 'Payload muito grande.') {
      sendJson(res, 413, { error: error.message });
      return;
    }

    if (error?.message === 'JSON inválido.' || error?.message === 'Content-Type inválido.') {
      sendJson(res, 400, { error: error.message });
      return;
    }

    sendJson(res, 500, { error: 'Erro interno no servidor.' });
  }
});

server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;

server.listen(PORT, () => {
  console.log(`Servidor iniciado em http://localhost:${PORT}`);
});

setInterval(() => {
  const now = Date.now();

  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }

  for (const [ip, current] of loginAttempts.entries()) {
    if ((current.blockedUntil || current.windowStartedAt) + LOGIN_WINDOW_MS <= now) {
      loginAttempts.delete(ip);
    }
  }

  for (const [key, current] of apiRateLimits.entries()) {
    if (current.resetAt <= now) {
      apiRateLimits.delete(key);
    }
  }
}, 60_000).unref();

function initDb() {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      document TEXT,
      billing_amount REAL NOT NULL DEFAULT 0,
      billing_due_day INTEGER,
      payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'overdue')),
      last_payment_date TEXT,
      notes TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS company_modules (
      company_id INTEGER NOT NULL,
      module_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (company_id, module_key),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
      is_platform_admin INTEGER NOT NULL DEFAULT 0 CHECK(is_platform_admin IN (0, 1)),
      company_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_modules (
      user_id INTEGER NOT NULL,
      module_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, module_key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS can_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      email TEXT,
      phone TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      cnpj_cpf TEXT,
      contact_person TEXT,
      notes TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
      total_orders INTEGER DEFAULT 0,
      total_spent REAL DEFAULT 0.0,
      last_order_date TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS client_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      order_date TEXT NOT NULL,
      total_items INTEGER NOT NULL,
      total_volume_cm3 REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'delivered', 'cancelled')),
      delivery_date TEXT,
      delivery_address TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER,
      shape TEXT NOT NULL CHECK(shape IN ('square', 'cylinder', 'container')),
      length_cm REAL,
      width_cm REAL,
      depth_cm REAL,
      diameter_cm REAL,
      height_cm REAL NOT NULL,
      volume_cm3 REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trucks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      length_cm REAL NOT NULL,
      width_cm REAL NOT NULL,
      height_cm REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      volume_cm3 REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_by_user_id INTEGER NOT NULL,
      created_by_name TEXT NOT NULL,
      scheduled_date TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT NOT NULL CHECK(status IN ('open', 'completed')) DEFAULT 'open',
      total_cans INTEGER NOT NULL,
      total_volume_cm3 REAL NOT NULL,
      completed_at TEXT,
      completed_by_user_id INTEGER,
      completed_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      client_name TEXT,
      can_id INTEGER,
      can_name TEXT NOT NULL,
      can_shape TEXT NOT NULL CHECK(can_shape IN ('square', 'cylinder', 'container')),
      quantity INTEGER NOT NULL,
      unit_volume_cm3 REAL NOT NULL,
      total_volume_cm3 REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_trucks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      truck_id INTEGER NOT NULL,
      truck_name TEXT NOT NULL,
      quantity_reserved INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_trucks_order_id ON order_trucks(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_trucks_truck_id ON order_trucks(truck_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_order_trucks_order_truck ON order_trucks(order_id, truck_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_can_categories_name ON can_categories(name);
    CREATE INDEX IF NOT EXISTS idx_cans_category_id ON cans(category_id);
    CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
    CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
    CREATE INDEX IF NOT EXISTS idx_client_orders_client_id ON client_orders(client_id);
    CREATE INDEX IF NOT EXISTS idx_client_orders_order_id ON client_orders(order_id);
    CREATE INDEX IF NOT EXISTS idx_client_orders_status ON client_orders(status);
    CREATE INDEX IF NOT EXISTS idx_client_orders_order_date ON client_orders(order_date);
    CREATE INDEX IF NOT EXISTS idx_user_modules_module_key ON user_modules(module_key);
    CREATE INDEX IF NOT EXISTS idx_company_modules_module_key ON company_modules(module_key);
  `);

  ensureOrderSchemaCompatibility();
  ensureUserAccessSchemaCompatibility();
  ensureCompanySchemaCompatibility();
  normalizeCanNominalVolumes();

  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (!userCount) {
    db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run('Administrador', 'admin@granilha.local', hashPassword('admin123'), 'admin');
  }

  const truckCount = db.prepare('SELECT COUNT(*) AS count FROM trucks').get().count;
  // Caminhões padrão não serão mais adicionados automaticamente

  const canCount = db.prepare('SELECT COUNT(*) AS count FROM cans').get().count;
  // Produtos padrao nao serao mais adicionados automaticamente

  ensurePlatformAdminUser();
}

function ensureOrderSchemaCompatibility() {
  const orderColumns = db.prepare('PRAGMA table_info(orders)').all();
  const hasScheduledDate = orderColumns.some((column) => column.name === 'scheduled_date');
  const hasStartDate = orderColumns.some((column) => column.name === 'start_date');
  const hasEndDate = orderColumns.some((column) => column.name === 'end_date');

  if (!hasScheduledDate) {
    db.exec('ALTER TABLE orders ADD COLUMN scheduled_date TEXT;');
    db.exec("UPDATE orders SET scheduled_date = date(created_at) WHERE scheduled_date IS NULL OR scheduled_date = '';");
  }

  if (!hasStartDate) {
    db.exec('ALTER TABLE orders ADD COLUMN start_date TEXT;');
  }

  if (!hasEndDate) {
    db.exec('ALTER TABLE orders ADD COLUMN end_date TEXT;');
  }

  db.exec(`
    UPDATE orders
    SET start_date = COALESCE(NULLIF(start_date, ''), NULLIF(scheduled_date, ''), date(created_at))
    WHERE start_date IS NULL OR start_date = '';
  `);
  db.exec(`
    UPDATE orders
    SET end_date = COALESCE(NULLIF(end_date, ''), NULLIF(scheduled_date, ''), date(created_at))
    WHERE end_date IS NULL OR end_date = '';
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_orders_scheduled_date ON orders(scheduled_date);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_orders_start_date ON orders(start_date);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_orders_end_date ON orders(end_date);');

  const truckColumns = db.prepare('PRAGMA table_info(trucks)').all();
  const hasTruckQuantity = truckColumns.some((column) => column.name === 'quantity');
  if (!hasTruckQuantity) {
    db.exec('ALTER TABLE trucks ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;');
    db.exec("UPDATE trucks SET quantity = 1 WHERE quantity IS NULL OR quantity <= 0;");
  }

  const orderTruckColumns = db.prepare('PRAGMA table_info(order_trucks)').all();
  const hasReservedQuantity = orderTruckColumns.some((column) => column.name === 'quantity_reserved');
  if (!hasReservedQuantity) {
    db.exec('ALTER TABLE order_trucks ADD COLUMN quantity_reserved INTEGER NOT NULL DEFAULT 1;');
    db.exec("UPDATE order_trucks SET quantity_reserved = 1 WHERE quantity_reserved IS NULL OR quantity_reserved <= 0;");
  }

  const orderItemColumns = db.prepare('PRAGMA table_info(order_items)').all();
  const hasClientName = orderItemColumns.some((column) => column.name === 'client_name');
  
  if (!hasClientName) {
    db.exec('ALTER TABLE order_items ADD COLUMN client_name TEXT;');
  }

  // Verificar e criar tabela de categorias se não existir
  const categoryTableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='can_categories'
  `).get();
  
  if (!categoryTableExists) {
    db.exec(`
      CREATE TABLE can_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_can_categories_name ON can_categories(name);');
  }

  // Verificar e adicionar category_id na tabela cans
  const canColumns = db.prepare('PRAGMA table_info(cans)').all();
  const hasCategoryId = canColumns.some((column) => column.name === 'category_id');
  
  if (!hasCategoryId) {
    db.exec('ALTER TABLE cans ADD COLUMN category_id INTEGER;');
    db.exec('CREATE INDEX IF NOT EXISTS idx_cans_category_id ON cans(category_id);');
  }

  // Verificar e criar tabela de clientes se não existir
  const clientTableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='clients'
  `).get();
  
  if (!clientTableExists) {
    db.exec(`
      CREATE TABLE clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);');
  }

  // Verificar e adicionar colunas na tabela clients
  const clientColumns = db.prepare('PRAGMA table_info(clients)').all();
  const hasEmail = clientColumns.some((column) => column.name === 'email');
  
  if (!hasEmail) {
    db.exec('ALTER TABLE clients ADD COLUMN email TEXT;');
    db.exec('ALTER TABLE clients ADD COLUMN phone TEXT;');
    db.exec('ALTER TABLE clients ADD COLUMN address TEXT;');
    db.exec('ALTER TABLE clients ADD COLUMN city TEXT;');
    db.exec('ALTER TABLE clients ADD COLUMN state TEXT;');
    db.exec('ALTER TABLE clients ADD COLUMN cnpj_cpf TEXT;');
    db.exec('ALTER TABLE clients ADD COLUMN contact_person TEXT;');
    db.exec('ALTER TABLE clients ADD COLUMN notes TEXT;');
    db.exec('ALTER TABLE clients ADD COLUMN status TEXT DEFAULT "active" CHECK(status IN ("active", "inactive", "suspended"));');
    db.exec('ALTER TABLE clients ADD COLUMN total_orders INTEGER DEFAULT 0;');
    db.exec('ALTER TABLE clients ADD COLUMN total_spent REAL DEFAULT 0.0;');
    db.exec('ALTER TABLE clients ADD COLUMN last_order_date TEXT;');
    db.exec('ALTER TABLE clients ADD COLUMN updated_at TEXT;');
    db.exec("UPDATE clients SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = '';");
    db.exec('CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);');
  }

  // Verificar e criar tabela de pedidos de clientes
  const clientOrdersTableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='client_orders'
  `).get();
  
  if (!clientOrdersTableExists) {
    db.exec(`
      CREATE TABLE client_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        order_id INTEGER NOT NULL,
        order_date TEXT NOT NULL,
        total_items INTEGER NOT NULL,
        total_volume_cm3 REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'delivered', 'cancelled')),
        delivery_date TEXT,
        delivery_address TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_client_orders_client_id ON client_orders(client_id);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_client_orders_order_id ON client_orders(order_id);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_client_orders_status ON client_orders(status);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_client_orders_order_date ON client_orders(order_date);');
  }
}

function ensureUserAccessSchemaCompatibility() {
  const userColumns = db.prepare('PRAGMA table_info(users)').all();
  const hasIsActive = userColumns.some((column) => column.name === 'is_active');

  if (!hasIsActive) {
    db.exec('ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1));');
  }

  const users = db.prepare('SELECT id, role FROM users').all();
  for (const user of users) {
    const existingModules = getUserModules(user.id);
    const validModules = normalizeModuleKeys(existingModules);
    const modules = user.role === 'admin'
      ? getDefaultModulesForRole(user.role)
      : (validModules.length ? validModules : getDefaultModulesForRole(user.role));

    if (modules.length !== existingModules.length || modules.some((moduleKey, index) => moduleKey !== existingModules[index])) {
      replaceUserModules(user.id, modules);
    }
  }
}

function ensureCompanySchemaCompatibility() {
  const companyColumns = db.prepare('PRAGMA table_info(companies)').all();
  if (!companyColumns.some((column) => column.name === 'contact_name')) {
    db.exec('ALTER TABLE companies ADD COLUMN contact_name TEXT;');
  }
  if (!companyColumns.some((column) => column.name === 'contact_email')) {
    db.exec('ALTER TABLE companies ADD COLUMN contact_email TEXT;');
  }
  if (!companyColumns.some((column) => column.name === 'contact_phone')) {
    db.exec('ALTER TABLE companies ADD COLUMN contact_phone TEXT;');
  }
  if (!companyColumns.some((column) => column.name === 'document')) {
    db.exec('ALTER TABLE companies ADD COLUMN document TEXT;');
  }
  if (!companyColumns.some((column) => column.name === 'billing_amount')) {
    db.exec('ALTER TABLE companies ADD COLUMN billing_amount REAL NOT NULL DEFAULT 0;');
  }
  if (!companyColumns.some((column) => column.name === 'billing_due_day')) {
    db.exec('ALTER TABLE companies ADD COLUMN billing_due_day INTEGER;');
  }
  if (!companyColumns.some((column) => column.name === 'payment_status')) {
    db.exec('ALTER TABLE companies ADD COLUMN payment_status TEXT NOT NULL DEFAULT "pending" CHECK(payment_status IN ("pending", "paid", "overdue"));');
  }
  if (!companyColumns.some((column) => column.name === 'last_payment_date')) {
    db.exec('ALTER TABLE companies ADD COLUMN last_payment_date TEXT;');
  }
  if (!companyColumns.some((column) => column.name === 'notes')) {
    db.exec('ALTER TABLE companies ADD COLUMN notes TEXT;');
  }
  if (!companyColumns.some((column) => column.name === 'updated_at')) {
    db.exec('ALTER TABLE companies ADD COLUMN updated_at TEXT;');
    db.exec("UPDATE companies SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = '';");
  }

  const userColumns = db.prepare('PRAGMA table_info(users)').all();
  if (!userColumns.some((column) => column.name === 'company_id')) {
    db.exec('ALTER TABLE users ADD COLUMN company_id INTEGER;');
  }
  if (!userColumns.some((column) => column.name === 'is_platform_admin')) {
    db.exec('ALTER TABLE users ADD COLUMN is_platform_admin INTEGER NOT NULL DEFAULT 0 CHECK(is_platform_admin IN (0, 1));');
  }

  const tablesToScope = ['can_categories', 'clients', 'cans', 'trucks', 'orders'];
  for (const tableName of tablesToScope) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    if (!columns.some((column) => column.name === 'company_id')) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN company_id INTEGER;`);
    }
  }

  const defaultCompanyId = ensureDefaultCompany();
  const defaultCompanyModules = getDefaultModulesForRole('admin');
  replaceCompanyModules(defaultCompanyId, defaultCompanyModules);

  db.prepare('UPDATE users SET company_id = ? WHERE company_id IS NULL AND COALESCE(is_platform_admin, 0) = 0').run(defaultCompanyId);
  db.prepare('UPDATE can_categories SET company_id = ? WHERE company_id IS NULL').run(defaultCompanyId);
  db.prepare('UPDATE clients SET company_id = ? WHERE company_id IS NULL').run(defaultCompanyId);
  db.prepare('UPDATE cans SET company_id = ? WHERE company_id IS NULL').run(defaultCompanyId);
  db.prepare('UPDATE trucks SET company_id = ? WHERE company_id IS NULL').run(defaultCompanyId);
  db.prepare('UPDATE orders SET company_id = ? WHERE company_id IS NULL').run(defaultCompanyId);
}

function ensureDefaultCompany() {
  const existing = db.prepare('SELECT id FROM companies ORDER BY id ASC LIMIT 1').get();
  if (existing) {
    return Number(existing.id);
  }

  const result = db.prepare(`
    INSERT INTO companies (name, status)
    VALUES (?, 'active')
  `).run(DEFAULT_COMPANY_NAME);
  return Number(result.lastInsertRowid);
}

function ensurePlatformAdminUser() {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(PLATFORM_ADMIN_EMAIL);
  if (existing) {
    db.prepare('UPDATE users SET role = ?, is_active = 1, is_platform_admin = 1, company_id = NULL WHERE id = ?')
      .run('admin', existing.id);
    return;
  }

  db.prepare(`
    INSERT INTO users (name, email, password_hash, role, is_active, is_platform_admin, company_id)
    VALUES (?, ?, ?, ?, 1, 1, NULL)
  `).run('Master Plataforma', PLATFORM_ADMIN_EMAIL, hashPassword(PLATFORM_ADMIN_PASSWORD), 'admin');
}

function normalizeCanNominalVolumes() {
  const cans = db.prepare('SELECT id, name, volume_cm3 FROM cans').all();
  const updateVolume = db.prepare('UPDATE cans SET volume_cm3 = ? WHERE id = ?');

  for (const can of cans) {
    const inferredVolumeCm3 = inferCommercialVolumeCm3(can.name);
    if (!(inferredVolumeCm3 > 0)) {
      continue;
    }

    if (Math.abs(Number(can.volume_cm3 || 0) - inferredVolumeCm3) > 0.5) {
      updateVolume.run(inferredVolumeCm3, can.id);
    }
  }
}

function inferCommercialVolumeCm3(nameInput) {
  const name = String(nameInput || '').toUpperCase();
  if (!name) return null;

  const slashMlMatch = name.match(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*ML/);
  if (slashMlMatch) {
    const first = Number(slashMlMatch[1].replace(',', '.'));
    const second = Number(slashMlMatch[2].replace(',', '.'));
    const valueMl = Math.max(first, second);
    return Number.isFinite(valueMl) && valueMl > 0 ? valueMl : null;
  }

  const matches = [...name.matchAll(/(\d+(?:[.,]\d+)?)\s*(ML|LT|L)\b/g)];
  if (!matches.length) return null;

  const volumesCm3 = matches
    .map((match) => {
      const value = Number(match[1].replace(',', '.'));
      const unit = match[2];
      if (!Number.isFinite(value) || value <= 0) return null;
      if (unit === 'ML') return value;
      return value * 1000;
    })
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!volumesCm3.length) return null;
  return Math.max(...volumesCm3);
}

function getDefaultModulesForRole(role) {
  if (role === 'admin') {
    return AVAILABLE_MODULES.map((module) => module.key);
  }

  return ['loading3d'];
}

function normalizeModuleKeys(modules) {
  const input = Array.isArray(modules) ? modules : [];
  const unique = new Set();

  for (const moduleKey of input) {
    const normalized = String(moduleKey || '').trim();
    if (MODULE_KEYS.has(normalized)) {
      unique.add(normalized);
    }
  }

  return Array.from(unique);
}

function getModulesForPersistence(role, modules) {
  if (role === 'admin') {
    return getDefaultModulesForRole(role);
  }

  const normalizedModules = normalizeModuleKeys(modules);
  return normalizedModules.length ? normalizedModules : getDefaultModulesForRole(role);
}

function getUserModules(userId) {
  return db.prepare(`
    SELECT module_key
    FROM user_modules
    WHERE user_id = ?
    ORDER BY module_key ASC
  `).all(userId).map((row) => row.module_key);
}

function getCompanyModules(companyId) {
  if (!companyId) return [];
  return db.prepare(`
    SELECT module_key
    FROM company_modules
    WHERE company_id = ?
    ORDER BY module_key ASC
  `).all(companyId).map((row) => row.module_key);
}

function replaceUserModules(userId, modules) {
  const normalizedModules = normalizeModuleKeys(modules);
  const deleteModules = db.prepare('DELETE FROM user_modules WHERE user_id = ?');
  const insertModule = db.prepare(`
    INSERT OR IGNORE INTO user_modules (user_id, module_key)
    VALUES (?, ?)
  `);
  deleteModules.run(userId);
  for (const moduleKey of normalizedModules) {
    insertModule.run(userId, moduleKey);
  }
}

function replaceCompanyModules(companyId, modules) {
  const normalizedModules = normalizeModuleKeys(modules);
  const deleteModules = db.prepare('DELETE FROM company_modules WHERE company_id = ?');
  const insertModule = db.prepare(`
    INSERT OR IGNORE INTO company_modules (company_id, module_key)
    VALUES (?, ?)
  `);
  deleteModules.run(companyId);
  for (const moduleKey of normalizedModules) {
    insertModule.run(companyId, moduleKey);
  }
}

function userHasModule(user, moduleKey) {
  if (!user || !moduleKey) return false;
  if (isPlatformAdmin(user)) return true;
  const safe = safeUser(user);
  return Array.isArray(safe.modules) && safe.modules.includes(moduleKey);
}

function getTargetCompanyId(currentUser, requestedCompanyId = null) {
  if (isPlatformAdmin(currentUser) && requestedCompanyId) {
    return Number(requestedCompanyId);
  }

  return Number(currentUser.company_id || 0);
}

async function handleApi(req, res, url) {
  const method = req.method || 'GET';
  const canIdMatch = url.pathname.match(/^\/api\/cans\/(\d+)$/);
  const clientIdMatch = url.pathname.match(/^\/api\/clients\/(\d+)$/);
  const truckIdMatch = url.pathname.match(/^\/api\/trucks\/(\d+)$/);
  const userIdMatch = url.pathname.match(/^\/api\/users\/(\d+)$/);
  const companyIdMatch = url.pathname.match(/^\/api\/platform\/companies\/(\d+)$/);
  const orderIdMatch = url.pathname.match(/^\/api\/orders\/(\d+)$/);
  const orderConcludeMatch = url.pathname.match(/^\/api\/orders\/(\d+)\/conclude$/);

  if (!enforceApiRateLimit(req, res, method)) {
    return;
  }

  if (method === 'POST' && url.pathname === '/api/login') {
    if (!isSameOriginRequest(req)) {
      return sendJson(res, 403, { error: 'Origem da requisição não permitida.' });
    }
    ensureJsonRequest(req);
    const body = await readJson(req);
    return login(req, res, body);
  }

  if (['POST', 'PUT', 'DELETE'].includes(method) && !isSameOriginRequest(req)) {
    return sendJson(res, 403, { error: 'Origem da requisição não permitida.' });
  }

  if (['POST', 'PUT'].includes(method)) {
    ensureJsonRequest(req);
  }

  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    const csrfCheck = requireCsrf(req, res);
    if (!csrfCheck) return;
  }

  if (method === 'POST' && url.pathname === '/api/logout') {
    return logout(req, res);
  }

  if (method === 'GET' && url.pathname === '/api/me') {
    const session = requireSession(req, res);
    if (!session) return;
    return sendJson(res, 200, {
      user: safeUser(session.user),
      availableModules: AVAILABLE_MODULES,
      csrfToken: session.session.csrfToken
    });
  }

  if (method === 'GET' && url.pathname === '/api/platform/companies') {
    const user = requirePlatformAdmin(req, res);
    if (!user) return;
    return listPlatformCompanies(res);
  }

  if (method === 'POST' && url.pathname === '/api/platform/companies') {
    const user = requirePlatformAdmin(req, res);
    if (!user) return;
    const body = await readJson(req);
    return createCompany(res, body);
  }

  if (companyIdMatch && method === 'PUT') {
    const user = requirePlatformAdmin(req, res);
    if (!user) return;
    const body = await readJson(req);
    return updateCompany(res, Number(companyIdMatch[1]), body);
  }

  if (method === 'GET' && url.pathname === '/api/cans') {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!userHasModule(user, 'loading3d')) {
      return sendJson(res, 403, { error: 'Seu usuario nao possui acesso a este modulo.' });
    }
    const cans = db.prepare(`
      SELECT c.*, cat.name as category_name 
      FROM cans c 
      LEFT JOIN can_categories cat ON c.category_id = cat.id 
      WHERE c.company_id = ?
      ORDER BY c.created_at DESC
    `).all(getTargetCompanyId(user));
    return sendJson(res, 200, { cans });
  }

  if (method === 'GET' && url.pathname === '/api/clients') {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!userHasModule(user, 'loading3d')) {
      return sendJson(res, 403, { error: 'Seu usuario nao possui acesso a este modulo.' });
    }
    const clients = db.prepare('SELECT * FROM clients WHERE company_id = ? ORDER BY name ASC').all(getTargetCompanyId(user));
    return sendJson(res, 200, { clients });
  }

  if (method === 'POST' && url.pathname === '/api/clients') {
    const user = requireCompanyModuleAccess(req, res, 'loading3d');
    if (!user) return;
    const body = await readJson(req);
    return createClient(user, res, body);
  }

  if (clientIdMatch && method === 'PUT') {
    const user = requireCompanyModuleAccess(req, res, 'loading3d');
    if (!user) return;
    const body = await readJson(req);
    return updateClient(user, res, Number(clientIdMatch[1]), body);
  }

  if (clientIdMatch && method === 'DELETE') {
    const user = requireCompanyModuleAccess(req, res, 'loading3d');
    if (!user) return;
    return deleteClient(user, res, Number(clientIdMatch[1]));
  }

  if (method === 'GET' && url.pathname === '/api/can-categories') {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!userHasModule(user, 'loading3d')) {
      return sendJson(res, 403, { error: 'Seu usuario nao possui acesso a este modulo.' });
    }
    const categories = db.prepare('SELECT * FROM can_categories WHERE company_id = ? ORDER BY name ASC').all(getTargetCompanyId(user));
    return sendJson(res, 200, { categories });
  }

  if (method === 'POST' && url.pathname === '/api/can-categories') {
    const user = requireCompanyModuleAccess(req, res, 'loading3d');
    if (!user) return;
    const body = await readJson(req);
    return createCanCategory(user, res, body);
  }

  if (method === 'PUT' && url.pathname.startsWith('/api/can-categories/')) {
    const user = requireCompanyModuleAccess(req, res, 'loading3d');
    if (!user) return;
    const categoryId = Number(url.pathname.split('/')[3]);
    if (!Number.isInteger(categoryId)) {
      return sendJson(res, 400, { error: 'ID de categoria inválido.' });
    }
    const body = await readJson(req);
    return updateCanCategory(user, res, categoryId, body);
  }

  if (method === 'DELETE' && url.pathname.startsWith('/api/can-categories/')) {
    const user = requireCompanyModuleAccess(req, res, 'loading3d');
    if (!user) return;
    const categoryId = Number(url.pathname.split('/')[3]);
    if (!Number.isInteger(categoryId)) {
      return sendJson(res, 400, { error: 'ID de categoria inválido.' });
    }
    return deleteCanCategory(user, res, categoryId);
  }

  if (method === 'POST' && url.pathname === '/api/cans') {
    const user = requireCompanyModuleAccess(req, res, 'loading3d');
    if (!user) return;
    const body = await readJson(req);
    return createCan(user, res, body);
  }

  if (canIdMatch && method === 'PUT') {
    const user = requireCompanyModuleAccess(req, res, 'loading3d');
    if (!user) return;
    const body = await readJson(req);
    return updateCan(user, res, Number(canIdMatch[1]), body);
  }

  if (canIdMatch && method === 'DELETE') {
    const user = requireCompanyModuleAccess(req, res, 'loading3d');
    if (!user) return;
    return deleteCan(user, res, Number(canIdMatch[1]));
  }

  if (method === 'GET' && url.pathname === '/api/trucks') {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!userHasModule(user, 'loading3d')) {
      return sendJson(res, 403, { error: 'Seu usuario nao possui acesso a este modulo.' });
    }
    const trucks = db.prepare('SELECT * FROM trucks WHERE company_id = ? ORDER BY volume_cm3 ASC').all(getTargetCompanyId(user));
    return sendJson(res, 200, { trucks });
  }

  if (method === 'POST' && url.pathname === '/api/trucks') {
    const user = requireCompanyModuleAccess(req, res, 'loading3d');
    if (!user) return;
    const body = await readJson(req);
    return createTruck(user, res, body);
  }

  if (truckIdMatch && method === 'PUT') {
    const user = requireCompanyModuleAccess(req, res, 'loading3d');
    if (!user) return;
    const body = await readJson(req);
    return updateTruck(user, res, Number(truckIdMatch[1]), body);
  }

  if (truckIdMatch && method === 'DELETE') {
    const user = requireCompanyModuleAccess(req, res, 'loading3d');
    if (!user) return;
    return deleteTruck(user, res, Number(truckIdMatch[1]));
  }

  if (method === 'POST' && url.pathname === '/api/users') {
    const user = requireAdmin(req, res);
    if (!user) return;
    const body = await readJson(req);
    return createUser(user, res, body);
  }

  if (method === 'GET' && url.pathname === '/api/users') {
    const user = requireAdmin(req, res);
    if (!user) return;
    const requestedCompanyId = url.searchParams.get('companyId');
    const params = [];
    let sql = `
      SELECT id, name, email, role, is_active, is_platform_admin, company_id, created_at
      FROM users
      WHERE COALESCE(is_platform_admin, 0) = 0
    `;

    if (isPlatformAdmin(user)) {
      if (requestedCompanyId) {
        sql += ' AND company_id = ?';
        params.push(getTargetCompanyId(user, requestedCompanyId));
      }
    } else {
      sql += ' AND company_id = ? AND role = ?';
      params.push(getTargetCompanyId(user), 'user');
    }

    sql += ' ORDER BY company_id ASC, created_at DESC';
    const users = db.prepare(sql).all(...params)
      .map((entry) => ({
        ...entry,
        modules: getCompanyModules(entry.company_id)
      }));
    return sendJson(res, 200, { users });
  }

  if (userIdMatch && method === 'PUT') {
    const user = requireAdmin(req, res);
    if (!user) return;
    const body = await readJson(req);
    return updateUser(user, res, Number(userIdMatch[1]), body);
  }

  if (userIdMatch && method === 'DELETE') {
    const user = requireAdmin(req, res);
    if (!user) return;
    return deleteUser(user, res, Number(userIdMatch[1]));
  }

  if (method === 'GET' && url.pathname === '/api/orders') {
    const user = requireModuleAccess(req, res, 'loading3d');
    if (!user) return;
    return listOrders(user, res);
  }

  if (method === 'POST' && url.pathname === '/api/orders') {
    const user = requireModuleAccess(req, res, 'loading3d');
    if (!user) return;
    const body = await readJson(req);
    return createOrder(user, res, body);
  }

  if (method === 'GET' && url.pathname === '/api/truck-availability') {
    const user = requireModuleAccess(req, res, 'loading3d');
    if (!user) return;
    const fallbackDate = url.searchParams.get('date');
    return getTruckAvailability(
      user,
      res,
      url.searchParams.get('startDate') || fallbackDate,
      url.searchParams.get('endDate') || fallbackDate
    );
  }

  if (method === 'GET' && url.pathname === '/api/truck-schedule') {
    const user = requireModuleAccess(req, res, 'loading3d');
    if (!user) return;
    const fallbackDate = url.searchParams.get('date');
    return getTruckSchedule(
      user,
      res,
      url.searchParams.get('startDate') || fallbackDate,
      url.searchParams.get('endDate') || fallbackDate
    );
  }

  if (orderIdMatch && method === 'GET') {
    const user = requireModuleAccess(req, res, 'loading3d');
    if (!user) return;
    return getOrderDetails(user, res, Number(orderIdMatch[1]));
  }

  if (orderIdMatch && method === 'PUT') {
    const user = requireModuleAccess(req, res, 'loading3d');
    if (!user) return;
    const body = await readJson(req);
    return updateOrder(user, res, Number(orderIdMatch[1]), body);
  }

  if (orderConcludeMatch && method === 'POST') {
    const user = requireCompanyModuleAccess(req, res, 'loading3d');
    if (!user) return;
    return concludeOrder(user, res, Number(orderConcludeMatch[1]));
  }

  if (orderIdMatch && method === 'DELETE') {
    const user = requireModuleAccess(req, res, 'loading3d');
    if (!user) return;
    return deleteOrder(user, res, Number(orderIdMatch[1]));
  }

  if (method === 'POST' && url.pathname === '/api/calculate') {
    const user = requireModuleAccess(req, res, 'loading3d');
    if (!user) return;
    const body = await readJson(req);
    return calculateLoad(user, res, body);
  }

  sendJson(res, 404, { error: 'Rota não encontrada.' });
}

function login(req, res, body) {
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');

  if (!email || !password) {
    return sendJson(res, 400, { error: 'Informe email e senha.' });
  }

  const rateLimitState = getLoginRateLimitState(req);
  if (rateLimitState.blocked) {
    res.setHeader('Retry-After', String(rateLimitState.retryAfterSeconds));
    return sendJson(res, 429, { error: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    registerLoginFailure(req);
    return sendJson(res, 401, { error: 'Credenciais invalidas.' });
  }

  if (!user.is_active) {
    return sendJson(res, 403, { error: 'Seu acesso esta inativo. Fale com o administrador.' });
  }

  if (!isPlatformAdmin(user) && user.company_id) {
    const company = db.prepare('SELECT status FROM companies WHERE id = ?').get(user.company_id);
    if (!company || company.status !== 'active') {
      return sendJson(res, 403, { error: 'A empresa vinculada a este usuario esta inativa.' });
    }
  }

  clearLoginFailures(req);

  const sessionToken = crypto.randomBytes(32).toString('hex');
  const session = createSessionRecord(req, user.id);
  sessions.set(sessionToken, session);

  setCookie(res, getSessionCookieName(req), sessionToken, {
    httpOnly: true,
    sameSite: 'Strict',
    secure: isSecureRequest(req),
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    path: '/'
  });

  sendJson(res, 200, { user: safeUser(user), availableModules: AVAILABLE_MODULES, csrfToken: session.csrfToken });
}

function logout(req, res) {
  const cookies = parseCookies(req.headers.cookie || '');
  const sessionToken = cookies['__Host-sid'] || cookies.sid;
  if (sessionToken) {
    sessions.delete(sessionToken);
  }

  const secure = isSecureRequest(req);
  setCookie(res, 'sid', '', { httpOnly: true, sameSite: 'Strict', secure, maxAge: 0, path: '/' });
  setCookie(res, '__Host-sid', '', { httpOnly: true, sameSite: 'Strict', secure: true, maxAge: 0, path: '/' });
  res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
  sendJson(res, 200, { ok: true });
}

function createCanCategory(currentUser, res, body) {
  const companyId = getTargetCompanyId(currentUser);
  const name = String(body?.name || '').trim();

  const nameError = validateEntityName(name, 'categoria');
  if (nameError) {
    return sendJson(res, 400, { error: nameError });
  }

  const existingCategory = db.prepare('SELECT id FROM can_categories WHERE name = ? AND company_id = ?').get(name, companyId);
  if (existingCategory) {
    return sendJson(res, 409, { error: 'Já existe uma categoria com este nome.' });
  }

  const result = db.prepare('INSERT INTO can_categories (name, company_id) VALUES (?, ?)').run(name, companyId);
  sendJson(res, 201, { ok: true, categoryId: result.lastInsertRowid });
}

function updateCanCategory(currentUser, res, categoryId, body) {
  const existing = db.prepare('SELECT * FROM can_categories WHERE id = ? AND company_id = ?').get(categoryId, getTargetCompanyId(currentUser));
  if (!existing) {
    return sendJson(res, 404, { error: 'Categoria não encontrada.' });
  }

  const name = String(body?.name || '').trim();

  const nameError = validateEntityName(name, 'categoria');
  if (nameError) {
    return sendJson(res, 400, { error: nameError });
  }

  if (name !== existing.name) {
    const nameConflict = db.prepare('SELECT id FROM can_categories WHERE name = ? AND id != ? AND company_id = ?').get(name, categoryId, getTargetCompanyId(currentUser));
    if (nameConflict) {
      return sendJson(res, 409, { error: 'Já existe outra categoria com este nome.' });
    }
  }

  db.prepare('UPDATE can_categories SET name = ? WHERE id = ?').run(name, categoryId);
  sendJson(res, 200, { ok: true });
}

function deleteCanCategory(currentUser, res, categoryId) {
  const existing = db.prepare('SELECT * FROM can_categories WHERE id = ? AND company_id = ?').get(categoryId, getTargetCompanyId(currentUser));
  if (!existing) {
    return sendJson(res, 404, { error: 'Categoria não encontrada.' });
  }

  const canCount = db.prepare('SELECT COUNT(*) AS count FROM cans WHERE category_id = ? AND company_id = ?').get(categoryId, getTargetCompanyId(currentUser)).count;
  if (canCount > 0) {
    return sendJson(res, 400, { 
      error: `Não é possível excluir esta categoria. Existem ${canCount} produto(s) associados a esta categoria.` 
    });
  }

  db.prepare('DELETE FROM can_categories WHERE id = ?').run(categoryId);
  sendJson(res, 200, { ok: true });
}

function createClient(currentUser, res, body) {
  const companyId = getTargetCompanyId(currentUser);
  const name = String(body?.name || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();
  const phone = String(body?.phone || '').trim();
  const address = String(body?.address || '').trim();
  const city = String(body?.city || '').trim();
  const state = String(body?.state || '').trim().toUpperCase();
  const cnpjCpf = String(body?.cnpj_cpf || '').trim();
  const contactPerson = String(body?.contact_person || '').trim();
  const notes = String(body?.notes || '').trim();
  const status = String(body?.status || 'active').trim();

  const nameError = validateEntityName(name, 'cliente');
  const emailError = email ? validateEmailAddress(email) : null;
  if (nameError || emailError || !['active', 'inactive', 'suspended'].includes(status)) {
    return sendJson(res, 400, { error: nameError || emailError || 'Dados do cliente invalidos.' });
  }

  const existingClient = db.prepare('SELECT id FROM clients WHERE name = ? AND company_id = ?').get(name, companyId);
  if (existingClient) {
    return sendJson(res, 409, { error: 'Já existe um cliente com este nome.' });
  }

  const result = db.prepare(`
    INSERT INTO clients (
      name,
      email,
      phone,
      address,
      city,
      state,
      cnpj_cpf,
      contact_person,
      notes,
      status,
      company_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    email || null,
    phone || null,
    address || null,
    city || null,
    state || null,
    cnpjCpf || null,
    contactPerson || null,
    notes || null,
    status,
    companyId
  );
  sendJson(res, 201, { ok: true, clientId: result.lastInsertRowid });
}

function updateClient(currentUser, res, clientId, body) {
  const companyId = getTargetCompanyId(currentUser);
  const existing = db.prepare('SELECT * FROM clients WHERE id = ? AND company_id = ?').get(clientId, companyId);
  if (!existing) {
    return sendJson(res, 404, { error: 'Cliente nao encontrado.' });
  }

  const name = String(body?.name ?? existing.name).trim();
  const email = String(body?.email ?? existing.email ?? '').trim().toLowerCase();
  const phone = String(body?.phone ?? existing.phone ?? '').trim();
  const address = String(body?.address ?? existing.address ?? '').trim();
  const city = String(body?.city ?? existing.city ?? '').trim();
  const state = String(body?.state ?? existing.state ?? '').trim().toUpperCase();
  const cnpjCpf = String(body?.cnpj_cpf ?? existing.cnpj_cpf ?? '').trim();
  const contactPerson = String(body?.contact_person ?? existing.contact_person ?? '').trim();
  const notes = String(body?.notes ?? existing.notes ?? '').trim();
  const status = String(body?.status ?? existing.status ?? 'active').trim();

  const nameError = validateEntityName(name, 'cliente');
  const emailError = email ? validateEmailAddress(email) : null;
  if (nameError || emailError || !['active', 'inactive', 'suspended'].includes(status)) {
    return sendJson(res, 400, { error: nameError || emailError || 'Dados do cliente invalidos.' });
  }

  const duplicate = db.prepare('SELECT id FROM clients WHERE name = ? AND company_id = ? AND id <> ?').get(name, companyId, clientId);
  if (duplicate) {
    return sendJson(res, 409, { error: 'Ja existe um cliente com este nome.' });
  }

  db.prepare(`
    UPDATE clients
    SET name = ?,
        email = ?,
        phone = ?,
        address = ?,
        city = ?,
        state = ?,
        cnpj_cpf = ?,
        contact_person = ?,
        notes = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND company_id = ?
  `).run(
    name,
    email || null,
    phone || null,
    address || null,
    city || null,
    state || null,
    cnpjCpf || null,
    contactPerson || null,
    notes || null,
    status,
    clientId,
    companyId
  );

  sendJson(res, 200, { ok: true });
}

function deleteClient(currentUser, res, clientId) {
  const result = db.prepare('DELETE FROM clients WHERE id = ? AND company_id = ?').run(clientId, getTargetCompanyId(currentUser));
  if (!result.changes) {
    return sendJson(res, 404, { error: 'Cliente nao encontrado.' });
  }

  sendJson(res, 200, { ok: true });
}

function createCan(currentUser, res, body) {
  const parsed = parseCanPayload(body);
  if (parsed.error) {
    return sendJson(res, 400, { error: parsed.error });
  }

  const { name, shape, lengthCm, widthCm, depthCm, diameterCm, heightCm, volumeCm3 } = parsed;
  const categoryId = body?.categoryId ? Number(body.categoryId) : null;

  db.prepare(`
    INSERT INTO cans (name, category_id, shape, length_cm, width_cm, depth_cm, diameter_cm, height_cm, volume_cm3, company_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, categoryId, shape, lengthCm, widthCm, depthCm, diameterCm, heightCm, volumeCm3, getTargetCompanyId(currentUser));

  sendJson(res, 201, { ok: true });
}

function updateCan(currentUser, res, canId, body) {
  const existing = db.prepare('SELECT * FROM cans WHERE id = ? AND company_id = ?').get(canId, getTargetCompanyId(currentUser));
  if (!existing) {
    return sendJson(res, 404, { error: 'Produto nao encontrado.' });
  }

  const mergedBody = {
    name: body?.name ?? existing.name,
    categoryId: body?.categoryId ?? existing.category_id,
    shape: body?.shape ?? existing.shape,
    heightCm: body?.heightCm ?? existing.height_cm,
    side1Cm: body?.side1Cm ?? body?.lengthCm ?? existing.length_cm,
    side2Cm: body?.side2Cm ?? body?.widthCm ?? existing.width_cm,
    diameterCm: body?.diameterCm ?? existing.diameter_cm,
    circumferenceCm: body?.circumferenceCm
  };

  const parsed = parseCanPayload(mergedBody);
  if (parsed.error) {
    return sendJson(res, 400, { error: parsed.error });
  }

  const { name, shape, lengthCm, widthCm, depthCm, diameterCm, heightCm, volumeCm3 } = parsed;
  const categoryId = mergedBody.categoryId ? Number(mergedBody.categoryId) : null;

  db.prepare(`
    UPDATE cans
    SET name = ?, category_id = ?, shape = ?, length_cm = ?, width_cm = ?, depth_cm = ?, diameter_cm = ?, height_cm = ?, volume_cm3 = ?
    WHERE id = ?
  `).run(name, categoryId, shape, lengthCm, widthCm, depthCm, diameterCm, heightCm, volumeCm3, canId);

  sendJson(res, 200, { ok: true });
}

function deleteCan(currentUser, res, canId) {
  const result = db.prepare('DELETE FROM cans WHERE id = ? AND company_id = ?').run(canId, getTargetCompanyId(currentUser));
  if (!result.changes) {
    return sendJson(res, 404, { error: 'Produto nao encontrado.' });
  }

  sendJson(res, 200, { ok: true });
}

function createTruck(currentUser, res, body) {
  const name = String(body?.name || '').trim();
  const lengthCm = Number(body?.lengthCm);
  const widthCm = Number(body?.widthCm);
  const heightCm = Number(body?.heightCm);
  const quantity = Number(body?.quantity ?? 1);

  const nameError = validateEntityName(name, 'caminhão');

  if (
    nameError ||
    ![lengthCm, widthCm, heightCm].every((value) => Number.isFinite(value) && value > 0) ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return sendJson(res, 400, { error: nameError || 'Nome, medidas válidas e quantidade inteira do caminhão são obrigatórios.' });
  }

  const volumeCm3 = lengthCm * widthCm * heightCm;

  db.prepare(`
    INSERT INTO trucks (name, length_cm, width_cm, height_cm, quantity, volume_cm3, company_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, lengthCm, widthCm, heightCm, quantity, volumeCm3, getTargetCompanyId(currentUser));

  sendJson(res, 201, { ok: true });
}

function updateTruck(currentUser, res, truckId, body) {
  const existing = db.prepare('SELECT * FROM trucks WHERE id = ? AND company_id = ?').get(truckId, getTargetCompanyId(currentUser));
  if (!existing) {
    return sendJson(res, 404, { error: 'Caminhão não encontrado.' });
  }

  const name = String(body?.name ?? existing.name).trim();
  const lengthCm = Number(body?.lengthCm ?? existing.length_cm);
  const widthCm = Number(body?.widthCm ?? existing.width_cm);
  const heightCm = Number(body?.heightCm ?? existing.height_cm);
  const quantity = Number(body?.quantity ?? existing.quantity ?? 1);

  const nameError = validateEntityName(name, 'caminhão');

  if (
    nameError ||
    ![lengthCm, widthCm, heightCm].every((value) => Number.isFinite(value) && value > 0) ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return sendJson(res, 400, { error: nameError || 'Nome, medidas válidas e quantidade inteira do caminhão são obrigatórios.' });
  }

  const volumeCm3 = lengthCm * widthCm * heightCm;
  const activeReservations = db.prepare(`
    SELECT COALESCE(SUM(quantity_reserved), 0) AS reserved
    FROM order_trucks ot
    INNER JOIN orders o ON o.id = ot.order_id
    WHERE ot.truck_id = ?
      AND o.status = 'open'
  `).get(truckId).reserved;

  if (quantity < Number(activeReservations || 0)) {
    return sendJson(res, 400, {
      error: `Não é possível reduzir a quantidade para ${quantity}. Existem ${activeReservations} unidade(s) desse caminhão em pedidos abertos.`
    });
  }

  db.prepare(`
    UPDATE trucks
    SET name = ?, length_cm = ?, width_cm = ?, height_cm = ?, quantity = ?, volume_cm3 = ?
    WHERE id = ?
  `).run(name, lengthCm, widthCm, heightCm, quantity, volumeCm3, truckId);

  sendJson(res, 200, { ok: true });
}

function deleteTruck(currentUser, res, truckId) {
  const activeReservations = db.prepare(`
    SELECT COALESCE(SUM(ot.quantity_reserved), 0) AS reserved
    FROM order_trucks ot
    INNER JOIN orders o ON o.id = ot.order_id
    WHERE ot.truck_id = ?
      AND o.status = 'open'
  `).get(truckId).reserved;

  if (Number(activeReservations || 0) > 0) {
    return sendJson(res, 400, {
      error: `Não é possível excluir este caminhão. Existem ${activeReservations} unidade(s) reservada(s) em pedidos abertos.`
    });
  }

  const result = db.prepare('DELETE FROM trucks WHERE id = ? AND company_id = ?').run(truckId, getTargetCompanyId(currentUser));
  if (!result.changes) {
    return sendJson(res, 404, { error: 'Caminhão não encontrado.' });
  }

  sendJson(res, 200, { ok: true });
}

function createUser(currentUser, res, body) {
  const name = String(body?.name || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  const requestedRole = String(body?.role || 'user').trim();
  const role = isPlatformAdmin(currentUser) ? requestedRole : 'user';
  const isActive = body?.isActive === undefined ? true : Boolean(body?.isActive);
  const companyId = isPlatformAdmin(currentUser)
    ? getTargetCompanyId(currentUser, body?.companyId)
    : getTargetCompanyId(currentUser);
  const companyModules = getCompanyModules(companyId);
  const modules = isPlatformAdmin(currentUser)
    ? (role === 'admin'
      ? companyModules
      : getModulesForPersistence(role, body?.modules).filter((moduleKey) => companyModules.includes(moduleKey)))
    : companyModules;

  const nameError = validateEntityName(name, 'usuário');
  const emailError = validateEmailAddress(email);
  const passwordError = validatePasswordStrength(password);

  if (nameError || emailError || passwordError || !['admin', 'user'].includes(role)) {
    return sendJson(res, 400, { error: nameError || emailError || passwordError || 'Dados do usuário inválidos.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return sendJson(res, 409, { error: 'E-mail já cadastrado.' });
  }

  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, is_active, is_platform_admin, company_id)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).run(name, email, hashPassword(password), role, isActive ? 1 : 0, companyId);
  replaceUserModules(Number(result.lastInsertRowid), modules);

  sendJson(res, 201, { ok: true });
}

function updateUser(currentUser, res, userId, body) {
  const existing = isPlatformAdmin(currentUser)
    ? db.prepare('SELECT * FROM users WHERE id = ? AND COALESCE(is_platform_admin, 0) = 0').get(userId)
    : db.prepare('SELECT * FROM users WHERE id = ? AND company_id = ? AND role = ? AND COALESCE(is_platform_admin, 0) = 0')
      .get(userId, getTargetCompanyId(currentUser), 'user');
  if (!existing) {
    return sendJson(res, 404, { error: 'Usuario nao encontrado.' });
  }

  const name = String(body?.name ?? existing.name).trim();
  const email = String(body?.email ?? existing.email).trim().toLowerCase();
  const requestedRole = String(body?.role ?? existing.role).trim();
  const role = isPlatformAdmin(currentUser) ? requestedRole : 'user';
  const password = body?.password === undefined ? '' : String(body?.password || '');
  const isActive = body?.isActive === undefined ? Boolean(existing.is_active) : Boolean(body?.isActive);
  const companyModules = getCompanyModules(existing.company_id);
  const modules = isPlatformAdmin(currentUser)
    ? (role === 'admin'
      ? companyModules
      : getModulesForPersistence(role, body?.modules ?? getUserModules(userId)).filter((moduleKey) => companyModules.includes(moduleKey)))
    : companyModules;

  const nameError = validateEntityName(name, 'usuario');
  const emailError = validateEmailAddress(email);
  const passwordError = password.trim() ? validatePasswordStrength(password) : null;

  if (nameError || emailError || passwordError || !['admin', 'user'].includes(role)) {
    return sendJson(res, 400, { error: nameError || emailError || passwordError || 'Dados do usuario invalidos.' });
  }

  const duplicate = db.prepare('SELECT id FROM users WHERE email = ? AND id <> ?').get(email, userId);
  if (duplicate) {
    return sendJson(res, 409, { error: 'E-mail ja cadastrado.' });
  }

  if (existing.id === currentUser.id && role !== 'admin') {
    return sendJson(res, 400, { error: 'Voce nao pode remover seu proprio acesso de administrador.' });
  }

  if (existing.id === currentUser.id && !isActive) {
    return sendJson(res, 400, { error: 'Voce nao pode desativar sua propria conta.' });
  }

  if (existing.role === 'admin' && role !== 'admin') {
    const adminCount = db.prepare(`
      SELECT COUNT(*) AS count
      FROM users
      WHERE role = 'admin'
        AND company_id = ?
        AND COALESCE(is_platform_admin, 0) = 0
    `).get(existing.company_id).count;
    if (adminCount <= 1) {
      return sendJson(res, 400, { error: 'Nao e permitido remover o ultimo administrador do sistema.' });
    }
  }

  const passwordHash = password.trim() ? hashPassword(password) : existing.password_hash;

  db.prepare(`
    UPDATE users
    SET name = ?, email = ?, role = ?, password_hash = ?, is_active = ?
    WHERE id = ?
  `).run(name, email, role, passwordHash, isActive ? 1 : 0, userId);

  replaceUserModules(userId, modules);

  sendJson(res, 200, { ok: true });
}

function deleteUser(currentUser, res, userId) {
  const existing = isPlatformAdmin(currentUser)
    ? db.prepare('SELECT * FROM users WHERE id = ? AND COALESCE(is_platform_admin, 0) = 0').get(userId)
    : db.prepare('SELECT * FROM users WHERE id = ? AND company_id = ? AND role = ? AND COALESCE(is_platform_admin, 0) = 0')
      .get(userId, getTargetCompanyId(currentUser), 'user');
  if (!existing) {
    return sendJson(res, 404, { error: 'Usuário não encontrado.' });
  }

  if (existing.id === currentUser.id) {
    return sendJson(res, 400, { error: 'Você não pode excluir sua própria conta.' });
  }

  if (existing.role === 'admin') {
    const adminCount = db.prepare(`
      SELECT COUNT(*) AS count
      FROM users
      WHERE role = 'admin'
        AND company_id = ?
        AND COALESCE(is_platform_admin, 0) = 0
    `).get(existing.company_id).count;
    if (adminCount <= 1) {
      return sendJson(res, 400, { error: 'Não é permitido excluir o último administrador do sistema.' });
    }
  }

  db.prepare('DELETE FROM user_modules WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  clearSessionsByUserId(userId);

  sendJson(res, 200, { ok: true });
}

function listPlatformCompanies(res) {
  const companies = db.prepare(`
    SELECT
      c.id,
      c.name,
      c.status,
      c.contact_name,
      c.contact_email,
      c.contact_phone,
      c.document,
      c.billing_amount,
      c.billing_due_day,
      c.payment_status,
      c.last_payment_date,
      c.notes,
      c.updated_at,
      c.created_at,
      COUNT(u.id) AS total_users,
      SUM(CASE WHEN COALESCE(u.is_active, 0) = 1 THEN 1 ELSE 0 END) AS active_users
    FROM companies c
    LEFT JOIN users u
      ON u.company_id = c.id
     AND COALESCE(u.is_platform_admin, 0) = 0
    GROUP BY c.id, c.name, c.status, c.created_at
    ORDER BY c.created_at DESC, c.id DESC
  `).all().map((company) => ({
    ...company,
    modules: getCompanyModules(company.id),
    admin: getPrimaryCompanyAdmin(company.id)
  }));

  sendJson(res, 200, { companies });
}

function createCompany(res, body) {
  const name = String(body?.name || '').trim();
  const adminName = String(body?.adminName || '').trim();
  const adminEmail = String(body?.adminEmail || '').trim().toLowerCase();
  const adminPassword = String(body?.adminPassword || '');
  const status = String(body?.status || 'active').trim();
  const modules = normalizeModuleKeys(body?.modules);
  const contactName = String(body?.contactName || '').trim();
  const contactEmail = String(body?.contactEmail || '').trim().toLowerCase();
  const contactPhone = String(body?.contactPhone || '').trim();
  const document = String(body?.document || '').trim();
  const notes = String(body?.notes || '').trim();
  const paymentStatus = String(body?.paymentStatus || 'pending').trim();
  const billingAmount = Number(body?.billingAmount || 0);
  const billingDueDay = body?.billingDueDay === null || body?.billingDueDay === undefined || body?.billingDueDay === ''
    ? null
    : Number(body.billingDueDay);
  const lastPaymentDate = String(body?.lastPaymentDate || '').trim() || null;

  const nameError = validateEntityName(name, 'empresa');
  const adminNameError = validateEntityName(adminName, 'usuario');
  const emailError = validateEmailAddress(adminEmail);
  const passwordError = validatePasswordStrength(adminPassword);
  const contactEmailError = contactEmail ? validateEmailAddress(contactEmail) : null;
  const billingAmountValid = Number.isFinite(billingAmount) && billingAmount >= 0;
  const billingDueDayValid = billingDueDay === null || (Number.isInteger(billingDueDay) && billingDueDay >= 1 && billingDueDay <= 31);

  if (
    nameError ||
    adminNameError ||
    emailError ||
    passwordError ||
    contactEmailError ||
    !['active', 'inactive'].includes(status) ||
    !['pending', 'paid', 'overdue'].includes(paymentStatus) ||
    !modules.length ||
    !billingAmountValid ||
    !billingDueDayValid
  ) {
    return sendJson(res, 400, { error: nameError || adminNameError || emailError || passwordError || contactEmailError || 'Dados da empresa invalidos.' });
  }

  if (db.prepare('SELECT id FROM companies WHERE name = ?').get(name)) {
    return sendJson(res, 409, { error: 'Ja existe uma empresa com esse nome.' });
  }

  if (db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail)) {
    return sendJson(res, 409, { error: 'Ja existe um usuario com esse e-mail.' });
  }

  try {
    db.exec('BEGIN');
    const companyResult = db.prepare(`
      INSERT INTO companies (
        name,
        status,
        contact_name,
        contact_email,
        contact_phone,
        document,
        billing_amount,
        billing_due_day,
        payment_status,
        last_payment_date,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      status,
      contactName || adminName,
      contactEmail || adminEmail,
      contactPhone || null,
      document || null,
      billingAmount,
      billingDueDay,
      paymentStatus,
      lastPaymentDate,
      notes || null
    );
    const companyId = Number(companyResult.lastInsertRowid);
    replaceCompanyModules(companyId, modules);
    const userResult = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, is_active, is_platform_admin, company_id)
      VALUES (?, ?, ?, 'admin', 1, 0, ?)
    `).run(adminName, adminEmail, hashPassword(adminPassword), companyId);
    replaceUserModules(Number(userResult.lastInsertRowid), modules);
    db.exec('COMMIT');
    return sendJson(res, 201, { ok: true, companyId });
  } catch (error) {
    db.exec('ROLLBACK');
    console.error(error);
    return sendJson(res, 500, { error: 'Nao foi possivel criar a empresa.' });
  }
}

function updateCompany(res, companyId, body) {
  const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
  if (!existing) {
    return sendJson(res, 404, { error: 'Empresa nao encontrada.' });
  }

  const name = String(body?.name ?? existing.name).trim();
  const status = String(body?.status ?? existing.status).trim();
  const modules = normalizeModuleKeys(body?.modules ?? getCompanyModules(companyId));
  const contactName = String(body?.contactName ?? existing.contact_name ?? '').trim();
  const contactEmail = String(body?.contactEmail ?? existing.contact_email ?? '').trim().toLowerCase();
  const contactPhone = String(body?.contactPhone ?? existing.contact_phone ?? '').trim();
  const document = String(body?.document ?? existing.document ?? '').trim();
  const notes = String(body?.notes ?? existing.notes ?? '').trim();
  const paymentStatus = String(body?.paymentStatus ?? existing.payment_status ?? 'pending').trim();
  const billingAmount = Number(body?.billingAmount ?? existing.billing_amount ?? 0);
  const billingDueDay = body?.billingDueDay === null || body?.billingDueDay === undefined || body?.billingDueDay === ''
    ? null
    : Number(body.billingDueDay);
  const lastPaymentDate = String(body?.lastPaymentDate ?? existing.last_payment_date ?? '').trim() || null;
  const adminName = body?.adminName === undefined ? null : String(body.adminName || '').trim();
  const adminEmail = body?.adminEmail === undefined ? null : String(body.adminEmail || '').trim().toLowerCase();
  const nameError = validateEntityName(name, 'empresa');
  const contactEmailError = contactEmail ? validateEmailAddress(contactEmail) : null;
  const adminNameError = adminName !== null && !adminName ? 'Informe o nome do administrador.' : null;
  const adminEmailError = adminEmail !== null ? validateEmailAddress(adminEmail) : null;
  const billingAmountValid = Number.isFinite(billingAmount) && billingAmount >= 0;
  const billingDueDayValid = billingDueDay === null || (Number.isInteger(billingDueDay) && billingDueDay >= 1 && billingDueDay <= 31);

  if (
    nameError ||
    contactEmailError ||
    adminNameError ||
    adminEmailError ||
    !['active', 'inactive'].includes(status) ||
    !['pending', 'paid', 'overdue'].includes(paymentStatus) ||
    !modules.length ||
    !billingAmountValid ||
    !billingDueDayValid
  ) {
    return sendJson(res, 400, { error: nameError || contactEmailError || adminNameError || adminEmailError || 'Dados da empresa invalidos.' });
  }

  const duplicate = db.prepare('SELECT id FROM companies WHERE name = ? AND id <> ?').get(name, companyId);
  if (duplicate) {
    return sendJson(res, 409, { error: 'Ja existe outra empresa com esse nome.' });
  }

  const primaryAdmin = getPrimaryCompanyAdmin(companyId);
  if (adminEmail && primaryAdmin) {
    const duplicateAdmin = db.prepare('SELECT id FROM users WHERE email = ? AND id <> ?').get(adminEmail, primaryAdmin.id);
    if (duplicateAdmin) {
      return sendJson(res, 409, { error: 'Ja existe outro usuario com esse e-mail.' });
    }
  }

  try {
    db.exec('BEGIN');

    db.prepare(`
      UPDATE companies
      SET name = ?,
          status = ?,
          contact_name = ?,
          contact_email = ?,
          contact_phone = ?,
          document = ?,
          billing_amount = ?,
          billing_due_day = ?,
          payment_status = ?,
          last_payment_date = ?,
          notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name,
      status,
      contactName || null,
      contactEmail || null,
      contactPhone || null,
      document || null,
      billingAmount,
      billingDueDay,
      paymentStatus,
      lastPaymentDate,
      notes || null,
      companyId
    );

    replaceCompanyModules(companyId, modules);

    if (primaryAdmin && adminName && adminEmail) {
      db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(adminName, adminEmail, primaryAdmin.id);
    }

    const companyUsers = db.prepare(`
      SELECT id, role
      FROM users
      WHERE company_id = ?
        AND COALESCE(is_platform_admin, 0) = 0
    `).all(companyId);

    for (const user of companyUsers) {
      replaceUserModules(user.id, modules);
    }

    db.exec('COMMIT');
    sendJson(res, 200, { ok: true });
  } catch (error) {
    db.exec('ROLLBACK');
    console.error(error);
    sendJson(res, 500, { error: 'Nao foi possivel atualizar a empresa.' });
  }
}

function getPrimaryCompanyAdmin(companyId) {
  if (!companyId) return null;
  return db.prepare(`
    SELECT id, name, email, is_active, created_at
    FROM users
    WHERE company_id = ?
      AND role = 'admin'
      AND COALESCE(is_platform_admin, 0) = 0
    ORDER BY created_at ASC, id ASC
    LIMIT 1
  `).get(companyId) || null;
}

function listOrders(currentUser, res) {
  const orders = db.prepare(`
    SELECT
      id,
      created_by_user_id,
      created_by_name,
      scheduled_date,
      start_date,
      end_date,
      status,
      total_cans,
      total_volume_cm3,
      completed_at,
      completed_by_user_id,
      completed_by_name,
      created_at
    FROM orders
    WHERE company_id = ?
    ORDER BY datetime(created_at) DESC, id DESC
  `).all(getTargetCompanyId(currentUser));

  sendJson(res, 200, { orders });
}

function createOrder(currentUser, res, body) {
  const companyId = getTargetCompanyId(currentUser);
  const load = buildLoadSummary(currentUser, body?.items);
  if (load.error) {
    return sendJson(res, load.status || 400, { error: load.error });
  }
  const requiredVolumeCm3 = load.totalEffectiveVolumeCm3 || load.totalVolumeCm3;

  const fallbackDate = body?.scheduledDate;
  const dateRange = parseDateRange(body?.startDate || fallbackDate, body?.endDate || fallbackDate);
  if (dateRange.error) {
    return sendJson(res, 400, { error: dateRange.error });
  }

  const allTrucks = db.prepare('SELECT * FROM trucks WHERE company_id = ? ORDER BY volume_cm3 ASC').all(companyId);
  const availability = buildTruckAvailabilityMap(companyId, allTrucks, dateRange.startDate, dateRange.endDate);
  const parsedSelection = parseOrderTruckSelection(body?.allocation?.trucks, requiredVolumeCm3, availability);
  if (parsedSelection.error) {
    return sendJson(res, 400, { error: parsedSelection.error });
  }

  const allocationCheck = buildAllocationResult(requiredVolumeCm3, parsedSelection.allocations);
  if (!allocationCheck.fits) {
    return sendJson(res, 422, { error: 'A carga não cabe nos caminhões selecionados para este pedido.' });
  }

  try {
    db.exec('BEGIN');

    const orderResult = db.prepare(`
      INSERT INTO orders (
        company_id,
        created_by_user_id,
        created_by_name,
        scheduled_date,
        start_date,
        end_date,
        status,
        total_cans,
        total_volume_cm3
      ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)
    `).run(
      companyId,
      currentUser.id,
      currentUser.name,
      dateRange.startDate,
      dateRange.startDate,
      dateRange.endDate,
      load.totalCans,
      load.totalVolumeCm3
    );

    const orderId = Number(orderResult.lastInsertRowid);
    const insertItem = db.prepare(`
      INSERT INTO order_items (
        order_id,
        client_name,
        can_id,
        can_name,
        can_shape,
        quantity,
        unit_volume_cm3,
        total_volume_cm3
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of load.breakdown) {
      insertItem.run(
        orderId,
        item.clientName || null,
        item.canId,
        item.canName,
        item.canShape,
        item.quantity,
        item.unitVolumeCm3,
        item.totalVolumeCm3
      );
    }

    const insertOrderTruck = db.prepare(`
      INSERT INTO order_trucks (order_id, truck_id, truck_name, quantity_reserved)
      VALUES (?, ?, ?, ?)
    `);
    for (const allocation of parsedSelection.allocations) {
      insertOrderTruck.run(orderId, allocation.truckId, allocation.name, allocation.quantity);
    }

    db.exec('COMMIT');
    sendJson(res, 201, { ok: true, orderId });
  } catch (error) {
    db.exec('ROLLBACK');
    console.error(error);
    sendJson(res, 500, { error: 'Não foi possível lancar o pedido.' });
  }
}

function getOrderDetails(currentUser, res, orderId) {
  const order = db.prepare(`
    SELECT
      id,
      created_by_user_id,
      created_by_name,
      scheduled_date,
      start_date,
      end_date,
      status,
      total_cans,
      total_volume_cm3,
      completed_at,
      completed_by_user_id,
      completed_by_name,
      created_at
    FROM orders
    WHERE id = ?
      AND company_id = ?
  `).get(orderId, getTargetCompanyId(currentUser));

  if (!order) {
    return sendJson(res, 404, { error: 'Pedido não encontrado.' });
  }

  const items = db.prepare(`
    SELECT
      oi.id,
      oi.order_id,
      oi.client_name,
      oi.can_id,
      oi.can_name,
      oi.can_shape,
      oi.quantity,
      oi.unit_volume_cm3,
      oi.total_volume_cm3,
      c.length_cm AS can_length_cm,
      c.width_cm AS can_width_cm,
      c.depth_cm AS can_depth_cm,
      c.diameter_cm AS can_diameter_cm,
      c.height_cm AS can_height_cm
    FROM order_items oi
    LEFT JOIN cans c ON c.id = oi.can_id
    WHERE oi.order_id = ?
    ORDER BY oi.id ASC
  `).all(orderId);

  // Agrupar itens por cliente
  const itemsByClient = new Map();
  for (const item of items) {
    const clientName = item.client_name || 'Sem Cliente';
    if (!itemsByClient.has(clientName)) {
      itemsByClient.set(clientName, []);
    }
    itemsByClient.get(clientName).push(item);
  }

  // Converter para array de objetos com nome do cliente e itens
  const groupedItems = Array.from(itemsByClient.entries()).map(([clientName, clientItems]) => ({
    clientName,
    items: clientItems,
    totalCans: clientItems.reduce((sum, item) => sum + item.quantity, 0),
    totalVolumeCm3: clientItems.reduce((sum, item) => sum + item.total_volume_cm3, 0)
  }));

  const trucks = db.prepare(`
    SELECT
      ot.truck_id,
      ot.truck_name,
      ot.quantity_reserved,
      t.length_cm,
      t.width_cm,
      t.height_cm,
      t.volume_cm3
    FROM order_trucks ot
    LEFT JOIN trucks t ON t.id = ot.truck_id
    WHERE ot.order_id = ?
    ORDER BY ot.id ASC
  `).all(orderId);

  sendJson(res, 200, { order, items: groupedItems, trucks });
}

function updateOrder(currentUser, res, orderId, body) {
  const companyId = getTargetCompanyId(currentUser);
  const existing = db.prepare(`
    SELECT
      id,
      created_by_user_id,
      status
    FROM orders
    WHERE id = ?
      AND company_id = ?
  `).get(orderId, companyId);

  if (!existing) {
    return sendJson(res, 404, { error: 'Pedido não encontrado.' });
  }

  if (!canManageOrder(currentUser, existing)) {
    return sendJson(res, 403, { error: 'Você não tem permissão para editar este pedido.' });
  }

  if (existing.status !== 'open') {
    return sendJson(res, 400, { error: 'Somente pedidos em aberto podem ser editados.' });
  }

  const load = buildLoadSummary(currentUser, body?.items);
  if (load.error) {
    return sendJson(res, load.status || 400, { error: load.error });
  }
  const requiredVolumeCm3 = load.totalEffectiveVolumeCm3 || load.totalVolumeCm3;

  const fallbackDate = body?.scheduledDate;
  const dateRange = parseDateRange(body?.startDate || fallbackDate, body?.endDate || fallbackDate);
  if (dateRange.error) {
    return sendJson(res, 400, { error: dateRange.error });
  }

  const allTrucks = db.prepare('SELECT * FROM trucks WHERE company_id = ? ORDER BY volume_cm3 ASC').all(companyId);
  const availability = buildTruckAvailabilityMap(companyId, allTrucks, dateRange.startDate, dateRange.endDate, orderId);
  const availableTrucks = [...availability.values()].filter((truck) => truck.availableQuantity > 0);
  if (!availableTrucks.length) {
    return sendJson(res, 422, { error: `Não há caminhões disponíveis entre ${dateRange.startDate} e ${dateRange.endDate}.` });
  }

  const autoAllocation = findAutomaticAllocation(requiredVolumeCm3, availableTrucks, [...availability.values()]);
  if (!autoAllocation || !autoAllocation.allocation?.fits) {
    return sendJson(res, 422, { error: 'Não foi possível recalcular a frota para esse pedido com os dados informados.' });
  }

  try {
    db.exec('BEGIN');
    db.prepare(`
      UPDATE orders
      SET scheduled_date = ?,
          start_date = ?,
          end_date = ?,
          total_cans = ?,
          total_volume_cm3 = ?
      WHERE id = ?
    `).run(dateRange.startDate, dateRange.startDate, dateRange.endDate, load.totalCans, load.totalVolumeCm3, orderId);

    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);
    db.prepare('DELETE FROM order_trucks WHERE order_id = ?').run(orderId);

    const insertItem = db.prepare(`
      INSERT INTO order_items (
        order_id,
        can_id,
        can_name,
        can_shape,
        quantity,
        unit_volume_cm3,
        total_volume_cm3
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of load.breakdown) {
      insertItem.run(
        orderId,
        item.canId,
        item.canName,
        item.canShape,
        item.quantity,
        item.unitVolumeCm3,
        item.totalVolumeCm3
      );
    }

    const insertOrderTruck = db.prepare(`
      INSERT INTO order_trucks (order_id, truck_id, truck_name, quantity_reserved)
      VALUES (?, ?, ?, ?)
    `);
    for (const allocation of autoAllocation.allocation.trucks) {
      insertOrderTruck.run(orderId, allocation.truckId, allocation.name, allocation.quantity);
    }

    db.exec('COMMIT');
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    db.exec('ROLLBACK');
    console.error(error);
    return sendJson(res, 500, { error: 'Não foi possível atualizar o pedido.' });
  }
}

function concludeOrder(currentUser, res, orderId) {
  const existing = db.prepare('SELECT id, status, created_by_user_id FROM orders WHERE id = ? AND company_id = ?')
    .get(orderId, getTargetCompanyId(currentUser));
  if (!existing) {
    return sendJson(res, 404, { error: 'Pedido não encontrado.' });
  }

  if (!canManageOrder(currentUser, existing)) {
    return sendJson(res, 403, { error: 'VocÃª nÃ£o tem permissÃ£o para concluir este pedido.' });
  }

  if (existing.status === 'completed') {
    return sendJson(res, 400, { error: 'Este pedido já foi concluído.' });
  }

  db.prepare(`
    UPDATE orders
    SET status = 'completed',
        completed_at = CURRENT_TIMESTAMP,
        completed_by_user_id = ?,
        completed_by_name = ?
    WHERE id = ?
  `).run(currentUser.id, currentUser.name, orderId);

  sendJson(res, 200, { ok: true });
}

function deleteOrder(currentUser, res, orderId) {
  const orderExists = db.prepare('SELECT id, created_by_user_id FROM orders WHERE id = ? AND company_id = ?')
    .get(orderId, getTargetCompanyId(currentUser));
  if (!orderExists) {
    return sendJson(res, 404, { error: 'Pedido não encontrado.' });
  }

  if (!canManageOrder(currentUser, orderExists)) {
    return sendJson(res, 403, { error: 'Você não tem permissão para excluir este pedido.' });
  }

  try {
    db.exec('BEGIN');
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);
    db.prepare('DELETE FROM order_trucks WHERE order_id = ?').run(orderId);
    db.prepare('DELETE FROM orders WHERE id = ? AND company_id = ?').run(orderId, getTargetCompanyId(currentUser));
    db.exec('COMMIT');
    sendJson(res, 200, { ok: true });
  } catch (error) {
    db.exec('ROLLBACK');
    console.error(error);
    sendJson(res, 500, { error: 'Não foi possível excluir o pedido.' });
  }
}

function canManageOrder(user, order) {
  if (!user || !order) return false;
  return user.role === 'admin' || Number(order.created_by_user_id) === Number(user.id);
}

function getTruckAvailability(currentUser, res, startDateRaw, endDateRaw) {
  const companyId = getTargetCompanyId(currentUser);
  const dateRange = parseDateRange(startDateRaw, endDateRaw);
  if (dateRange.error) {
    return sendJson(res, 400, { error: dateRange.error });
  }

  const allTrucks = db.prepare('SELECT * FROM trucks WHERE company_id = ? ORDER BY volume_cm3 ASC').all(companyId);
  const busyRows = getUnavailableTruckRowsForRange(companyId, dateRange.startDate, dateRange.endDate);
  const availability = buildTruckAvailabilityMap(companyId, allTrucks, dateRange.startDate, dateRange.endDate);
  const busyTruckIds = [...availability.values()]
    .filter((item) => item.availableQuantity <= 0)
    .map((item) => item.id);

  sendJson(res, 200, {
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    busyTruckIds,
    busyTrucks: busyRows,
    availability: [...availability.values()]
  });
}

function getTruckSchedule(currentUser, res, startDateRaw, endDateRaw) {
  const companyId = getTargetCompanyId(currentUser);
  const dateRange = parseDateRange(startDateRaw, endDateRaw);
  if (dateRange.error) {
    return sendJson(res, 400, { error: dateRange.error });
  }

  const dates = buildDateSeries(dateRange.startDate, dateRange.endDate);
  if (dates.length > 45) {
    return sendJson(res, 400, { error: 'A agenda aceita no máximo 45 dias por consulta.' });
  }

  const trucks = db.prepare('SELECT * FROM trucks WHERE company_id = ? ORDER BY volume_cm3 ASC').all(companyId);
  const reservations = db.prepare(`
    SELECT
      ot.truck_id,
      ot.truck_name,
      ot.order_id,
      ot.quantity_reserved,
      o.created_by_name,
      o.start_date,
      o.end_date,
      o.total_cans,
      o.total_volume_cm3,
      o.created_at
    FROM order_trucks ot
    INNER JOIN orders o ON o.id = ot.order_id
    WHERE o.status = 'open'
      AND o.company_id = ?
      AND o.start_date <= ?
      AND o.end_date >= ?
    ORDER BY ot.truck_name ASC, o.start_date ASC, o.id ASC
  `).all(companyId, dateRange.endDate, dateRange.startDate);

  const reservationsByTruckId = new Map();
  for (const reservation of reservations) {
    if (!reservationsByTruckId.has(reservation.truck_id)) {
      reservationsByTruckId.set(reservation.truck_id, []);
    }
    reservationsByTruckId.get(reservation.truck_id).push({
      orderId: reservation.order_id,
      truckId: reservation.truck_id,
      truckName: reservation.truck_name,
      quantityReserved: Number(reservation.quantity_reserved || 1),
      createdByName: reservation.created_by_name,
      startDate: reservation.start_date,
      endDate: reservation.end_date,
      totalCans: Number(reservation.total_cans || 0),
      totalVolumeCm3: Number(reservation.total_volume_cm3 || 0),
      createdAt: reservation.created_at
    });
  }

  sendJson(res, 200, {
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    dates,
    trucks: trucks.map((truck) => ({
      id: truck.id,
      name: truck.name,
      totalQuantity: Number(truck.quantity || 1),
      volumeCm3: Number(truck.volume_cm3 || 0),
      reservations: reservationsByTruckId.get(truck.id) || []
    }))
  });
}

function parseDateValue(value, label) {
  const date = String(value || '').trim();
  if (!date) {
    return { error: `Informe a ${label}.` };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: `${label} invalida. Use o formato YYYY-MM-DD.` };
  }

  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return { error: `${label} invalida.` };
  }

  return { value: date };
}

function parseDateRange(startValue, endValue) {
  const startDate = parseDateValue(startValue, 'data inicial');
  if (startDate.error) return startDate;

  const endDate = parseDateValue(endValue, 'data final');
  if (endDate.error) return endDate;

  if (startDate.value > endDate.value) {
    return { error: 'A data final deve ser maior ou igual a data inicial.' };
  }

  return {
    startDate: startDate.value,
    endDate: endDate.value
  };
}

function buildDateSeries(startDate, endDate) {
  const dates = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const limit = new Date(`${endDate}T00:00:00`);

  while (cursor <= limit) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function getUnavailableTruckRowsForRange(companyId, startDate, endDate, excludedOrderId = null) {
  const sql = `
    SELECT
      ot.truck_id,
      ot.truck_name,
      ot.order_id,
      ot.quantity_reserved,
      o.status,
      o.start_date,
      o.end_date
    FROM order_trucks ot
    INNER JOIN orders o ON o.id = ot.order_id
    WHERE o.status = 'open'
      AND o.company_id = ?
      AND o.start_date <= ?
      AND o.end_date >= ?
      ${excludedOrderId ? 'AND o.id <> ?' : ''}
    ORDER BY ot.truck_name ASC
  `;

  return excludedOrderId
    ? db.prepare(sql).all(companyId, endDate, startDate, excludedOrderId)
    : db.prepare(sql).all(companyId, endDate, startDate);
}

function getUnavailableTruckIdsForRange(companyId, startDate, endDate, excludedOrderId = null) {
  const rows = getUnavailableTruckRowsForRange(companyId, startDate, endDate, excludedOrderId);
  return new Set(rows.map((row) => row.truck_id));
}

function buildTruckAvailabilityMap(companyId, trucks, startDate, endDate, excludedOrderId = null) {
  const reservedRows = startDate && endDate ? getUnavailableTruckRowsForRange(companyId, startDate, endDate, excludedOrderId) : [];
  const reservedByTruckId = new Map();
  for (const row of reservedRows) {
    reservedByTruckId.set(row.truck_id, (reservedByTruckId.get(row.truck_id) || 0) + Number(row.quantity_reserved || 1));
  }

  return new Map(
    trucks.map((truck) => {
      const totalQuantity = Number(truck.quantity || 1);
      const reservedQuantity = reservedByTruckId.get(truck.id) || 0;
      const availableQuantity = Math.max(0, totalQuantity - reservedQuantity);
      return [truck.id, { ...truck, totalQuantity, reservedQuantity, availableQuantity }];
    })
  );
}

function findAutomaticAllocation(totalVolumeCm3, availableTrucks, allTruckOptions = availableTrucks) {
  // Usar volume efetivo para cálculo mais realista
  const unavailableTruckIds = new Set(
    allTruckOptions.filter((truck) => Number(truck.availableQuantity || 0) <= 0).map((truck) => truck.id)
  );
  const options = buildTruckOptions(allTruckOptions, totalVolumeCm3, unavailableTruckIds);
  const bestSingle = options
    .filter((truck) => truck.isAvailable && truck.fits)
    .sort((a, b) => a.leftoverCm3 - b.leftoverCm3)[0];

  if (bestSingle) {
    return {
      strategy: 'single',
      options,
      allocation: buildAllocationResult(totalVolumeCm3, [
        {
          truckId: bestSingle.id,
          name: bestSingle.name,
          quantity: 1,
          unitVolumeCm3: bestSingle.volume_cm3
        }
      ])
    };
  }

  const fleet = findBestFleetForAutomatic(totalVolumeCm3, availableTrucks);
  if (!fleet) {
    return null;
  }

  return {
    strategy: 'multi',
    options,
    allocation: buildAllocationResult(totalVolumeCm3, fleet.allocations)
  };
}

function parseOrderTruckSelection(rawTrucks, totalVolumeCm3, availability = new Map()) {
  const trucks = Array.isArray(rawTrucks) ? rawTrucks : [];
  if (!trucks.length) {
    return { error: 'Calcule a carga e selecione os caminhões antes de lançar o pedido.' };
  }

  const selectedByTruckId = new Map();

  for (const item of trucks) {
    const truckId = Number(item?.truckId);
    const quantity = Number(item?.quantity ?? 1);
    if (!Number.isInteger(truckId) || !Number.isInteger(quantity) || quantity <= 0) {
      return { error: 'Seleção de caminhões inválida.' };
    }

    const truck = availability.get(truckId) || db.prepare('SELECT id, name, volume_cm3, quantity FROM trucks WHERE id = ?').get(truckId);
    if (!truck) {
      return { error: `Caminhão ${truckId} não encontrado.` };
    }

    const nextQuantity = (selectedByTruckId.get(truckId)?.quantity || 0) + quantity;
    const availableQuantity = Number(truck.availableQuantity ?? truck.quantity ?? 1);
    if (nextQuantity > availableQuantity) {
      return {
        error: `O caminhão "${truck.name}" possui apenas ${availableQuantity} unidade(s) disponível(is) para esse período.`
      };
    }

    selectedByTruckId.set(truckId, {
      truckId: truck.id,
      name: truck.name,
      quantity: nextQuantity,
      unitVolumeCm3: truck.volume_cm3
    });
  }

  const selected = [...selectedByTruckId.values()];
  const allocation = buildAllocationResult(totalVolumeCm3, selected);
  return { allocations: selected, allocation };
}

function parseCanPayload(body) {
  const name = String(body?.name || '').trim();
  const shape = String(body?.shape || '').trim();
  const nameError = validateEntityName(name, 'produto');

  if (nameError || !['square', 'cylinder'].includes(shape)) {
    return { error: nameError || 'Nome e formato válido são obrigatórios.' };
  }

  let lengthCm = null;
  let widthCm = null;
  let depthCm = null;
  let diameterCm = null;
  const heightCm = Number(body?.heightCm);

  if (!Number.isFinite(heightCm) || heightCm <= 0) {
    return { error: 'Altura inválida.' };
  }

  let geometryVolumeCm3;

  if (shape === 'square') {
    lengthCm = Number(body?.side1Cm ?? body?.lengthCm);
    widthCm = Number(body?.side2Cm ?? body?.widthCm);
    depthCm = heightCm;

    if (![lengthCm, widthCm, depthCm].every((value) => Number.isFinite(value) && value > 0)) {
      return { error: 'Medidas do produto retangular invalidas.' };
    }

    geometryVolumeCm3 = lengthCm * widthCm * depthCm;
  } else {
    const circumferenceCm = Number(body?.circumferenceCm);
    diameterCm = Number(body?.diameterCm);
    if (Number.isFinite(circumferenceCm) && circumferenceCm > 0) {
      diameterCm = circumferenceCm / Math.PI;
    }
    if (!Number.isFinite(diameterCm) || diameterCm <= 0) {
      return { error: 'Circunferencia invalida para produto cilindrico.' };
    }

    geometryVolumeCm3 = Math.PI * (diameterCm / 2) ** 2 * heightCm;
  }

  const volumeCm3 = inferCommercialVolumeCm3(name) || geometryVolumeCm3;

  return {
    name,
    shape,
    lengthCm,
    widthCm,
    depthCm,
    diameterCm,
    heightCm,
    volumeCm3
  };
}

function calculateLoad(currentUser, res, body) {
  const load = buildLoadSummary(currentUser, body?.items);
  if (load.error) {
    return sendJson(res, load.status || 400, { error: load.error });
  }

  const allTrucks = db.prepare('SELECT * FROM trucks WHERE company_id = ? ORDER BY volume_cm3 ASC').all(getTargetCompanyId(currentUser));
  if (!allTrucks.length) {
    return sendJson(res, 422, { error: 'Não há caminhões cadastrados para calcular a carga.' });
  }

  const fallbackDate = body?.scheduledDate;
  const hasDateRange =
    (body?.startDate !== undefined && body?.startDate !== null && String(body?.startDate).trim() !== '') ||
    (body?.endDate !== undefined && body?.endDate !== null && String(body?.endDate).trim() !== '') ||
    (fallbackDate !== undefined && fallbackDate !== null && String(fallbackDate).trim() !== '');
  const dateRange = hasDateRange
    ? parseDateRange(body?.startDate || fallbackDate, body?.endDate || fallbackDate)
    : { startDate: null, endDate: null };
  if (dateRange.error) {
    return sendJson(res, 400, { error: dateRange.error });
  }

  const availability = buildTruckAvailabilityMap(getTargetCompanyId(currentUser), allTrucks, dateRange.startDate, dateRange.endDate);
  const unavailableTruckIds = new Set(
    [...availability.values()].filter((truck) => truck.availableQuantity <= 0).map((truck) => truck.id)
  );
  const availableTrucks = [...availability.values()].filter((truck) => truck.availableQuantity > 0);
  if (!availableTrucks.length) {
    return sendJson(res, 422, {
      error: dateRange.startDate
        ? `Não há caminhões disponíveis entre ${dateRange.startDate} e ${dateRange.endDate}.`
        : 'Não há caminhões cadastrados para calcular a carga.'
    });
  }

  const mode = String(body?.mode || 'automatic').trim().toLowerCase();
  if (mode === 'manual') {
    return calculateManualLoad(res, body, load, availableTrucks, {
      allTrucks: [...availability.values()],
      availability,
      unavailableTruckIds,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate
    });
  }

  return calculateAutomaticLoad(res, load, availableTrucks, {
    allTrucks: [...availability.values()],
    availability,
    unavailableTruckIds,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate
  });
}

function calculateAutomaticLoad(res, load, trucks, context = {}) {
  // Usar cálculo 3D preciso em vez de eficiência fixa
  const effectiveVolume = load.totalEffectiveVolumeCm3 || load.totalVolumeCm3;
  
  const automatic = findAutomaticAllocation(effectiveVolume, trucks, context.allTrucks || trucks);
  if (automatic?.strategy === 'single') {
    // Obter dimensões reais do caminhão selecionado
    const selectedTruck = trucks.find(t => t.id === automatic.allocation.trucks[0].truckId);
    const truckDimensions = selectedTruck ? {
      length_cm: selectedTruck.length_cm,
      width_cm: selectedTruck.width_cm,
      height_cm: selectedTruck.height_cm
    } : null;
    
    const logisticAnalysis = calculateLogisticAnalysis(load, truckDimensions);
    return sendJson(res, 200, {
      mode: 'automatic',
      strategy: 'single',
      startDate: context.startDate || null,
      endDate: context.endDate || null,
      totalVolumeCm3: load.totalVolumeCm3,
      totalEffectiveVolumeCm3: load.totalEffectiveVolumeCm3,
      totalCans: load.totalCans,
      breakdown: load.breakdown,
      packingEfficiency: load.packingEfficiency,
      calculationMethod: load.calculationMethod || '3d_precise',
      logisticAnalysis: logisticAnalysis,
      options: automatic.options,
      allocation: automatic.allocation
    });
  }

  if (!automatic) {
    // Para erro, usar o maior caminhão disponível para análise
    const largestTruck = trucks.reduce((largest, current) => 
      (current.volume_cm3 > largest.volume_cm3) ? current : largest, trucks[0]);
    
    const truckDimensions = largestTruck ? {
      length_cm: largestTruck.length_cm,
      width_cm: largestTruck.width_cm,
      height_cm: largestTruck.height_cm
    } : null;
    
    const logisticAnalysis = calculateLogisticAnalysis(load, truckDimensions);
    return sendJson(res, 422, {
      error: 'Não foi possível encontrar combinação de caminhões para comportar a carga.',
      startDate: context.startDate || null,
      endDate: context.endDate || null,
      totalVolumeCm3: load.totalVolumeCm3,
      totalEffectiveVolumeCm3: load.totalEffectiveVolumeCm3,
      totalCans: load.totalCans,
      breakdown: load.breakdown,
      packingEfficiency: load.packingEfficiency,
      calculationMethod: load.calculationMethod || '3d_precise',
      logisticAnalysis: logisticAnalysis,
      options: buildTruckOptions(context.allTrucks || trucks, effectiveVolume, context.unavailableTruckIds || new Set())
    });
  }

  // Para múltiplos caminhões, usar dimensões do primeiro caminhão como referência
  const firstTruck = trucks.find(t => t.id === automatic.allocation.trucks[0].truckId);
  const truckDimensions = firstTruck ? {
    length_cm: firstTruck.length_cm,
    width_cm: firstTruck.width_cm,
    height_cm: firstTruck.height_cm
  } : null;
  
  const logisticAnalysis = calculateLogisticAnalysis(load, truckDimensions);
  return sendJson(res, 200, {
    mode: 'automatic',
    strategy: 'multi',
    startDate: context.startDate || null,
    endDate: context.endDate || null,
    totalVolumeCm3: load.totalVolumeCm3,
    totalEffectiveVolumeCm3: load.totalEffectiveVolumeCm3,
    totalCans: load.totalCans,
    breakdown: load.breakdown,
    packingEfficiency: load.packingEfficiency,
    calculationMethod: load.calculationMethod || '3d_precise',
    logisticAnalysis: logisticAnalysis,
    options: automatic.options,
    allocation: automatic.allocation
  });
}

function calculateManualLoad(res, body, load, trucks, context = {}) {
  // Usar volume efetivo 3D para cálculo preciso
  const effectiveVolume = load.totalEffectiveVolumeCm3 || load.totalVolumeCm3;
  const type = String(body?.manual?.type || 'single').trim().toLowerCase();

  if (type === 'single') {
    const truckId = Number(body?.manual?.truckId);
    if (!Number.isInteger(truckId)) {
      return sendJson(res, 400, { error: 'Selecione um caminhão valido para o modo manual (um caminhão).' });
    }

    const truck = trucks.find((entry) => entry.id === truckId);
    if (!truck) {
      const unavailableTruck = (context.availability || new Map()).get(truckId) || (context.allTrucks || []).find((entry) => entry.id === truckId);
      if (unavailableTruck && Number(unavailableTruck.availableQuantity || 0) <= 0 && context.startDate && context.endDate) {
        return sendJson(res, 409, {
          error: `O caminhão "${unavailableTruck.name}" não possui unidades disponíveis entre ${context.startDate} e ${context.endDate}.`
        });
      }
      return sendJson(res, 404, { error: 'Caminhão selecionado não encontrado.' });
    }

    // Obter dimensões reais do caminhão para análise 3D
    const truckDimensions = {
      length_cm: truck.length_cm,
      width_cm: truck.width_cm,
      height_cm: truck.height_cm
    };

    const allocation = buildAllocationResult(effectiveVolume, [
      {
        truckId: truck.id,
        name: truck.name,
        quantity: 1,
        unitVolumeCm3: truck.volume_cm3
      }
    ]);

    const logisticAnalysis = calculateLogisticAnalysis(load, truckDimensions);
    return sendJson(res, 200, {
      mode: 'manual',
      strategy: 'single',
      startDate: context.startDate || null,
      endDate: context.endDate || null,
      totalVolumeCm3: load.totalVolumeCm3,
      totalEffectiveVolumeCm3: load.totalEffectiveVolumeCm3,
      totalCans: load.totalCans,
      breakdown: load.breakdown,
      packingEfficiency: load.packingEfficiency,
      calculationMethod: load.calculationMethod || '3d_precise',
      logisticAnalysis: logisticAnalysis,
      allocation
    });
  }

  if (type === 'multi') {
    const rawAllocations = Array.isArray(body?.manual?.allocations) ? body.manual.allocations : [];
    if (!rawAllocations.length) {
      return sendJson(res, 400, { error: 'Adicione ao menos um caminhão para distribuicao manual.' });
    }

    const byTruckId = new Map();
    for (const item of rawAllocations) {
      const truckId = Number(item?.truckId);
      const quantity = Number(item?.quantity ?? 1);
      if (!Number.isInteger(truckId) || !Number.isInteger(quantity) || quantity <= 0) {
        return sendJson(res, 400, { error: 'Distribuição manual inválida. Verifique os caminhões selecionados.' });
      }
      byTruckId.set(truckId, (byTruckId.get(truckId) || 0) + quantity);
    }

    const allocations = [];
    for (const [truckId, quantity] of byTruckId.entries()) {
      const truck = trucks.find((entry) => entry.id === truckId);
      if (!truck) {
        const unavailableTruck = (context.availability || new Map()).get(truckId) || (context.allTrucks || []).find((entry) => entry.id === truckId);
        if (unavailableTruck && Number(unavailableTruck.availableQuantity || 0) <= 0 && context.startDate && context.endDate) {
          return sendJson(res, 409, {
            error: `O caminhão "${unavailableTruck.name}" não possui unidades disponíveis entre ${context.startDate} e ${context.endDate}.`
          });
        }
        return sendJson(res, 404, { error: `Caminhão ${truckId} não encontrado.` });
      }

      if (quantity > Number(truck.availableQuantity || 0)) {
        return sendJson(res, 409, {
          error: `O caminhão "${truck.name}" possui apenas ${truck.availableQuantity} unidade(s) disponível(is) para esse período.`
        });
      }

      allocations.push({
        truckId: truck.id,
        name: truck.name,
        quantity,
        unitVolumeCm3: truck.volume_cm3
      });
    }

    // Usar primeiro caminhão para análise 3D
    const firstTruck = trucks.find(t => t.id === allocations[0].truckId);
    const truckDimensions = firstTruck ? {
      length_cm: firstTruck.length_cm,
      width_cm: firstTruck.width_cm,
      height_cm: firstTruck.height_cm
    } : null;

    const allocation = buildAllocationResult(effectiveVolume, allocations);
    const logisticAnalysis = calculateLogisticAnalysis(load, truckDimensions);
    return sendJson(res, 200, {
      mode: 'manual',
      strategy: 'multi',
      startDate: context.startDate || null,
      endDate: context.endDate || null,
      totalVolumeCm3: load.totalVolumeCm3,
      totalEffectiveVolumeCm3: load.totalEffectiveVolumeCm3,
      totalCans: load.totalCans,
      breakdown: load.breakdown,
      packingEfficiency: load.packingEfficiency,
      calculationMethod: load.calculationMethod || '3d_precise',
      logisticAnalysis: logisticAnalysis,
      allocation
    });
  }

  return sendJson(res, 400, { error: 'Tipo de distribuição manual inválido.' });
}

function buildLoadSummary(currentUser, itemsInput) {
  const items = Array.isArray(itemsInput) ? itemsInput : [];
  if (!items.length) {
    return { error: 'Adicione ao menos um item na carga.', status: 400 };
  }

  let totalVolumeCm3 = 0;
  let totalEffectiveVolumeCm3 = 0;
  let totalCans = 0;
  const breakdown = [];

  // Buscar dados completos dos produtos para calculo 3D
  const canIds = items.map(item => Number(item.canId));
  const companyId = getTargetCompanyId(currentUser);
  const cansData = canIds.length > 0 ? 
    db.prepare(`SELECT id, name, shape, length_cm, width_cm, depth_cm, diameter_cm, height_cm, volume_cm3 FROM cans WHERE company_id = ? AND id IN (${canIds.map(() => '?').join(',')})`).all(companyId, ...canIds) : [];

  for (const item of items) {
    const canId = Number(item?.canId);
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(canId) || !Number.isInteger(quantity) || quantity <= 0) {
      return { error: 'Itens da carga inválidos.', status: 400 };
    }

    const can = cansData.find(c => c.id === canId);
    if (!can) {
      return { error: `Produto ${canId} nao encontrado.`, status: 404 };
    }

    const itemVolume = can.volume_cm3 * quantity;
    
    const dimensions = getPackingDimensions(can);
    if (!dimensions) {
      return { error: `Dimensoes invalidas para o produto ${can.name}.`, status: 400 };
    }
    const effectiveVolume = dimensions.length * dimensions.width * dimensions.height * quantity;
    
    totalVolumeCm3 += itemVolume;
    totalEffectiveVolumeCm3 += effectiveVolume;
    totalCans += quantity;
    breakdown.push({
      canId: can.id,
      canName: can.name,
      canShape: can.shape,
      quantity,
      unitVolumeCm3: can.volume_cm3,
      totalVolumeCm3: itemVolume,
      effectiveVolumeCm3: effectiveVolume,
      dimensions3D: dimensions,
      packingEfficiency: itemVolume / effectiveVolume // eficiência real baseada no volume 3D
    });
  }

  const overallPackingEfficiency = totalVolumeCm3 > 0 ? (totalVolumeCm3 / totalEffectiveVolumeCm3) : 1;

  return { 
    totalVolumeCm3, 
    totalEffectiveVolumeCm3,
    totalCans, 
    breakdown,
    packingEfficiency: overallPackingEfficiency,
    calculationMethod: '3d_precise'
  };
}

function calculateLogisticAnalysis(load, truckDimensions = null) {
  // Usar dimensões reais do caminhão se fornecidas, senão usar padrão atualizado
  const truck = truckDimensions || {
    length_cm: 1450,  // 14.5m comprimento
    width_cm: 245,    // 2.45m largura  
    height_cm: 170     // 1.70m altura
  };
  
  const truckCapacity = truck.length_cm * truck.width_cm * truck.height_cm;
  const effectiveLoadVolume = load.totalEffectiveVolumeCm3;
  
  // Análise 3D precisa
  const occupancyRate = (effectiveLoadVolume / truckCapacity) * 100;
  const remainingSpace = truckCapacity - effectiveLoadVolume;
  const remainingSpacePercent = (remainingSpace / truckCapacity) * 100;
  
  // Classificação da ocupação baseada no cálculo 3D
  let riskLevel = 'BAIXA';
  if (occupancyRate > 90) riskLevel = 'ALTA';
  else if (occupancyRate > 75) riskLevel = 'MÉDIA';
  
  return {
    metodo: 'Cálculo 3D Preciso',
    volumeTotalTeorico: load.totalVolumeCm3 / 1000000,
    volumeEfetivoNecessario: effectiveLoadVolume / 1000000,
    volumeUtilCaminhao: truckCapacity / 1000000,
    taxaOcupacao: Math.round(occupancyRate * 100) / 100,
    espacoRestante: remainingSpace / 1000000,
    espacoRestantePercentual: Math.round(remainingSpacePercent * 100) / 100,
    conclusao: effectiveLoadVolume <= truckCapacity ? 'CABE em 1 caminhão (cálculo 3D)' : 'NÃO CABE - precisa de múltiplos caminhões (cálculo 3D)',
    nivelRisco: riskLevel,
    recomendacao: get3DLogisticRecommendation(occupancyRate, riskLevel, load),
    dimensoesCaminhao: {
      comprimento: truck.length_cm,
      largura: truck.width_cm,
      altura: truck.height_cm
    },
    eficienciaEmpacotamento: load.packingEfficiency || 1
  };
}

function get3DLogisticRecommendation(occupancyRate, riskLevel, load) {
  const efficiency = load.packingEfficiency || 1;
  
  if (riskLevel === 'ALTA') {
    if (efficiency > 0.8) {
      return 'Caminhão com ocupação muito alta baseada em cálculo 3D preciso. Verificar dimensões reais das peças.';
    } else {
      return 'Ocupação alta devido à forma dos itens. Considerar reorganização ou múltiplos caminhões.';
    }
  } else if (riskLevel === 'MÉDIA') {
    return 'Ocupação moderada com boa margem de segurança - cálculo 3D confirma viabilidade.';
  } else {
    return 'Carga confortável com ampla margem - excelente para transporte seguro.';
  }
}

function getPackingDimensions(item) {
  const shape = String(item?.canShape || item?.shape || '').trim().toLowerCase();
  const height = Number(item?.height_cm);

  if (!Number.isFinite(height) || height <= 0) {
    return null;
  }

  if (shape === 'cylinder') {
    const diameter = Number(item?.diameter_cm ?? item?.width_cm ?? item?.length_cm);
    if (!Number.isFinite(diameter) || diameter <= 0) {
      return null;
    }

    return {
      length: diameter,
      width: diameter,
      height,
      type: 'cylinder'
    };
  }

  const length = Number(item?.length_cm);
  const width = Number(item?.width_cm ?? item?.depth_cm ?? item?.length_cm);

  if (![length, width].every((value) => Number.isFinite(value) && value > 0)) {
    return null;
  }

  return {
    length,
    width,
    height,
    type: shape === 'container' ? 'container' : 'box'
  };
}

function buildTruckOptions(trucks, totalVolumeCm3, unavailableTruckIds = new Set()) {
  return trucks.map((truck) => {
    const availableQuantity = Number(truck.availableQuantity ?? truck.quantity ?? (unavailableTruckIds.has(truck.id) ? 0 : 1));
    const totalQuantity = Number(truck.totalQuantity ?? truck.quantity ?? 1);
    const reservedQuantity = Number(truck.reservedQuantity ?? Math.max(0, totalQuantity - availableQuantity));
    const isAvailable = availableQuantity > 0 && !unavailableTruckIds.has(truck.id);
    const available = truck.volume_cm3 - totalVolumeCm3;
    return {
      ...truck,
      totalQuantity,
      reservedQuantity,
      availableQuantity,
      isAvailable,
      fits: isAvailable && available >= 0,
      leftoverCm3: available,
      occupancyRate: Number((totalVolumeCm3 / truck.volume_cm3).toFixed(4))
    };
  });
}

function buildAllocationResult(totalVolumeCm3, allocationsInput) {
  const allocations = allocationsInput
    .map((item) => {
      const quantity = Number(item.quantity);
      const unitVolumeCm3 = Number(item.unitVolumeCm3);
      const totalCapacityCm3 = quantity * unitVolumeCm3;
      return {
        truckId: item.truckId,
        name: item.name,
        quantity,
        unitVolumeCm3,
        totalCapacityCm3
      };
    })
    .filter((item) => item.quantity > 0);

  const totalCapacityCm3 = allocations.reduce((sum, item) => sum + item.totalCapacityCm3, 0);
  const leftoverCm3 = Math.max(0, totalCapacityCm3 - totalVolumeCm3);
  const missingCm3 = Math.max(0, totalVolumeCm3 - totalCapacityCm3);
  const fits = missingCm3 <= 0;

  return {
    fits,
    trucks: allocations,
    totalCapacityCm3,
    leftoverCm3,
    missingCm3,
    occupancyRate: totalCapacityCm3 > 0 ? Number((totalVolumeCm3 / totalCapacityCm3).toFixed(4)) : 0
  };
}

function findBestFleetForAutomatic(totalVolumeCm3, trucks) {
  if (!trucks.length) return null;

  const sorted = [...trucks]
    .flatMap((truck) =>
      Array.from({ length: Math.max(0, Number(truck.availableQuantity || truck.quantity || 0)) }, () => ({
        id: truck.id,
        name: truck.name,
        volume_cm3: Number(truck.volume_cm3)
      }))
    )
    .sort((a, b) => b.volume_cm3 - a.volume_cm3);
  if (!sorted.length) return null;
  let best = null;

  function visit(index, picked, currentCapacity) {
      if (currentCapacity >= totalVolumeCm3) {
        const leftoverCm3 = currentCapacity - totalVolumeCm3;
        if (!best || leftoverCm3 < best.leftoverCm3) {
          const grouped = new Map();
          for (const truck of picked) {
            const existing = grouped.get(truck.id);
            if (existing) {
              existing.quantity += 1;
            } else {
              grouped.set(truck.id, {
                truckId: truck.id,
                name: truck.name,
                quantity: 1,
                unitVolumeCm3: truck.volume_cm3
              });
            }
          }
          best = {
            leftoverCm3,
            allocations: [...grouped.values()]
          };
        }
        return;
    }

    if (index >= sorted.length) return;

    const maxPossible = currentCapacity + sorted.slice(index).reduce((sum, truck) => sum + truck.volume_cm3, 0);
    if (maxPossible < totalVolumeCm3) return;

    if (best && currentCapacity >= totalVolumeCm3 && currentCapacity - totalVolumeCm3 >= best.leftoverCm3) return;

    picked.push(sorted[index]);
    visit(index + 1, picked, currentCapacity + sorted[index].volume_cm3);
    picked.pop();

    visit(index + 1, picked, currentCapacity);
  }

  visit(0, [], 0);
  return best;
}

function getSessionContext(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[getSessionCookieName(req)] || cookies['__Host-sid'] || cookies.sid;
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;

  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }

  const requestFingerprint = getRequestFingerprint(req);
  if (
    session.ipHash !== requestFingerprint.ipHash ||
    session.userAgentHash !== requestFingerprint.userAgentHash
  ) {
    sessions.delete(token);
    return null;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId);
  if (!user || !user.is_active) {
    sessions.delete(token);
    return null;
  }

  if (!isPlatformAdmin(user) && user.company_id) {
    const company = db.prepare('SELECT status FROM companies WHERE id = ?').get(user.company_id);
    if (!company || company.status !== 'active') {
      sessions.delete(token);
      return null;
    }
  }

  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return { token, session, user };
}

function getSessionUser(req) {
  return getSessionContext(req)?.user || null;
}

function requireSession(req, res) {
  const context = getSessionContext(req);
  if (!context) {
    sendJson(res, 401, { error: 'Não autenticado.' });
    return null;
  }

  return context;
}

function requireAuth(req, res) {
  return requireSession(req, res)?.user || null;
}

function isPlatformAdmin(user) {
  return Boolean(user?.is_platform_admin);
}

function requireAdmin(req, res) {
  const user = requireAuth(req, res);
  if (!user) return null;

  if (user.role !== 'admin') {
    sendJson(res, 403, { error: 'Apenas administradores podem acessar este recurso.' });
    return null;
  }

  return user;
}

function requireModuleAccess(req, res, moduleKey) {
  const user = requireAuth(req, res);
  if (!user) return null;

  if (!userHasModule(user, moduleKey)) {
    sendJson(res, 403, { error: 'Seu usuario nao possui acesso a este modulo.' });
    return null;
  }

  return user;
}

function requireCompanyModuleAccess(req, res, moduleKey) {
  const user = requireModuleAccess(req, res, moduleKey);
  if (!user) return null;

  if (isPlatformAdmin(user) || !Number(user.company_id || 0)) {
    sendJson(res, 403, { error: 'Este recurso operacional exige um usuario vinculado a uma empresa.' });
    return null;
  }

  return user;
}

function requirePlatformAdmin(req, res) {
  const user = requireAdmin(req, res);
  if (!user) return null;

  if (!isPlatformAdmin(user)) {
    sendJson(res, 403, { error: 'Apenas o administrador master pode acessar este recurso.' });
    return null;
  }

  return user;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function validateEntityName(name, label = 'registro') {
  if (!name) {
    return `O nome do ${label} é obrigatório.`;
  }

  if (name.length > MAX_NAME_LENGTH) {
    return `O nome do ${label} deve ter no máximo ${MAX_NAME_LENGTH} caracteres.`;
  }

  if (/[\u0000-\u001F\u007F]/.test(name)) {
    return `O nome do ${label} contém caracteres inválidos.`;
  }

  return null;
}

function validateEmailAddress(email) {
  if (!email) {
    return 'E-mail é obrigatório.';
  }

  if (email.length > MAX_EMAIL_LENGTH) {
    return `O e-mail deve ter no máximo ${MAX_EMAIL_LENGTH} caracteres.`;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'E-mail inválido.';
  }

  return null;
}

function validatePasswordStrength(password) {
  if (password.length < 12) {
    return 'A senha deve ter pelo menos 12 caracteres.';
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return 'A senha deve incluir letra maiúscula, minúscula, número e caractere especial.';
  }

  return null;
}

function verifyPassword(password, fullHash) {
  const [salt, storedHash] = String(fullHash).split(':');
  if (!salt || !storedHash) return false;

  const inputHash = crypto.scryptSync(password, salt, 64).toString('hex');
  const inputBuffer = Buffer.from(inputHash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');

  if (inputBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(inputBuffer, storedBuffer);
}

function safeUser(user) {
  const company = user.company_id
    ? db.prepare('SELECT id, name, status FROM companies WHERE id = ?').get(user.company_id)
    : null;
  const companyModules = company ? getCompanyModules(company.id) : [];
  const userModules = isPlatformAdmin(user)
    ? AVAILABLE_MODULES.map((module) => module.key)
    : companyModules;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: Boolean(user.is_active),
    isPlatformAdmin: isPlatformAdmin(user),
    companyId: company?.id || null,
    companyName: company?.name || 'Plataforma',
    companyStatus: company?.status || 'active',
    companyModules,
    modules: userModules,
    createdAt: user.created_at
  };
}

function parseCookies(cookieHeader) {
  const result = {};
  const chunks = cookieHeader.split(';');

  for (const chunk of chunks) {
    const [rawKey, ...rest] = chunk.trim().split('=');
    if (!rawKey) continue;
    result[rawKey] = decodeURIComponent(rest.join('='));
  }

  return result;
}

function getSessionCookieName(req) {
  return isSecureRequest(req) ? '__Host-sid' : 'sid';
}

function setCookie(res, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.secure) parts.push('Secure');

  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionsByUserId(userId) {
  for (const [token, session] of sessions.entries()) {
    if (session.userId === userId) {
      sessions.delete(token);
    }
  }
}

function serveStaticFile(res, pathname, method = 'GET') {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, 'Acesso negado.');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendText(res, 404, 'Arquivo não encontrado.');
      return;
    }

    const contentType = getContentType(filePath);
    res.writeHead(200, getBaseHeaders({
      contentType,
      cacheControl: contentType.startsWith('text/html') ? 'no-store' : 'private, max-age=300'
    }));
    if (method === 'HEAD') {
      res.end();
      return;
    }
    res.end(data);
  });
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';

    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > MAX_JSON_PAYLOAD_BYTES) {
        req.socket.destroy();
        reject(new Error('Payload muito grande.'));
      }
    });

    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error('JSON inválido.'));
      }
    });

    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, getBaseHeaders({
    contentType: 'application/json; charset=utf-8',
    cacheControl: 'no-store'
  }));
  res.end(JSON.stringify(payload));
}

function sendText(res, status, message) {
  res.writeHead(status, getBaseHeaders({
    contentType: 'text/plain; charset=utf-8',
    cacheControl: 'no-store'
  }));
  res.end(message);
}

function getBaseHeaders({ contentType, cacheControl } = {}) {
  return {
    ...(contentType ? { 'Content-Type': contentType } : {}),
    ...(cacheControl ? { 'Cache-Control': cacheControl } : {}),
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Origin-Agent-Cluster': '?1',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'X-Robots-Tag': 'noindex, nofollow'
  };
}

function isSameOriginRequest(req) {
  const originHeader = String(req.headers.origin || '').trim();
  if (!originHeader) {
    return true;
  }

  try {
    const originUrl = new URL(originHeader);
    const expectedOrigin = getExpectedOrigin(req);
    return !expectedOrigin || originUrl.origin === expectedOrigin;
  } catch (_error) {
    return false;
  }
}

function getExpectedOrigin(req) {
  const configured = String(process.env.APP_ORIGIN || '').trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const protocol = isSecureRequest(req) ? 'https' : 'http';
  return `${protocol}://${req.headers.host}`;
}

function isSecureRequest(req) {
  return req.socket?.encrypted || String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
}

function getClientIp(req) {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').trim();
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.socket?.remoteAddress || 'unknown';
}

function getLoginRateLimitState(req) {
  const now = Date.now();
  const ip = getClientIp(req);
  const current = loginAttempts.get(ip);

  if (!current) {
    return { blocked: false, retryAfterSeconds: 0 };
  }

  if (current.blockedUntil && current.blockedUntil > now) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((current.blockedUntil - now) / 1000))
    };
  }

  if (now - current.windowStartedAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
  }

  return { blocked: false, retryAfterSeconds: 0 };
}

function registerLoginFailure(req) {
  const now = Date.now();
  const ip = getClientIp(req);
  const current = loginAttempts.get(ip);

  if (!current || now - current.windowStartedAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, {
      attempts: 1,
      windowStartedAt: now,
      blockedUntil: 0
    });
    return;
  }

  current.attempts += 1;
  if (current.attempts >= LOGIN_MAX_ATTEMPTS) {
    current.blockedUntil = now + LOGIN_WINDOW_MS;
  }
  loginAttempts.set(ip, current);
}

function clearLoginFailures(req) {
  loginAttempts.delete(getClientIp(req));
}

function sha256(input) {
  return crypto.createHash('sha256').update(String(input || '')).digest('hex');
}

function getRequestFingerprint(req) {
  return {
    ipHash: sha256(getClientIp(req)),
    userAgentHash: sha256(String(req.headers['user-agent'] || 'unknown'))
  };
}

function createSessionRecord(req, userId) {
  const fingerprint = getRequestFingerprint(req);
  return {
    userId,
    csrfToken: crypto.randomBytes(32).toString('hex'),
    expiresAt: Date.now() + SESSION_TTL_MS,
    ipHash: fingerprint.ipHash,
    userAgentHash: fingerprint.userAgentHash
  };
}

function ensureJsonRequest(req) {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    throw new Error('Content-Type inválido.');
  }
}

function requireCsrf(req, res) {
  const sessionContext = requireSession(req, res);
  if (!sessionContext) return null;

  const csrfToken = String(req.headers['x-csrf-token'] || '').trim();
  if (!csrfToken || csrfToken !== sessionContext.session.csrfToken) {
    sendJson(res, 403, { error: 'Token CSRF inválido.' });
    return null;
  }

  return sessionContext;
}

function enforceApiRateLimit(req, res, method) {
  const now = Date.now();
  const bucket = method === 'GET' ? 'read' : 'write';
  const windowMs = bucket === 'read' ? API_READ_WINDOW_MS : API_WRITE_WINDOW_MS;
  const maxRequests = bucket === 'read' ? API_READ_MAX_REQUESTS : API_WRITE_MAX_REQUESTS;
  const key = `${bucket}:${getClientIp(req)}`;
  const current = apiRateLimits.get(key);

  if (!current || current.resetAt <= now) {
    apiRateLimits.set(key, {
      count: 1,
      resetAt: now + windowMs
    });
    return true;
  }

  current.count += 1;
  apiRateLimits.set(key, current);

  if (current.count > maxRequests) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((current.resetAt - now) / 1000))));
    sendJson(res, 429, { error: 'Muitas requisições. Aguarde um momento e tente novamente.' });
    return false;
  }

  return true;
}


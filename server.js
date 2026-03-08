const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_PATH = path.join(__dirname, 'database.sqlite');

const db = new DatabaseSync(DB_PATH);
const sessions = new Map();

initDb();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }

    serveStaticFile(res, url.pathname);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: 'Erro interno no servidor.' });
  }
});

server.listen(PORT, () => {
  console.log(`Servidor iniciado em http://localhost:${PORT}`);
});

function initDb() {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      shape TEXT NOT NULL CHECK(shape IN ('square', 'cylinder')),
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
      can_id INTEGER,
      can_name TEXT NOT NULL,
      can_shape TEXT NOT NULL CHECK(can_shape IN ('square', 'cylinder')),
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
  `);

  ensureOrderSchemaCompatibility();

  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (!userCount) {
    db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run('Administrador', 'admin@granilha.local', hashPassword('admin123'), 'admin');
  }

  const truckCount = db.prepare('SELECT COUNT(*) AS count FROM trucks').get().count;
  if (!truckCount) {
    const seedTrucks = [
      ['VUC Pequeno', 220, 180, 160],
      ['Truck Medio', 420, 220, 220],
      ['Toco Grande', 620, 235, 240],
      ['Carreta', 1250, 250, 280]
    ];

    const insertTruck = db.prepare(`
      INSERT INTO trucks (name, length_cm, width_cm, height_cm, quantity, volume_cm3)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const [name, l, w, h] of seedTrucks) {
      insertTruck.run(name, l, w, h, 1, l * w * h);
    }
  }

  const canCount = db.prepare('SELECT COUNT(*) AS count FROM cans').get().count;
  if (!canCount) {
    const insertCan = db.prepare(`
      INSERT INTO cans (name, shape, length_cm, width_cm, depth_cm, diameter_cm, height_cm, volume_cm3)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertCan.run('Lata Quadrada 18L', 'square', 23, 23, 34, null, 34, 23 * 23 * 34);
    const d = 16;
    const h = 18;
    insertCan.run('Lata Cilindrica 3.6L', 'cylinder', null, null, null, d, h, Math.PI * (d / 2) ** 2 * h);
  }
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
}

async function handleApi(req, res, url) {
  const method = req.method || 'GET';
  const canIdMatch = url.pathname.match(/^\/api\/cans\/(\d+)$/);
  const truckIdMatch = url.pathname.match(/^\/api\/trucks\/(\d+)$/);
  const userIdMatch = url.pathname.match(/^\/api\/users\/(\d+)$/);
  const orderIdMatch = url.pathname.match(/^\/api\/orders\/(\d+)$/);
  const orderConcludeMatch = url.pathname.match(/^\/api\/orders\/(\d+)\/conclude$/);

  if (method === 'POST' && url.pathname === '/api/login') {
    const body = await readJson(req);
    return login(res, body);
  }

  if (method === 'POST' && url.pathname === '/api/logout') {
    return logout(req, res);
  }

  if (method === 'GET' && url.pathname === '/api/me') {
    const user = requireAuth(req, res);
    if (!user) return;
    return sendJson(res, 200, { user: safeUser(user) });
  }

  if (method === 'GET' && url.pathname === '/api/cans') {
    const user = requireAuth(req, res);
    if (!user) return;
    const cans = db.prepare('SELECT * FROM cans ORDER BY created_at DESC').all();
    return sendJson(res, 200, { cans });
  }

  if (method === 'POST' && url.pathname === '/api/cans') {
    const user = requireAdmin(req, res);
    if (!user) return;
    const body = await readJson(req);
    return createCan(res, body);
  }

  if (canIdMatch && method === 'PUT') {
    const user = requireAdmin(req, res);
    if (!user) return;
    const body = await readJson(req);
    return updateCan(res, Number(canIdMatch[1]), body);
  }

  if (canIdMatch && method === 'DELETE') {
    const user = requireAdmin(req, res);
    if (!user) return;
    return deleteCan(res, Number(canIdMatch[1]));
  }

  if (method === 'GET' && url.pathname === '/api/trucks') {
    const user = requireAuth(req, res);
    if (!user) return;
    const trucks = db.prepare('SELECT * FROM trucks ORDER BY volume_cm3 ASC').all();
    return sendJson(res, 200, { trucks });
  }

  if (method === 'POST' && url.pathname === '/api/trucks') {
    const user = requireAdmin(req, res);
    if (!user) return;
    const body = await readJson(req);
    return createTruck(res, body);
  }

  if (truckIdMatch && method === 'PUT') {
    const user = requireAdmin(req, res);
    if (!user) return;
    const body = await readJson(req);
    return updateTruck(res, Number(truckIdMatch[1]), body);
  }

  if (truckIdMatch && method === 'DELETE') {
    const user = requireAdmin(req, res);
    if (!user) return;
    return deleteTruck(res, Number(truckIdMatch[1]));
  }

  if (method === 'POST' && url.pathname === '/api/users') {
    const user = requireAdmin(req, res);
    if (!user) return;
    const body = await readJson(req);
    return createUser(res, body);
  }

  if (method === 'GET' && url.pathname === '/api/users') {
    const user = requireAdmin(req, res);
    if (!user) return;
    const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC').all();
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
    const user = requireAuth(req, res);
    if (!user) return;
    return listOrders(res);
  }

  if (method === 'POST' && url.pathname === '/api/orders') {
    const user = requireAuth(req, res);
    if (!user) return;
    const body = await readJson(req);
    return createOrder(user, res, body);
  }

  if (method === 'GET' && url.pathname === '/api/truck-availability') {
    const user = requireAuth(req, res);
    if (!user) return;
    const fallbackDate = url.searchParams.get('date');
    return getTruckAvailability(
      res,
      url.searchParams.get('startDate') || fallbackDate,
      url.searchParams.get('endDate') || fallbackDate
    );
  }

  if (orderIdMatch && method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return;
    return getOrderDetails(res, Number(orderIdMatch[1]));
  }

  if (orderConcludeMatch && method === 'POST') {
    const user = requireAdmin(req, res);
    if (!user) return;
    return concludeOrder(user, res, Number(orderConcludeMatch[1]));
  }

  if (orderIdMatch && method === 'DELETE') {
    const user = requireAdmin(req, res);
    if (!user) return;
    return deleteOrder(res, Number(orderIdMatch[1]));
  }

  if (method === 'POST' && url.pathname === '/api/calculate') {
    const user = requireAuth(req, res);
    if (!user) return;
    const body = await readJson(req);
    return calculateLoad(res, body);
  }

  sendJson(res, 404, { error: 'Rota nao encontrada.' });
}

function login(res, body) {
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');

  if (!email || !password) {
    return sendJson(res, 400, { error: 'Informe email e senha.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return sendJson(res, 401, { error: 'Credenciais invalidas.' });
  }

  const sessionToken = crypto.randomBytes(32).toString('hex');
  sessions.set(sessionToken, { userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS });

  setCookie(res, 'sid', sessionToken, {
    httpOnly: true,
    sameSite: 'Strict',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    path: '/'
  });

  sendJson(res, 200, { user: safeUser(user) });
}

function logout(req, res) {
  const cookies = parseCookies(req.headers.cookie || '');
  if (cookies.sid) {
    sessions.delete(cookies.sid);
  }

  setCookie(res, 'sid', '', { httpOnly: true, sameSite: 'Strict', maxAge: 0, path: '/' });
  sendJson(res, 200, { ok: true });
}

function createCan(res, body) {
  const parsed = parseCanPayload(body);
  if (parsed.error) {
    return sendJson(res, 400, { error: parsed.error });
  }

  const { name, shape, lengthCm, widthCm, depthCm, diameterCm, heightCm, volumeCm3 } = parsed;

  db.prepare(`
    INSERT INTO cans (name, shape, length_cm, width_cm, depth_cm, diameter_cm, height_cm, volume_cm3)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, shape, lengthCm, widthCm, depthCm, diameterCm, heightCm, volumeCm3);

  sendJson(res, 201, { ok: true });
}

function updateCan(res, canId, body) {
  const existing = db.prepare('SELECT * FROM cans WHERE id = ?').get(canId);
  if (!existing) {
    return sendJson(res, 404, { error: 'Lata nao encontrada.' });
  }

  const mergedBody = {
    name: body?.name ?? existing.name,
    shape: body?.shape ?? existing.shape,
    heightCm: body?.heightCm ?? existing.height_cm,
    side1Cm: body?.side1Cm ?? body?.lengthCm ?? existing.length_cm,
    side2Cm: body?.side2Cm ?? body?.widthCm ?? existing.width_cm,
    diameterCm: body?.diameterCm ?? existing.diameter_cm
  };

  const parsed = parseCanPayload(mergedBody);
  if (parsed.error) {
    return sendJson(res, 400, { error: parsed.error });
  }

  const { name, shape, lengthCm, widthCm, depthCm, diameterCm, heightCm, volumeCm3 } = parsed;

  db.prepare(`
    UPDATE cans
    SET name = ?, shape = ?, length_cm = ?, width_cm = ?, depth_cm = ?, diameter_cm = ?, height_cm = ?, volume_cm3 = ?
    WHERE id = ?
  `).run(name, shape, lengthCm, widthCm, depthCm, diameterCm, heightCm, volumeCm3, canId);

  sendJson(res, 200, { ok: true });
}

function deleteCan(res, canId) {
  const result = db.prepare('DELETE FROM cans WHERE id = ?').run(canId);
  if (!result.changes) {
    return sendJson(res, 404, { error: 'Lata nao encontrada.' });
  }

  sendJson(res, 200, { ok: true });
}

function createTruck(res, body) {
  const name = String(body?.name || '').trim();
  const lengthCm = Number(body?.lengthCm);
  const widthCm = Number(body?.widthCm);
  const heightCm = Number(body?.heightCm);
  const quantity = Number(body?.quantity ?? 1);

  if (
    !name ||
    ![lengthCm, widthCm, heightCm].every((value) => Number.isFinite(value) && value > 0) ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return sendJson(res, 400, { error: 'Nome, medidas validas e quantidade inteira do caminhao sao obrigatorios.' });
  }

  const volumeCm3 = lengthCm * widthCm * heightCm;

  db.prepare(`
    INSERT INTO trucks (name, length_cm, width_cm, height_cm, quantity, volume_cm3)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, lengthCm, widthCm, heightCm, quantity, volumeCm3);

  sendJson(res, 201, { ok: true });
}

function updateTruck(res, truckId, body) {
  const existing = db.prepare('SELECT * FROM trucks WHERE id = ?').get(truckId);
  if (!existing) {
    return sendJson(res, 404, { error: 'Caminhao nao encontrado.' });
  }

  const name = String(body?.name ?? existing.name).trim();
  const lengthCm = Number(body?.lengthCm ?? existing.length_cm);
  const widthCm = Number(body?.widthCm ?? existing.width_cm);
  const heightCm = Number(body?.heightCm ?? existing.height_cm);
  const quantity = Number(body?.quantity ?? existing.quantity ?? 1);

  if (
    !name ||
    ![lengthCm, widthCm, heightCm].every((value) => Number.isFinite(value) && value > 0) ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return sendJson(res, 400, { error: 'Nome, medidas validas e quantidade inteira do caminhao sao obrigatorios.' });
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
      error: `Nao e possivel reduzir a quantidade para ${quantity}. Existem ${activeReservations} unidade(s) desse caminhao em pedidos abertos.`
    });
  }

  db.prepare(`
    UPDATE trucks
    SET name = ?, length_cm = ?, width_cm = ?, height_cm = ?, quantity = ?, volume_cm3 = ?
    WHERE id = ?
  `).run(name, lengthCm, widthCm, heightCm, quantity, volumeCm3, truckId);

  sendJson(res, 200, { ok: true });
}

function deleteTruck(res, truckId) {
  const result = db.prepare('DELETE FROM trucks WHERE id = ?').run(truckId);
  if (!result.changes) {
    return sendJson(res, 404, { error: 'Caminhao nao encontrado.' });
  }

  sendJson(res, 200, { ok: true });
}

function createUser(res, body) {
  const name = String(body?.name || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  const role = String(body?.role || 'user').trim();

  if (!name || !email || !password || !['admin', 'user'].includes(role)) {
    return sendJson(res, 400, { error: 'Dados do usuario invalidos.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return sendJson(res, 409, { error: 'Email ja cadastrado.' });
  }

  db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, ?)
  `).run(name, email, hashPassword(password), role);

  sendJson(res, 201, { ok: true });
}

function updateUser(currentUser, res, userId, body) {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!existing) {
    return sendJson(res, 404, { error: 'Usuario nao encontrado.' });
  }

  const name = String(body?.name ?? existing.name).trim();
  const email = String(body?.email ?? existing.email).trim().toLowerCase();
  const role = String(body?.role ?? existing.role).trim();
  const password = body?.password === undefined ? '' : String(body?.password || '');

  if (!name || !email || !['admin', 'user'].includes(role)) {
    return sendJson(res, 400, { error: 'Dados do usuario invalidos.' });
  }

  const duplicate = db.prepare('SELECT id FROM users WHERE email = ? AND id <> ?').get(email, userId);
  if (duplicate) {
    return sendJson(res, 409, { error: 'Email ja cadastrado.' });
  }

  if (existing.id === currentUser.id && role !== 'admin') {
    return sendJson(res, 400, { error: 'Voce nao pode remover seu proprio acesso de administrador.' });
  }

  if (existing.role === 'admin' && role !== 'admin') {
    const adminCount = db.prepare(`SELECT COUNT(*) AS count FROM users WHERE role = 'admin'`).get().count;
    if (adminCount <= 1) {
      return sendJson(res, 400, { error: 'Nao e permitido remover o ultimo administrador do sistema.' });
    }
  }

  const passwordHash = password.trim() ? hashPassword(password) : existing.password_hash;

  db.prepare(`
    UPDATE users
    SET name = ?, email = ?, role = ?, password_hash = ?
    WHERE id = ?
  `).run(name, email, role, passwordHash, userId);

  sendJson(res, 200, { ok: true });
}

function deleteUser(currentUser, res, userId) {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!existing) {
    return sendJson(res, 404, { error: 'Usuario nao encontrado.' });
  }

  if (existing.id === currentUser.id) {
    return sendJson(res, 400, { error: 'Voce nao pode excluir sua propria conta.' });
  }

  if (existing.role === 'admin') {
    const adminCount = db.prepare(`SELECT COUNT(*) AS count FROM users WHERE role = 'admin'`).get().count;
    if (adminCount <= 1) {
      return sendJson(res, 400, { error: 'Nao e permitido excluir o ultimo administrador do sistema.' });
    }
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  clearSessionsByUserId(userId);

  sendJson(res, 200, { ok: true });
}

function listOrders(res) {
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
    ORDER BY datetime(created_at) DESC, id DESC
  `).all();

  sendJson(res, 200, { orders });
}

function createOrder(currentUser, res, body) {
  const load = buildLoadSummary(body?.items);
  if (load.error) {
    return sendJson(res, load.status || 400, { error: load.error });
  }

  const fallbackDate = body?.scheduledDate;
  const dateRange = parseDateRange(body?.startDate || fallbackDate, body?.endDate || fallbackDate);
  if (dateRange.error) {
    return sendJson(res, 400, { error: dateRange.error });
  }

  const allTrucks = db.prepare('SELECT * FROM trucks ORDER BY volume_cm3 ASC').all();
  const availability = buildTruckAvailabilityMap(allTrucks, dateRange.startDate, dateRange.endDate);
  const parsedSelection = parseOrderTruckSelection(body?.allocation?.trucks, load.totalVolumeCm3, availability);
  if (parsedSelection.error) {
    return sendJson(res, 400, { error: parsedSelection.error });
  }

  const allocationCheck = buildAllocationResult(load.totalVolumeCm3, parsedSelection.allocations);
  if (!allocationCheck.fits) {
    return sendJson(res, 422, { error: 'A carga nao cabe nos caminhoes selecionados para este pedido.' });
  }

  try {
    db.exec('BEGIN');

    const orderResult = db.prepare(`
      INSERT INTO orders (
        created_by_user_id,
        created_by_name,
        scheduled_date,
        start_date,
        end_date,
        status,
        total_cans,
        total_volume_cm3
      ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?)
    `).run(
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
    for (const allocation of parsedSelection.allocations) {
      insertOrderTruck.run(orderId, allocation.truckId, allocation.name, allocation.quantity);
    }

    db.exec('COMMIT');
    sendJson(res, 201, { ok: true, orderId });
  } catch (error) {
    db.exec('ROLLBACK');
    console.error(error);
    sendJson(res, 500, { error: 'Nao foi possivel lancar o pedido.' });
  }
}

function getOrderDetails(res, orderId) {
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
  `).get(orderId);

  if (!order) {
    return sendJson(res, 404, { error: 'Pedido nao encontrado.' });
  }

  const items = db.prepare(`
    SELECT
      id,
      order_id,
      can_id,
      can_name,
      can_shape,
      quantity,
      unit_volume_cm3,
      total_volume_cm3
    FROM order_items
    WHERE order_id = ?
    ORDER BY id ASC
  `).all(orderId);

  const trucks = db.prepare(`
    SELECT
      truck_id,
      truck_name,
      quantity_reserved
    FROM order_trucks
    WHERE order_id = ?
    ORDER BY truck_name ASC
  `).all(orderId);

  sendJson(res, 200, { order, items, trucks });
}

function concludeOrder(currentUser, res, orderId) {
  const existing = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(orderId);
  if (!existing) {
    return sendJson(res, 404, { error: 'Pedido nao encontrado.' });
  }

  if (existing.status === 'completed') {
    return sendJson(res, 400, { error: 'Este pedido ja foi concluido.' });
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

function deleteOrder(res, orderId) {
  const orderExists = db.prepare('SELECT id FROM orders WHERE id = ?').get(orderId);
  if (!orderExists) {
    return sendJson(res, 404, { error: 'Pedido nao encontrado.' });
  }

  try {
    db.exec('BEGIN');
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);
    db.prepare('DELETE FROM order_trucks WHERE order_id = ?').run(orderId);
    db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
    db.exec('COMMIT');
    sendJson(res, 200, { ok: true });
  } catch (error) {
    db.exec('ROLLBACK');
    console.error(error);
    sendJson(res, 500, { error: 'Nao foi possivel excluir o pedido.' });
  }
}

function getTruckAvailability(res, startDateRaw, endDateRaw) {
  const dateRange = parseDateRange(startDateRaw, endDateRaw);
  if (dateRange.error) {
    return sendJson(res, 400, { error: dateRange.error });
  }

  const allTrucks = db.prepare('SELECT * FROM trucks ORDER BY volume_cm3 ASC').all();
  const busyRows = getUnavailableTruckRowsForRange(dateRange.startDate, dateRange.endDate);
  const availability = buildTruckAvailabilityMap(allTrucks, dateRange.startDate, dateRange.endDate);
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

function getUnavailableTruckRowsForRange(startDate, endDate) {
  return db.prepare(`
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
      AND o.start_date <= ?
      AND o.end_date >= ?
    ORDER BY ot.truck_name ASC
  `).all(endDate, startDate);
}

function getUnavailableTruckIdsForRange(startDate, endDate) {
  const rows = getUnavailableTruckRowsForRange(startDate, endDate);
  return new Set(rows.map((row) => row.truck_id));
}

function buildTruckAvailabilityMap(trucks, startDate, endDate) {
  const reservedRows = startDate && endDate ? getUnavailableTruckRowsForRange(startDate, endDate) : [];
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

function parseOrderTruckSelection(rawTrucks, totalVolumeCm3, availability = new Map()) {
  const trucks = Array.isArray(rawTrucks) ? rawTrucks : [];
  if (!trucks.length) {
    return { error: 'Calcule a carga e selecione os caminhoes antes de lancar o pedido.' };
  }

  const selectedByTruckId = new Map();

  for (const item of trucks) {
    const truckId = Number(item?.truckId);
    const quantity = Number(item?.quantity ?? 1);
    if (!Number.isInteger(truckId) || !Number.isInteger(quantity) || quantity <= 0) {
      return { error: 'Selecao de caminhoes invalida.' };
    }

    const truck = availability.get(truckId) || db.prepare('SELECT id, name, volume_cm3, quantity FROM trucks WHERE id = ?').get(truckId);
    if (!truck) {
      return { error: `Caminhao ${truckId} nao encontrado.` };
    }

    const nextQuantity = (selectedByTruckId.get(truckId)?.quantity || 0) + quantity;
    const availableQuantity = Number(truck.availableQuantity ?? truck.quantity ?? 1);
    if (nextQuantity > availableQuantity) {
      return {
        error: `O caminhao "${truck.name}" possui apenas ${availableQuantity} unidade(s) disponivel(is) para esse periodo.`
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

  if (!name || !['square', 'cylinder'].includes(shape)) {
    return { error: 'Nome e formato valido sao obrigatorios.' };
  }

  let lengthCm = null;
  let widthCm = null;
  let depthCm = null;
  let diameterCm = null;
  const heightCm = Number(body?.heightCm);

  if (!Number.isFinite(heightCm) || heightCm <= 0) {
    return { error: 'Altura invalida.' };
  }

  let volumeCm3;

  if (shape === 'square') {
    lengthCm = Number(body?.side1Cm ?? body?.lengthCm);
    widthCm = Number(body?.side2Cm ?? body?.widthCm);
    depthCm = heightCm;

    if (![lengthCm, widthCm, depthCm].every((value) => Number.isFinite(value) && value > 0)) {
      return { error: 'Medidas da lata quadrada invalidas.' };
    }

    volumeCm3 = lengthCm * widthCm * depthCm;
  } else {
    diameterCm = Number(body?.diameterCm);
    if (!Number.isFinite(diameterCm) || diameterCm <= 0) {
      return { error: 'Diametro invalido para lata cilindrica.' };
    }

    volumeCm3 = Math.PI * (diameterCm / 2) ** 2 * heightCm;
  }

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

function calculateLoad(res, body) {
  const load = buildLoadSummary(body?.items);
  if (load.error) {
    return sendJson(res, load.status || 400, { error: load.error });
  }

  const allTrucks = db.prepare('SELECT * FROM trucks ORDER BY volume_cm3 ASC').all();
  if (!allTrucks.length) {
    return sendJson(res, 422, { error: 'Nao ha caminhoes cadastrados para calcular a carga.' });
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

  const availability = buildTruckAvailabilityMap(allTrucks, dateRange.startDate, dateRange.endDate);
  const unavailableTruckIds = new Set(
    [...availability.values()].filter((truck) => truck.availableQuantity <= 0).map((truck) => truck.id)
  );
  const availableTrucks = [...availability.values()].filter((truck) => truck.availableQuantity > 0);
  if (!availableTrucks.length) {
    return sendJson(res, 422, {
      error: dateRange.startDate
        ? `Nao ha caminhoes disponiveis entre ${dateRange.startDate} e ${dateRange.endDate}.`
        : 'Nao ha caminhoes cadastrados para calcular a carga.'
    });
  }

  const mode = String(body?.mode || 'automatic').trim().toLowerCase();
  if (mode === 'manual') {
    return calculateManualLoad(res, body, load, availableTrucks, {
      allTrucks,
      availability,
      unavailableTruckIds,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate
    });
  }

  return calculateAutomaticLoad(res, load, availableTrucks, {
    allTrucks,
    availability,
    unavailableTruckIds,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate
  });
}

function calculateAutomaticLoad(res, load, trucks, context = {}) {
  const options = buildTruckOptions(context.allTrucks || trucks, load.totalVolumeCm3, context.unavailableTruckIds || new Set());
  const bestSingle = options
    .filter((truck) => truck.isAvailable && truck.fits)
    .sort((a, b) => a.leftoverCm3 - b.leftoverCm3)[0];

  if (bestSingle) {
    const allocation = buildAllocationResult(load.totalVolumeCm3, [
      {
        truckId: bestSingle.id,
        name: bestSingle.name,
        quantity: 1,
        unitVolumeCm3: bestSingle.volume_cm3
      }
    ]);

    return sendJson(res, 200, {
      mode: 'automatic',
      strategy: 'single',
      startDate: context.startDate || null,
      endDate: context.endDate || null,
      totalVolumeCm3: load.totalVolumeCm3,
      totalCans: load.totalCans,
      breakdown: load.breakdown,
      options,
      allocation
    });
  }

  const fleet = findBestFleetForAutomatic(load.totalVolumeCm3, trucks);
  if (!fleet) {
    return sendJson(res, 422, {
      error: 'Nao foi possivel encontrar combinacao de caminhoes para comportar a carga.',
      startDate: context.startDate || null,
      endDate: context.endDate || null,
      totalVolumeCm3: load.totalVolumeCm3,
      totalCans: load.totalCans,
      breakdown: load.breakdown,
      options
    });
  }

  const allocation = buildAllocationResult(load.totalVolumeCm3, fleet.allocations);

  return sendJson(res, 200, {
    mode: 'automatic',
    strategy: 'multi',
    startDate: context.startDate || null,
    endDate: context.endDate || null,
    totalVolumeCm3: load.totalVolumeCm3,
    totalCans: load.totalCans,
    breakdown: load.breakdown,
    options,
    allocation
  });
}

function calculateManualLoad(res, body, load, trucks, context = {}) {
  const type = String(body?.manual?.type || 'single').trim().toLowerCase();

  if (type === 'single') {
    const truckId = Number(body?.manual?.truckId);
    if (!Number.isInteger(truckId)) {
      return sendJson(res, 400, { error: 'Selecione um caminhao valido para o modo manual (um caminhao).' });
    }

    const truck = trucks.find((entry) => entry.id === truckId);
    if (!truck) {
      const unavailableTruck = (context.availability || new Map()).get(truckId) || (context.allTrucks || []).find((entry) => entry.id === truckId);
      if (unavailableTruck && Number(unavailableTruck.availableQuantity || 0) <= 0 && context.startDate && context.endDate) {
        return sendJson(res, 409, {
          error: `O caminhao "${unavailableTruck.name}" nao possui unidades disponiveis entre ${context.startDate} e ${context.endDate}.`
        });
      }
      return sendJson(res, 404, { error: 'Caminhao selecionado nao encontrado.' });
    }

    const allocation = buildAllocationResult(load.totalVolumeCm3, [
      {
        truckId: truck.id,
        name: truck.name,
        quantity: 1,
        unitVolumeCm3: truck.volume_cm3
      }
    ]);

    return sendJson(res, 200, {
      mode: 'manual',
      strategy: 'single',
      startDate: context.startDate || null,
      endDate: context.endDate || null,
      totalVolumeCm3: load.totalVolumeCm3,
      totalCans: load.totalCans,
      breakdown: load.breakdown,
      allocation
    });
  }

  if (type === 'multi') {
    const rawAllocations = Array.isArray(body?.manual?.allocations) ? body.manual.allocations : [];
    if (!rawAllocations.length) {
      return sendJson(res, 400, { error: 'Adicione ao menos um caminhao para distribuicao manual.' });
    }

    const byTruckId = new Map();
    for (const item of rawAllocations) {
      const truckId = Number(item?.truckId);
      const quantity = Number(item?.quantity ?? 1);
      if (!Number.isInteger(truckId) || !Number.isInteger(quantity) || quantity <= 0) {
        return sendJson(res, 400, { error: 'Distribuicao manual invalida. Verifique os caminhoes selecionados.' });
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
            error: `O caminhao "${unavailableTruck.name}" nao possui unidades disponiveis entre ${context.startDate} e ${context.endDate}.`
          });
        }
        return sendJson(res, 404, { error: `Caminhao ${truckId} nao encontrado.` });
      }

      if (quantity > Number(truck.availableQuantity || 0)) {
        return sendJson(res, 409, {
          error: `O caminhao "${truck.name}" possui apenas ${truck.availableQuantity} unidade(s) disponivel(is) para esse periodo.`
        });
      }

      allocations.push({
        truckId: truck.id,
        name: truck.name,
        quantity,
        unitVolumeCm3: truck.volume_cm3
      });
    }

    const allocation = buildAllocationResult(load.totalVolumeCm3, allocations);
    return sendJson(res, 200, {
      mode: 'manual',
      strategy: 'multi',
      startDate: context.startDate || null,
      endDate: context.endDate || null,
      totalVolumeCm3: load.totalVolumeCm3,
      totalCans: load.totalCans,
      breakdown: load.breakdown,
      allocation
    });
  }

  return sendJson(res, 400, { error: 'Tipo de distribuicao manual invalido.' });
}

function buildLoadSummary(itemsInput) {
  const items = Array.isArray(itemsInput) ? itemsInput : [];
  if (!items.length) {
    return { error: 'Adicione ao menos um item na carga.', status: 400 };
  }

  let totalVolumeCm3 = 0;
  let totalCans = 0;
  const breakdown = [];

  for (const item of items) {
    const canId = Number(item?.canId);
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(canId) || !Number.isInteger(quantity) || quantity <= 0) {
      return { error: 'Itens da carga invalidos.', status: 400 };
    }

    const can = db.prepare('SELECT id, name, shape, volume_cm3 FROM cans WHERE id = ?').get(canId);
    if (!can) {
      return { error: `Lata ${canId} nao encontrada.`, status: 404 };
    }

    const itemVolume = can.volume_cm3 * quantity;
    totalVolumeCm3 += itemVolume;
    totalCans += quantity;
    breakdown.push({
      canId: can.id,
      canName: can.name,
      canShape: can.shape,
      quantity,
      unitVolumeCm3: can.volume_cm3,
      totalVolumeCm3: itemVolume
    });
  }

  return { totalVolumeCm3, totalCans, breakdown };
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

function getSessionUser(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies.sid;
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;

  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId);
  if (!user) {
    sessions.delete(token);
    return null;
  }

  return user;
}

function requireAuth(req, res) {
  const user = getSessionUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'Nao autenticado.' });
    return null;
  }

  return user;
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

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
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
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
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

function setCookie(res, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.path) parts.push(`Path=${options.path}`);

  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionsByUserId(userId) {
  for (const [token, session] of sessions.entries()) {
    if (session.userId === userId) {
      sessions.delete(token);
    }
  }
}

function serveStaticFile(res, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, 'Acesso negado.');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendText(res, 404, 'Arquivo nao encontrado.');
      return;
    }

    const contentType = getContentType(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
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
      if (data.length > 1_000_000) {
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
        reject(new Error('JSON invalido.'));
      }
    });

    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

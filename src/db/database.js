const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");
const config = require("../config");

let SQL = null;
let db = null;
let dbFilePath = config.DB_PATH;
let inTransaction = false;

const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS customers (
    customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    company_name TEXT DEFAULT '',
    phone TEXT NOT NULL,
    email TEXT DEFAULT '',
    gstin TEXT DEFAULT '',
    address TEXT NOT NULL,
    city TEXT DEFAULT 'Mumbai',
    credit_limit REAL DEFAULT 250000,
    account_status TEXT DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_number TEXT NOT NULL UNIQUE,
    vehicle_type TEXT NOT NULL,
    capacity TEXT NOT NULL,
    capacity_kg REAL DEFAULT 1500,
    current_hub TEXT DEFAULT 'Mumbai Central Hub',
    availability_status TEXT NOT NULL DEFAULT 'AVAILABLE',
    fuel_type TEXT DEFAULT 'Diesel',
    last_service_date TEXT DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drivers (
    driver_id INTEGER PRIMARY KEY AUTOINCREMENT,
    driver_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    licence_reference TEXT NOT NULL UNIQUE,
    home_hub TEXT DEFAULT 'Mumbai Central Hub',
    availability_status TEXT NOT NULL DEFAULT 'AVAILABLE',
    rating REAL DEFAULT 4.8,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    phone TEXT DEFAULT '',
    customer_id INTEGER,
    driver_id INTEGER,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
);

CREATE TABLE IF NOT EXISTS bookings (
    booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_reference TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL,
    pickup_address TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    parcel_description TEXT NOT NULL,
    service_type TEXT NOT NULL DEFAULT 'STANDARD',
    weight_kg REAL NOT NULL DEFAULT 1.0,
    dimensions_cm TEXT DEFAULT '40x30x25',
    declared_value REAL DEFAULT 0,
    booking_date TEXT NOT NULL,
    scheduled_pickup_date TEXT,
    booking_status TEXT NOT NULL DEFAULT 'ACTIVE',
    estimated_cost REAL NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE IF NOT EXISTS shipments (
    shipment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_number TEXT NOT NULL UNIQUE,
    booking_id INTEGER NOT NULL UNIQUE,
    vehicle_id INTEGER,
    driver_id INTEGER,
    current_status TEXT NOT NULL DEFAULT 'BOOKED',
    current_location TEXT DEFAULT 'Origin Dispatch Desk',
    origin_lat REAL DEFAULT 19.0760,
    origin_lng REAL DEFAULT 72.8777,
    dest_lat REAL DEFAULT 18.5913,
    dest_lng REAL DEFAULT 73.7389,
    current_lat REAL DEFAULT 19.0760,
    current_lng REAL DEFAULT 72.8777,
    estimated_delivery_date TEXT,
    actual_delivery_date TEXT,
    pod_receiver_name TEXT,
    pod_notes TEXT,
    pod_signature_code TEXT,
    pod_timestamp TEXT,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id),
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
);

CREATE TABLE IF NOT EXISTS tracking_history (
    history_id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    location_note TEXT NOT NULL,
    lat REAL,
    lng REAL,
    remarks TEXT DEFAULT '',
    updated_by TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id)
);

CREATE TABLE IF NOT EXISTS invoices (
    invoice_id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    booking_id INTEGER NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL,
    base_charge REAL NOT NULL DEFAULT 0,
    weight_charge REAL NOT NULL DEFAULT 0,
    fuel_surcharge REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL DEFAULT 0,
    amount_paid REAL NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'UNPAID',
    due_date TEXT NOT NULL,
    issued_at TEXT NOT NULL,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE IF NOT EXISTS payments (
    payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    reference_number TEXT DEFAULT '',
    recorded_by TEXT NOT NULL,
    paid_at TEXT NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id)
);

CREATE TABLE IF NOT EXISTS notifications (
    notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_role TEXT,
    target_user_id INTEGER,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'INFO',
    link TEXT DEFAULT '',
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_email TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT DEFAULT '',
    details TEXT DEFAULT '',
    ip_address TEXT DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(current_status);
CREATE INDEX IF NOT EXISTS idx_history_shipment ON tracking_history(shipment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
`;

async function initDatabase(customPath) {
    if (customPath) {
        dbFilePath = customPath;
    }
    if (!SQL) {
        SQL = await initSqlJs();
    }

    const dir = path.dirname(dbFilePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(dbFilePath)) {
        const fileBuffer = fs.readFileSync(dbFilePath);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    db.run(SCHEMA_SQL);
    persist();
    return db;
}

function persist() {
    if (!db || inTransaction) return;
    const dir = path.dirname(dbFilePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const buffer = Buffer.from(db.export());
    const tmpPath = `${dbFilePath}.tmp`;
    try {
        fs.writeFileSync(tmpPath, buffer);
        fs.renameSync(tmpPath, dbFilePath);
    } catch (err) {
        if (err && (err.code === "EPERM" || err.code === "EBUSY" || err.code === "EACCES")) {
            // Fallback for Windows / OneDrive file locks
            fs.writeFileSync(dbFilePath, buffer);
            try {
                if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
            } catch (_) {}
        } else {
            throw err;
        }
    }
}

function all(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}

function get(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    let row = null;
    if (stmt.step()) {
        row = stmt.getAsObject();
    }
    stmt.free();
    return row;
}

function run(sql, params = []) {
    db.run(sql, params);
    const lastIdRow = get("SELECT last_insert_rowid() AS id");
    const changesRow = get("SELECT changes() AS changes");
    persist();
    return {
        lastInsertRowid: lastIdRow ? lastIdRow.id : null,
        changes: changesRow ? changesRow.changes : 0
    };
}

function transaction(fn) {
    inTransaction = true;
    db.run("BEGIN TRANSACTION");
    try {
        const result = fn();
        db.run("COMMIT");
        inTransaction = false;
        persist();
        return result;
    } catch (err) {
        try {
            db.run("ROLLBACK");
        } catch (_) {
            // ignore rollback error
        }
        inTransaction = false;
        throw err;
    }
}

function closeDatabase() {
    if (db) {
        persist();
        db.close();
        db = null;
    }
}

module.exports = {
    initDatabase,
    all,
    get,
    run,
    transaction,
    persist,
    closeDatabase
};

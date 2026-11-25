const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "smartlogix_db.json");

function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function addDays(date, days) {
    const copy = new Date(date.getTime());
    copy.setDate(copy.getDate() + days);
    return copy;
}

function createEmptyDb() {
    return {
        counters: {
            users: 0,
            customers: 0,
            bookings: 0,
            shipments: 0,
            trackingHistory: 0,
            vehicles: 0,
            drivers: 0
        },
        users: [],
        customers: [],
        bookings: [],
        shipments: [],
        trackingHistory: [],
        vehicles: [],
        drivers: []
    };
}

function nextId(db, collection) {
    db.counters[collection] = (db.counters[collection] || 0) + 1;
    return db.counters[collection];
}

function saveDb(db) {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

function seedIfEmpty(db) {
    let changed = false;
    const now = new Date();

    if (db.users.length === 0) {
        db.users.push({
            userId: nextId(db, "users"),
            fullName: "Lalit Rajpurohit (Admin)",
            email: "admin@smartlogix.in",
            passwordHash: bcrypt.hashSync("admin123", 10),
            role: "ADMIN",
            active: true,
            createdAt: now.toISOString()
        });
        db.users.push({
            userId: nextId(db, "users"),
            fullName: "Dispatch Staff",
            email: "staff@smartlogix.in",
            passwordHash: bcrypt.hashSync("staff123", 10),
            role: "STAFF",
            active: true,
            createdAt: now.toISOString()
        });
        changed = true;
    }

    if (db.vehicles.length === 0) {
        db.vehicles.push(
            {
                vehicleId: nextId(db, "vehicles"),
                registrationNumber: "MH-01-CV-4521",
                vehicleType: "Light Commercial Van",
                capacity: "1,500 kg",
                availabilityStatus: "AVAILABLE"
            },
            {
                vehicleId: nextId(db, "vehicles"),
                registrationNumber: "MH-04-TR-8810",
                vehicleType: "Mini Cargo Truck",
                capacity: "3,500 kg",
                availabilityStatus: "ON_TRIP"
            },
            {
                vehicleId: nextId(db, "vehicles"),
                registrationNumber: "MH-43-BL-1904",
                vehicleType: "Heavy Box Truck",
                capacity: "7,000 kg",
                availabilityStatus: "AVAILABLE"
            }
        );
        changed = true;
    }

    if (db.drivers.length === 0) {
        db.drivers.push(
            {
                driverId: nextId(db, "drivers"),
                driverName: "Suresh Patil",
                phone: "+91 98192 44102",
                licenceReference: "MH01-2019004512",
                availabilityStatus: "AVAILABLE"
            },
            {
                driverId: nextId(db, "drivers"),
                driverName: "Ramesh Jadhav",
                phone: "+91 98211 77319",
                licenceReference: "MH04-2018007834",
                availabilityStatus: "ON_TRIP"
            }
        );
        changed = true;
    }

    if (db.bookings.length === 0) {
        const customerId = nextId(db, "customers");
        db.customers.push({
            customerId,
            customerName: "Rohan Traders",
            phone: "+91 98200 11223",
            email: "rohan@traders.in",
            address: "Andheri East, Mumbai - 400069",
            createdAt: now.toISOString()
        });

        const bookingId = nextId(db, "bookings");
        db.bookings.push({
            bookingId,
            bookingReference: "SLX-BK-2026-1001",
            customerId,
            pickupAddress: "Andheri East, Mumbai - 400069",
            deliveryAddress: "Hinjewadi Phase 1, Pune - 411057",
            parcelDescription: "Industrial Electronic Parts (18.5 kg)",
            weightKg: 18.5,
            bookingDate: formatLocalDate(now),
            bookingStatus: "ACTIVE",
            createdBy: "admin@smartlogix.in"
        });

        const shipmentId = nextId(db, "shipments");
        db.shipments.push({
            shipmentId,
            trackingNumber: "TRK-2026-88912",
            bookingId,
            currentStatus: "IN_TRANSIT",
            estimatedDeliveryDate: formatLocalDate(addDays(now, 1)),
            updatedAt: now.toISOString()
        });

        const earlier = new Date(now.getTime() - 60000);
        db.trackingHistory.push(
            {
                historyId: nextId(db, "trackingHistory"),
                shipmentId,
                status: "BOOKED",
                locationNote: "Andheri Hub, Mumbai",
                remarks: "Consignment registered and verified.",
                updatedBy: "admin@smartlogix.in",
                updatedAt: earlier.toISOString()
            },
            {
                historyId: nextId(db, "trackingHistory"),
                shipmentId,
                status: "IN_TRANSIT",
                locationNote: "Lonavala Highway Checkpoint",
                remarks: "Dispatched via Mumbai-Pune Expressway.",
                updatedBy: "admin@smartlogix.in",
                updatedAt: now.toISOString()
            }
        );
        changed = true;
    }

    if (changed) {
        saveDb(db);
    }
}

function loadDb() {
    let db;
    if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf8");
        db = JSON.parse(raw);
    } else {
        db = createEmptyDb();
    }
    seedIfEmpty(db);
    return db;
}

module.exports = {
    loadDb,
    saveDb,
    nextId,
    formatLocalDate,
    addDays
};

const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT_DIR, "data");

// Generate a persistent fallback secret in memory if JWT_SECRET is not provided
const fallbackSecret = crypto.randomBytes(32).toString("hex");

const ROLES = {
    ADMIN: "ADMIN",
    DISPATCHER: "DISPATCHER",
    WAREHOUSE: "WAREHOUSE",
    DRIVER: "DRIVER",
    CUSTOMER: "CUSTOMER"
};

const SHIPMENT_STATUSES = [
    "BOOKED",
    "PICKED_UP",
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED"
];

const SERVICE_TYPES = {
    STANDARD: { label: "Standard Road Freight", multiplier: 1.0, etaDays: 3 },
    EXPRESS: { label: "Express Air / Priority", multiplier: 1.65, etaDays: 1 },
    COLD_CHAIN: { label: "Cold Chain Logistics", multiplier: 1.9, etaDays: 2 },
    PORT_CONTAINER: { label: "Port / Container Cargo", multiplier: 1.4, etaDays: 4 }
};

const HUB_COORDINATES = {
    mumbai: { name: "Mumbai Central Hub", lat: 19.0760, lng: 72.8777 },
    andheri: { name: "Andheri East Hub, Mumbai", lat: 19.1136, lng: 72.8697 },
    bhiwandi: { name: "Bhiwandi Logistics Park", lat: 19.2813, lng: 73.0483 },
    jnpt: { name: "JNPT / Nhava Sheva Port", lat: 18.9490, lng: 72.9522 },
    lonavala: { name: "Lonavala Expressway Checkpoint", lat: 18.7557, lng: 73.4091 },
    pune: { name: "Pune Hinjewadi Sorting Hub", lat: 18.5913, lng: 73.7389 },
    nashik: { name: "Nashik Distribution Center", lat: 19.9975, lng: 73.7898 },
    ahmedabad: { name: "Ahmedabad Freight Terminal", lat: 23.0225, lng: 72.5714 },
    surat: { name: "Surat Textile Cargo Hub", lat: 21.1702, lng: 72.8311 },
    delhi: { name: "Delhi NCR Hub", lat: 28.6139, lng: 77.2090 },
    gurugram: { name: "Gurugram Fulfillment Center", lat: 28.4595, lng: 77.0266 },
    bengaluru: { name: "Bengaluru Electronic City Hub", lat: 12.9716, lng: 77.5946 },
    bangalore: { name: "Bengaluru Electronic City Hub", lat: 12.9716, lng: 77.5946 },
    hyderabad: { name: "Hyderabad Shamshabad Hub", lat: 17.3850, lng: 78.4867 },
    chennai: { name: "Chennai Port & Freight Hub", lat: 13.0827, lng: 80.2707 },
    kolkata: { name: "Kolkata Eastern Terminal", lat: 22.5726, lng: 88.3639 },
    jaipur: { name: "Jaipur Logistics Hub", lat: 26.9124, lng: 75.7873 },
    nagpur: { name: "Nagpur MIHAN Cargo Hub", lat: 21.1458, lng: 79.0882 }
};

function resolveCoordinates(addressText) {
    const lower = String(addressText || "").toLowerCase();
    for (const [key, coords] of Object.entries(HUB_COORDINATES)) {
        if (lower.includes(key)) {
            return { lat: coords.lat, lng: coords.lng };
        }
    }
    return { lat: 19.0760, lng: 72.8777 };
}

module.exports = {
    PORT: Number(process.env.PORT) || 8080,
    NODE_ENV: process.env.NODE_ENV || "development",
    JWT_SECRET: process.env.JWT_SECRET || fallbackSecret,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "12h",
    ROOT_DIR,
    DATA_DIR,
    DB_PATH: process.env.DB_PATH
        ? path.resolve(ROOT_DIR, process.env.DB_PATH)
        : path.join(DATA_DIR, "smartlogix.sqlite"),
    LEGACY_JSON_PATH: path.join(DATA_DIR, "smartlogix_db.json"),
    ROLES,
    SHIPMENT_STATUSES,
    SERVICE_TYPES,
    HUB_COORDINATES,
    resolveCoordinates
};

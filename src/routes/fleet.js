const express = require("express");
const db = require("../db/database");
const { authenticate, authorize } = require("../middleware/auth");
const { logAudit } = require("../services/auditService");

const router = express.Router();

const VALID_AVAILABILITY = ["AVAILABLE", "ON_TRIP", "MAINTENANCE"];

router.get("/vehicles", authenticate, authorize("ADMIN", "DISPATCHER", "WAREHOUSE", "DRIVER"), (req, res) => {
    const rows = db.all(
        `SELECT
            vehicle_id AS vehicleId,
            registration_number AS registrationNumber,
            vehicle_type AS vehicleType,
            capacity,
            capacity_kg AS capacityKg,
            current_hub AS currentHub,
            availability_status AS availabilityStatus,
            fuel_type AS fuelType,
            last_service_date AS lastServiceDate
         FROM vehicles
         ORDER BY vehicle_id DESC`
    );
    return res.json(rows);
});

router.post("/vehicles", authenticate, authorize("ADMIN", "DISPATCHER"), (req, res) => {
    const body = req.body || {};
    const regNo = String(body.registrationNumber || "").trim().toUpperCase();
    const vehicleType = String(body.vehicleType || "").trim();
    const capacity = String(body.capacity || "").trim();
    const currentHub = String(body.currentHub || "Mumbai Central Hub").trim();
    const fuelType = String(body.fuelType || "Diesel").trim();
    const availabilityStatus = VALID_AVAILABILITY.includes(String(body.availabilityStatus || "").toUpperCase())
        ? String(body.availabilityStatus).toUpperCase()
        : "AVAILABLE";

    if (!regNo || !vehicleType || !capacity) {
        return res.status(400).json({ message: "Registration number, vehicle type, and capacity are required." });
    }

    const exists = db.get("SELECT vehicle_id FROM vehicles WHERE LOWER(registration_number) = LOWER(?)", [regNo]);
    if (exists) {
        return res.status(409).json({ message: "Vehicle with this registration number already exists." });
    }

    const numericCap = Number(capacity.replace(/[^0-9.]/g, "")) || 1500;
    const nowIso = new Date().toISOString();
    const r = db.run(
        `INSERT INTO vehicles (registration_number, vehicle_type, capacity, capacity_kg, current_hub, availability_status, fuel_type, last_service_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [regNo, vehicleType, capacity, numericCap, currentHub, availabilityStatus, fuelType, nowIso.slice(0, 10), nowIso]
    );

    logAudit({
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: "VEHICLE_CREATED",
        entityType: "VEHICLE",
        entityId: regNo,
        details: `${vehicleType} (${capacity})`,
        ipAddress: req.ip
    });

    const created = db.get(
        `SELECT vehicle_id AS vehicleId, registration_number AS registrationNumber, vehicle_type AS vehicleType, capacity, current_hub AS currentHub, availability_status AS availabilityStatus, fuel_type AS fuelType
         FROM vehicles WHERE vehicle_id = ?`,
        [r.lastInsertRowid]
    );
    return res.status(201).json(created);
});

router.patch("/vehicles/:vehicleId/status", authenticate, authorize("ADMIN", "DISPATCHER"), (req, res) => {
    const vehicleId = Number(req.params.vehicleId);
    const status = String((req.body && req.body.availabilityStatus) || "").trim().toUpperCase();
    const currentHub = req.body && req.body.currentHub != null ? String(req.body.currentHub).trim() : null;

    if (!VALID_AVAILABILITY.includes(status)) {
        return res.status(400).json({ message: "Invalid availability status." });
    }
    const existing = db.get("SELECT * FROM vehicles WHERE vehicle_id = ?", [vehicleId]);
    if (!existing) return res.status(404).json({ message: "Vehicle not found." });

    db.run(
        "UPDATE vehicles SET availability_status = ?, current_hub = COALESCE(NULLIF(?, ''), current_hub) WHERE vehicle_id = ?",
        [status, currentHub || "", vehicleId]
    );

    logAudit({
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: "VEHICLE_STATUS_UPDATED",
        entityType: "VEHICLE",
        entityId: existing.registration_number,
        details: `${existing.availability_status} -> ${status}`,
        ipAddress: req.ip
    });

    return res.json({ message: `Vehicle ${existing.registration_number} marked ${status}.` });
});

router.get("/drivers", authenticate, authorize("ADMIN", "DISPATCHER", "WAREHOUSE", "DRIVER"), (req, res) => {
    const rows = db.all(
        `SELECT
            driver_id AS driverId,
            driver_name AS driverName,
            phone,
            licence_reference AS licenceReference,
            home_hub AS homeHub,
            availability_status AS availabilityStatus,
            rating
         FROM drivers
         ORDER BY driver_id DESC`
    );
    return res.json(rows);
});

router.post("/drivers", authenticate, authorize("ADMIN", "DISPATCHER"), (req, res) => {
    const body = req.body || {};
    const driverName = String(body.driverName || "").trim();
    const phone = String(body.phone || "").trim();
    const licenceRef = String(body.licenceReference || "").trim().toUpperCase();
    const homeHub = String(body.homeHub || "Mumbai Central Hub").trim();
    const availabilityStatus = VALID_AVAILABILITY.includes(String(body.availabilityStatus || "").toUpperCase())
        ? String(body.availabilityStatus).toUpperCase()
        : "AVAILABLE";

    if (!driverName || !phone || !licenceRef) {
        return res.status(400).json({ message: "Driver name, phone, and licence reference are required." });
    }

    const exists = db.get("SELECT driver_id FROM drivers WHERE LOWER(licence_reference) = LOWER(?)", [licenceRef]);
    if (exists) {
        return res.status(409).json({ message: "Driver with this licence reference already exists." });
    }

    const r = db.run(
        `INSERT INTO drivers (driver_name, phone, licence_reference, home_hub, availability_status, rating, created_at)
         VALUES (?, ?, ?, ?, ?, 4.8, ?)`,
        [driverName, phone, licenceRef, homeHub, availabilityStatus, new Date().toISOString()]
    );

    logAudit({
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: "DRIVER_CREATED",
        entityType: "DRIVER",
        entityId: licenceRef,
        details: `${driverName} (${phone})`,
        ipAddress: req.ip
    });

    const created = db.get(
        `SELECT driver_id AS driverId, driver_name AS driverName, phone, licence_reference AS licenceReference, home_hub AS homeHub, availability_status AS availabilityStatus, rating
         FROM drivers WHERE driver_id = ?`,
        [r.lastInsertRowid]
    );
    return res.status(201).json(created);
});

router.patch("/drivers/:driverId/status", authenticate, authorize("ADMIN", "DISPATCHER"), (req, res) => {
    const driverId = Number(req.params.driverId);
    const status = String((req.body && req.body.availabilityStatus) || "").trim().toUpperCase();
    if (!VALID_AVAILABILITY.includes(status)) {
        return res.status(400).json({ message: "Invalid availability status." });
    }
    const existing = db.get("SELECT * FROM drivers WHERE driver_id = ?", [driverId]);
    if (!existing) return res.status(404).json({ message: "Driver not found." });

    db.run("UPDATE drivers SET availability_status = ? WHERE driver_id = ?", [status, driverId]);

    logAudit({
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: "DRIVER_STATUS_UPDATED",
        entityType: "DRIVER",
        entityId: existing.licence_reference,
        details: `${existing.availability_status} -> ${status}`,
        ipAddress: req.ip
    });

    return res.json({ message: `Driver ${existing.driver_name} marked ${status}.` });
});

module.exports = router;

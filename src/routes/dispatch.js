const express = require("express");
const db = require("../db/database");
const { authenticate, authorize } = require("../middleware/auth");
const { logAudit } = require("../services/auditService");
const { createNotification } = require("../services/notificationService");

const router = express.Router();

router.get("/board", authenticate, authorize("ADMIN", "DISPATCHER", "WAREHOUSE", "DRIVER"), (req, res) => {
    let where = "WHERE s.current_status NOT IN ('DELIVERED', 'CANCELLED')";
    const params = [];
    if (req.user.role === "DRIVER") {
        where += " AND s.driver_id = ?";
        params.push(req.user.driverId || -1);
    }

    const shipments = db.all(
        `SELECT
            s.shipment_id AS shipmentId,
            s.tracking_number AS trackingNumber,
            b.booking_reference AS bookingReference,
            c.customer_name AS customerName,
            b.pickup_address AS pickupAddress,
            b.delivery_address AS deliveryAddress,
            b.service_type AS serviceType,
            b.weight_kg AS weightKg,
            b.scheduled_pickup_date AS scheduledPickupDate,
            s.estimated_delivery_date AS estimatedDeliveryDate,
            s.current_status AS currentStatus,
            s.current_location AS currentLocation,
            s.vehicle_id AS vehicleId,
            v.registration_number AS vehicleReg,
            v.vehicle_type AS vehicleType,
            s.driver_id AS driverId,
            d.driver_name AS driverName,
            d.phone AS driverPhone
         FROM shipments s
         JOIN bookings b ON b.booking_id = s.booking_id
         JOIN customers c ON c.customer_id = b.customer_id
         LEFT JOIN vehicles v ON v.vehicle_id = s.vehicle_id
         LEFT JOIN drivers d ON d.driver_id = s.driver_id
         ${where}
         ORDER BY CASE WHEN s.vehicle_id IS NULL THEN 0 ELSE 1 END, s.shipment_id DESC`,
        params
    );

    const availableVehicles = db.all(
        `SELECT vehicle_id AS vehicleId, registration_number AS registrationNumber, vehicle_type AS vehicleType, capacity, current_hub AS currentHub, availability_status AS availabilityStatus
         FROM vehicles
         ORDER BY CASE WHEN availability_status = 'AVAILABLE' THEN 0 ELSE 1 END, vehicle_id ASC`
    );

    const availableDrivers = db.all(
        `SELECT driver_id AS driverId, driver_name AS driverName, phone, licence_reference AS licenceReference, home_hub AS homeHub, availability_status AS availabilityStatus, rating
         FROM drivers
         ORDER BY CASE WHEN availability_status = 'AVAILABLE' THEN 0 ELSE 1 END, driver_id ASC`
    );

    return res.json({ shipments, availableVehicles, availableDrivers });
});

router.post("/assign", authenticate, authorize("ADMIN", "DISPATCHER"), (req, res) => {
    const body = req.body || {};
    const shipmentId = Number(body.shipmentId);
    const vehicleId = Number(body.vehicleId);
    const driverId = Number(body.driverId);
    const estimatedDeliveryDate = String(body.estimatedDeliveryDate || "").trim();

    if (!shipmentId || !vehicleId || !driverId) {
        return res.status(400).json({ message: "Shipment, vehicle, and driver are required for dispatch assignment." });
    }

    const shipment = db.get("SELECT * FROM shipments WHERE shipment_id = ?", [shipmentId]);
    if (!shipment) return res.status(404).json({ message: "Shipment not found." });

    const vehicle = db.get("SELECT * FROM vehicles WHERE vehicle_id = ?", [vehicleId]);
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found." });
    if (vehicle.availability_status === "MAINTENANCE") {
        return res.status(400).json({ message: `Vehicle ${vehicle.registration_number} is currently under maintenance.` });
    }

    const driver = db.get("SELECT * FROM drivers WHERE driver_id = ?", [driverId]);
    if (!driver) return res.status(404).json({ message: "Driver not found." });

    const nowIso = new Date().toISOString();
    const nextStatus = shipment.current_status === "BOOKED" ? "PICKED_UP" : shipment.current_status;

    db.transaction(() => {
        if (shipment.vehicle_id && shipment.vehicle_id !== vehicleId) {
            db.run("UPDATE vehicles SET availability_status = 'AVAILABLE' WHERE vehicle_id = ?", [shipment.vehicle_id]);
        }
        if (shipment.driver_id && shipment.driver_id !== driverId) {
            db.run("UPDATE drivers SET availability_status = 'AVAILABLE' WHERE driver_id = ?", [shipment.driver_id]);
        }

        db.run(
            `UPDATE shipments
             SET vehicle_id = ?,
                 driver_id = ?,
                 current_status = ?,
                 estimated_delivery_date = COALESCE(NULLIF(?, ''), estimated_delivery_date),
                 updated_at = ?
             WHERE shipment_id = ?`,
            [vehicleId, driverId, nextStatus, estimatedDeliveryDate, nowIso, shipmentId]
        );

        db.run("UPDATE vehicles SET availability_status = 'ON_TRIP' WHERE vehicle_id = ?", [vehicleId]);
        db.run("UPDATE drivers SET availability_status = 'ON_TRIP' WHERE driver_id = ?", [driverId]);

        db.run(
            `INSERT INTO tracking_history (shipment_id, status, location_note, lat, lng, remarks, updated_by, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                shipmentId,
                nextStatus,
                shipment.current_location || "Origin Dispatch Desk",
                shipment.current_lat,
                shipment.current_lng,
                `Dispatched with vehicle ${vehicle.registration_number} and driver ${driver.driver_name}.`,
                req.user.email,
                nowIso
            ]
        );
    });

    logAudit({
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: "DISPATCH_ASSIGNED",
        entityType: "SHIPMENT",
        entityId: shipment.tracking_number,
        details: `Assigned ${vehicle.registration_number} + ${driver.driver_name}`,
        ipAddress: req.ip
    });

    createNotification({
        targetRole: "DRIVER",
        title: "New Trip Assigned",
        message: `You have been assigned shipment ${shipment.tracking_number} with vehicle ${vehicle.registration_number}.`,
        severity: "INFO",
        link: `tracking.html?trk=${encodeURIComponent(shipment.tracking_number)}`
    });

    return res.json({
        message: `Assigned ${vehicle.registration_number} and ${driver.driver_name} to ${shipment.tracking_number}.`
    });
});

module.exports = router;

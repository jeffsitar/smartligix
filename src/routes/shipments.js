const express = require("express");
const db = require("../db/database");
const config = require("../config");
const { authenticate, optionalAuth, authorize } = require("../middleware/auth");
const { logAudit } = require("../services/auditService");
const { createNotification } = require("../services/notificationService");

const router = express.Router();

function formatDisplayTimestamp(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = String(d.getDate()).padStart(2, "0");
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${day} ${month} ${year}, ${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
}

router.get("/", authenticate, (req, res) => {
    const clauses = [];
    const params = [];

    if (req.user.role === "CUSTOMER") {
        clauses.push("b.customer_id = ?");
        params.push(req.user.customerId || -1);
    } else if (req.user.role === "DRIVER") {
        clauses.push("s.driver_id = ?");
        params.push(req.user.driverId || -1);
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = db.all(
        `SELECT
            s.shipment_id AS shipmentId,
            s.tracking_number AS trackingNumber,
            b.booking_reference AS bookingReference,
            c.customer_name AS customerName,
            b.pickup_address AS pickupAddress,
            b.delivery_address AS deliveryAddress,
            b.service_type AS serviceType,
            s.current_status AS currentStatus,
            s.current_location AS currentLocation,
            s.estimated_delivery_date AS estimatedDeliveryDate,
            v.registration_number AS vehicleReg,
            d.driver_name AS driverName,
            s.updated_at AS updatedAt
         FROM shipments s
         JOIN bookings b ON b.booking_id = s.booking_id
         JOIN customers c ON c.customer_id = b.customer_id
         LEFT JOIN vehicles v ON v.vehicle_id = s.vehicle_id
         LEFT JOIN drivers d ON d.driver_id = s.driver_id
         ${whereSql}
         ORDER BY s.shipment_id DESC`,
        params
    );
    return res.json(rows);
});

// Public & authenticated tracking lookup
router.get("/:trackingNumber", optionalAuth, (req, res) => {
    const trackingNumber = String(req.params.trackingNumber || "").trim();
    const row = db.get(
        `SELECT
            s.*,
            b.booking_reference,
            b.customer_id,
            b.pickup_address,
            b.delivery_address,
            b.parcel_description,
            b.service_type,
            b.weight_kg,
            b.dimensions_cm,
            c.customer_name,
            c.phone AS customer_phone,
            v.registration_number AS vehicle_reg,
            v.vehicle_type,
            d.driver_name,
            d.phone AS driver_phone
         FROM shipments s
         JOIN bookings b ON b.booking_id = s.booking_id
         JOIN customers c ON c.customer_id = b.customer_id
         LEFT JOIN vehicles v ON v.vehicle_id = s.vehicle_id
         LEFT JOIN drivers d ON d.driver_id = s.driver_id
         WHERE LOWER(s.tracking_number) = LOWER(?)`,
        [trackingNumber]
    );

    if (!row) {
        return res.status(404).json({ message: `No shipment found with tracking number: ${trackingNumber}` });
    }

    const history = db.all(
        `SELECT history_id, status, location_note, lat, lng, remarks, updated_by, updated_at
         FROM tracking_history
         WHERE shipment_id = ?
         ORDER BY updated_at DESC, history_id DESC`,
        [row.shipment_id]
    );

    const isStaff = req.user && ["ADMIN", "DISPATCHER", "WAREHOUSE", "DRIVER"].includes(req.user.role);

    return res.json({
        shipmentId: row.shipment_id,
        trackingNumber: row.tracking_number,
        bookingReference: row.booking_reference,
        customerName: row.customer_name,
        customerPhone: isStaff ? row.customer_phone : undefined,
        pickupAddress: row.pickup_address,
        deliveryAddress: row.delivery_address,
        parcelDescription: row.parcel_description,
        serviceType: row.service_type,
        weightKg: row.weight_kg,
        dimensionsCm: row.dimensions_cm,
        currentStatus: row.current_status,
        currentLocation: row.current_location,
        estimatedDeliveryDate: row.estimated_delivery_date || "TBD",
        actualDeliveryDate: row.actual_delivery_date,
        vehicle: row.vehicle_reg ? { registrationNumber: row.vehicle_reg, vehicleType: row.vehicle_type } : null,
        driver: row.driver_name ? { driverName: row.driver_name, phone: isStaff ? row.driver_phone : undefined } : null,
        coordinates: {
            origin: { lat: row.origin_lat, lng: row.origin_lng },
            destination: { lat: row.dest_lat, lng: row.dest_lng },
            current: { lat: row.current_lat, lng: row.current_lng }
        },
        pod: row.pod_receiver_name
            ? {
                  receiverName: row.pod_receiver_name,
                  notes: row.pod_notes,
                  signatureCode: row.pod_signature_code,
                  timestamp: formatDisplayTimestamp(row.pod_timestamp)
              }
            : null,
        timeline: history.map((h) => ({
            historyId: h.history_id,
            status: h.status,
            locationNote: h.location_note,
            lat: h.lat,
            lng: h.lng,
            remarks: h.remarks,
            updatedBy: isStaff ? h.updated_by : "SmartLogix Operations",
            updatedAt: formatDisplayTimestamp(h.updated_at)
        }))
    });
});

router.post("/:shipmentId/status", authenticate, authorize("ADMIN", "DISPATCHER", "WAREHOUSE", "DRIVER"), (req, res) => {
    const shipmentId = Number(req.params.shipmentId);
    const shipment = db.get("SELECT * FROM shipments WHERE shipment_id = ?", [shipmentId]);
    if (!shipment) {
        return res.status(404).json({ message: "Shipment not found." });
    }

    if (req.user.role === "DRIVER" && shipment.driver_id !== req.user.driverId) {
        return res.status(403).json({ message: "Drivers can only update shipments assigned to them." });
    }

    const body = req.body || {};
    const status = String(body.status || "").trim().toUpperCase();
    const locationNote = String(body.locationNote || "").trim();
    const remarks = String(body.remarks || "").trim();
    const podReceiverName = String(body.podReceiverName || "").trim();
    const podNotes = String(body.podNotes || "").trim();

    if (!config.SHIPMENT_STATUSES.includes(status)) {
        return res.status(400).json({ message: "Invalid shipment status." });
    }
    if (!locationNote) {
        return res.status(400).json({ message: "Location / checkpoint note is required." });
    }
    if (status === "DELIVERED" && !podReceiverName) {
        return res.status(400).json({ message: "Proof of Delivery (receiver name) is required when marking DELIVERED." });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const coords = config.resolveCoordinates(locationNote);
    const podCode = status === "DELIVERED" ? `POD-${Math.floor(1000 + Math.random() * 9000)}-${shipmentId}` : shipment.pod_signature_code;

    db.transaction(() => {
        db.run(
            `UPDATE shipments
             SET current_status = ?,
                 current_location = ?,
                 current_lat = ?,
                 current_lng = ?,
                 actual_delivery_date = CASE WHEN ? = 'DELIVERED' THEN ? ELSE actual_delivery_date END,
                 pod_receiver_name = CASE WHEN ? = 'DELIVERED' THEN ? ELSE pod_receiver_name END,
                 pod_notes = CASE WHEN ? = 'DELIVERED' THEN ? ELSE pod_notes END,
                 pod_signature_code = CASE WHEN ? = 'DELIVERED' THEN ? ELSE pod_signature_code END,
                 pod_timestamp = CASE WHEN ? = 'DELIVERED' THEN ? ELSE pod_timestamp END,
                 updated_at = ?
             WHERE shipment_id = ?`,
            [
                status,
                locationNote,
                coords.lat,
                coords.lng,
                status,
                nowIso.slice(0, 10),
                status,
                podReceiverName,
                status,
                podNotes,
                status,
                podCode,
                status,
                nowIso,
                nowIso,
                shipmentId
            ]
        );

        db.run(
            `INSERT INTO tracking_history (shipment_id, status, location_note, lat, lng, remarks, updated_by, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                shipmentId,
                status,
                locationNote,
                coords.lat,
                coords.lng,
                remarks || (status === "DELIVERED" ? `Delivered and signed by ${podReceiverName} (${podCode})` : `Status updated to ${status}`),
                req.user.email,
                nowIso
            ]
        );

        // Free up assigned vehicle & driver upon terminal status
        if (status === "DELIVERED" || status === "CANCELLED") {
            if (shipment.vehicle_id) {
                db.run("UPDATE vehicles SET availability_status = 'AVAILABLE', current_hub = ? WHERE vehicle_id = ?", [locationNote, shipment.vehicle_id]);
            }
            if (shipment.driver_id) {
                db.run("UPDATE drivers SET availability_status = 'AVAILABLE' WHERE driver_id = ?", [shipment.driver_id]);
            }
        }
    });

    logAudit({
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: "SHIPMENT_STATUS_UPDATED",
        entityType: "SHIPMENT",
        entityId: shipment.tracking_number,
        details: `${shipment.current_status} -> ${status} @ ${locationNote}`,
        ipAddress: req.ip
    });

    if (status === "DELIVERED") {
        createNotification({
            targetRole: "ADMIN",
            title: "Shipment Delivered (POD Captured)",
            message: `${shipment.tracking_number} delivered to ${podReceiverName} at ${locationNote}.`,
            severity: "SUCCESS",
            link: `tracking.html?trk=${encodeURIComponent(shipment.tracking_number)}`
        });
    }

    return res.json({
        message: `Shipment status updated to ${status}`,
        podSignatureCode: status === "DELIVERED" ? podCode : null
    });
});

module.exports = router;

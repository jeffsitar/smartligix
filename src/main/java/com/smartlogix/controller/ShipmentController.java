package com.smartlogix.controller;

import com.smartlogix.entity.*;
import com.smartlogix.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/shipments")
public class ShipmentController {

    private final ShipmentRepository shipmentRepo;
    private final TrackingHistoryRepository historyRepo;

    public ShipmentController(ShipmentRepository shipmentRepo, TrackingHistoryRepository historyRepo) {
        this.shipmentRepo = shipmentRepo;
        this.historyRepo = historyRepo;
    }

    @GetMapping("/{trackingNumber}")
    public ResponseEntity<?> getByTrackingNumber(@PathVariable String trackingNumber) {
        Optional<Shipment> sOpt = shipmentRepo.findByTrackingNumberIgnoreCase(trackingNumber.trim());
        if (sOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "No shipment found with tracking number: " + trackingNumber));
        }

        Shipment s = sOpt.get();
        Booking b = s.getBooking();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a");

        List<Map<String, Object>> timeline = new ArrayList<>();
        for (TrackingHistory h : historyRepo.findByShipmentOrderByUpdatedAtDesc(s)) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("status", h.getStatus());
            item.put("locationNote", h.getLocationNote());
            item.put("remarks", h.getRemarks());
            item.put("updatedBy", h.getUpdatedBy());
            item.put("updatedAt", h.getUpdatedAt().format(fmt));
            timeline.add(item);
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("shipmentId", s.getShipmentId());
        resp.put("trackingNumber", s.getTrackingNumber());
        resp.put("bookingReference", b.getBookingReference());
        resp.put("customerName", b.getCustomer().getCustomerName());
        resp.put("pickupAddress", b.getPickupAddress());
        resp.put("deliveryAddress", b.getDeliveryAddress());
        resp.put("parcelDescription", b.getParcelDescription());
        resp.put("currentStatus", s.getCurrentStatus());
        resp.put("estimatedDeliveryDate", s.getEstimatedDeliveryDate() != null ? s.getEstimatedDeliveryDate().toString() : "TBD");
        resp.put("timeline", timeline);

        return ResponseEntity.ok(resp);
    }

    @PostMapping("/{shipmentId}/status")
    public ResponseEntity<?> updateStatus(@PathVariable Long shipmentId, @RequestBody Map<String, String> req) {
        Optional<Shipment> sOpt = shipmentRepo.findById(shipmentId);
        if (sOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Shipment not found."));
        }

        String status = req.getOrDefault("status", "").trim();
        String locationNote = req.getOrDefault("locationNote", "").trim();
        String remarks = req.getOrDefault("remarks", "").trim();

        if (status.isEmpty() || locationNote.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Status and location note are required."));
        }

        Shipment s = sOpt.get();
        s.setCurrentStatus(status);
        s.setUpdatedAt(LocalDateTime.now());
        shipmentRepo.save(s);

        TrackingHistory h = new TrackingHistory();
        h.setShipment(s);
        h.setStatus(status);
        h.setLocationNote(locationNote);
        h.setRemarks(remarks.isEmpty() ? "Status updated to " + status : remarks);
        h.setUpdatedBy("Staff");
        historyRepo.save(h);

        return ResponseEntity.ok(Map.of("message", "Shipment status updated to " + status));
    }
}

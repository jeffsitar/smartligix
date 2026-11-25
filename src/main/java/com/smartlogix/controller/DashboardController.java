package com.smartlogix.controller;

import com.smartlogix.entity.Booking;
import com.smartlogix.entity.Shipment;
import com.smartlogix.repository.*;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final BookingRepository bookingRepo;
    private final ShipmentRepository shipmentRepo;
    private final VehicleRepository vehicleRepo;

    public DashboardController(BookingRepository bookingRepo, ShipmentRepository shipmentRepo, VehicleRepository vehicleRepo) {
        this.bookingRepo = bookingRepo;
        this.shipmentRepo = shipmentRepo;
        this.vehicleRepo = vehicleRepo;
    }

    @GetMapping("/summary")
    public Map<String, Object> getSummary() {
        long totalBookings = bookingRepo.count();
        long activeShipments = shipmentRepo.countByCurrentStatusNotIn(List.of("DELIVERED", "CANCELLED"));
        long availableVehicles = vehicleRepo.countByAvailabilityStatus("AVAILABLE");
        long totalVehicles = vehicleRepo.count();
        long deliveredCount = shipmentRepo.countByCurrentStatus("DELIVERED");

        List<Map<String, Object>> recentBookings = new ArrayList<>();
        for (Booking b : bookingRepo.findAllByOrderByBookingIdDesc()) {
            Optional<Shipment> sOpt = shipmentRepo.findByBooking(b);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("bookingReference", b.getBookingReference());
            row.put("trackingNumber", sOpt.map(Shipment::getTrackingNumber).orElse("N/A"));
            row.put("customerName", b.getCustomer().getCustomerName());
            row.put("destination", b.getDeliveryAddress());
            row.put("bookingDate", b.getBookingDate().toString());
            row.put("status", sOpt.map(Shipment::getCurrentStatus).orElse(b.getBookingStatus()));
            recentBookings.add(row);
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("totalBookings", totalBookings);
        resp.put("activeShipments", activeShipments);
        resp.put("availableVehicles", availableVehicles);
        resp.put("totalVehicles", totalVehicles);
        resp.put("deliveredCount", deliveredCount);
        resp.put("recentBookings", recentBookings);
        return resp;
    }
}

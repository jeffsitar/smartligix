package com.smartlogix.controller;

import com.smartlogix.entity.*;
import com.smartlogix.repository.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    private final CustomerRepository customerRepo;
    private final BookingRepository bookingRepo;
    private final ShipmentRepository shipmentRepo;
    private final TrackingHistoryRepository historyRepo;

    public BookingController(CustomerRepository customerRepo, BookingRepository bookingRepo,
                             ShipmentRepository shipmentRepo, TrackingHistoryRepository historyRepo) {
        this.customerRepo = customerRepo;
        this.bookingRepo = bookingRepo;
        this.shipmentRepo = shipmentRepo;
        this.historyRepo = historyRepo;
    }

    @GetMapping
    public List<Map<String, Object>> listBookings() {
        List<Map<String, Object>> list = new ArrayList<>();
        for (Booking b : bookingRepo.findAllByOrderByBookingIdDesc()) {
            Optional<Shipment> sOpt = shipmentRepo.findByBooking(b);
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("bookingId", b.getBookingId());
            map.put("bookingReference", b.getBookingReference());
            map.put("trackingNumber", sOpt.map(Shipment::getTrackingNumber).orElse("N/A"));
            map.put("customerName", b.getCustomer().getCustomerName());
            map.put("phone", b.getCustomer().getPhone());
            map.put("pickupAddress", b.getPickupAddress());
            map.put("deliveryAddress", b.getDeliveryAddress());
            map.put("parcelDescription", b.getParcelDescription());
            map.put("weightKg", b.getWeightKg());
            map.put("bookingDate", b.getBookingDate().toString());
            map.put("status", sOpt.map(Shipment::getCurrentStatus).orElse(b.getBookingStatus()));
            list.add(map);
        }
        return list;
    }

    @PostMapping
    public ResponseEntity<?> createBooking(@RequestBody Map<String, Object> req) {
        String customerName = Objects.toString(req.get("customerName"), "").trim();
        String phone = Objects.toString(req.get("phone"), "").trim();
        String email = Objects.toString(req.get("email"), "").trim();
        String pickupAddress = Objects.toString(req.get("pickupAddress"), "").trim();
        String deliveryAddress = Objects.toString(req.get("deliveryAddress"), "").trim();
        String parcelDescription = Objects.toString(req.get("parcelDescription"), "").trim();

        if (customerName.isEmpty() || phone.isEmpty() || pickupAddress.isEmpty() ||
            deliveryAddress.isEmpty() || parcelDescription.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "All required fields must be filled."));
        }

        double weightKg = 1.0;
        if (req.get("weightKg") != null && !req.get("weightKg").toString().isBlank()) {
            weightKg = Double.parseDouble(req.get("weightKg").toString());
        }

        Customer customer = new Customer();
        customer.setCustomerName(customerName);
        customer.setPhone(phone);
        customer.setEmail(email);
        customer.setAddress(pickupAddress);
        customerRepo.save(customer);

        long nextNum = 1001 + bookingRepo.count();
        String bookingRef = "SLX-BK-2026-" + nextNum;
        String trackingNum = "TRK-2026-" + (88900 + nextNum);

        Booking booking = new Booking();
        booking.setBookingReference(bookingRef);
        booking.setCustomer(customer);
        booking.setPickupAddress(pickupAddress);
        booking.setDeliveryAddress(deliveryAddress);
        booking.setParcelDescription(parcelDescription);
        booking.setWeightKg(weightKg);
        booking.setBookingDate(LocalDate.now());
        booking.setBookingStatus("ACTIVE");
        booking.setCreatedBy("Staff");
        bookingRepo.save(booking);

        Shipment shipment = new Shipment();
        shipment.setTrackingNumber(trackingNum);
        shipment.setBooking(booking);
        shipment.setCurrentStatus("BOOKED");
        shipment.setEstimatedDeliveryDate(LocalDate.now().plusDays(2));
        shipmentRepo.save(shipment);

        TrackingHistory history = new TrackingHistory();
        history.setShipment(shipment);
        history.setStatus("BOOKED");
        history.setLocationNote("Origin Dispatch Desk");
        history.setRemarks("Booking confirmed and tracking ID generated.");
        history.setUpdatedBy("Staff");
        historyRepo.save(history);

        return ResponseEntity.ok(Map.of(
            "message", "Booking created successfully!",
            "bookingReference", bookingRef,
            "trackingNumber", trackingNum
        ));
    }
}

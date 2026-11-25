package com.smartlogix.config;

import com.smartlogix.entity.*;
import com.smartlogix.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import java.time.LocalDate;

@Component
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepo;
    private final CustomerRepository customerRepo;
    private final BookingRepository bookingRepo;
    private final ShipmentRepository shipmentRepo;
    private final TrackingHistoryRepository historyRepo;
    private final VehicleRepository vehicleRepo;
    private final DriverRepository driverRepo;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(UserRepository userRepo, CustomerRepository customerRepo,
                           BookingRepository bookingRepo, ShipmentRepository shipmentRepo,
                           TrackingHistoryRepository historyRepo, VehicleRepository vehicleRepo,
                           DriverRepository driverRepo, PasswordEncoder passwordEncoder) {
        this.userRepo = userRepo;
        this.customerRepo = customerRepo;
        this.bookingRepo = bookingRepo;
        this.shipmentRepo = shipmentRepo;
        this.historyRepo = historyRepo;
        this.vehicleRepo = vehicleRepo;
        this.driverRepo = driverRepo;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (userRepo.count() == 0) {
            User admin = new User();
            admin.setFullName("Lalit Rajpurohit (Admin)");
            admin.setEmail("admin@smartlogix.in");
            admin.setPasswordHash(passwordEncoder.encode("admin123"));
            admin.setRole("ADMIN");
            userRepo.save(admin);

            User staff = new User();
            staff.setFullName("Dispatch Staff");
            staff.setEmail("staff@smartlogix.in");
            staff.setPasswordHash(passwordEncoder.encode("staff123"));
            staff.setRole("STAFF");
            userRepo.save(staff);
        }

        if (vehicleRepo.count() == 0) {
            Vehicle v1 = new Vehicle();
            v1.setRegistrationNumber("MH-01-CV-4521");
            v1.setVehicleType("Light Commercial Van");
            v1.setCapacity("1,500 kg");
            v1.setAvailabilityStatus("AVAILABLE");
            vehicleRepo.save(v1);

            Vehicle v2 = new Vehicle();
            v2.setRegistrationNumber("MH-04-TR-8810");
            v2.setVehicleType("Mini Cargo Truck");
            v2.setCapacity("3,500 kg");
            v2.setAvailabilityStatus("ON_TRIP");
            vehicleRepo.save(v2);

            Vehicle v3 = new Vehicle();
            v3.setRegistrationNumber("MH-43-BL-1904");
            v3.setVehicleType("Heavy Box Truck");
            v3.setCapacity("7,000 kg");
            v3.setAvailabilityStatus("AVAILABLE");
            vehicleRepo.save(v3);
        }

        if (driverRepo.count() == 0) {
            Driver d1 = new Driver();
            d1.setDriverName("Suresh Patil");
            d1.setPhone("+91 98192 44102");
            d1.setLicenceReference("MH01-2019004512");
            d1.setAvailabilityStatus("AVAILABLE");
            driverRepo.save(d1);

            Driver d2 = new Driver();
            d2.setDriverName("Ramesh Jadhav");
            d2.setPhone("+91 98211 77319");
            d2.setLicenceReference("MH04-2018007834");
            d2.setAvailabilityStatus("ON_TRIP");
            driverRepo.save(d2);
        }

        if (bookingRepo.count() == 0) {
            Customer c1 = new Customer();
            c1.setCustomerName("Rohan Traders");
            c1.setPhone("+91 98200 11223");
            c1.setEmail("rohan@traders.in");
            c1.setAddress("Andheri East, Mumbai - 400069");
            customerRepo.save(c1);

            Booking b1 = new Booking();
            b1.setBookingReference("SLX-BK-2026-1001");
            b1.setCustomer(c1);
            b1.setPickupAddress("Andheri East, Mumbai - 400069");
            b1.setDeliveryAddress("Hinjewadi Phase 1, Pune - 411057");
            b1.setParcelDescription("Industrial Electronic Parts (18.5 kg)");
            b1.setWeightKg(18.5);
            b1.setBookingDate(LocalDate.now());
            b1.setBookingStatus("ACTIVE");
            b1.setCreatedBy("admin@smartlogix.in");
            bookingRepo.save(b1);

            Shipment s1 = new Shipment();
            s1.setTrackingNumber("TRK-2026-88912");
            s1.setBooking(b1);
            s1.setCurrentStatus("IN_TRANSIT");
            s1.setEstimatedDeliveryDate(LocalDate.now().plusDays(1));
            shipmentRepo.save(s1);

            TrackingHistory h1 = new TrackingHistory();
            h1.setShipment(s1);
            h1.setStatus("BOOKED");
            h1.setLocationNote("Andheri Hub, Mumbai");
            h1.setRemarks("Consignment registered and verified.");
            h1.setUpdatedBy("admin@smartlogix.in");
            historyRepo.save(h1);

            TrackingHistory h2 = new TrackingHistory();
            h2.setShipment(s1);
            h2.setStatus("IN_TRANSIT");
            h2.setLocationNote("Lonavala Highway Checkpoint");
            h2.setRemarks("Dispatched via Mumbai-Pune Expressway.");
            h2.setUpdatedBy("admin@smartlogix.in");
            historyRepo.save(h2);
        }
    }
}

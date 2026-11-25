package com.smartlogix.repository;

import com.smartlogix.entity.Shipment;
import com.smartlogix.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;

public interface ShipmentRepository extends JpaRepository<Shipment, Long> {
    Optional<Shipment> findByTrackingNumberIgnoreCase(String trackingNumber);
    Optional<Shipment> findByBooking(Booking booking);
    long countByCurrentStatusNotIn(List<String> statuses);
    long countByCurrentStatus(String status);
}

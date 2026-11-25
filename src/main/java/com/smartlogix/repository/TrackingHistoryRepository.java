package com.smartlogix.repository;

import com.smartlogix.entity.TrackingHistory;
import com.smartlogix.entity.Shipment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TrackingHistoryRepository extends JpaRepository<TrackingHistory, Long> {
    List<TrackingHistory> findByShipmentOrderByUpdatedAtDesc(Shipment shipment);
}

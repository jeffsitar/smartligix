package com.smartlogix.repository;

import com.smartlogix.entity.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VehicleRepository extends JpaRepository<Vehicle, Long> {
    boolean existsByRegistrationNumberIgnoreCase(String registrationNumber);
    long countByAvailabilityStatus(String status);
}

package com.smartlogix.repository;

import com.smartlogix.entity.Driver;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DriverRepository extends JpaRepository<Driver, Long> {
    boolean existsByLicenceReferenceIgnoreCase(String licenceReference);
}

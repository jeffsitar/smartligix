package com.smartlogix.controller;

import com.smartlogix.entity.Driver;
import com.smartlogix.entity.Vehicle;
import com.smartlogix.repository.DriverRepository;
import com.smartlogix.repository.VehicleRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/fleet")
public class FleetController {

    private final VehicleRepository vehicleRepo;
    private final DriverRepository driverRepo;

    public FleetController(VehicleRepository vehicleRepo, DriverRepository driverRepo) {
        this.vehicleRepo = vehicleRepo;
        this.driverRepo = driverRepo;
    }

    @GetMapping("/vehicles")
    public List<Vehicle> getVehicles() {
        return vehicleRepo.findAll();
    }

    @PostMapping("/vehicles")
    public ResponseEntity<?> addVehicle(@RequestBody Vehicle vehicle) {
        if (vehicle.getRegistrationNumber() == null || vehicle.getRegistrationNumber().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Registration number is required."));
        }
        if (vehicleRepo.existsByRegistrationNumberIgnoreCase(vehicle.getRegistrationNumber().trim())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "Vehicle with registration number already exists."));
        }
        vehicle.setRegistrationNumber(vehicle.getRegistrationNumber().trim().toUpperCase());
        if (vehicle.getAvailabilityStatus() == null || vehicle.getAvailabilityStatus().isBlank()) {
            vehicle.setAvailabilityStatus("AVAILABLE");
        }
        return ResponseEntity.ok(vehicleRepo.save(vehicle));
    }

    @GetMapping("/drivers")
    public List<Driver> getDrivers() {
        return driverRepo.findAll();
    }

    @PostMapping("/drivers")
    public ResponseEntity<?> addDriver(@RequestBody Driver driver) {
        if (driver.getLicenceReference() == null || driver.getLicenceReference().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Licence reference is required."));
        }
        if (driverRepo.existsByLicenceReferenceIgnoreCase(driver.getLicenceReference().trim())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "Driver with this licence reference already exists."));
        }
        if (driver.getAvailabilityStatus() == null || driver.getAvailabilityStatus().isBlank()) {
            driver.setAvailabilityStatus("AVAILABLE");
        }
        return ResponseEntity.ok(driverRepo.save(driver));
    }
}

package com.smartlogix.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "drivers")
public class Driver {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long driverId;

    @Column(nullable = false)
    private String driverName;

    @Column(nullable = false)
    private String phone;

    @Column(nullable = false, unique = true)
    private String licenceReference;

    @Column(nullable = false)
    private String availabilityStatus = "AVAILABLE";

    public Long getDriverId() { return driverId; }
    public void setDriverId(Long driverId) { this.driverId = driverId; }
    public String getDriverName() { return driverName; }
    public void setDriverName(String driverName) { this.driverName = driverName; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getLicenceReference() { return licenceReference; }
    public void setLicenceReference(String licenceReference) { this.licenceReference = licenceReference; }
    public String getAvailabilityStatus() { return availabilityStatus; }
    public void setAvailabilityStatus(String availabilityStatus) { this.availabilityStatus = availabilityStatus; }
}

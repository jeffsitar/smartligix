-- SmartLogix Database Schema & Sample Seed Data
-- University of Mumbai - Department of Information Technology

CREATE DATABASE IF NOT EXISTS smartlogix_db;
USE smartlogix_db;

CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
    customer_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(150),
    address TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
    booking_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_reference VARCHAR(50) NOT NULL UNIQUE,
    customer_id BIGINT NOT NULL,
    pickup_address TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    parcel_description VARCHAR(255) NOT NULL,
    weight_kg DOUBLE DEFAULT 1.0,
    booking_date DATE NOT NULL,
    booking_status VARCHAR(30) NOT NULL,
    created_by VARCHAR(120),
    CONSTRAINT fk_booking_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE IF NOT EXISTS shipments (
    shipment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tracking_number VARCHAR(50) NOT NULL UNIQUE,
    booking_id BIGINT NOT NULL UNIQUE,
    current_status VARCHAR(30) NOT NULL,
    estimated_delivery_date DATE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_shipment_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
);

CREATE TABLE IF NOT EXISTS tracking_history (
    history_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    shipment_id BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL,
    location_note VARCHAR(200) NOT NULL,
    remarks VARCHAR(255),
    updated_by VARCHAR(120),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_history_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id)
);

CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    registration_number VARCHAR(40) NOT NULL UNIQUE,
    vehicle_type VARCHAR(80) NOT NULL,
    capacity VARCHAR(50) NOT NULL,
    availability_status VARCHAR(30) NOT NULL
);

CREATE TABLE IF NOT EXISTS drivers (
    driver_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    driver_name VARCHAR(120) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    licence_reference VARCHAR(60) NOT NULL UNIQUE,
    availability_status VARCHAR(30) NOT NULL
);

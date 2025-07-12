CREATE DATABASE IF NOT EXISTS hospital_management;
USE hospital_management;

CREATE TABLE IF NOT EXISTS patients (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fname VARCHAR(50) NOT NULL,
    lname VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    address TEXT,
    age INT,
    profile_pic VARCHAR(255),
    blood_group VARCHAR(5),
    disease TEXT,
    appointment_status VARCHAR(20),
    appointment_time DATETIME
);

CREATE TABLE IF NOT EXISTS doctors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fname VARCHAR(50) NOT NULL,
    lname VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    address TEXT,
    age INT,
    profile_pic VARCHAR(255),
    degree VARCHAR(100),
    experience INT
);

CREATE TABLE IF NOT EXISTS doctor_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fname VARCHAR(50) NOT NULL,
    lname VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    address TEXT,
    age INT,
    profile_pic VARCHAR(255),
    status ENUM('pending', 'approved') DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    doctor_id INT,
    patient_id INT,
    disease TEXT,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id),
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE IF NOT EXISTS admin (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS testimonials (
    id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT,
    message TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Insert default admin account
INSERT INTO admin (email, password) VALUES ('admin@hospital.com', 'admin123'); 

INSERT INTO patients (fname, lname, email, password, address, age, profile_pic, blood_group, disease, appointment_status, appointment_time) VALUES
('Alice', 'Johnson', 'alicej@example.com', 'password123', '321 Maple Ave', 28, '', 'A+', 'Flu', 'scheduled', '2025-05-10 10:00:00'),
('Bob', 'Williams', 'bobw@example.com', 'password123', '654 Pine Rd', 50, '', 'B-', 'Diabetes', 'completed', '2025-05-01 09:00:00'),
('Charlie', 'Davis', 'charlied@example.com', 'password123', '987 Cedar Blvd', 60, '', 'O+', 'Hypertension', 'scheduled', '2025-05-15 14:00:00'),
('Diana', 'Evans', 'dianae@example.com', 'password123', '1111 Oak Cir', 34, '', 'AB+', 'Asthma', 'scheduled', '2025-05-12 11:00:00'),
('Ethan', 'Morris', 'ethanm@example.com', 'password123', '2222 Pine St', 45, '', 'A-', 'Arthritis', 'cancelled', '2025-05-20 13:00:00'),
('Fiona', 'Scott', 'fionas@example.com', 'password123', '3333 Cedar Ave', 29, '', 'B+', 'Migraine', 'scheduled', '2025-05-18 15:00:00'),
('George', 'King', 'georgek@example.com', 'password123', '4444 Birch Blvd', 52, '', 'O-', 'Heart Disease', 'completed', '2025-05-05 08:00:00'),
('Hannah', 'Wright', 'hannahw@example.com', 'password123', '5555 Willow Rd', 39, '', 'AB-', 'Allergy', 'scheduled', '2025-05-22 16:00:00'),
('Ian', 'Lopez', 'ianl@example.com', 'password123', '6666 Aspen Ct', 31, '', 'A+', 'Back Pain', 'scheduled', '2025-05-25 10:30:00'),
('Julia', 'Perez', 'juliap@example.com', 'password123', '7777 Poplar Pl', 27, '', 'B-', 'Cold', 'completed', '2025-05-03 12:00:00');


INSERT INTO doctors (fname, lname, email, password, address, age, profile_pic, degree, experience) VALUES
('John', 'Doe', 'johndoe@example.com', 'password123', '123 Main St', 40, '', 'MBBS', 15),
('Jane', 'Smith', 'janesmith@example.com', 'password123', '456 Elm St', 35, '', 'MD', 10),
('Emily', 'Brown', 'emilybrown@example.com', 'password123', '789 Oak St', 45, '', 'MBBS, MD', 20),
('Michael', 'Clark', 'michaelc@example.com', 'password123', '1010 Birch St', 38, '', 'MBBS', 12),
('Sarah', 'Lee', 'sarahlee@example.com', 'password123', '2020 Willow Ave', 42, '', 'MD', 18),
('David', 'Wilson', 'davidwilson@example.com', 'password123', '3030 Aspen Rd', 50, '', 'MBBS', 25),
('Laura', 'Martinez', 'lauram@example.com', 'password123', '4040 Poplar Dr', 33, '', 'MBBS', 8),
('James', 'Taylor', 'jamest@example.com', 'password123', '5050 Spruce Ln', 47, '', 'MD', 22),
('Olivia', 'Anderson', 'oliviaa@example.com', 'password123', '6060 Redwood Ct', 36, '', 'MBBS', 11),
('William', 'Moore', 'williamm@example.com', 'password123', '7070 Cypress Pl', 55, '', 'MD', 30);

ALTER TABLE doctors MODIFY experience VARCHAR(50);


CREATE TABLE IF NOT EXISTS appointments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT,
    doctor_id INT,
    disease VARCHAR(255),
    status VARCHAR(20), -- e.g., 'pending', 'completed', 'cancelled'
    appointment_time DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
);

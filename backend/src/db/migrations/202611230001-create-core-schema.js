exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE branches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE doctors (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL REFERENCES branches(id),
      name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE INDEX doctors_branch_id_idx ON doctors(branch_id);

    CREATE TABLE services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE doctor_services (
      doctor_id TEXT NOT NULL REFERENCES doctors(id),
      service_id TEXT NOT NULL REFERENCES services(id),
      PRIMARY KEY (doctor_id, service_id)
    );
    CREATE INDEX doctor_services_service_id_idx ON doctor_services(service_id);

    CREATE TABLE patients (
      id TEXT PRIMARY KEY,
      nik CHAR(16) NOT NULL UNIQUE CHECK (nik ~ '^[0-9]{16}$'),
      name TEXT NOT NULL,
      phone VARCHAR(13) NOT NULL CHECK (phone ~ '^08[0-9]{8,11}$'),
      address VARCHAR(500),
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE schedules (
      id TEXT PRIMARY KEY,
      doctor_id TEXT NOT NULL REFERENCES doctors(id),
      date DATE NOT NULL,
      shift TEXT NOT NULL CHECK (shift IN ('pagi', 'siang')),
      start_time TIME NOT NULL,
      end_time TIME NOT NULL CHECK (end_time > start_time),
      capacity INTEGER NOT NULL CHECK (capacity > 0),
      booked_count INTEGER NOT NULL DEFAULT 0 CHECK (booked_count >= 0 AND booked_count <= capacity),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE (doctor_id, date, shift, start_time)
    );
    CREATE INDEX schedules_doctor_date_active_idx ON schedules(doctor_id, date, is_active);

    CREATE TABLE reservations (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id),
      service_id TEXT NOT NULL REFERENCES services(id),
      doctor_id TEXT NOT NULL REFERENCES doctors(id),
      schedule_id TEXT NOT NULL REFERENCES schedules(id),
      visit_type TEXT NOT NULL CHECK (visit_type IN ('baru', 'kontrol')),
      status TEXT NOT NULL CHECK (status IN ('confirmed', 'waiting', 'present', 'called', 'in_progress', 'completed', 'cancelled')),
      queue_number VARCHAR(10),
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX reservations_patient_created_idx ON reservations(patient_id, created_at DESC);
    CREATE INDEX reservations_doctor_id_idx ON reservations(doctor_id);
    CREATE INDEX reservations_service_id_idx ON reservations(service_id);
    CREATE INDEX reservations_schedule_id_idx ON reservations(schedule_id);

    CREATE TABLE queues (
      id TEXT PRIMARY KEY,
      reservation_id TEXT NOT NULL UNIQUE REFERENCES reservations(id),
      doctor_id TEXT NOT NULL REFERENCES doctors(id),
      date DATE NOT NULL,
      shift TEXT NOT NULL CHECK (shift IN ('pagi', 'siang')),
      queue_number VARCHAR(10) NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('waiting', 'present', 'called', 'in_progress', 'completed', 'cancelled')),
      created_at TIMESTAMPTZ NOT NULL,
      UNIQUE (doctor_id, date, shift, queue_number)
    );
    CREATE INDEX queues_doctor_date_status_idx ON queues(doctor_id, date, status);
    CREATE INDEX queues_doctor_date_shift_idx ON queues(doctor_id, date, shift);
  `);

  pgm.sql(`
    INSERT INTO branches (id, name)
    VALUES ('gunung-anyar', 'Gunung Anyar')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

    INSERT INTO services (id, name, description, is_active) VALUES
      ('service-001', 'Pemeriksaan Umum', 'Pemeriksaan gigi secara menyeluruh untuk senyum sehat.', TRUE),
      ('service-002', 'Tambal Gigi', 'Perawatan untuk memperbaiki gigi berlubang agar tetap sehat.', TRUE),
      ('service-003', 'Cabut Gigi', 'Tindakan untuk mengangkat gigi yang rusak dan tidak dapat dipertahankan.', TRUE),
      ('service-004', 'Perawatan Ortodonti', 'Rencanakan senyum rapi bersama dokter kami.', TRUE)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      is_active = EXCLUDED.is_active;

    INSERT INTO doctors (id, branch_id, name, specialty, is_active) VALUES
      ('doctor-demo-001', 'gunung-anyar', 'Dokter Demonstrasi 1', 'Dokter Gigi Umum', TRUE),
      ('doctor-demo-002', 'gunung-anyar', 'Dokter Demonstrasi 2', 'Dokter Gigi', TRUE),
      ('doctor-demo-003', 'gunung-anyar', 'Dokter Demonstrasi 3', 'Dokter Gigi', FALSE)
    ON CONFLICT (id) DO UPDATE SET
      branch_id = EXCLUDED.branch_id,
      name = EXCLUDED.name,
      specialty = EXCLUDED.specialty,
      is_active = EXCLUDED.is_active;

    INSERT INTO doctor_services (doctor_id, service_id) VALUES
      ('doctor-demo-001', 'service-001'),
      ('doctor-demo-001', 'service-002'),
      ('doctor-demo-002', 'service-003'),
      ('doctor-demo-002', 'service-004'),
      ('doctor-demo-003', 'service-001')
    ON CONFLICT (doctor_id, service_id) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE queues;
    DROP TABLE reservations;
    DROP TABLE schedules;
    DROP TABLE patients;
    DROP TABLE doctor_services;
    DROP TABLE services;
    DROP TABLE doctors;
    DROP TABLE branches;
  `);
};

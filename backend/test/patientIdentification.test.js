const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');
const app = require('../src/app');

test('patient identification, duplicate prevention, and reservation reuse', async () => {
  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function post(path, payload) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { status: response.status, body: await response.json() };
  }

  try {
    const existing = await post('/api/patients/identify', {
      nik: '0000000000000001',
      name: 'Pasien Demonstrasi 1',
    });
    assert.equal(existing.status, 200);
    assert.equal(existing.body.data.found, true);
    assert.equal(existing.body.data.patient.id, 'patient-demo-001');

    const normalizedMatch = await post('/api/patients/identify', {
      nik: '0000000000000001',
      name: '  pasien   demonstrasi 1  ',
    });
    assert.equal(normalizedMatch.status, 200);
    assert.equal(normalizedMatch.body.data.patient.id, existing.body.data.patient.id);

    const wrongName = await post('/api/patients/identify', {
      nik: '0000000000000001',
      name: 'Nama Berbeda',
    });
    assert.equal(wrongName.status, 409);
    assert.match(wrongName.body.error, /NIK sudah terdaftar.*nama lengkap tidak cocok/i);

    const mismatchedCreate = await post('/api/patients', {
      nik: '0000000000000001',
      name: 'Nama Berbeda',
      phone: '081234567890',
    });
    assert.equal(mismatchedCreate.status, 409);
    assert.match(mismatchedCreate.body.error, /NIK sudah terdaftar.*nama lengkap tidak cocok/i);

    const missing = await post('/api/patients/identify', {
      nik: '9900000000000001',
      name: 'Pasien Baru Uji',
    });
    assert.equal(missing.status, 200);
    assert.deepEqual(missing.body.data, { found: false, patient: null });

    const created = await post('/api/patients', {
      nik: '9900000000000001',
      name: 'Pasien Baru Uji',
      phone: '081234567890',
    });
    assert.equal(created.status, 201);
    const createdPatientId = created.body.data.id;

    const identifiedCreated = await post('/api/patients/identify', {
      nik: '9900000000000001',
      name: 'Pasien Baru Uji',
    });
    assert.equal(identifiedCreated.status, 200);
    assert.equal(identifiedCreated.body.data.patient.id, createdPatientId);

    const duplicate = await post('/api/patients', {
      nik: '9900000000000001',
      name: 'Pasien Baru Uji',
      phone: '081234567890',
    });
    assert.equal(duplicate.status, 409);
    assert.match(duplicate.body.error, /NIK sudah terdaftar/i);

    const schedulesResponse = await fetch(`${baseUrl}/api/schedules?doctorId=doctor-demo-001`);
    const schedulesBody = await schedulesResponse.json();
    const schedule = schedulesBody.data.find((item) => item.isActive && item.bookedCount < item.capacity);
    assert.ok(schedule, 'Expected an available demonstration schedule');

    const existingReservation = await post('/api/reservations', {
      patientId: existing.body.data.patient.id,
      serviceId: 'service-001',
      doctorId: 'doctor-demo-001',
      scheduleId: schedule.id,
      visitType: 'baru',
    });
    assert.equal(existingReservation.status, 201);
    assert.equal(existingReservation.body.data.patientId, existing.body.data.patient.id);
    assert.ok(existingReservation.body.data.queue.queueNumber);

    const newPatientSchedule = schedulesBody.data.find((item) => (
      item.id !== schedule.id && item.isActive && item.bookedCount < item.capacity
    ));
    assert.ok(newPatientSchedule, 'Expected another available demonstration schedule');
    const newPatientReservation = await post('/api/reservations', {
      patientId: createdPatientId,
      serviceId: 'service-001',
      doctorId: 'doctor-demo-001',
      scheduleId: newPatientSchedule.id,
      visitType: 'baru',
    });
    assert.equal(newPatientReservation.status, 201);
    assert.equal(newPatientReservation.body.data.patientId, createdPatientId);
    assert.ok(newPatientReservation.body.data.queue.queueNumber);

    const controlLookup = await post('/api/patients/lookup-control', {
      nik: '0000000000000001',
      name: 'Pasien Demonstrasi 1',
    });
    assert.equal(controlLookup.status, 200);
    assert.equal(controlLookup.body.data.patientId, existing.body.data.patient.id);
    assert.equal(controlLookup.body.data.patientPhone, existing.body.data.patient.phone);
    assert.equal(controlLookup.body.data.doctor.id, 'doctor-demo-001');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
test('patient administrative records require frontline authentication', async () => {
  const previousUsername = process.env.FRONTLINE_USERNAME;
  const previousPassword = process.env.FRONTLINE_PASSWORD;
  process.env.FRONTLINE_USERNAME = 'patient-test-frontline';
  process.env.FRONTLINE_PASSWORD = 'patient-test-password';
  const server = app.listen(0);
  await once(server, 'listening');
  const baseUrl = 'http://127.0.0.1:' + server.address().port;
  try {
    const unauthorizedPatients = await fetch(baseUrl + '/api/patients');
    const unauthorizedPatient = await fetch(baseUrl + '/api/patients/patient-demo-001');
    const unauthorizedReservations = await fetch(baseUrl + '/api/reservations');
    assert.equal(unauthorizedPatients.status, 401);
    assert.equal(unauthorizedPatient.status, 401);
    assert.equal(unauthorizedReservations.status, 401);

    const loginResponse = await fetch(baseUrl + '/api/auth/frontline/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: process.env.FRONTLINE_USERNAME, password: process.env.FRONTLINE_PASSWORD }),
    });
    assert.equal(loginResponse.status, 200);
    const cookie = loginResponse.headers.get('set-cookie').split(';')[0];
    const patientsResponse = await fetch(baseUrl + '/api/patients', { headers: { Cookie: cookie } });
    assert.equal(patientsResponse.status, 200);
    const patients = (await patientsResponse.json()).data;
    const patient = patients.find((item) => item.id === 'patient-demo-001');
    assert.equal(patient.nik, '0000000000000001');
    assert.equal(patient.name, 'Pasien Demonstrasi 1');
    assert.equal(patient.phone, '080000000001');
  } finally {
    server.close();
    await once(server, 'close');
    if (previousUsername === undefined) delete process.env.FRONTLINE_USERNAME;
    else process.env.FRONTLINE_USERNAME = previousUsername;
    if (previousPassword === undefined) delete process.env.FRONTLINE_PASSWORD;
    else process.env.FRONTLINE_PASSWORD = previousPassword;
  }
});

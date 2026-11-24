const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');
const createQueueService = require('../src/services/queueService');
const app = require('../src/app');

function createFixture() {
  const queues = [
    { id: 'queue-a001', reservationId: 'reservation-a001', doctorId: 'doctor-1', date: '2030-01-10', shift: 'pagi', queueNumber: '001', status: 'in_progress' },
    { id: 'queue-a002', reservationId: 'reservation-a002', doctorId: 'doctor-1', date: '2030-01-10', shift: 'pagi', queueNumber: '002', status: 'called' },
    { id: 'queue-b001', reservationId: 'reservation-b001', doctorId: 'doctor-2', date: '2030-01-10', shift: 'siang', queueNumber: '001', status: 'in_progress' },
    { id: 'queue-a003', reservationId: 'reservation-a003', doctorId: 'doctor-1', date: '2030-01-11', shift: 'siang', queueNumber: '001', status: 'in_progress' },
    { id: 'queue-a004', reservationId: 'reservation-a004', doctorId: 'doctor-2', date: '2030-01-12', shift: 'siang', queueNumber: '004', status: 'waiting' },
  ];
  const reservations = queues.map((queue, index) => ({ id: queue.reservationId, patientId: `patient-${index + 1}`, status: queue.status }));
  const patients = reservations.map((reservation, index) => ({ id: reservation.patientId, name: `Nama Pasien ${index + 1}`, nik: `000${index}`, phone: `080${index}` }));
  const doctors = [{ id: 'doctor-1' }, { id: 'doctor-2' }];
  const schedules = [];
  const queueRepository = {
    findAll: () => queues,
    findById: (id) => queues.find((queue) => queue.id === id) || null,
    findByReservationId: (reservationId) => queues.find((queue) => queue.reservationId === reservationId) || null,
    update(id, payload) {
      const queue = this.findById(id);
      if (!queue) return null;
      Object.assign(queue, payload);
      return queue;
    },
  };
  const reservationRepository = {
    findById: (id) => reservations.find((reservation) => reservation.id === id) || null,
    update(id, payload) {
      const reservation = this.findById(id);
      if (!reservation) return null;
      Object.assign(reservation, payload);
      return reservation;
    },
  };
  const service = createQueueService({
    queues: queueRepository,
    reservations: reservationRepository,
    schedules: { findAll: () => schedules, findById: () => null, releaseBooking: () => null },
    doctors: { findAll: () => doctors, findById: (id) => doctors.find((doctor) => doctor.id === id) || null },
    patients: { findById: (id) => patients.find((patient) => patient.id === id) || null },
  });
  return { service, queues, reservations };
}

test('current queue returns only active queue numbers for the requested doctor and date', () => {
  const { service } = createFixture();
  assert.deepEqual(service.current({ doctorId: 'doctor-1', date: '2030-01-10' }), ['001']);
});

test('current queue returns an empty list when no queue is being served', () => {
  const { service } = createFixture();
  assert.deepEqual(service.current({ doctorId: 'doctor-1', date: '2030-01-12' }), []);
});

test('frontline status updates move the active number without changing official queue numbers', () => {
  const { service, queues, reservations } = createFixture();
  const firstNumber = queues[0].queueNumber;
  const nextNumber = queues[1].queueNumber;
  const firstReservation = reservations.find((item) => item.id === queues[0].reservationId);
  const nextReservation = reservations.find((item) => item.id === queues[1].reservationId);

  service.updateStatus('queue-a001', 'completed');
  assert.equal(queues[0].status, 'completed');
  assert.equal(firstReservation.status, 'completed');
  assert.equal(queues[1].status, 'called');
  assert.equal(nextReservation.status, 'called');
  assert.deepEqual(service.current({ doctorId: 'doctor-1', date: '2030-01-10' }), []);

  service.updateStatus('queue-a002', 'in_progress');

  assert.deepEqual(service.current({ doctorId: 'doctor-1', date: '2030-01-10' }), ['002']);
  assert.deepEqual(service.current({ doctorId: 'doctor-2', date: '2030-01-10' }), ['001']);
  assert.deepEqual(service.current({ doctorId: 'doctor-1', date: '2030-01-11' }), ['001']);
  assert.equal(queues[0].queueNumber, firstNumber);
  assert.equal(queues[1].queueNumber, nextNumber);
});

test('marking a waiting patient present persists status, syncs reservation, and preserves queue number', () => {
  const { service, queues, reservations } = createFixture();
  const queue = queues.find((item) => item.id === 'queue-a004');
  const reservation = reservations.find((item) => item.id === queue.reservationId);
  const officialNumber = queue.queueNumber;

  service.updateStatus(queue.id, 'present');

  assert.equal(queue.status, 'present');
  assert.equal(reservation.status, 'present');
  assert.equal(service.list({ status: 'present' }).find((item) => item.queueId === queue.id).status, 'present');
  assert.equal(queue.queueNumber, officialNumber);
  assert.deepEqual(service.current({ doctorId: 'doctor-2', date: '2030-01-12' }), []);
  assert.throws(() => service.updateStatus('queue-a002', 'present'), { status: 400 });
});

test('current queue validates doctor, date, and required query parameters', () => {
  const { service } = createFixture();
  assert.throws(() => service.current({ date: '2030-01-10' }), { status: 400 });
  assert.throws(() => service.current({ doctorId: 'doctor-1', date: '2030-02-30' }), { status: 400 });
  assert.throws(() => service.current({ doctorId: 'unknown', date: '2030-01-10' }), { status: 404 });
});

test('queue list supports doctor, date, shift, and status filters together and returns only required patient fields', () => {
  const { service } = createFixture();
  assert.equal(service.list({ doctorId: 'doctor-1' }).length, 3);
  assert.equal(service.list({ date: '2030-01-10' }).length, 3);
  assert.equal(service.list({ shift: 'pagi' }).length, 2);
  const rows = service.list({ doctorId: 'doctor-1', date: '2030-01-10', shift: 'pagi', status: 'called' });
  assert.deepEqual(rows, [{
    queueId: 'queue-a002',
    queueNumber: '002',
    doctorId: 'doctor-1',
    date: '2030-01-10',
    shift: 'pagi',
    patientName: 'Nama Pasien 2',
    status: 'called',
  }]);
  assert.throws(() => service.list({ shift: 'malam' }), { status: 400 });
  assert.throws(() => service.list({ doctorId: 'doctor-1', unknown: 'value' }), { status: 400 });
});

test('queue list preserves unfiltered listing and reports the latest queue status', () => {
  const { service } = createFixture();
  assert.equal(service.list().length, 5);
  service.updateStatus('queue-a002', 'in_progress');
  const updated = service.list({ doctorId: 'doctor-1', date: '2030-01-10', shift: 'pagi', status: 'in_progress' });
  const changedQueue = updated.find((queue) => queue.queueNumber === '002');
  assert.ok(changedQueue);
  assert.equal(changedQueue.status, 'in_progress');
});

test('public current queue endpoint requires no frontline session and returns no patient data', async () => {
  const server = app.listen(0);
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`${baseUrl}/api/queues/current?doctorId=doctor-demo-001&date=2030-01-10`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.data, []);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('frontline queue list remains protected by authentication', async () => {
  const server = app.listen(0);
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`${baseUrl}/api/queues`);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Login Frontline diperlukan untuk mengakses data ini.' });
    const statusResponse = await fetch(`${baseUrl}/api/queues/queue-a004/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'present' }),
    });
    assert.equal(statusResponse.status, 401);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('authenticated queue API filters records and returns only the requested patient identity field', async () => {
  const previousUsername = process.env.FRONTLINE_USERNAME;
  const previousPassword = process.env.FRONTLINE_PASSWORD;
  process.env.FRONTLINE_USERNAME = 'queue-test-frontline';
  process.env.FRONTLINE_PASSWORD = 'queue-test-password';
  const server = app.listen(0);
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const loginResponse = await fetch(`${baseUrl}/api/auth/frontline/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: process.env.FRONTLINE_USERNAME, password: process.env.FRONTLINE_PASSWORD }),
    });
    assert.equal(loginResponse.status, 200);
    const cookie = loginResponse.headers.get('set-cookie').split(';')[0];

    const schedulesResponse = await fetch(`${baseUrl}/api/schedules`);
    const schedules = (await schedulesResponse.json()).data;
    const schedule = schedules.find((item) => item.doctorId === 'doctor-demo-001' && item.shift === 'pagi');
    assert.ok(schedule);
    const reservationResponse = await fetch(`${baseUrl}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: 'patient-demo-001', serviceId: 'service-001', doctorId: 'doctor-demo-001', scheduleId: schedule.id, visitType: 'baru' }),
    });
    assert.equal(reservationResponse.status, 201);
    const created = (await reservationResponse.json()).data;

    const params = new URLSearchParams({ doctorId: 'doctor-demo-001', date: schedule.date, shift: 'pagi', status: 'waiting' });
    const response = await fetch(`${baseUrl}/api/queues?${params}`, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    const queues = (await response.json()).data;
    const queue = queues.find((item) => item.queueId === created.queue.id);
    assert.deepEqual(queue, {
      queueId: created.queue.id,
      queueNumber: created.queue.queueNumber,
      doctorId: 'doctor-demo-001',
      date: schedule.date,
      shift: 'pagi',
      patientName: 'Pasien Demonstrasi 1',
      status: 'waiting',
    });

    const markPresentResponse = await fetch(`${baseUrl}/api/queues/${encodeURIComponent(created.queue.id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ status: 'present' }),
    });
    assert.equal(markPresentResponse.status, 200);
    const updatedQueue = (await markPresentResponse.json()).data;
    assert.equal(updatedQueue.status, 'present');
    assert.equal(updatedQueue.queueNumber, created.queue.queueNumber);

    const presentParams = new URLSearchParams({ doctorId: 'doctor-demo-001', date: schedule.date, shift: 'pagi', status: 'present' });
    const refreshedResponse = await fetch(`${baseUrl}/api/queues?${presentParams}`, { headers: { Cookie: cookie } });
    const refreshedQueues = (await refreshedResponse.json()).data;
    assert.equal(refreshedQueues.find((item) => item.queueId === created.queue.id).status, 'present');

    const reservationsResponse = await fetch(`${baseUrl}/api/reservations`, { headers: { Cookie: cookie } });
    const refreshedReservations = (await reservationsResponse.json()).data;
    const updatedReservation = refreshedReservations.find((item) => item.id === created.id);
    assert.equal(updatedReservation.status, 'present');
    assert.equal(updatedReservation.queueNumber, created.queue.queueNumber);

    const activeResponse = await fetch(`${baseUrl}/api/queues/current?doctorId=doctor-demo-001&date=${schedule.date}`);
    assert.deepEqual((await activeResponse.json()).data, []);

    for (const status of ['called', 'in_progress']) {
      const updateResponse = await fetch(`${baseUrl}/api/queues/${encodeURIComponent(created.queue.id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ status }),
      });
      assert.equal(updateResponse.status, 200);
      assert.equal((await updateResponse.json()).data.status, status);
    }

    const servingResponse = await fetch(`${baseUrl}/api/queues/current?doctorId=doctor-demo-001&date=${schedule.date}`);
    assert.deepEqual((await servingResponse.json()).data, [created.queue.queueNumber]);
    const servingParams = new URLSearchParams({ doctorId: 'doctor-demo-001', date: schedule.date, shift: 'pagi', status: 'in_progress' });
    const servingListResponse = await fetch(`${baseUrl}/api/queues?${servingParams}`, { headers: { Cookie: cookie } });
    const servingQueue = (await servingListResponse.json()).data.find((item) => item.queueId === created.queue.id);
    assert.equal(servingQueue.status, 'in_progress');
    assert.equal(servingQueue.queueNumber, created.queue.queueNumber);
    const finalReservationsResponse = await fetch(`${baseUrl}/api/reservations`, { headers: { Cookie: cookie } });
    const finalReservation = (await finalReservationsResponse.json()).data.find((item) => item.id === created.id);
    assert.equal(finalReservation.status, 'in_progress');
    assert.equal(finalReservation.queueNumber, created.queue.queueNumber);
  } finally {
    server.close();
    await once(server, 'close');
    if (previousUsername === undefined) delete process.env.FRONTLINE_USERNAME;
    else process.env.FRONTLINE_USERNAME = previousUsername;
    if (previousPassword === undefined) delete process.env.FRONTLINE_PASSWORD;
    else process.env.FRONTLINE_PASSWORD = previousPassword;
  }
});

const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');
const createQueueService = require('../src/services/queueService');
const app = require('../src/app');

function createFixture() {
  const queues = [
    { id: 'queue-a001', reservationId: 'reservation-a001', doctorId: 'doctor-1', date: '2030-01-10', queueNumber: '001', status: 'in_progress' },
    { id: 'queue-a002', reservationId: 'reservation-a002', doctorId: 'doctor-1', date: '2030-01-10', queueNumber: '002', status: 'called' },
    { id: 'queue-b001', reservationId: 'reservation-b001', doctorId: 'doctor-2', date: '2030-01-10', queueNumber: '001', status: 'in_progress' },
    { id: 'queue-a003', reservationId: 'reservation-a003', doctorId: 'doctor-1', date: '2030-01-11', queueNumber: '001', status: 'in_progress' },
  ];
  const reservations = queues.map((queue) => ({ id: queue.reservationId, status: queue.status }));
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
  });
  return { service, queues };
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
  const { service, queues } = createFixture();
  const firstNumber = queues[0].queueNumber;
  const nextNumber = queues[1].queueNumber;

  service.updateStatus('queue-a001', 'completed');
  service.updateStatus('queue-a002', 'in_progress');

  assert.deepEqual(service.current({ doctorId: 'doctor-1', date: '2030-01-10' }), ['002']);
  assert.equal(queues[0].queueNumber, firstNumber);
  assert.equal(queues[1].queueNumber, nextNumber);
});

test('current queue validates doctor, date, and required query parameters', () => {
  const { service } = createFixture();
  assert.throws(() => service.current({ date: '2030-01-10' }), { status: 400 });
  assert.throws(() => service.current({ doctorId: 'doctor-1', date: '2030-02-30' }), { status: 400 });
  assert.throws(() => service.current({ doctorId: 'unknown', date: '2030-01-10' }), { status: 404 });
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

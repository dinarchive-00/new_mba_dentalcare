const { resourceRepositories } = require('../repositories');
const createDoctorService = require('./doctorService');
const createScheduleService = require('./scheduleService');
const createPatientService = require('./patientService');
const createReservationService = require('./reservationService');
const createQueueService = require('./queueService');
const createResourceService = require('./resourceService');

const resourceServices = Object.fromEntries(
  Object.entries(resourceRepositories).map(([name, repository]) => [
    name,
    name === 'doctors'
      ? createDoctorService(repository)
      : name === 'schedules'
        ? createScheduleService(repository, resourceRepositories.doctors)
        : name === 'patients'
          ? createPatientService(repository)
          : name === 'reservations'
            ? createReservationService({
              reservations: repository,
              patients: resourceRepositories.patients,
              services: resourceRepositories.services,
              doctors: resourceRepositories.doctors,
              schedules: resourceRepositories.schedules,
            })
            : name === 'queues'
              ? createQueueService({
                queues: repository,
                reservations: resourceRepositories.reservations,
                schedules: resourceRepositories.schedules,
              })
              : createResourceService(repository),
  ]),
);

module.exports = { resourceServices };

const createResourceService = require('./resourceService');

function createDoctorService(repository) {
  const resourceService = createResourceService(repository);

  return {
    ...resourceService,
    async list(query = {}) {
      const doctors = await repository.findAll();
      return doctors.filter((doctor) => (
        doctor.isActive
        && (!query.serviceId || doctor.serviceIds.includes(query.serviceId))
      ));
    },
  };
}

module.exports = createDoctorService;

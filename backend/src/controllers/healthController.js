function createHealthController() {
  return {
    getHealth(req, res) {
      res.status(200).json({ status: 'ok', message: 'API MBA Dentalcare aktif' });
    },
  };
}

module.exports = { createHealthController };

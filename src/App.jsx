import { useEffect, useRef, useState } from 'react'
import './App.css'
import './review.css'

const serviceIcons = ['🦷', '✨', '🪥', '😁']

async function getApiData(path, options) {
  const response = await fetch(`/api/${path}`, options)
  if (!response.ok) throw new Error(`Gagal memuat ${path}.`)
  const result = await response.json()
  return result.data
}

async function postApiData(path, payload) {
  const response = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(result.error || 'Permintaan tidak dapat diproses.')
    error.status = response.status
    throw error
  }
  return { status: response.status, data: result.data }
}

async function patchApiData(path, payload) {
  const response = await fetch(`/api/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(result.error || 'Perubahan tidak dapat disimpan.')
    error.status = response.status
    throw error
  }
  return result.data
}

function toRecordList(value) {
  if (!Array.isArray(value)) throw new Error('Format data tidak sesuai. Silakan muat ulang.');
  return value.filter((record) => record && typeof record === 'object' && !Array.isArray(record));
}

function IdentityMismatchDialog({ onClose }) {
  return (
    <div className="identity-dialog-backdrop">
      <section className="identity-dialog" role="alertdialog" aria-modal="true" aria-labelledby="identity-dialog-title" aria-describedby="identity-dialog-description">
        <div className="eyebrow"><span /> VERIFIKASI IDENTITAS</div>
        <h2 id="identity-dialog-title">NIK telah digunakan</h2>
        <p id="identity-dialog-description">NIK ini terdaftar dengan nama yang berbeda. Periksa kembali NIK dan nama lengkap Anda. Jika data tetap tidak cocok, silakan hubungi Frontline.</p>
        <button className="button button-dark" type="button" onClick={onClose}>Periksa kembali <span>→</span></button>
      </section>
    </div>
  )
}

function ReservationList({ onBack, onLogout }) {
  const [reservations, setReservations] = useState([]);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [query, setQuery] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedReservationId, setSelectedReservationId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [statusSuccess, setStatusSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all(['reservations', 'patients', 'services', 'doctors', 'schedules'].map(async (path) => {
      const result = await getApiData(path, { signal: controller.signal });
      return toRecordList(result);
    }))
      .then(([reservationData, patientData, serviceData, doctorData, scheduleData]) => {
        if (controller.signal.aborted) return;
        setReservations(reservationData);
        setPatients(patientData);
        setServices(serviceData);
        setDoctors(doctorData);
        setSchedules(scheduleData);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Daftar reservasi gagal dimuat. Periksa koneksi ke server, lalu coba muat ulang.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reloadKey]);

  const patientById = new Map(patients.map((record) => [record.id, record]));
  const serviceById = new Map(services.map((record) => [record.id, record]));
  const doctorById = new Map(doctors.map((record) => [record.id, record]));
  const scheduleById = new Map(schedules.map((record) => [record.id, record]));
  const rows = reservations.map((reservation) => ({
    reservation,
    patient: patientById.get(reservation.patientId),
    service: serviceById.get(reservation.serviceId),
    doctor: doctorById.get(reservation.doctorId),
    schedule: scheduleById.get(reservation.scheduleId),
  }));
  const normalizedQuery = query.trim().toLocaleLowerCase('id');
  const filteredRows = rows.filter(({ reservation, patient, service, doctor, schedule }) => {
    const matchesQuery = [reservation.id, patient?.name, service?.name, doctor?.name]
      .some((value) => String(value || '').toLocaleLowerCase('id').includes(normalizedQuery));
    const matchesDoctor = !doctorFilter || doctor?.id === doctorFilter || reservation.doctorId === doctorFilter;
    const matchesDate = !dateFilter || schedule?.date === dateFilter;
    const matchesStatus = !statusFilter || String(reservation.status || '').toLowerCase() === statusFilter;
    return matchesQuery && matchesDoctor && matchesDate && matchesStatus;
  });
  const reservationStatuses = [...new Set(reservations.map((item) => String(item.status || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'id'));
  const hasActiveFilters = Boolean(query || doctorFilter || dateFilter || statusFilter);
  const selectedRow = rows.find(({ reservation }) => reservation.id === selectedReservationId);
  const nextReservationStatuses = {
    confirmed: ['waiting', 'cancelled'],
    waiting: ['called', 'cancelled'],
    called: ['in_progress', 'cancelled'],
    in_progress: ['completed'],
    completed: [],
    cancelled: [],
  };
  const statusLabels = {
    confirmed: 'Terkonfirmasi', waiting: 'Menunggu', called: 'Dipanggil',
    in_progress: 'Sedang dilayani', completed: 'Selesai', cancelled: 'Dibatalkan',
  };
  const confirmedCount = reservations.filter((item) => String(item.status || '').toLowerCase() === 'confirmed').length;
  const otherStatusCount = reservations.length - confirmedCount;
  const formatDate = (value) => {
    if (!value) return '?';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
  };

  async function handleReservationStatusSave() {
    if (!selectedReservationId || !selectedStatus) return;
    setStatusSaving(true);
    setStatusError('');
    setStatusSuccess('');
    try {
      const updated = await patchApiData(`reservations/${encodeURIComponent(selectedReservationId)}/status`, { status: selectedStatus });
      setReservations((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelectedStatus(updated.status);
      setStatusSuccess('Status reservasi berhasil diperbarui.');
    } catch (requestError) {
      setStatusError(requestError.message || 'Status reservasi gagal diperbarui. Silakan coba lagi.');
    } finally {
      setStatusSaving(false);
    }
  }

  return (
    <main className="service-page reservation-page">
      <header className="service-page-header"><button className="back-button" onClick={onBack} aria-label="Kembali ke beranda">?</button><span>Daftar Reservasi</span><button className="logout-button" onClick={onLogout}>Keluar</button><button className="reload-button" onClick={() => { setLoading(true); setError(''); setReloadKey((value) => value + 1) }} disabled={loading}>Muat Ulang</button></header>
      <section className="reservation-content">
        <div className="eyebrow"><span /> DATA KUNJUNGAN</div>
        <h1>Daftar <em>Reservasi</em></h1>
        <div className="reservation-summary" aria-label="Ringkasan reservasi">
          <article><span>Total Reservasi</span><strong>{loading ? '?' : reservations.length}</strong></article>
          <article><span>Terkonfirmasi</span><strong>{loading ? '?' : confirmedCount}</strong></article>
          <article><span>Status lain</span><strong>{loading ? '?' : otherStatusCount}</strong></article>
        </div>
        <div className="reservation-filters">
          <label className="reservation-search">Cari reservasi
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ID, pasien, dokter, atau layanan" />
          </label>
          <label className="reservation-filter">Dokter
            <select value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)} disabled={loading || doctors.length === 0}>
              <option value="">Semua dokter</option>
              {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
            </select>
          </label>
          <label className="reservation-filter">Tanggal kunjungan
            <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          </label>
          <label className="reservation-filter">Status reservasi
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} disabled={loading || reservationStatuses.length === 0}>
              <option value="">Semua status</option>
              {reservationStatuses.map((status) => <option key={status} value={status.toLowerCase()}>{status}</option>)}
            </select>
          </label>
          <button className="clear-reservation-filters" type="button" onClick={() => { setQuery(''); setDoctorFilter(''); setDateFilter(''); setStatusFilter('') }} disabled={!hasActiveFilters}>Hapus filter</button>
        </div>
        {loading && <p className="reservation-message" role="status">Memuat daftar reservasi...</p>}
        {!loading && error && <p className="reservation-message reservation-error" role="alert">{error}</p>}
        {!loading && !error && reservations.length === 0 && <p className="reservation-message">Belum ada reservasi.</p>}
        {!loading && !error && reservations.length > 0 && filteredRows.length === 0 && <p className="reservation-message">Tidak ada reservasi yang sesuai dengan filter. Ubah dokter, tanggal, atau kata kunci.</p>}
        {!loading && !error && filteredRows.length > 0 && (
          <div className="reservation-table-wrap"><table className="reservation-table">
            <thead><tr><th>ID Reservasi</th><th>Nama Pasien</th><th>Layanan</th><th>Dokter</th><th>Jadwal Kunjungan</th><th>Jenis Kunjungan</th><th>Status</th><th>Dibuat</th><th>Aksi</th></tr></thead>
            <tbody>{filteredRows.map(({ reservation, patient, service, doctor, schedule }) => (
              <tr key={reservation.id}>
                <td>{reservation.id || '?'}</td><td>{patient?.name || '?'}</td><td>{service?.name || '?'}</td><td>{doctor?.name || '?'}</td>
                <td>{schedule ? <>{formatDate(schedule.date)}{(schedule.startTime || schedule.endTime) && <small>{schedule.startTime || ''}{schedule.endTime ? `?${schedule.endTime}` : ''}</small>}</> : '?'}</td>
                <td>{reservation.visitType || '?'}</td><td><span className={`reservation-status ${String(reservation.status || '').toLowerCase() === 'confirmed' ? 'is-confirmed' : ''}`}>{statusLabels[reservation.status] || reservation.status || '?'}</span></td><td>{formatDate(reservation.createdAt)}</td><td><button className="reservation-detail-button" type="button" onClick={() => { setSelectedReservationId(reservation.id); setSelectedStatus(reservation.status); setStatusError(''); setStatusSuccess('') }}>Detail</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {selectedRow && <section className="reservation-detail" aria-label="Detail reservasi">
          <div className="reservation-detail-heading"><div><div className="eyebrow"><span /> DETAIL RESERVASI</div><h2>{selectedRow.reservation.id}</h2></div><button type="button" className="reservation-detail-close" onClick={() => setSelectedReservationId('')} aria-label="Tutup detail">×</button></div>
          <dl><div><dt>Pasien</dt><dd>{selectedRow.patient?.name || '?'}</dd></div><div><dt>Layanan</dt><dd>{selectedRow.service?.name || '?'}</dd></div><div><dt>Dokter</dt><dd>{selectedRow.doctor?.name || '?'}</dd></div><div><dt>Jadwal</dt><dd>{selectedRow.schedule ? `${formatDate(selectedRow.schedule.date)} ${selectedRow.schedule.startTime || ''}` : '?'}</dd></div><div><dt>Status saat ini</dt><dd>{statusLabels[selectedRow.reservation.status] || selectedRow.reservation.status || '?'}</dd></div></dl>
          <label className="reservation-status-edit">Perbarui status<select value={selectedStatus} onChange={(event) => { setSelectedStatus(event.target.value); setStatusError(''); setStatusSuccess('') }} disabled={statusSaving || nextReservationStatuses[selectedRow.reservation.status]?.length === 0}><option value={selectedRow.reservation.status}>{statusLabels[selectedRow.reservation.status] || selectedRow.reservation.status}</option>{(nextReservationStatuses[selectedRow.reservation.status] || []).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
          {statusError && <p className="form-error" role="alert">{statusError}</p>}{statusSuccess && <p className="status-save-success" role="status">{statusSuccess}</p>}
          <button className="button button-dark" type="button" onClick={handleReservationStatusSave} disabled={statusSaving || selectedStatus === selectedRow.reservation.status}>{statusSaving ? 'Menyimpan...' : 'Simpan Status'} <span>→</span></button>
        </section>}
      </section>
    </main>
  );
}


function localDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function addLocalDateDays(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function formatClinicDate(dateString) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(`${dateString}T00:00:00Z`))
}

function ScheduleManagement({ onBack, onLogout }) {
  const today = localDateString()
  const lastDate = addLocalDateDays(today, 13)
  const [doctors, setDoctors] = useState([])
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([getApiData('doctors', { signal: controller.signal }), getApiData('schedules', { signal: controller.signal })])
      .then(([doctorData, scheduleData]) => {
        if (!Array.isArray(doctorData) || !Array.isArray(scheduleData)) throw new Error('Format data dokter atau jadwal tidak sesuai.')
        if (controller.signal.aborted) return
        setDoctors(doctorData)
        setSchedules(scheduleData)
      })
      .catch(() => { if (!controller.signal.aborted) setError('Data dokter atau jadwal gagal dimuat. Periksa koneksi server, lalu coba muat ulang.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [reloadKey])

  async function handleSubmit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const doctorId = String(formData.get('doctorId') || '')
    const date = String(formData.get('date') || '')
    const shift = String(formData.get('shift') || '')
    setError('')
    setSuccess('')
    if (!doctorId) { setError('Pilih dokter terlebih dahulu.'); return }
    if (!date) { setError('Pilih tanggal jadwal.'); return }
    if (date < today || date > lastDate) { setError(`Tanggal harus berada antara ${formatClinicDate(today)} dan ${formatClinicDate(lastDate)}.`); return }
    if (!['pagi', 'siang'].includes(shift)) { setError('Pilih shift Pagi atau Siang.'); return }

    setSaving(true)
    try {
      const result = await postApiData('schedules', { doctorId, date, shift })
      if (result.status !== 201 || !result.data?.id || result.data.doctorId !== doctorId || result.data.date !== date || result.data.shift !== shift) {
        throw new Error('Server tidak mengembalikan jadwal yang tersimpan dengan benar.')
      }
      setSuccess('Jadwal berhasil disimpan.')
      setLoading(true)
      setReloadKey((value) => value + 1)
      form.reset()
    } catch (requestError) {
      setError(requestError.status === 409
        ? 'Jadwal dokter untuk tanggal dan shift tersebut sudah tersedia.'
        : requestError.message || 'Jadwal gagal disimpan. Silakan coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  const doctorById = new Map(doctors.map((doctor) => [doctor.id, doctor]))

  return (
    <main className="service-page schedule-management-page">
      <header className="service-page-header"><button className="back-button" onClick={onBack} aria-label="Kembali ke beranda">?</button><span>Manajemen Jadwal Dokter</span><button className="logout-button" onClick={onLogout}>Keluar</button></header>
      <section className="schedule-management-content">
        <div className="eyebrow"><span /> KHUSUS FRONTLINE</div>
        <h1>Manajemen Jadwal <em>Dokter</em></h1>
        <p className="service-page-intro">Tambahkan jadwal untuk hari ini sampai {formatClinicDate(lastDate)}.</p>
        <form className="schedule-management-form" onSubmit={handleSubmit}>
          <label>Dokter<select name="doctorId" defaultValue="" required disabled={loading || doctors.length === 0}><option value="" disabled>Pilih dokter</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></label>
          <label>Tanggal<input type="date" name="date" required min={today} max={lastDate} disabled={loading} /></label>
          <label>Shift<select name="shift" defaultValue="" required><option value="" disabled>Pilih shift</option><option value="pagi">Pagi</option><option value="siang">Siang</option></select></label>
          {error && <p className="schedule-feedback schedule-error" role="alert">{error}</p>}
          {success && <p className="schedule-feedback schedule-success" role="status">{success}</p>}
          <button className="button button-dark" type="submit" disabled={saving || loading || doctors.length === 0}>{saving ? 'Menyimpan...' : 'Simpan Jadwal'} <span>?</span></button>
        </form>
        <p className="schedule-branch-note">Aplikasi ini mengelola satu cabang. Frontline tetap perlu memastikan jadwal tidak bertabrakan dengan cabang lain secara manual.</p>
        <div className="schedule-list-heading"><h2>Jadwal Tersimpan</h2><button className="reload-button" onClick={() => { setLoading(true); setError(''); setReloadKey((value) => value + 1) }} disabled={loading}>Muat Ulang</button></div>
        {loading && <p className="reservation-message" role="status">Memuat data dokter dan jadwal...</p>}
        {!loading && error && schedules.length === 0 && <p className="reservation-message reservation-error" role="alert">{error}</p>}
        {!loading && !error && schedules.length === 0 && <p className="reservation-message">Belum ada jadwal tersimpan.</p>}
        {!loading && schedules.length > 0 && <div className="managed-schedule-list">{[...schedules].sort((a,b) => a.date.localeCompare(b.date) || String(a.shift).localeCompare(String(b.shift))).map((schedule) => <article className="managed-schedule-card" key={schedule.id}><div><strong>{doctorById.get(schedule.doctorId)?.name || 'Dokter tidak ditemukan'}</strong><small>{formatClinicDate(schedule.date)}</small></div><span className="managed-shift">Shift {schedule.shift === 'pagi' ? 'Pagi' : schedule.shift === 'siang' ? 'Siang' : schedule.shift || '?'}</span><span className="managed-hours">{schedule.startTime || '?'}{schedule.endTime ? `?${schedule.endTime}` : ''}</span>{schedule.isActive !== undefined && <span className={`managed-status ${schedule.isActive ? 'active' : ''}`}>{schedule.isActive ? 'Aktif' : 'Nonaktif'}</span>}</article>)}</div>}
      </section>
    </main>
  )
}


function FrontlineLogin({ onBack, onSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const response = await fetch('/api/auth/frontline/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Login gagal. Silakan coba lagi.')
      if (result.data?.role !== 'frontline') throw new Error('Server tidak mengonfirmasi role Frontline.')
      onSuccess()
    } catch (requestError) {
      setError(requestError.message || 'Server tidak dapat dihubungi. Periksa koneksi lalu coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="service-page frontline-login-page">
      <header className="service-page-header"><button className="back-button" onClick={onBack} aria-label="Kembali ke beranda">?</button><span>Login Frontline</span></header>
      <section className="frontline-login-card">
        <div className="brand-mark login-brand-mark">?</div>
        <div className="eyebrow"><span /> AREA FRONTLINE</div>
        <h1>Selamat datang<br /><em>kembali.</em></h1>
        <p className="service-page-intro">Masuk untuk mengelola jadwal dokter dan reservasi pasien.</p>
        <form className="frontline-login-form" onSubmit={handleSubmit}>
          <label>Nama pengguna<input name="username" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} /></label>
          <label>Kata sandi<input name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-dark" type="submit" disabled={submitting}>{submitting ? 'Memeriksa...' : 'Masuk sebagai Frontline'} <span>?</span></button>
        </form>
      </section>
    </main>
  )
}


function FrontlineDashboard({ onHome, onReservations, onSchedules, onLogout }) {
  return (
    <main className="service-page frontline-dashboard-page">
      <header className="service-page-header"><button className="back-button" onClick={onHome}>Kembali</button><span>Dashboard Frontline</span><button className="logout-button" onClick={onLogout}>Keluar</button></header>
      <section className="frontline-dashboard-content">
        <div className="eyebrow"><span /> AREA OPERASIONAL</div>
        <h1>Dashboard <em>Frontline</em></h1>
        <p className="service-page-intro">Pilih pekerjaan yang ingin Anda lakukan.</p>
        <div className="frontline-dashboard-grid">
          <button className="frontline-dashboard-card" onClick={onReservations}><span className="frontline-card-icon">R</span><strong>Daftar Reservasi</strong><small>Lihat dan cari reservasi pasien.</small></button>
          <button className="frontline-dashboard-card" onClick={onSchedules}><span className="frontline-card-icon">J</span><strong>Manajemen Jadwal Dokter</strong><small>Tambahkan dan lihat jadwal dokter.</small></button>
        </div>
      </section>
    </main>
  )
}


const FRONTLINE_PATHS = {
  frontlineLogin: '/frontline',
  frontlineDashboard: '/frontline/dashboard',
  reservations: '/frontline/reservations',
  scheduleManagement: '/frontline/schedules',
}

function pageFromPath(pathname) {
  const match = Object.entries(FRONTLINE_PATHS).find(([, path]) => path === pathname)
  return match?.[0] || 'home'
}

function App() {
  const bookingToday = localDateString()
  const bookingLastDate = addLocalDateDays(bookingToday, 6)
  const [menuOpen, setMenuOpen] = useState(false)
  const [page, setPageState] = useState(() => pageFromPath(window.location.pathname))
  function setPage(nextPage) {
    setPageState(nextPage)
    const nextPath = FRONTLINE_PATHS[nextPage] || '/'
    if (window.location.pathname !== nextPath) window.history.pushState({ page: nextPage }, '', nextPath)
  }
  const [visitDate, setVisitDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [services, setServices] = useState([])
  const [doctors, setDoctors] = useState([])
  const [selectedService, setSelectedService] = useState(null)
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [schedules, setSchedules] = useState([])
  const [selectedSchedule, setSelectedSchedule] = useState(null)
  const [schedulesLoading, setSchedulesLoading] = useState(false)
  const [schedulesError, setSchedulesError] = useState('')
  const [servicesLoading, setServicesLoading] = useState(true)
  const [doctorsLoading, setDoctorsLoading] = useState(true)
  const [servicesError, setServicesError] = useState('')
  const [doctorsError, setDoctorsError] = useState('')
  const [patientId, setPatientId] = useState('')
  const [patientForm, setPatientForm] = useState({ name: '', nik: '', phone: '', address: '', email: '', notes: '' })
  const [patientIdentityStatus, setPatientIdentityStatus] = useState('unverified')
  const [patientIdentityMessage, setPatientIdentityMessage] = useState('')
  const [identityMismatchOpen, setIdentityMismatchOpen] = useState(false)
  const [patientIdentityLoading, setPatientIdentityLoading] = useState(false)
  const [visitType, setVisitType] = useState('baru')
  const [controlLookup, setControlLookup] = useState({ nik: '', name: '' })
  const [reservationDraft, setReservationDraft] = useState(null)
  const [controlLookupError, setControlLookupError] = useState('')
  const [controlLookupLoading, setControlLookupLoading] = useState(false)
  const [reservationSubmitting, setReservationSubmitting] = useState(false)
  const [reservationError, setReservationError] = useState('')
  const [reservationConfirmation, setReservationConfirmation] = useState(null)
  const [frontlineAuthenticated, setFrontlineAuthenticated] = useState(false)
  const reservationInProgress = useRef(false)

  useEffect(() => {
    const handlePopState = () => setPageState(pageFromPath(window.location.pathname))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'same-origin' })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => { if (result?.data?.role === 'frontline') setFrontlineAuthenticated(true) })
      .catch(() => {})
  }, [])

  function openFrontlinePage() {
    setMenuOpen(false)
    setPage(frontlineAuthenticated ? 'frontlineDashboard' : 'frontlineLogin')
  }

  async function handleFrontlineLogout() {
    await fetch('/api/auth/frontline/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => null)
    setFrontlineAuthenticated(false)
    setPage('home')
  }

  useEffect(() => {
    getApiData('services')
      .then(setServices)
      .catch(() => setServicesError('Layanan gagal dimuat. Silakan muat ulang halaman.'))
      .finally(() => setServicesLoading(false))
    getApiData('doctors')
      .then(setDoctors)
      .catch(() => setDoctorsError('Dokter gagal dimuat. Silakan muat ulang halaman.'))
      .finally(() => setDoctorsLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedDoctor?.id) return undefined

    const controller = new AbortController()
    const query = new URLSearchParams({ doctorId: selectedDoctor.id })
    const endpoint = visitDate
      ? `schedules/availability?${query.toString()}&date=${encodeURIComponent(visitDate)}`
      : `schedules?${query.toString()}`

    getApiData(endpoint, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return
        setSchedules(data.filter((schedule) => (
          schedule.doctorId === selectedDoctor.id
          && schedule.isActive
          && schedule.bookedCount < schedule.capacity
          && schedule.date >= bookingToday
          && schedule.date <= bookingLastDate
          && (!visitDate || schedule.date === visitDate)
        )))
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSchedulesError('Jadwal gagal dimuat. Silakan coba lagi.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSchedulesLoading(false)
      })

    return () => controller.abort()
  }, [selectedDoctor, visitDate, bookingToday, bookingLastDate])

  const visibleSchedules = schedules.filter((schedule) => (
    schedule.doctorId === selectedDoctor?.id
    && (!visitDate || schedule.date === visitDate)
  ))

  const serviceListStatus = servicesLoading
    ? <p role="status">Memuat layanan...</p>
    : servicesError || (services.length === 0 ? <p>Layanan belum tersedia.</p> : null)
  const doctorListStatus = doctorsLoading
    ? <p role="status">Memuat dokter...</p>
    : doctorsError || (doctors.length === 0 ? <p>Dokter belum tersedia.</p> : null)

  function handlePrepareReservationReview(event) {
    event.preventDefault()
    if (patientIdentityStatus !== 'existing' && patientIdentityStatus !== 'new') {
      setReservationError('Identifikasi pasien terlebih dahulu berdasarkan NIK dan nama lengkap.')
      return
    }
    if (patientIdentityStatus === 'existing' && !patientId) {
      setReservationError('Data pasien belum terhubung. Silakan identifikasi ulang.')
      return
    }
    setReservationDraft(Object.fromEntries(Object.entries(patientForm).map(([key, value]) => [key, value.trim()])))
    setReservationError('')
    setPage('review')
  }

  function handlePatientIdentityChange(field, value) {
    setPatientForm((current) => ({ ...current, [field]: value }))
    if (field === 'name' || field === 'nik') {
      setIdentityMismatchOpen(false)
      setPatientId('')
      setPatientIdentityStatus('unverified')
      setPatientIdentityMessage('NIK atau nama berubah. Silakan identifikasi ulang.')
    }
  }

  async function handlePatientIdentify() {
    setIdentityMismatchOpen(false)
    setPatientIdentityLoading(true)
    setPatientIdentityMessage('')
    setPatientIdentityStatus('unverified')
    setPatientId('')
    try {
      const result = await postApiData('patients/identify', {
        nik: patientForm.nik.trim(),
        name: patientForm.name.trim(),
      })
      if (result.data?.found && result.data.patient?.id) {
        setPatientId(result.data.patient.id)
        setPatientForm((current) => ({
          ...current,
          name: result.data.patient.name,
          nik: result.data.patient.nik,
          phone: result.data.patient.phone || current.phone,
          address: result.data.patient.address || current.address,
        }))
        setPatientIdentityStatus('existing')
        setPatientIdentityMessage('Data pasien ditemukan. Reservasi akan menggunakan record pasien yang sudah ada.')
      } else {
        setPatientIdentityStatus('new')
        setPatientIdentityMessage('Data pasien belum terdaftar. Record pasien baru akan dibuat saat reservasi dikirim.')
      }
    } catch (error) {
      setPatientIdentityStatus(error.status === 409 ? 'mismatch' : 'unverified')
      if (error.status === 409) setIdentityMismatchOpen(true)
      setPatientIdentityMessage(error.status === 409
        ? error.message
        : error.status === 400
          ? error.message
          : 'Identifikasi pasien gagal. Silakan coba lagi.')
    } finally {
      setPatientIdentityLoading(false)
    }
  }

  async function handleReservationSubmit() {
    if (reservationInProgress.current) return

    const patient = {
      nik: String(reservationDraft?.nik || '').trim(),
      name: String(reservationDraft?.name || '').trim(),
      phone: String(reservationDraft?.phone || '').trim(),
      address: String(reservationDraft?.address || '').trim(),
    }

    if (!selectedService?.id || !selectedDoctor?.id || !selectedSchedule?.id
      || selectedSchedule.doctorId !== selectedDoctor.id
      || selectedSchedule.date !== visitDate) {
      setReservationError('Pilihan layanan, dokter, atau jadwal belum lengkap. Silakan periksa kembali.')
      return
    }
    if (!/^\d{16}$/.test(patient.nik)) {
      setReservationError('NIK harus terdiri dari 16 digit.')
      return
    }
    if (!/^08\d{8,11}$/.test(patient.phone)) {
      setReservationError('Nomor telepon harus diawali 08 dan terdiri dari 10–13 digit.')
      return
    }
    if (!['baru', 'kontrol'].includes(visitType)) {
      setReservationError('Pilih jenis kunjungan yang tersedia.')
      return
    }

    reservationInProgress.current = true
    setReservationSubmitting(true)
    setReservationError('')
    try {
      let currentPatientId = patientId
      if (!currentPatientId) {
        if (patientIdentityStatus !== 'new') {
          throw new Error('Pasien belum teridentifikasi. Identifikasi ulang sebelum membuat record baru.')
        }
        const patientResponse = await postApiData('patients', patient)
        if (patientResponse.status !== 201 || !patientResponse.data?.id) {
          throw new Error('Data pasien tidak berhasil dibuat.')
        }
        currentPatientId = patientResponse.data.id
        setPatientId(currentPatientId)
      }

      const reservationResponse = await postApiData('reservations', {
        patientId: currentPatientId,
        serviceId: selectedService.id,
        doctorId: selectedDoctor.id,
        scheduleId: selectedSchedule.id,
        visitType,
        address: patient.address,
      })
      const savedReservation = reservationResponse.data
      if (reservationResponse.status !== 201 || !savedReservation?.id
        || !savedReservation.queue?.queueNumber || !savedReservation.queue?.doctorId
        || !savedReservation.queue?.date || !savedReservation.queue?.shift
        || savedReservation.doctorId !== selectedDoctor.id
        || savedReservation.scheduleId !== selectedSchedule.id) {
        const error = new Error('Server belum mengembalikan nomor antrean dan detail reservasi yang lengkap. Silakan coba lagi.')
        error.status = 502
        throw error
      }
      setReservationConfirmation(savedReservation)
      setPage('success')
    } catch (error) {
      if (error.status === 400) {
        setReservationError(`Periksa data yang dimasukkan. ${error.message}`)
      } else if (error.status === 404) {
        setReservationError('Data pasien, layanan, dokter, atau jadwal tidak ditemukan. Silakan pilih kembali.')
      } else if (error.status === 409 && /penuh/i.test(error.message)) {
        setReservationError('Jadwal baru saja penuh. Silakan kembali dan pilih jadwal lain.')
      } else if (error.status === 409 && /NIK sudah terdaftar/i.test(error.message)) {
        setReservationError('NIK sudah terdaftar. Identifikasi ulang sebelum melanjutkan.')
        if (/nama lengkap tidak cocok/i.test(error.message)) {
          setPatientId('')
          setPatientIdentityStatus('mismatch')
          setPatientIdentityMessage(error.message)
          setIdentityMismatchOpen(true)
          setPage('form')
        }
      } else if (error.status === 409) {
        setReservationError(error.message)
      } else if (error.status) {
        setReservationError(error.message)
      } else {
        setReservationError('Koneksi ke server gagal. Data formulir tetap tersimpan; silakan coba lagi.')
      }
    } finally {
      reservationInProgress.current = false
      setReservationSubmitting(false)
    }
  }

  async function handleControlLookup(event) {
    event.preventDefault()
    setControlLookupError('')
    setControlLookupLoading(true)
    try {
      const result = await postApiData('patients/lookup-control', controlLookup)
      if (!result.data?.patientId || !result.data?.doctor?.id) throw new Error('Data dokter sebelumnya tidak lengkap.')
      setPatientId(result.data.patientId)
      setPatientForm((current) => ({
        ...current,
        nik: controlLookup.nik.trim(),
        name: result.data.patientName,
        phone: result.data.patientPhone || current.phone,
        address: result.data.patientAddress || current.address,
      }))
      setPatientIdentityStatus('existing')
      setPatientIdentityMessage('Data pasien ditemukan. Reservasi akan menggunakan record pasien yang sudah ada.')
      setSelectedDoctor(result.data.doctor)
      setSchedules([])
      setSelectedSchedule(null)
      setSelectedTime('')
      setVisitDate('')
      setSchedulesError('')
      setSchedulesLoading(true)
      setPage('previousDoctor')
    } catch (error) {
      setControlLookupError(error.status === 404 ? error.message : 'Pencarian data gagal. Silakan coba lagi.')
      if (/nama lengkap tidak cocok/i.test(error.message)) setIdentityMismatchOpen(true)
    } finally {
      setControlLookupLoading(false)
    }
  }

  if (page === 'frontlineLogin') return frontlineAuthenticated ? <FrontlineDashboard onHome={() => setPage('home')} onReservations={() => setPage('reservations')} onSchedules={() => setPage('scheduleManagement')} onLogout={handleFrontlineLogout} /> : <FrontlineLogin onBack={() => setPage('home')} onSuccess={() => { setFrontlineAuthenticated(true); setPage('frontlineDashboard') }} />
  if (page === 'frontlineDashboard') return frontlineAuthenticated ? <FrontlineDashboard onHome={() => setPage('home')} onReservations={() => setPage('reservations')} onSchedules={() => setPage('scheduleManagement')} onLogout={handleFrontlineLogout} /> : <FrontlineLogin onBack={() => setPage('home')} onSuccess={() => { setFrontlineAuthenticated(true); setPage('frontlineDashboard') }} />
  if (page === 'scheduleManagement') return frontlineAuthenticated ? <ScheduleManagement onBack={() => setPage('frontlineDashboard')} onLogout={handleFrontlineLogout} /> : <FrontlineLogin onBack={() => setPage('home')} onSuccess={() => { setFrontlineAuthenticated(true); setPage('scheduleManagement') }} />
  if (page === 'reservations') return frontlineAuthenticated ? <ReservationList onBack={() => setPage('frontlineDashboard')} onLogout={handleFrontlineLogout} /> : <FrontlineLogin onBack={() => setPage('home')} onSuccess={() => { setFrontlineAuthenticated(true); setPage('reservations') }} />

  if (page === 'services') return (
    <main className="service-page">
      <header className="service-page-header"><button className="back-button" onClick={() => setPage('home')}>←</button><span>Pilih Layanan</span><span className="step-count">01 / 04</span></header>
      <section className="service-page-content service-choice-content"><label>Jenis kunjungan<select value={visitType} onChange={(event) => { setVisitType(event.target.value); setPatientId(''); setSelectedDoctor(null) }}><option value="baru">Pasien baru</option><option value="kontrol">Kontrol</option></select></label><div className="booking-service-list">{serviceListStatus}{!servicesLoading && !servicesError && services.map((service, index) => <button className="booking-service-card" key={service.id} onClick={() => { setSelectedService(service); setSelectedDoctor(null); setSchedules([]); setSelectedSchedule(null); setSelectedTime(''); setVisitDate(''); setSchedulesError(''); setSchedulesLoading(false); setPage(visitType === 'kontrol' ? 'controlLookup' : 'doctors') }}><span className="booking-service-icon">{serviceIcons[index % serviceIcons.length]}</span><span className="booking-service-copy"><strong>{service.name}</strong><small>{service.description}</small></span><span className="booking-service-arrow">→</span></button>)}</div></section>
    </main>
  )
  if (page === 'controlLookup') return <main className="service-page"><header className="service-page-header"><button className="back-button" onClick={() => setPage('services')}>←</button><span>Data Kunjungan Kontrol</span><span className="step-count">02 / 04</span></header><section className="service-page-content"><div className="eyebrow"><span /> VERIFIKASI PASIEN</div><h1>Temukan data<br /><em>perawatan Anda.</em></h1><p className="service-page-intro">Masukkan NIK dan nama lengkap sesuai data yang tersimpan.</p><form className="reservation-form" onSubmit={handleControlLookup}><label>NIK<input required inputMode="numeric" pattern="[0-9]{16}" maxLength="16" value={controlLookup.nik} onChange={(event) => setControlLookup({ ...controlLookup, nik: event.target.value })} /></label><label>Nama lengkap<input required value={controlLookup.name} onChange={(event) => setControlLookup({ ...controlLookup, name: event.target.value })} /></label>{controlLookupError && <p className="form-error" role="alert">{controlLookupError}</p>}<button className="button button-dark continue-button" disabled={controlLookupLoading}>{controlLookupLoading ? 'Mencari...' : 'Cari Data Pasien'} <span>→</span></button></form></section>{identityMismatchOpen && <IdentityMismatchDialog onClose={() => setIdentityMismatchOpen(false)} />}</main>
  if (page === 'previousDoctor') return <main className="service-page"><header className="service-page-header"><button className="back-button" onClick={() => setPage('controlLookup')}>←</button><span>Dokter Kontrol</span><span className="step-count">02 / 04</span></header><section className="service-page-content"><div className="eyebrow"><span /> INFORMASI PERAWATAN SEBELUMNYA</div><h1>Kontrol dengan<br /><em>dokter yang sama.</em></h1><article className="booking-service-card" aria-label="Dokter kontrol"><span className="doctor-avatar">{selectedDoctor?.name?.split(' ').slice(-2).map((part) => part[0]).join('').toUpperCase()}</span><span className="booking-service-copy"><strong>{selectedDoctor?.name}</strong><small>{selectedDoctor?.specialty}</small></span><span className="booking-service-arrow">✓</span></article><p className="service-page-intro">Dokter kontrol ditentukan dari reservasi sebelumnya. Jika perlu diganti, silakan hubungi Frontline.</p><button className="button button-dark continue-button" onClick={() => setPage('schedule')}>Lihat Jadwal <span>→</span></button></section></main>
  if (page === 'doctors') return <main className="service-page"><header className="service-page-header"><button className="back-button" onClick={() => setPage('services')}>←</button><span>Pilih Dokter</span><span className="step-count">02 / 04</span></header><section className="service-page-content"><div className="eyebrow"><span /> DOKTER KAMI</div><h1>Temukan dokter<br /><em>pilihan Anda.</em></h1><p className="service-page-intro">Pilih dokter untuk melanjutkan reservasi.</p><div className="booking-service-list">{doctorListStatus}{!doctorsLoading && !doctorsError && doctors.map((doctor)=><button className="booking-service-card" key={doctor.id} onClick={()=>{if(selectedDoctor?.id!==doctor.id){setSelectedDoctor(doctor);setSchedules([]);setSelectedSchedule(null);setSelectedTime('');setSchedulesError('');setSchedulesLoading(true)}setPage('schedule')}}><span className="doctor-avatar">{doctor.name.split(' ').slice(-2).map((part)=>part[0]).join('').toUpperCase()}</span><span className="booking-service-copy"><strong>{doctor.name}</strong><small>{doctor.specialty}</small></span><span className="booking-service-arrow">→</span></button>)}</div></section></main>
  if (page === 'schedule') return (
    <main className="service-page">
      <header className="service-page-header"><button className="back-button" onClick={() => setPage(visitType === 'kontrol' ? 'previousDoctor' : 'doctors')}>←</button><span>{visitType === 'kontrol' ? 'Jadwal Dokter Kontrol' : 'Pilih Jadwal'}</span><span className="step-count">03 / 04</span></header>
      <section className="service-page-content">
        <div className="eyebrow"><span /> JADWAL KUNJUNGAN</div>
        <h1>Kapan Anda<br /><em>ingin berkunjung?</em></h1>
        <p className="service-page-intro">Pilih tanggal dan waktu yang tersedia.</p>
        <label className="date-label" htmlFor="visit-date">Tanggal kunjungan</label>
        <input className="date-input" id="visit-date" type="date" min={bookingToday} max={bookingLastDate} required value={visitDate} onChange={(event) => { setVisitDate(event.target.value); setSchedules([]); setSelectedSchedule(null); setSelectedTime(''); setSchedulesError(''); setSchedulesLoading(true) }} />
        <p className="schedule-date-note">Jadwal yang dapat dipilih tersedia hari ini hingga {formatClinicDate(bookingLastDate)}.</p>
        <div className="time-label">Pilih waktu</div>
        <div className="time-options">
          {schedulesLoading && <p role="status">Memuat jadwal...</p>}
          {!schedulesLoading && schedulesError && <p role="alert">{schedulesError}</p>}
          {!schedulesLoading && !schedulesError && !visitDate && visibleSchedules.length === 0 && <p>Pilih tanggal untuk melihat jadwal tersedia.</p>}
          {!schedulesLoading && !schedulesError && visitDate && visibleSchedules.length === 0 && <p>Tidak ada jadwal tersedia untuk dokter dan tanggal ini.</p>}
          {!schedulesLoading && !schedulesError && visibleSchedules.map((schedule) => {
            const time = `${schedule.startTime}–${schedule.endTime}`
            return <button type="button" key={schedule.id} disabled={!visitDate} aria-pressed={selectedSchedule?.id === schedule.id} className={selectedSchedule?.id === schedule.id ? 'time-option selected' : 'time-option'} onClick={() => { setSelectedSchedule(schedule); setSelectedTime(schedule.id) }}>{time}</button>
          })}
        </div>
        <button className="button button-dark continue-button" disabled={!visitDate || !selectedTime || selectedSchedule?.doctorId !== selectedDoctor?.id} onClick={() => setPage('form')}>Lanjutkan <span>→</span></button>
      </section>
    </main>
  )
  if (page === 'form') return <main className="service-page"><header className="service-page-header"><button className="back-button" onClick={()=>setPage('schedule')}>←</button><span>Form Reservasi</span><span className="step-count">04 / 05</span></header><section className="service-page-content"><div className="eyebrow"><span /> DETAIL PASIEN</div><h1>Lengkapi data<br /><em>kunjungan Anda.</em></h1><p className="service-page-intro">Kami akan menghubungi Anda untuk konfirmasi reservasi.</p><form className="reservation-form" onSubmit={handlePrepareReservationReview}>
    <label>Nama lengkap<input name="name" required value={patientForm.name} readOnly={visitType === 'kontrol' && patientIdentityStatus === 'existing'} placeholder="Masukkan nama lengkap" onChange={(event) => handlePatientIdentityChange('name', event.target.value)} /></label>
    <label>NIK<input name="nik" required inputMode="numeric" pattern="[0-9]{16}" maxLength="16" value={patientForm.nik} readOnly={visitType === 'kontrol' && patientIdentityStatus === 'existing'} placeholder="Masukkan 16 digit NIK" onChange={(event) => handlePatientIdentityChange('nik', event.target.value)} /></label>
    {visitType !== 'kontrol' && <div className="patient-identification"><button type="button" className="review-secondary" onClick={handlePatientIdentify} disabled={patientIdentityLoading || !patientForm.name.trim() || !/^\d{16}$/.test(patientForm.nik.trim())}>{patientIdentityLoading ? 'Memeriksa...' : 'Identifikasi Pasien'}</button>{patientIdentityMessage && <p className={`patient-identification-message ${patientIdentityStatus === 'mismatch' ? 'is-error' : ''}`} role={patientIdentityStatus === 'mismatch' ? 'alert' : 'status'}>{patientIdentityMessage}</p>}</div>}
    <label>Nomor telepon<input name="phone" required type="tel" value={patientForm.phone} placeholder="08xxxxxxxxxx" onChange={(event) => handlePatientIdentityChange('phone', event.target.value)} /></label>
    <label>Alamat<input name="address" required maxLength="500" value={patientForm.address} placeholder="Masukkan alamat lengkap" onChange={(event) => handlePatientIdentityChange('address', event.target.value)} /></label>
    <label>Email<input name="email" required type="email" value={patientForm.email} placeholder="nama@email.com" onChange={(event) => handlePatientIdentityChange('email', event.target.value)} /></label>
    <label>Jenis kunjungan<input value={visitType === 'kontrol' ? 'Kontrol' : 'Pasien baru'} readOnly /></label>
    <label>Keluhan / Catatan<textarea name="notes" required rows="4" value={patientForm.notes} placeholder="Ceritakan keluhan atau catatan tambahan" onChange={(event) => handlePatientIdentityChange('notes', event.target.value)} /></label>
    {reservationError && <p className="form-error" role="alert">{reservationError}</p>}
    <button className="button button-dark continue-button" type="submit">Tinjau Reservasi <span>→</span></button>
    </form></section>{identityMismatchOpen && <IdentityMismatchDialog onClose={() => setIdentityMismatchOpen(false)} />}</main>
  if (page === 'review') return <main className="service-page"><header className="service-page-header"><button className="back-button" onClick={() => setPage('form')} aria-label="Kembali ke data pasien">←</button><span>Periksa Reservasi</span><span className="step-count">05 / 05</span></header><section className="service-page-content"><div className="eyebrow"><span /> RINGKASAN RESERVASI</div><h1>Periksa kembali<br /><em>pilihan Anda.</em></h1><p className="service-page-intro">Pastikan informasi berikut sudah benar sebelum reservasi dikirim.</p><section className="confirmation-card" aria-label="Ringkasan reservasi"><dl><div><dt>Tindakan</dt><dd>{selectedService?.name || '—'}</dd></div><div><dt>Jenis kunjungan</dt><dd>{visitType === 'kontrol' ? 'Kontrol' : 'Pasien baru'}</dd></div><div><dt>Dokter</dt><dd>{selectedDoctor?.name || '—'}</dd></div><div><dt>Tanggal</dt><dd>{visitDate ? formatClinicDate(visitDate) : '—'}</dd></div><div><dt>Shift</dt><dd>{selectedSchedule?.shift ? `${selectedSchedule.shift[0].toUpperCase()}${selectedSchedule.shift.slice(1)}` : '—'}</dd></div><div><dt>Jam</dt><dd>{selectedSchedule ? `${selectedSchedule.startTime}–${selectedSchedule.endTime}` : '—'}</dd></div></dl></section><section className="confirmation-card" aria-label="Data pasien yang digunakan"><div className="queue-number-label">DATA PASIEN</div><dl><div><dt>Nama</dt><dd>{reservationDraft?.name || '—'}</dd></div><div><dt>NIK</dt><dd>{reservationDraft?.nik || '—'}</dd></div><div><dt>Telepon</dt><dd>{reservationDraft?.phone || '—'}</dd></div><div><dt>Alamat</dt><dd>{reservationDraft?.address || '—'}</dd></div><div><dt>Email</dt><dd>{reservationDraft?.email || '—'}</dd></div><div><dt>Keluhan / Catatan</dt><dd>{reservationDraft?.notes || '—'}</dd></div></dl></section>{reservationError && <p className="form-error" role="alert">{reservationError}</p>}<div className="review-actions"><button className="button button-dark" onClick={handleReservationSubmit} disabled={reservationSubmitting}>{reservationSubmitting ? 'Mengirim...' : 'Kirim Reservasi'} <span>→</span></button><button className="review-secondary" onClick={() => setPage('form')} disabled={reservationSubmitting}>Ubah data pasien</button><button className="review-secondary" onClick={() => setPage('schedule')} disabled={reservationSubmitting}>Ubah jadwal</button></div></section></main>
  if (page === 'success') return <main className="service-page success-page"><div className="success-check">?</div><h1>Reservasi<br /><em>berhasil!</em></h1><p>Reservasi Anda sudah tercatat.</p>{reservationConfirmation && <section className="confirmation-card" aria-label="Ringkasan konfirmasi"><div className="queue-number-label">NOMOR ANTREAN</div><strong className="queue-number">A{String(reservationConfirmation.queue.queueNumber).padStart(3, '0')}</strong><dl><div><dt>Kode reservasi</dt><dd>{reservationConfirmation.id}</dd></div><div><dt>Layanan</dt><dd>{reservationConfirmation.serviceName || selectedService?.name || '?'}</dd></div><div><dt>Dokter</dt><dd>{selectedDoctor?.name || '?'}</dd></div><div><dt>Tanggal</dt><dd>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(`${reservationConfirmation.queue.date}T00:00:00`))}</dd></div><div><dt>Shift</dt><dd>{reservationConfirmation.queue.shift}</dd></div><div><dt>Jam</dt><dd>{reservationConfirmation.queue.startTime}{reservationConfirmation.queue.endTime ? `?${reservationConfirmation.queue.endTime}` : ''}</dd></div></dl></section>}<p>Terima kasih. Tim kami akan segera menghubungi Anda.</p><button className="button button-dark" onClick={()=>setPage('home')}>Kembali ke Beranda <span>→</span></button></main>
  return (
    <div className="app">
      <header className="header">
        <a className="brand" href="#home" aria-label="MBA Dentalcare, beranda">
          <span className="brand-mark">✦</span>
          <span><strong>MBA</strong><small>DENTALCARE</small></span>
        </a>
        <button className="menu-toggle" aria-label="Buka menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        <nav className={menuOpen ? 'nav nav-open' : 'nav'}>
          <a href="#home" onClick={() => setMenuOpen(false)}>Beranda</a>
          <a href="#layanan" onClick={() => setMenuOpen(false)}>Layanan</a>
          <a href="#tentang" onClick={() => setMenuOpen(false)}>Tentang Kami</a>
          <a href="#kontak" onClick={() => setMenuOpen(false)}>Kontak</a>
          <a className="nav-cta" href="#reservasi" onClick={(event) => { event.preventDefault(); setPage("services"); setMenuOpen(false) }}>Buat Reservasi <span>↗</span></a>
        </nav>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-content">
            <div className="eyebrow"><span /> KLINIK GIGI KELUARGA</div>
            <h1>Senyum lebih sehat,<br /><em>dimulai dari sini.</em></h1>
            <p className="hero-copy">Perawatan gigi yang nyaman dan penuh perhatian untuk Anda dan keluarga. Temukan dokter yang tepat dan atur kunjungan dengan mudah.</p>
            <div className="hero-actions">
              <a className="button button-dark" href="#reservasi" onClick={(event) => { event.preventDefault(); setPage("services") }}>Reservasi Sekarang <span>→</span></a>
              <a className="text-link" href="#layanan">Lihat layanan <span>↓</span></a>
            </div>
            <div className="social-proof"><div className="avatars"><span>👩🏻</span><span>👨🏽</span><span>👩🏾</span></div><p><strong>Perawatan ramah untuk semua</strong><br />Senyum sehat, hati tenang.</p></div>
          </div>
          <div className="hero-art" aria-label="Ilustrasi senyum sehat" role="img">
            <div className="sun-disc" />
            <div className="sparkle sparkle-one">✳</div><div className="sparkle sparkle-two">✦</div><div className="sparkle sparkle-three">✧</div>
            <div className="tooth"><span className="tooth-eye eye-left"/><span className="tooth-eye eye-right"/><span className="tooth-cheek cheek-left"/><span className="tooth-cheek cheek-right"/><span className="tooth-smile"/></div>
            <div className="art-caption"><span className="caption-icon">✦</span><span><strong>Senyum sehat,</strong><br/>percaya diri setiap hari</span></div>
            <div className="art-stamp">CARE<br/><b>WITH</b><br/>A SMILE</div>
          </div>
        </section>

        <section className="services section-wrap" id="layanan">
          <div className="section-heading"><div><div className="eyebrow"><span /> PERAWATAN UNTUK ANDA</div><h2>Layanan yang bikin<br/><em>senyum nyaman.</em></h2></div><a className="all-services" href="#reservasi">Jelajahi semua layanan <span>↗</span></a></div>
          <div className="service-list">{serviceListStatus}{!servicesLoading && !servicesError && services.map((service, index) => <a className="service-card" href="#reservasi" onClick={(event) => { event.preventDefault(); setSelectedService(service); setPage('services') }} key={service.id}><div className="service-top"><span className="service-icon">{serviceIcons[index % serviceIcons.length]}</span><span className="service-number">0{index + 1}</span></div><h3>{service.name}</h3><p>{service.description}</p><span className="service-arrow">↗</span></a>)}</div>
        </section>

        <section className="about" id="tentang">
          <div className="about-logo" role="img" aria-label="Logo resmi M. Budi A. Dental Care">
            <svg viewBox="0 0 360 290" aria-hidden="true">
              <g fill="#d89a35">
                <path d="M180 22l5 13 13 5-13 5-5 13-5-13-13-5 13-5zM225 4l4 10 10 4-10 4-4 10-4-10-10-4 10-4zM243 68l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/>
                <path d="M62 111c14-49 54-68 91-56 25 8 41-12 68-6 22 5 31 20 46 11-4 21-22 29-33 44-12 16-9 34-24 57l-26 38c-8-18-18-29-32-28-14 1-23 15-27 36l-31-33c-21-22-41-37-54-63 8 4 15 7 22 8z"/>
                <path fill="#fff15a" d="M76 99c10-38 40-59 73-49 28 8 42-10 68-6 13 2 23 9 32 12-13 9-29 10-45 21-20 14-47 22-77 26-21 3-38 0-51-4z"/>
              </g>
              <text x="180" y="239" textAnchor="middle" fill="#30291f" fontFamily="Georgia,serif" fontSize="39" letterSpacing="1">M. BUDI A.</text>
              <text x="180" y="273" textAnchor="middle" fill="#30291f" fontFamily="Georgia,serif" fontSize="20" letterSpacing="1.5">DENTAL CARE</text>
            </svg>
          </div>
          <div className="about-copy"><div className="eyebrow"><span /> TENTANG KAMI</div><h2>Merawat senyum<br /><em>sepenuh hati.</em></h2><p>M. Budi A. Dental Care hadir untuk memberikan perawatan gigi yang nyaman dan penuh perhatian bagi setiap anggota keluarga.</p><a href="#layanan" className="all-services">Kenali layanan kami <span>↗</span></a></div>
        </section>
        <section className="booking" id="reservasi"><div className="booking-copy"><div className="eyebrow"><span /> MULAI PERJALANAN SENYUM SEHAT</div><h2>Waktunya merawat<br/>senyum <em>Anda.</em></h2><p>Pilih layanan dan jadwal yang cocok. Tim kami siap menyambut Anda.</p></div><a className="button button-light" href="#reservasi" onClick={(event) => { event.preventDefault(); setPage("services") }}>Atur Reservasi <span>→</span></a></section>
      </main>
      <footer id="kontak"><a className="brand" href="#home"><span className="brand-mark">✦</span><span><strong>MBA</strong><small>DENTALCARE</small></span></a><p>Merawat senyum, sepenuh hati.</p><span>© 2026 MBA Dentalcare</span><a className="frontline-footer-link" href="#frontline-login" onClick={(event) => { event.preventDefault(); openFrontlinePage() }}>Area Frontline</a></footer>
    </div>
  )
}

export default App

import { useEffect, useRef, useState } from 'react'
import './App.css'

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

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [page, setPage] = useState('home')
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
  const [reservationSubmitting, setReservationSubmitting] = useState(false)
  const [reservationError, setReservationError] = useState('')
  const reservationInProgress = useRef(false)

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
  }, [selectedDoctor, visitDate])

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

  async function handleReservationSubmit(event) {
    event.preventDefault()
    if (reservationInProgress.current) return

    const formData = new FormData(event.currentTarget)
    const patient = {
      nik: String(formData.get('nik') || '').trim(),
      name: String(formData.get('name') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
    }
    const visitType = String(formData.get('visitType') || '')

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
      })
      if (reservationResponse.status !== 201) {
        throw new Error('Reservasi belum dikonfirmasi oleh server.')
      }
      setPage('success')
    } catch (error) {
      if (error.status === 400) {
        setReservationError(`Periksa data yang dimasukkan. ${error.message}`)
      } else if (error.status === 404) {
        setReservationError('Data pasien, layanan, dokter, atau jadwal tidak ditemukan. Silakan pilih kembali.')
      } else if (error.status === 409 && /penuh/i.test(error.message)) {
        setReservationError('Jadwal baru saja penuh. Silakan kembali dan pilih jadwal lain.')
      } else if (error.status === 409 && /NIK sudah terdaftar/i.test(error.message)) {
        setReservationError('NIK sudah terdaftar. Pemilihan pasien lama belum tersedia melalui API yang ada; hubungi klinik untuk melanjutkan.')
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

  if (page === 'services') return (
    <main className="service-page">
      <header className="service-page-header"><button className="back-button" onClick={() => setPage('home')}>←</button><span>Pilih Layanan</span><span className="step-count">01 / 04</span></header>
      <section className="service-page-content service-choice-content"><div className="booking-service-list">{serviceListStatus}{!servicesLoading && !servicesError && services.map((service, index) => <button className="booking-service-card" key={service.id} onClick={() => { setSelectedService(service); setSelectedDoctor(null); setSchedules([]); setSelectedSchedule(null); setSelectedTime(''); setVisitDate(''); setSchedulesError(''); setSchedulesLoading(false); setPage('doctors') }}><span className="booking-service-icon">{serviceIcons[index % serviceIcons.length]}</span><span className="booking-service-copy"><strong>{service.name}</strong><small>{service.description}</small></span><span className="booking-service-arrow">→</span></button>)}</div></section>
    </main>
  )
  if (page === 'doctors') return <main className="service-page"><header className="service-page-header"><button className="back-button" onClick={() => setPage('services')}>←</button><span>Pilih Dokter</span><span className="step-count">02 / 04</span></header><section className="service-page-content"><div className="eyebrow"><span /> DOKTER KAMI</div><h1>Temukan dokter<br /><em>pilihan Anda.</em></h1><p className="service-page-intro">Pilih dokter untuk melanjutkan reservasi.</p><div className="booking-service-list">{doctorListStatus}{!doctorsLoading && !doctorsError && doctors.map((doctor)=><button className="booking-service-card" key={doctor.id} onClick={()=>{if(selectedDoctor?.id!==doctor.id){setSelectedDoctor(doctor);setSchedules([]);setSelectedSchedule(null);setSelectedTime('');setSchedulesError('');setSchedulesLoading(true)}setPage('schedule')}}><span className="doctor-avatar">{doctor.name.split(' ').slice(-2).map((part)=>part[0]).join('').toUpperCase()}</span><span className="booking-service-copy"><strong>{doctor.name}</strong><small>{doctor.specialty}</small></span><span className="booking-service-arrow">→</span></button>)}</div></section></main>
  if (page === 'schedule') return (
    <main className="service-page">
      <header className="service-page-header"><button className="back-button" onClick={() => setPage('doctors')}>←</button><span>Pilih Jadwal</span><span className="step-count">03 / 04</span></header>
      <section className="service-page-content">
        <div className="eyebrow"><span /> JADWAL KUNJUNGAN</div>
        <h1>Kapan Anda<br /><em>ingin berkunjung?</em></h1>
        <p className="service-page-intro">Pilih tanggal dan waktu yang tersedia.</p>
        <label className="date-label" htmlFor="visit-date">Tanggal kunjungan</label>
        <input className="date-input" id="visit-date" type="date" required value={visitDate} onChange={(event) => { setVisitDate(event.target.value); setSchedules([]); setSelectedSchedule(null); setSelectedTime(''); setSchedulesError(''); setSchedulesLoading(true) }} />
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
  if (page === 'form') return <main className="service-page"><header className="service-page-header"><button className="back-button" onClick={()=>setPage('schedule')}>←</button><span>Form Reservasi</span><span className="step-count">04 / 04</span></header><section className="service-page-content"><div className="eyebrow"><span /> DETAIL PASIEN</div><h1>Lengkapi data<br /><em>kunjungan Anda.</em></h1><p className="service-page-intro">Kami akan menghubungi Anda untuk konfirmasi reservasi.</p><form className="reservation-form" onSubmit={handleReservationSubmit}>
    <label>Nama lengkap<input name="name" required placeholder="Masukkan nama lengkap" onChange={() => setPatientId('')} /></label>
    <label>Nomor telepon<input name="phone" required type="tel" placeholder="08xxxxxxxxxx" onChange={() => setPatientId('')} /></label>
    <label>NIK<input name="nik" required inputMode="numeric" pattern="[0-9]{16}" maxLength="16" placeholder="Masukkan 16 digit NIK" onChange={() => setPatientId('')} /></label>
    <label>Email<input name="email" required type="email" placeholder="nama@email.com" /></label>
    <label>Jenis kunjungan<select name="visitType" required defaultValue="baru"><option value="baru">Pasien baru</option><option value="kontrol">Kontrol</option></select></label>
    <label>Keluhan / Catatan<textarea name="notes" required rows="4" placeholder="Ceritakan keluhan atau catatan tambahan" /></label>
    {reservationError && <p className="form-error" role="alert">{reservationError}</p>}
    <button className="button button-dark continue-button" type="submit" disabled={reservationSubmitting}>{reservationSubmitting ? 'Mengirim...' : 'Konfirmasi Reservasi'} <span>→</span></button>
    </form></section></main>
  if (page === 'success') return <main className="service-page success-page"><div className="success-check">✓</div><h1>Reservasi<br /><em>berhasil!</em></h1><p>Terima kasih. Tim kami akan segera menghubungi Anda.</p><button className="button button-dark" onClick={()=>setPage('home')}>Kembali ke Beranda <span>→</span></button></main>
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
      <footer id="kontak"><a className="brand" href="#home"><span className="brand-mark">✦</span><span><strong>MBA</strong><small>DENTALCARE</small></span></a><p>Merawat senyum, sepenuh hati.</p><span>© 2026 MBA Dentalcare</span></footer>
    </div>
  )
}

export default App









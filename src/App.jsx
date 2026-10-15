import { useState } from 'react'
import './App.css'

const services = [
  { icon: '🦷', title: 'Pemeriksaan Umum', detail: 'Pemeriksaan gigi secara menyeluruh untuk senyum sehat.' },
  { icon: '✨', title: 'Tambal Gigi', detail: 'Perawatan untuk memperbaiki gigi berlubang agar tetap sehat.' },
  { icon: '🪥', title: 'Cabut Gigi', detail: 'Tindakan untuk mengangkat gigi yang rusak dan tidak dapat dipertahankan.' },
  { icon: '😁', title: 'Perawatan Ortodonti', detail: 'Rencanakan senyum rapi bersama dokter kami.' },
]

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [page, setPage] = useState('home')
  const [visitDate, setVisitDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')

  if (page === 'services') return (
    <main className="service-page">
      <header className="service-page-header"><button className="back-button" onClick={() => setPage('home')}>←</button><span>Pilih Layanan</span><span className="step-count">01 / 04</span></header>
      <section className="service-page-content service-choice-content"><div className="booking-service-list">{services.map((service) => <button className="booking-service-card" key={service.title} onClick={() => setPage('doctors')}><span className="booking-service-icon">{service.icon}</span><span className="booking-service-copy"><strong>{service.title}</strong><small>{service.detail}</small></span><span className="booking-service-arrow">→</span></button>)}</div></section>
    </main>
  )
  if (page === 'doctors') return <main className="service-page"><header className="service-page-header"><button className="back-button" onClick={() => setPage('services')}>←</button><span>Pilih Dokter</span><span className="step-count">02 / 04</span></header><section className="service-page-content"><div className="eyebrow"><span /> DOKTER KAMI</div><h1>Temukan dokter<br /><em>pilihan Anda.</em></h1><p className="service-page-intro">Pilih dokter untuk melanjutkan reservasi.</p><div className="booking-service-list">{['Drg. Nadia Putri','Drg. Arif Pratama','Drg. Sinta Maharani'].map((doctor,index)=><button className="booking-service-card" key={doctor} onClick={()=>setPage('schedule')}><span className="doctor-avatar">{['NP','AP','SM'][index]}</span><span className="booking-service-copy"><strong>{doctor}</strong><small>{['Dokter Gigi Umum','Dokter Gigi Anak','Konservasi Gigi'][index]}</small></span><span className="booking-service-arrow">→</span></button>)}</div></section></main>
  if (page === 'schedule') return (
    <main className="service-page">
      <header className="service-page-header"><button className="back-button" onClick={() => setPage('doctors')}>←</button><span>Pilih Jadwal</span><span className="step-count">03 / 04</span></header>
      <section className="service-page-content">
        <div className="eyebrow"><span /> JADWAL KUNJUNGAN</div>
        <h1>Kapan Anda<br /><em>ingin berkunjung?</em></h1>
        <p className="service-page-intro">Pilih tanggal dan waktu yang tersedia.</p>
        <label className="date-label" htmlFor="visit-date">Tanggal kunjungan</label>
        <input className="date-input" id="visit-date" type="date" required value={visitDate} onChange={(event) => setVisitDate(event.target.value)} />
        <div className="time-label">Pilih waktu</div>
        <div className="time-options">{['08.00','09.00','10.00','13.00','14.00','15.00'].map((time) => <button type="button" key={time} aria-pressed={selectedTime === time} className={selectedTime === time ? 'time-option selected' : 'time-option'} onClick={() => setSelectedTime(time)}>{time}</button>)}</div>
        <button className="button button-dark continue-button" disabled={!visitDate || !selectedTime} onClick={() => setPage('form')}>Lanjutkan <span>→</span></button>
      </section>
    </main>
  )
  if (page === 'form') return <main className="service-page"><header className="service-page-header"><button className="back-button" onClick={()=>setPage('schedule')}>←</button><span>Form Reservasi</span><span className="step-count">04 / 04</span></header><section className="service-page-content"><div className="eyebrow"><span /> DETAIL PASIEN</div><h1>Lengkapi data<br /><em>kunjungan Anda.</em></h1><p className="service-page-intro">Kami akan menghubungi Anda untuk konfirmasi reservasi.</p><form className="reservation-form" onSubmit={(event)=>{event.preventDefault();setPage('success')}}><label>Nama lengkap<input required placeholder="Masukkan nama lengkap" /></label><label>Nomor telepon<input required type="tel" placeholder="08xxxxxxxxxx" /></label><label>Email<input required type="email" placeholder="nama@email.com" /></label><label>Keluhan / Catatan<textarea required rows="4" placeholder="Ceritakan keluhan atau catatan tambahan" /></label><button className="button button-dark continue-button" type="submit">Konfirmasi Reservasi <span>→</span></button></form></section></main>
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
          <div className="service-list">{services.map((service, index) => <a className="service-card" href="#reservasi" onClick={(event) => { event.preventDefault(); setPage("services") }} key={service.title}><div className="service-top"><span className="service-icon">{service.icon}</span><span className="service-number">0{index + 1}</span></div><h3>{service.title}</h3><p>{service.detail}</p><span className="service-arrow">↗</span></a>)}</div>
        </section>

        <section className="about" id="tentang">
          <div className="about-logo" role="img" aria-label="Logo resmi M. Budi A. Dental Care">
            <svg viewBox="0 0 360 290" aria-hidden="true">
              <g fill="#d89a35">
                <path d="M180 22l5 13 13 5-13 5-5 13-5-13-13-5 13-5zM225 4l4 10 10 4-10 4-4 10-4-10-10-4 10-4zM243 68l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/>
                <path d="M62 111c14-49 54-68 91-56 25 8 41-12 68-6 22 5 31 20 46 11-4 21-22 29-33 44-12 16-9 34-24 57l-26 38c-8-18-18-29-32-28-14 1-23 15-27 36l-31-33c-21-22-41-37-54-63 8 4 15 7 22 8z"/>
                <path fill="#fff15a" d="M76 99c10-38 40-59 73-49 28 8 42-10 68-6 13 2 23 9 32 12-13 9-29 10-45 21-20 14-47 22-77 26-21 3-38 0-51-4z"/>
              </g>
              <text x="180" y="239" text-anchor="middle" fill="#30291f" font-family="Georgia,serif" font-size="39" letter-spacing="1">M. BUDI A.</text>
              <text x="180" y="273" text-anchor="middle" fill="#30291f" font-family="Georgia,serif" font-size="20" letter-spacing="1.5">DENTAL CARE</text>
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









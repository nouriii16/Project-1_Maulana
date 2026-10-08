import { useRef, useState } from "react";
import "./FokusLensaLogin.css";

/*
  Formulir login "Fokus Lensa"
  - Formulir awalnya buram. Putar ring fokus (drag horizontal, atau tombol panah
    saat ring difokuskan) sampai tajam. Setelah fokus terkunci, input aktif.
  - Tombol "Masuk" adalah tombol shutter: layar berkedip putih lalu login diproses.
  - Tanpa dependensi selain React. Gaya ada di FokusLensaLogin.css (font dimuat dari Google Fonts).
*/

const TARGET = 68; // titik fokus tersembunyi (0-100)
const TOLERANSI = 3; // selisih maksimal agar dianggap tajam
const AWAL = 12;
const API_URL = "http://localhost:3001"; // alamat backend Anda

const batas = (n) => Math.min(100, Math.max(0, n));

function Cincin({ nilai, setNilai, terkunci }) {
  const awal = useRef(null);

  const turun = (e) => {
    if (terkunci) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    awal.current = { x: e.clientX, v: nilai };
  };
  const geser = (e) => {
    if (!awal.current || terkunci) return;
    setNilai(batas(awal.current.v + (e.clientX - awal.current.x) / 3));
  };
  const lepas = () => { awal.current = null; };
  const tombol = (e) => {
    if (terkunci) return;
    const langkah = { ArrowRight: 2, ArrowUp: 2, ArrowLeft: -2, ArrowDown: -2 }[e.key];
    if (langkah) { e.preventDefault(); setNilai(batas(nilai + langkah)); }
    if (e.key === "Home") setNilai(0);
    if (e.key === "End") setNilai(100);
  };

  const ticks = Array.from({ length: 36 }, (_, i) => i);
  return (
    <div
      className="fl-cincin"
      role="slider"
      tabIndex={terkunci ? -1 : 0}
      aria-label="Ring fokus lensa"
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(nilai)}
      aria-disabled={terkunci}
      onPointerDown={turun} onPointerMove={geser} onPointerUp={lepas} onPointerCancel={lepas}
      onKeyDown={tombol}
    >
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <radialGradient id="kaca" cx="40%" cy="35%" r="70%">
            <stop offset="0" stopColor="#4b5d7a" />
            <stop offset=".45" stopColor="#1d2638" />
            <stop offset="1" stopColor="#0a0d14" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="98" fill="#101112" />
        <g className="fl-putar" style={{ transform: `rotate(${nilai * 2.7}deg)` }}>
          <circle cx="100" cy="100" r="92" fill="#2b2c2f" />
          {ticks.map((i) => (
            <rect
              key={i} x="98.5" y="10" width={i % 3 === 0 ? 3 : 1.6} height={i % 3 === 0 ? 14 : 9}
              fill={i === 0 ? "#f2c14e" : "#8d8a82"}
              transform={`rotate(${i * 10} 100 100)`}
            />
          ))}
        </g>
        <circle cx="100" cy="100" r="64" fill="#18191b" stroke="#3a3b3f" strokeWidth="2" />
        <circle cx="100" cy="100" r="52" fill="url(#kaca)" />
        <circle cx="100" cy="100" r="30" fill="none" stroke="#2c3a54" strokeWidth="1.5" opacity=".8" />
        <ellipse cx="82" cy="80" rx="14" ry="8" fill="#9db6e0" opacity=".28" transform="rotate(-35 82 80)" />
      </svg>
    </div>
  );
}

export default function FokusLensaLogin() {
  const [fokus, setFokus] = useState(AWAL);
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [error, setError] = useState("");
  const [berhasil, setBerhasil] = useState(false);
  const [kilat, setKilat] = useState(false);
  const [memuat, setMemuat] = useState(false);

  const selisih = Math.abs(fokus - TARGET);
  const [terkunci, setTerkunci] = useState(false);
  const tajam = terkunci;

  const ubahFokus = (v) => {
    setFokus(v);
    if (Math.abs(v - TARGET) <= TOLERANSI) setTerkunci(true);
  };

  const blur = tajam ? 0 : Math.min(2 + (selisih - TOLERANSI) * 0.28, 14);
  const arah = tajam ? null : fokus < TARGET ? "kanan" : "kiri";

  const ambil = async (e) => {
    e.preventDefault();
    if (!email.includes("@")) return setError("Alamat email harus memuat tanda @.");
    if (sandi.length < 6) return setError("Kata sandi minimal 6 karakter.");
    setError("");
    setKilat(true);
    setMemuat(true);

    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: sandi }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) return setError(data.pesan || "Gagal masuk. Coba lagi.");

      localStorage.setItem("token", data.token);
      setBerhasil(true);
    } catch {
      setError("Tidak bisa terhubung ke server. Pastikan backend sudah berjalan.");
    } finally {
      setMemuat(false);
    }
  };

  const ulang = () => {
    localStorage.removeItem("token");
    setBerhasil(false); setTerkunci(false); setFokus(AWAL); setSandi(""); setError("");
  };

  return (
    <main className="fl" data-tajam={tajam}>
      <div
        className={`fl-kilat ${kilat ? "nyala" : ""}`}
        onAnimationEnd={() => setKilat(false)}
        aria-hidden="true"
      />

      <div className="fl-bodi">
        <section className="fl-vf" aria-label="Formulir login">
          <form className="fl-layar" onSubmit={ambil} noValidate id="fl-form">
            <span className="fl-sudut a" /><span className="fl-sudut b" />
            <span className="fl-sudut c" /><span className="fl-sudut d" />
            <span className={`fl-af ${tajam ? "kedip" : ""}`} />

            {!berhasil && (
              <p className="fl-petunjuk">Atur fokus dulu, lalu isi data dan tekan shutter.</p>
            )}

            <div className="fl-isi" style={{ filter: `blur(${blur}px)` }}>
              {berhasil ? (
                <>
                  <h1>Foto tersimpan</h1>
                  <p className="fl-sub">Kamu masuk sebagai {email}.</p>
                  <button type="button" className="fl-ulang" onClick={ulang}>
                    Ambil foto lagi
                  </button>
                </>
              ) : (
                <fieldset disabled={!tajam}>
                  <h1>Masuk ke akunmu</h1>

                  <label htmlFor="fl-email">Email</label>
                  <input
                    id="fl-email" type="email" autoComplete="email" placeholder="nama@email.com"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                  />

                  <label htmlFor="fl-sandi">Kata sandi</label>
                  <input
                    id="fl-sandi" type="password" autoComplete="current-password" placeholder="Minimal 6 karakter"
                    value={sandi} onChange={(e) => setSandi(e.target.value)}
                  />
                  {error && <p className="fl-error" role="alert">{error}</p>}
                </fieldset>
              )}
            </div>
          </form>

          <div className="fl-hud" aria-hidden="true">
            <span>1/250&nbsp;&nbsp;F2.8&nbsp;&nbsp;ISO 100</span>
            <span className="fl-meter">
              <i className={arah === "kiri" ? "on" : ""}>◀</i>
              <b />
              <i className={arah === "kanan" ? "on" : ""}>▶</i>
            </span>
          </div>
        </section>

        <section className="fl-lensa" aria-label="Kontrol kamera">
          <Cincin nilai={fokus} setNilai={ubahFokus} terkunci={tajam} />
          <button
            type="submit" form="fl-form" className="fl-shutter"
            disabled={!tajam || berhasil || memuat} aria-label="Masuk"
          >
            Masuk
          </button>
          <p className="fl-cap" aria-live="polite">
            {tajam ? "Fokus terkunci. Formulir siap diisi." : "Geser ring ke kiri atau kanan sampai formulir tajam."}
          </p>
        </section>
      </div>
    </main>
  );
}
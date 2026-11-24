import { Link, Route, Routes } from 'react-router-dom';
import { useLanguage } from './i18n/LanguageContext.jsx';
import Home from './pages/Home.jsx';
import JoinQueue from './pages/JoinQueue.jsx';
import MyStatus from './pages/MyStatus.jsx';
import Reception from './pages/Reception.jsx';
import BarberView from './pages/BarberView.jsx';
import WaitingDisplay from './pages/WaitingDisplay.jsx';
import OwnerSettings from './pages/OwnerSettings.jsx';
import Navigation from './components/Navigation.jsx';
import CloudConnectionLabel from './components/CloudConnectionLabel.jsx';
import { useQueueConnection } from './data/QueueConnectionContext.jsx';

function CloudConnectionNotice() {
  const { t } = useLanguage();
  const { status } = useQueueConnection();
  if (status === 'connected') return null;
  const message = status === 'connecting' ? t.cloudConnectingDetails
    : status === 'unconfigured' ? t.cloudSetupDetails : t.cloudReconnectDetails;
  return <div className={`cloud-connection-notice cloud-${status}`} role={status === 'unconfigured' || status === 'error' ? 'alert' : 'status'} aria-live="polite">
    <span aria-hidden="true">{status === 'connecting' ? '◌' : '!'}</span><p>{message}</p>
  </div>;
}

const screens = [
  { path: '/', key: 'home', title: 'Home' }, { path: '/join', key: 'join', title: 'Join Queue' },
  { path: '/status/:id', key: 'status', title: 'My Status' }, { path: '/reception', key: 'reception', title: 'Reception Dashboard' },
  { path: '/barber/:barberId', key: 'barber', title: 'Barber View' }, { path: '/display', key: 'display', title: 'Waiting Area TV' },
  { path: '/admin', key: 'admin', title: 'Owner Settings' },
];

function Shell({ screen }) {
  const { t, language, toggleLanguage } = useLanguage();
  return <main className="min-h-screen px-4 py-6 sm:px-8 sm:py-10">
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
      <Link to="/" className="font-semibold tracking-wide text-white">{t.brand}</Link>
      <div className="flex items-center gap-3"><CloudConnectionLabel className="local-pill" /><button className="touch-button" onClick={toggleLanguage} aria-label={t.language}>{language === 'en' ? 'EN | ગુજરાતી' : 'ગુજરાતી | EN'}</button></div>
    </header>
    <section className="mx-auto mt-12 w-full max-w-5xl rounded-3xl border border-white/10 bg-white p-6 shadow-2xl sm:p-10">
      <p className="eyebrow">{t.prototype}</p><h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">{t[screen.key] ?? screen.title}</h1>
      <p className="mt-4 max-w-2xl leading-7 text-slate-600">{t.phaseOne}</p>
      <div className="mt-8 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">{t.cloudDisclosure}</div>
      <nav className="mt-8 flex flex-wrap gap-2" aria-label={t.screens}>{screens.map(item => <Link key={item.path} className="nav-link" to={item.path}>{t[item.key] ?? item.title}</Link>)}</nav>
    </section>
  </main>;
}

export default function App() { return <><CloudConnectionNotice /><Navigation /><Routes><Route path="/" element={<Home />} /><Route path="/join" element={<JoinQueue />} /><Route path="/status/:id" element={<MyStatus />} /><Route path="/reception" element={<Reception />} /><Route path="/barber/:barberId" element={<BarberView />} /><Route path="/display" element={<WaitingDisplay />} /><Route path="/admin" element={<OwnerSettings />} /><Route path="*" element={<Shell screen={{ key: 'notFound', title: 'Not found' }} />} /></Routes></>; }

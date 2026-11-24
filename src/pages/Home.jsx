import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { queueRepository } from '../data/storage.js';
import { approximateWait, onlineQueueOpen } from '../domain/customerQueue.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const initials = name => name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();

export default function Home() {
  const { t } = useLanguage();
  const [state, setState] = useState(() => queueRepository.getSnapshot());
  const [now, setNow] = useState(Date.now());
  useEffect(() => queueRepository.subscribe(setState), []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const waiting = state.queue.filter(entry => entry.status === 'Waiting');
  const wait = approximateWait(state, waiting.reduce((total, entry) => total + entry.durationMinutes, 0));
  const open = onlineQueueOpen(state, new Date(now));
  const working = state.barbers.filter(barber => barber.onDuty && barber.availability !== 'break');
  const status = barber => !barber.onDuty ? t.offDuty : barber.availability === 'break' ? t.onBreak : state.queue.some(entry => entry.barberId === barber.id && ['Called', 'In chair'].includes(entry.status)) ? t.busy : t.available;

  return <main className="home-page page-enter">
    <section className="home-hero">
      <div className="hero-copy">
        <div className="hero-brandline"><span className="brand-mark">S</span><span>{t.salonName}</span></div>
        <span className={`queue-status ${open ? 'queue-status-open' : 'queue-status-closed'}`}><i />{open ? t.open : t.closed}</span>
        <p className="hero-kicker">{t.homeKicker}</p>
        <h1>{t.homeHeadline}</h1>
        <p className="hero-description">{t.homeIntro}</p>
        <div className="hero-actions">
          <Link aria-disabled={!open} tabIndex={open ? 0 : -1} className={`button-primary ${!open ? 'button-disabled' : ''}`} to={open ? '/join' : '#'}>{t.join}<span aria-hidden="true">↗</span></Link>
          <span className="hero-closing">{t.closesAt} <strong>{state.settings.closingTime}</strong></span>
        </div>
        {!open && <p className="hero-notice">{t.closeExplanation}</p>}
      </div>
      <div className="hero-visual" aria-label={t.liveQueue}>
        <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
        <div className="hero-emblem"><span>THE</span><strong>CHAIR</strong><i /></div>
        <div className="hero-live-card"><span className="live-dot" />{t.liveQueue}<strong>{waiting.length.toLocaleString('en-IN')} <small>{t.waiting}</small></strong></div>
        <span className="hero-serial">EST. · {state.settings.closingTime}</span>
      </div>
    </section>

    <section className="home-stats" aria-label={t.liveQueue}>
      <article className="stat-panel"><span className="stat-icon">01</span><div><p>{t.guestsWaiting}</p><strong key={waiting.length} className="stat-number">{waiting.length.toLocaleString('en-IN')}</strong></div><span className="stat-caption">{waiting.length ? t.inLiveQueue : t.noWait}</span></article>
      <article className="stat-panel"><span className="stat-icon">02</span><div><p>{t.currentWait}</p><strong key={wait ?? 'unavailable'} className="stat-number">{working.length ? <>{wait ?? 0} <small>{t.minutes}</small></> : t.noEstimate}</strong></div><span className="stat-caption">{t.estimateDisclaimerShort}</span></article>
    </section>

    {!working.length && <p className="home-unavailable">{t.unavailable}</p>}
    {!waiting.length && working.length > 0 && <div className="empty-queue"><span className="empty-spark">✦</span><div><strong>{t.noWait}</strong><p>{t.emptyQueueHint}</p></div></div>}

    <section className="barber-section">
      <div className="section-heading"><div><p className="section-kicker">{t.ourTeam}</p><h2>{t.chooseBarber}</h2></div><span>{state.barbers.length.toLocaleString('en-IN')} {t.barbersLabel}</span></div>
      <div className="barber-grid">{state.barbers.map((barber, index) => <article key={barber.id} className="barber-card" style={{ '--card-delay': `${index * 70}ms` }}><div className={`barber-avatar barber-avatar-${index % 3}`}>{initials(barber.name)}</div><div className="barber-info"><strong>{barber.name}</strong><span className={`availability availability-${!barber.onDuty ? 'off' : barber.availability === 'break' ? 'break' : status(barber) === t.busy ? 'busy' : 'available'}`}><i />{status(barber)}</span></div><span className="barber-number">0{index + 1}</span></article>)}</div>
    </section>

    <section className="staff-access"><div><p className="section-kicker">{t.staffOnly}</p><h2>{t.staffQuickAccess}</h2><p>{t.staffQuickAccessHint}</p></div><div className="staff-actions"><Link to="/reception" className="staff-link">{t.reception}<span>↗</span></Link><Link to="/admin" className="staff-link">{t.admin}<span>↗</span></Link></div></section>
    <footer className="home-footer"><span>{t.walkins}</span><span>{t.cloudDisclosure}</span></footer>
  </main>;
}

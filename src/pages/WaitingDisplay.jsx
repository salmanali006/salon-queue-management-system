import { useEffect, useRef, useState } from 'react';
import { queueRepository } from '../data/storage.js';
import { eligibleWaitingEntries, getCustomerQueueStatus, onlineQueueOpen } from '../domain/customerQueue.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useQueueConnection } from '../data/QueueConnectionContext.jsx';

function chime() {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    const context = new Audio();
    if (context.state === 'suspended') {
      context.close();
      return;
    }
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(740, context.currentTime);
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.24);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.24);
    oscillator.onended = () => context.close();
  } catch {
    // The visual call announcement remains available when browser audio is blocked.
  }
}

export default function WaitingDisplay() {
  const { t, language } = useLanguage();
  const connection = useQueueConnection();
  const [state, setState] = useState(() => queueRepository.read());
  const [highlight, setHighlight] = useState(null);
  const [now, setNow] = useState(Date.now());
  const seen = useRef(new Set(state.queue.filter(entry => entry.status === 'Called').map(entry => entry.id)));
  const hydrated = useRef(queueRepository.hasRemoteSnapshot);

  useEffect(() => queueRepository.subscribe(next => {
    if (!hydrated.current && queueRepository.hasRemoteSnapshot) {
      hydrated.current = true;
      seen.current = new Set(next.queue.filter(entry => entry.status === 'Called').map(entry => entry.id));
      setState(next);
      return;
    }
    if (!queueRepository.hasRemoteSnapshot) {
      setState(next);
      return;
    }
    const newlyCalled = next.queue.find(entry => entry.status === 'Called' && !seen.current.has(entry.id));
    seen.current = new Set(next.queue.filter(entry => entry.status === 'Called').map(entry => entry.id));
    if (newlyCalled) {
      setHighlight(newlyCalled.id);
      chime();
      window.setTimeout(() => setHighlight(current => current === newlyCalled.id ? null : current), 5000);
    }
    setState(next);
  }), []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const called = state.queue.filter(entry => entry.status === 'Called' || entry.status === 'In chair');
  const highlightedEntry = state.queue.find(entry => entry.id === highlight && ['Called', 'In chair'].includes(entry.status));
  const upcoming = eligibleWaitingEntries(state);
  const activeBarbers = state.barbers.filter(barber => barber.onDuty);
  const salonOpen = onlineQueueOpen(state, new Date(now));
  const date = new Date(now);
  const dateLabel = date.toLocaleDateString(language === 'gu' ? 'gu-IN' : 'en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const clockLabel = date.toLocaleTimeString(language === 'gu' ? 'gu-IN' : 'en-IN', {
    hour: '2-digit', minute: '2-digit',
  });
  const serviceNames = entry => (entry.services ?? [])
    .map(service => service.name?.[language] ?? service.name?.en ?? service.name)
    .filter(Boolean)
    .join(', ');
  const barberFor = id => state.barbers.find(barber => barber.id === id);
  const barberState = (barber, current) => {
    if (!barber.onDuty) return { key: 'offDuty', label: t.offDuty };
    if (current) return { key: 'busy', label: t.busy };
    if (barber.availability === 'break') return { key: 'break', label: t.onBreak };
    return { key: 'available', label: t.available };
  };

  return (
    <main className="tv-page">
      <header className="tv-heading">
        <div className="tv-brand-lockup">
          <span className="tv-logo-mark" aria-hidden="true"><i>✦</i></span>
          <div>
            <p className="tv-brand">{t.salonName}</p>
            <h1>{t.display}</h1>
          </div>
        </div>
        <div className="tv-header-details">
          <div className="tv-date-time"><strong>{clockLabel}</strong><span>{dateLabel}</span></div>
          <span className={`tv-queue-state ${salonOpen ? 'tv-open' : 'tv-closed'}`}><i aria-hidden="true" />{salonOpen ? t.open : t.closed}</span>
          <span className={`tv-live-badge ${connection.status === 'connected' ? '' : 'tv-live-offline'}`}><i aria-hidden="true" />{connection.status === 'connected' ? t.liveIndicator : connection.status === 'unconfigured' ? t.cloudSetupRequired : t.cloudReconnecting}</span>
        </div>
      </header>

      {highlightedEntry && (
        <section key={highlightedEntry.id} aria-live="polite" role="status" className="tv-call-announcement">
          <span className="tv-call-decoration" aria-hidden="true">✦</span>
          <div className="tv-call-copy"><p>{t.itsYourTurn}</p><strong>{highlightedEntry.token}</strong><span>{t.goTo} {barberFor(highlightedEntry.barberId)?.name}</span></div>
          <span className="tv-call-decoration" aria-hidden="true">✦</span>
        </section>
      )}

      {activeBarbers.length === 0 && <p className="tv-no-barbers">{t.noActiveBarbers}</p>}

      <section className="tv-barber-grid" aria-label={t.barbersLabel}>
        {state.barbers.map((barber, index) => {
          const current = called.find(entry => entry.barberId === barber.id);
          const status = barberState(barber, current);
          return (
            <article key={barber.id} className={`tv-barber-card barber-tv-${status.key}`} style={{ '--card-delay': `${index * 70}ms` }}>
              <div className="tv-barber-topline">
                <div className="tv-barber-emblem" aria-hidden="true">{barber.name.slice(0, 1)}</div>
                <div><h2>{barber.name}</h2><span className={`tv-barber-status tv-status-${status.key}`}><i aria-hidden="true" />{status.label}</span></div>
              </div>
              <div className="tv-current-customer">
                <p className="tv-now-label">{current ? t.nowServing : t.available}</p>
                {current ? <strong className="tv-token">{current.token}</strong> : <strong className="tv-idle-token">—</strong>}
                {current && <div className="tv-service-line"><span>{t.currentService}</span><strong>{serviceNames(current) || '—'}</strong></div>}
              </div>
            </article>
          );
        })}
      </section>

      <section className="tv-up-next">
        <div className="tv-up-heading"><div><p className="tv-up-kicker">{t.liveQueue}</p><h2>{t.upNext}</h2></div><span>{t.nextFive}</span></div>
        {upcoming.length ? (
          <div className="tv-up-grid">
            {upcoming.map((entry, index) => {
              const estimate = getCustomerQueueStatus(state, entry.id).waitMinutes;
              const preference = entry.barberId === 'any' ? t.anyBarber : barberFor(entry.barberId)?.name ?? t.unavailableBarber;
              return (
                <article key={entry.id} className={`tv-up-card ${entry.id === highlight ? 'called-highlight tv-up-highlight' : ''}`}>
                  <p>{String(index + 1).padStart(2, '0')} <span aria-hidden="true">·</span> {preference}</p>
                  <strong>{entry.token}</strong>
                  <span className="tv-up-service">{serviceNames(entry) || '—'}</span>
                  <small>{t.approxWait}: {estimate === null ? t.noEstimate : `${estimate} ${t.minutes}`}</small>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="tv-empty-state"><span aria-hidden="true">✦</span><p>{t.noUpcoming}</p></div>
        )}
      </section>
    </main>
  );
}

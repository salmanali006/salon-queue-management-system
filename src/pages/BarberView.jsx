import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { queueRepository } from '../data/storage.js';
import { nextEligibleCustomerForBarber } from '../domain/customerQueue.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const formatElapsed = (startedAt, now) => {
  if (!startedAt) return '—';
  const elapsedSeconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  if (!Number.isFinite(elapsedSeconds)) return '—';
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const serviceName = (service, language) => service.name?.[language] ?? service.name?.en ?? service.name;

export default function BarberView() {
  const { barberId } = useParams();
  const { t, language } = useLanguage();
  const [state, setState] = useState(() => queueRepository.read());
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => queueRepository.subscribe(setState), []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const barber = state.barbers.find(item => item.id === barberId);
  if (!barber) {
    return (
      <main className="barber-view-page">
        <section className="barber-not-found">
          <h1 className="text-2xl font-bold">{t.barberNotFound}</h1>
          <Link to="/reception" className="mt-4 inline-flex min-h-11 items-center underline">{t.reception}</Link>
        </section>
      </main>
    );
  }

  const current = state.queue.find(item => item.barberId === barberId && ['Called', 'In chair'].includes(item.status));
  const next = nextEligibleCustomerForBarber(state, barberId);
  const statusKey = !barber.onDuty ? 'offDuty' : current ? 'busy' : barber.availability === 'break' ? 'onBreak' : 'available';
  const currentStatusKey = current?.status === 'Called' ? 'called' : 'inChair';
  const duration = Number(current?.durationMinutes) || 0;
  const rawElapsedSeconds = current?.startedAt ? Math.floor((now - new Date(current.startedAt).getTime()) / 1000) : 0;
  const elapsedSeconds = Number.isFinite(rawElapsedSeconds) ? Math.max(0, rawElapsedSeconds) : 0;
  const elapsedMinutes = elapsedSeconds / 60;
  const serviceProgress = duration > 0 ? Math.min(100, (elapsedMinutes / duration) * 100) : 0;
  const elapsedLabel = current?.startedAt ? formatElapsed(current.startedAt, now) : '—';
  const toggleLabel = barber.availability === 'break' ? t.onBreakAction : t.availableAction;

  async function action(success, operation) {
    if (saving) return;
    setSaving(true);
    setMessage('');
    try {
      const result = await queueRepository.update(operation);
      if (!result.ok) {
        setMessage(t[result.error] ?? t.barberUpdateFailed);
        return;
      }
      setMessage(success);
    } catch {
      setMessage(t.barberUpdateFailed);
    } finally {
      setSaving(false);
    }
  }

  const selectedServices = entry => entry?.services ?? [];

  return (
    <main className="barber-view-page page-enter">
      <section className="barber-view-shell">
        <Link to="/reception" className="barber-back">← {t.reception}</Link>

        <article className="barber-workspace">
          <header className="barber-profile">
            <div className={`barber-avatar barber-avatar-${state.barbers.findIndex(item => item.id === barberId) % 3}`} aria-hidden="true">
              {barber.name.slice(0, 1)}
            </div>
            <div className="barber-profile-copy">
              <p className="section-kicker">{t.barberView}</p>
              <h1>{barber.name}</h1>
              <span className={`barber-live-state is-${statusKey === 'onBreak' ? 'break' : statusKey === 'offDuty' ? 'off-duty' : statusKey}`}>
                <i aria-hidden="true" />{t[statusKey]}
              </span>
            </div>
            {barber.onDuty && (
              <div className="barber-availability-control">
                <button
                  type="button"
                  className={`barber-break-action ${barber.availability === 'break' ? 'break-toggle-on' : ''}`}
                  aria-pressed={barber.availability === 'break'}
                  aria-label={toggleLabel}
                  disabled={Boolean(current) || saving}
                  onClick={() => action(
                    barber.availability === 'break' ? t.nowAvailable : t.nowOnBreak,
                    { type: 'barberBreak', payload: { barberId, onBreak: barber.availability !== 'break' } },
                  )}
                >
                  <i aria-hidden="true" />
                  <span>{saving ? t.barberSaving : toggleLabel}</span>
                </button>
                {current && <p className="barber-control-hint">{t.barberAvailabilityLocked}</p>}
              </div>
            )}
          </header>

          {current ? (
            <section key={current.id} className={`barber-current-card barber-current-${current.status === 'Called' ? 'called' : 'working'}`} aria-labelledby="current-customer-name">
              <div className="barber-current-top">
                <p>{t.currentCustomer}</p>
                <span className={`barber-service-status status-${current.status === 'Called' ? 'called' : 'in-chair'}`}>
                  <i aria-hidden="true" />{t[currentStatusKey]}
                </span>
              </div>

              <div className="barber-customer-heading">
                <strong className="barber-token">{current.token}</strong>
                <div>
                  <p className="barber-customer-eyebrow">{t.customer}</p>
                  <h2 id="current-customer-name">{current.name}</h2>
                </div>
              </div>

              <div className="barber-service-block">
                <p className="barber-info-label">{t.services}</p>
                <ul className="barber-service-list">
                  {selectedServices(current).map((service, index) => (
                    <li key={`${service.id ?? service.name?.en ?? 'service'}-${index}`}>
                      <span>{serviceName(service, language)}</span>
                      {service.durationMinutes > 0 && <span>{service.durationMinutes} {t.minutes}</span>}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="barber-total-duration">
                <span>{t.totalServiceDuration}</span>
                <strong>{duration} {t.minutes}</strong>
              </div>

              {current.status === 'In chair' ? (
                <section className="barber-timer-panel" aria-label={t.elapsedServiceTime}>
                  <div className="barber-timer-ring" style={{ '--timer-progress': `${serviceProgress * 3.6}deg` }} role="img" aria-label={`${t.elapsed}: ${elapsedLabel}`}>
                    <div className="barber-timer-ring-center">
                      <strong>{elapsedLabel}</strong>
                      <span>{t.elapsed}</span>
                    </div>
                  </div>
                  <div className="barber-timer-copy">
                    <p className="barber-info-label">{t.serviceTimer}</p>
                    <strong>{t.expectedDuration}: {duration} {t.minutes}</strong>
                    <div className="barber-timer-track" role="progressbar" aria-label={t.expectedDuration} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(serviceProgress)}>
                      <span style={{ width: `${serviceProgress}%` }} />
                    </div>
                    <p>{t.expectedDurationNote}</p>
                  </div>
                </section>
              ) : (
                <p className="barber-called-hint">{t.customerReadyForService}</p>
              )}

              <button
                type="button"
                disabled={saving}
                onClick={() => current.status === 'Called'
                  ? action(t.serviceStarted, { type: 'start', payload: { barberId } })
                  : action(t.serviceDone, { type: 'complete', payload: { barberId } })}
                className={`barber-primary-action ${current.status === 'In chair' ? 'action-done' : ''}`}
              >
                <span className="barber-action-label">{saving ? t.barberSaving : current.status === 'Called' ? t.start : t.done}</span>
                <span aria-hidden="true">→</span>
              </button>
            </section>
          ) : (
            <section className="barber-empty-current" aria-live="polite">
              <span aria-hidden="true">✦</span>
              <p>{t.noCurrentCustomer}</p>
            </section>
          )}

          <section className="barber-next-card" aria-label={t.nextForYou}>
            <div className="barber-next-heading">
              <p className="section-kicker">{t.nextForYou}</p>
              <span aria-hidden="true">↗</span>
            </div>
            {next ? (
              <div className="barber-next-customer">
                <strong>{next.token}</strong>
                <div>
                  <h2>{next.name}</h2>
                  <p>{selectedServices(next).map(service => serviceName(service, language)).join(' · ')}</p>
                </div>
              </div>
            ) : <p className="barber-no-next">{t.noEligible}</p>}
          </section>

          {message && <p role="status" aria-live="polite" className="barber-feedback">{message}</p>}
          <p className="barber-local-note">{t.cloudDisclosure}</p>
        </article>
      </section>
    </main>
  );
}

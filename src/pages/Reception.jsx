import { useEffect, useMemo, useState } from 'react';
import { queueRepository } from '../data/storage.js';
import CloudConnectionLabel from '../components/CloudConnectionLabel.jsx';
import {
  activeServices,
  nextEligibleCustomerForBarber,
  onlineQueueOpen,
  serviceTotals,
  todayStatistics,
} from '../domain/customerQueue.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const fmtTime = (iso, now, minuteLabel) => {
  if (!iso) return '—';
  const elapsed = Math.floor((now - new Date(iso).getTime()) / 60000);
  return Number.isFinite(elapsed) ? `${Math.max(0, elapsed)} ${minuteLabel}` : '—';
};

const formatInr = amount => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(amount);

export default function Reception() {
  const { t, language } = useLanguage();
  const [state, setState] = useState(() => queueRepository.read());
  const [showWalkin, setShowWalkin] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState(null);
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceIds, setServiceIds] = useState([]);
  const [barberId, setBarberId] = useState('any');

  useEffect(() => queueRepository.subscribe(setState), []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  const services = activeServices(state);
  const selectedServices = services.filter(service => serviceIds.includes(service.id));
  const totals = serviceTotals(selectedServices);
  const waiting = useMemo(() => state.queue
    .filter(entry => entry.status === 'Waiting')
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.joinedAt.localeCompare(b.joinedAt)), [state]);
  const activeQueue = useMemo(() => state.queue
    .filter(entry => ['Waiting', 'Called', 'In chair'].includes(entry.status))
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.joinedAt.localeCompare(b.joinedAt)), [state]);
  const open = onlineQueueOpen(state, new Date(now));
  const stats = todayStatistics(state, new Date(now));
  const inService = state.queue.filter(entry => entry.status === 'In chair').length;
  const dateLabel = new Date(now).toLocaleDateString(language === 'gu' ? 'gu-IN' : 'en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  function showFeedback(message, kind = 'success') {
    setToast({ id: Date.now(), message, kind });
  }

  async function callNext(barber) {
    if (pending) return;
    setPending(true);
    try {
      const result = await queueRepository.update({ type: 'callNext', payload: { barberId: barber.id } });
      if (!result.ok) {
        showFeedback(t[result.error] ?? t.updateFailed, 'error');
        return;
      }
      showFeedback(`${t.calledToken} ${result.entry.token} · ${barber.name}`);
    } catch {
      showFeedback(t.updateFailed, 'error');
    } finally {
      setPending(false);
    }
  }

  async function cancelEntry(entry) {
    if (!window.confirm(t.cancelConfirm) || pending) return;
    setPending(true);
    try {
      const result = await queueRepository.update({ type: 'cancel', payload: { entryId: entry.id } });
      if (!result.ok) {
        showFeedback(t[result.error] ?? t.cancelUnavailable, 'error');
        return;
      }
      showFeedback(t.cancelledFeedback);
    } catch {
      showFeedback(t.updateFailed, 'error');
    } finally {
      setPending(false);
    }
  }

  async function noShow(entry) {
    if (!window.confirm(t.noShowConfirm) || pending) return;
    setPending(true);
    try {
      const result = await queueRepository.update({ type: 'noShow', payload: { entryId: entry.id } });
      if (!result.ok) {
        showFeedback(t[result.error] ?? t.updateFailed, 'error');
        return;
      }
      showFeedback(t.noShowFeedback);
    } catch {
      showFeedback(t.updateFailed, 'error');
    } finally {
      setPending(false);
    }
  }

  async function submitWalkin(event) {
    event.preventDefault();
    setFormError('');
    if (pending) return;
    setPending(true);
    try {
      const input = { name, phone, serviceIds, barberId };
      const result = await queueRepository.update({ type: 'walkIn', payload: { input, requestId: crypto.randomUUID() } });
      if (!result.ok) {
        setFormError(result.duplicate ? `${t.duplicate} ${result.duplicate.token}` : t[result.error] ?? t.updateFailed);
        return;
      }
      showFeedback(`${t.walkinAdded} ${result.entry.token}`);
      setName('');
      setPhone('');
      setServiceIds([]);
      setBarberId('any');
      setShowWalkin(false);
    } catch {
      setFormError(t.updateFailed);
    } finally {
      setPending(false);
    }
  }

  const activeEntryFor = id => state.queue.find(entry => entry.barberId === id && ['Called', 'In chair'].includes(entry.status));
  const barberStatus = (barber, active) => {
    if (!barber.onDuty) return { key: 'offDuty', label: t.offDuty };
    if (active) return { key: 'busy', label: t.busy };
    if (barber.availability === 'break') return { key: 'break', label: t.onBreak };
    return { key: 'available', label: t.available };
  };
  const serviceNames = entry => (entry.services ?? [])
    .map(service => service.name?.[language] ?? service.name?.en ?? service.name)
    .filter(Boolean)
    .join(', ');
  const statusLabel = status => ({ Waiting: t.waiting, Called: t.calledToken, 'In chair': t.inChair })[status];
  const barberForEntry = entry => state.barbers.find(barber => barber.id === entry.barberId);
  const minutesSinceCall = entry => entry.calledAt ? (now - new Date(entry.calledAt).getTime()) / 60000 : 0;
  const timeForEntry = entry => entry.status === 'Waiting'
    ? `${t.waitingTime}: ${fmtTime(entry.joinedAt, now, t.minutes)}`
    : entry.status === 'Called'
      ? `${t.sinceCall}: ${fmtTime(entry.calledAt, now, t.minutes)}`
      : `${t.elapsed}: ${fmtTime(entry.startedAt, now, t.minutes)}`;

  return (
    <main className="reception-page page-enter">
      <div className="reception-shell">
        <header className="reception-header">
          <div className="reception-title-block">
            <p className="section-kicker">{t.salonName}</p>
            <h1>{t.reception}</h1>
            <div className="reception-meta-line">
              <span>{dateLabel}</span>
              <span className="reception-meta-separator" aria-hidden="true">·</span>
              <span>{new Date(now).toLocaleTimeString(language === 'gu' ? 'gu-IN' : 'en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
              <span className="reception-meta-separator" aria-hidden="true">·</span>
              <CloudConnectionLabel className="reception-local-indicator" />
            </div>
          </div>
          <div className="reception-header-actions">
            <span className={`queue-status ${open ? 'queue-status-open' : 'queue-status-closed'}`}>
              <i aria-hidden="true" />{open ? t.open : t.closed}
            </span>
            <button type="button" onClick={() => { setShowWalkin(value => !value); setFormError(''); }} className="reception-add-button">
              <span aria-hidden="true">＋</span>{showWalkin ? t.close : t.addWalkin}
            </button>
          </div>
        </header>

        <section className="reception-stats-grid" aria-label={t.todayStats}>
          <article className="reception-stat-card stat-waiting">
            <span className="reception-stat-icon" aria-hidden="true">⌛</span>
            <p>{t.customersWaiting}</p>
            <strong>{waiting.length.toLocaleString(language === 'gu' ? 'gu-IN' : 'en-IN')}</strong>
            <small>{t.inLiveQueue}</small>
          </article>
          <article className="reception-stat-card stat-serving">
            <span className="reception-stat-icon" aria-hidden="true">✂</span>
            <p>{t.currentlyServing}</p>
            <strong>{inService.toLocaleString(language === 'gu' ? 'gu-IN' : 'en-IN')}</strong>
            <small>{t.inChair}</small>
          </article>
          <article className="reception-stat-card stat-completed">
            <span className="reception-stat-icon" aria-hidden="true">✓</span>
            <p>{t.completedToday}</p>
            <strong>{stats.served.toLocaleString(language === 'gu' ? 'gu-IN' : 'en-IN')}</strong>
            <small>{t.customersServed}</small>
          </article>
          <article className="reception-stat-card stat-wait-time">
            <span className="reception-stat-icon" aria-hidden="true">◷</span>
            <p>{t.averageWaitingTime}</p>
            <strong>{stats.averageWait === null ? '—' : `${stats.averageWait} ${t.minutes}`}</strong>
            <small>{stats.averageWait === null ? t.noData : t.actualWaitFromService}</small>
          </article>
        </section>

        {showWalkin && (
          <form onSubmit={submitWalkin} className="reception-walkin-form">
            <div className="walkin-form-heading">
              <div><p className="section-kicker">{t.walkinFormKicker}</p><h2>{t.addWalkin}</h2></div>
              <button type="button" className="walkin-close-button" aria-label={t.close} onClick={() => setShowWalkin(false)}>×</button>
            </div>
            <p className="walkin-form-hint">{t.walkinClosedNote}</p>

            <div className="walkin-field-grid">
              <label>{t.name}
                <input required className="form-input" placeholder={t.namePlaceholder} value={name} onChange={event => setName(event.target.value)} />
              </label>
              <label>{t.phone}
                <input required className="form-input" value={phone} onChange={event => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" maxLength={10} />
              </label>
            </div>

            <fieldset className="walkin-service-fieldset">
              <legend>{t.services}</legend>
              {services.length ? (
                <div className="walkin-service-grid">
                  {services.map(service => {
                    const checked = serviceIds.includes(service.id);
                    const disabled = !checked && serviceIds.length >= 3;
                    return (
                      <label key={service.id} className={`walkin-service-option ${checked ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}>
                        <input type="checkbox" checked={checked} disabled={disabled} onChange={() => setServiceIds(current => current.includes(service.id)
                          ? current.filter(id => id !== service.id)
                          : current.length < 3 ? [...current, service.id] : current)} />
                        <span><strong>{service.name[language]}</strong><small>{service.durationMinutes} {t.minutes} · {formatInr(service.priceInr)}</small></span>
                      </label>
                    );
                  })}
                </div>
              ) : <p className="walkin-no-services">{t.noActiveServices}</p>}
            </fieldset>

            <label className="walkin-barber-field">{t.barberPreference}
              <select className="form-input" value={barberId} onChange={event => setBarberId(event.target.value)}>
                <option value="any">{t.anyBarber}</option>
                {state.barbers.map(barber => <option key={barber.id} value={barber.id} disabled={!barber.onDuty || barber.availability !== 'available'}>{barber.name}{!barber.onDuty || barber.availability !== 'available' ? ` · ${t.unavailableBarber}` : ''}</option>)}
              </select>
            </label>

            {selectedServices.length > 0 && (
              <div className="walkin-total-summary">
                <span>{t.duration}<strong>{totals.minutes} {t.minutes}</strong></span>
                <span>{t.price}<strong>{formatInr(totals.price)}</strong></span>
              </div>
            )}
            {formError && <p role="alert" className="walkin-form-error">{formError}</p>}
            <div className="walkin-form-actions">
              <button type="button" className="walkin-secondary-button" onClick={() => setShowWalkin(false)}>{t.close}</button>
              <button type="submit" disabled={pending || services.length === 0} className="walkin-submit-button">{pending ? t.barberSaving : t.addToQueue}<span aria-hidden="true">→</span></button>
            </div>
          </form>
        )}

        <section className="reception-section-block">
          <div className="reception-section-heading">
            <div><p className="section-kicker">{t.liveQueue}</p><h2>{t.barberOverview}</h2></div>
            <span className="reception-section-count">{state.barbers.length} {t.barbersLabel}</span>
          </div>
          <div className="reception-barber-grid">
            {state.barbers.map((barber, index) => {
              const active = activeEntryFor(barber.id);
              const status = barberStatus(barber, active);
              const next = nextEligibleCustomerForBarber(state, barber.id);
              const canCall = barber.onDuty && barber.availability === 'available' && !active && Boolean(next);
              const disabledReason = !barber.onDuty ? t.offDuty : barber.availability !== 'available' ? t.onBreak : active ? t.barberOccupied : !next ? t.noEligible : '';
              return (
                <article key={barber.id} className={`ops-barber-card barber-state-${status.key}`} style={{ '--card-delay': `${index * 55}ms` }}>
                  <div className="ops-barber-head">
                    <span className={`ops-avatar ops-avatar-${index % 3}`} aria-hidden="true">{barber.name[0]}</span>
                    <div className="ops-barber-identity"><h3>{barber.name}</h3><span className={`ops-status-badge badge-${status.key}`}><i aria-hidden="true" />{status.label}</span></div>
                    {active && <span className="ops-token">{active.token}</span>}
                  </div>
                  {active ? (
                    <div className="ops-current">
                      <p>{active.status === 'Called' ? t.calledToken : t.inChair}</p>
                      <strong>{active.name}</strong>
                      <span>{serviceNames(active) || '—'}</span>
                      <small>{active.status === 'Called' ? t.sinceCall : t.elapsed}: {fmtTime(active.status === 'Called' ? active.calledAt : active.startedAt ?? active.calledAt, now, t.minutes)}</small>
                    </div>
                  ) : (
                    <div className="ops-no-customer"><span aria-hidden="true">✦</span><p>{t.noActiveCustomer}</p></div>
                  )}
                  <button type="button" disabled={!canCall || pending} aria-describedby={!canCall ? `call-reason-${barber.id}` : undefined} onClick={() => callNext(barber)} className="ops-call-button">
                    <span>{pending ? t.barberSaving : t.callNext}</span><span aria-hidden="true">→</span>
                  </button>
                  {!canCall && <p id={`call-reason-${barber.id}`} className="ops-call-reason">{disabledReason}</p>}
                </article>
              );
            })}
          </div>
        </section>

        <section className="ops-queue-panel reception-queue-panel">
          <header className="reception-queue-heading">
            <div><p className="section-kicker">{t.waitingList}</p><h2>{t.activeQueue}</h2></div>
            <span className="ops-count"><strong>{activeQueue.length}</strong> {t.activeCustomers}</span>
          </header>
          {activeQueue.length ? (
            <>
              <div className="ops-queue-columns" aria-hidden="true">
                <span>{t.tokenLabel}</span><span>{t.customerName}</span><span>{t.services}</span><span>{t.barberPreference}</span><span>{t.queueTime}</span><span>{t.statusLabel}</span><span>{t.actions}</span>
              </div>
              <div className="ops-queue-list">
                {activeQueue.map(entry => {
                  const waited = entry.status === 'Waiting' ? Math.max(0, Math.floor((now - new Date(entry.joinedAt).getTime()) / 60000)) : 0;
                  const calledEligible = entry.status === 'Called' && minutesSinceCall(entry) >= 10;
                  const assignedBarber = barberForEntry(entry);
                  const preferredBarber = entry.status === 'Waiting'
                    ? entry.barberId === 'any' ? t.anyBarber : state.barbers.find(barber => barber.id === entry.barberId)?.name ?? '—'
                    : assignedBarber?.name ?? '—';
                  return (
                    <article key={entry.id} className={`ops-queue-row status-row-${entry.status === 'In chair' ? 'in-chair' : entry.status.toLowerCase()} ${entry.status === 'Waiting' && waited > 60 ? 'ops-long-wait' : ''}`}>
                      <strong className="ops-row-token">{entry.token}</strong>
                      <div className="ops-row-customer"><strong>{entry.name}</strong><span className={`ops-status-badge badge-${entry.status === 'In chair' ? 'in-chair' : entry.status.toLowerCase()}`}><i aria-hidden="true" />{statusLabel(entry.status)}</span></div>
                      <p className="ops-row-services">{serviceNames(entry) || '—'}</p>
                      <p className="ops-row-barber">{preferredBarber}</p>
                      <p className="ops-row-time">{timeForEntry(entry)}{entry.status === 'Waiting' && waited > 60 && <span className="long-wait-label">{t.waitingOverHour}</span>}</p>
                      <span className={`ops-row-status status-text-${entry.status === 'In chair' ? 'in-chair' : entry.status.toLowerCase()}`}>{statusLabel(entry.status)}</span>
                      <div className="ops-row-actions">
                        {entry.status === 'Waiting' && <button type="button" disabled={pending} onClick={() => cancelEntry(entry)} className="ops-cancel-button">{t.cancelAction}</button>}
                        {entry.status === 'Called' && <button type="button" disabled={!calledEligible || pending} title={!calledEligible ? t.gracePeriod : undefined} aria-describedby={!calledEligible ? `no-show-reason-${entry.id}` : undefined} onClick={() => noShow(entry)} className="ops-no-show-button">{t.noShowAction}</button>}
                        {entry.status === 'In chair' && <span className="ops-action-placeholder" aria-hidden="true">—</span>}
                        {entry.status === 'Called' && !calledEligible && <span id={`no-show-reason-${entry.id}`} className="ops-action-hint">{t.gracePeriod}</span>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          ) : <div className="ops-empty-state"><span aria-hidden="true">✦</span><h3>{t.emptyWaiting}</h3><p>{t.emptyQueueHint}</p></div>}
        </section>
      </div>

      {toast && (
        <div key={toast.id} role={toast.kind === 'error' ? 'alert' : 'status'} aria-live={toast.kind === 'error' ? 'assertive' : 'polite'} className={`reception-toast toast-${toast.kind}`}>
          <span className="reception-toast-mark" aria-hidden="true">{toast.kind === 'error' ? '!' : '✓'}</span>
          <p>{toast.message}</p>
          <button type="button" aria-label={t.dismiss} onClick={() => setToast(null)}>×</button>
        </div>
      )}
    </main>
  );
}

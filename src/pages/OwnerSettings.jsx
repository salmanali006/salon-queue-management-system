import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { queueRepository } from '../data/storage.js';
import { onlineQueueOpen, todayStatistics, updateQueueSettings } from '../domain/customerQueue.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import CloudConnectionLabel from '../components/CloudConnectionLabel.jsx';

const activeStatuses = new Set(['Waiting', 'Called', 'In chair']);

export default function OwnerSettings() {
  const { t, language } = useLanguage();
  const [state, setState] = useState(() => queueRepository.read());
  const [now, setNow] = useState(Date.now());
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [closingDraft, setClosingDraft] = useState(null);
  const [pending, setPending] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const confirmButtonRef = useRef(null);
  const confirmationDialogRef = useRef(null);

  useEffect(() => queueRepository.subscribe(setState), []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!confirmation) return undefined;
    const previouslyFocused = document.activeElement;
    confirmButtonRef.current?.focus();
    const handleKeyDown = event => {
      if (event.key === 'Escape') setConfirmation(null);
      if (event.key === 'Tab') {
        const buttons = confirmationDialogRef.current?.querySelectorAll('button:not(:disabled)');
        if (!buttons?.length) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [Boolean(confirmation)]);

  const stats = todayStatistics(state, new Date(now));
  const onlineOpen = onlineQueueOpen(state, new Date(now));
  const queueSize = state.queue.filter(entry => activeStatuses.has(entry.status)).length;
  const dateLabel = new Date(now).toLocaleDateString(language === 'gu' ? 'gu-IN' : 'en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const timeLabel = new Date(now).toLocaleTimeString(language === 'gu' ? 'gu-IN' : 'en-IN', {
    hour: 'numeric', minute: '2-digit',
  });

  function showToast(message, kind = 'success') {
    setToast({ id: Date.now(), message, kind });
  }

  async function saveWith(operation, successMessage, key) {
    if (pending) return false;
    setPending(key);
    try {
      const result = await queueRepository.update(operation);
      if (!result.ok) {
        showToast(t[result.error] ?? t.updateFailed, 'error');
        return false;
      }
      showToast(successMessage);
      return true;
    } catch {
      showToast(t.updateFailed, 'error');
      return false;
    } finally {
      setPending(null);
    }
  }

  function startEditing(service) {
    setEditingId(service.id);
    setDraft({
      nameEn: service.name.en,
      nameGu: service.name.gu,
      durationMinutes: String(service.durationMinutes),
      priceInr: String(service.priceInr),
    });
  }

  function saveService(serviceId) {
    if (!draft) return;
    const savedDraft = { ...draft };
    const patch = {
      name: { en: savedDraft.nameEn, gu: savedDraft.nameGu },
      durationMinutes: Number(savedDraft.durationMinutes),
      priceInr: Number(savedDraft.priceInr),
    };
    setConfirmation({ message: t.confirmServiceEdit, onConfirm: async () => {
      const saved = await saveWith({ type: 'service', payload: { serviceId, patch } }, t.saved, `service-${serviceId}`);
      if (saved) {
        setEditingId(null);
        setDraft(null);
      }
    } });
  }

  function toggleService(service) {
    const active = !service.active;
    const patch = { active };
    setConfirmation({ message: active ? t.confirmActivateService : t.confirmDeactivateService, onConfirm: () => saveWith({ type: 'service', payload: { serviceId: service.id, patch } }, active ? t.serviceActivated : t.serviceDeactivated, `service-state-${service.id}`) });
  }

  function toggleBarberDuty(barber) {
    const onDuty = !barber.onDuty;
    setConfirmation({ message: onDuty ? t.confirmBarberOnDuty : t.confirmBarberOffDuty, onConfirm: () => saveWith({ type: 'barberDuty', payload: { barberId: barber.id, onDuty } }, onDuty ? t.barberMarkedOnDuty : t.barberMarkedOffDuty, `barber-${barber.id}`) });
  }

  async function toggleOnlineQueue(onlineOpenSetting) {
    const preview = updateQueueSettings(state, { onlineOpen: onlineOpenSetting });
    const successMessage = onlineOpenSetting && preview.ok && !onlineQueueOpen(preview.nextState, new Date(now))
      ? t.onlineQueueOpenHeldByCutoff
      : onlineOpenSetting ? t.onlineQueueOpened : t.onlineQueueClosed;
    if (state.settings.onlineOpen !== onlineOpenSetting) {
      const patch = { onlineOpen: onlineOpenSetting };
      setConfirmation({ message: onlineOpenSetting ? t.confirmOpenQueue : t.confirmCloseQueue, onConfirm: () => saveWith({ type: 'settings', payload: { patch } }, successMessage, 'online-queue') });
      return;
    }
    const patch = { onlineOpen: onlineOpenSetting };
    await saveWith({ type: 'settings', payload: { patch } }, successMessage, 'online-queue');
  }

  async function saveClosingTime(event) {
    event.preventDefault();
    if (closingDraft === null || !closingDraft) {
      showToast(t.invalidClosingTime, 'error');
      return;
    }
    const preview = updateQueueSettings(state, { closingTime: closingDraft });
    if (!preview.ok) {
      showToast(t[preview.error] ?? t.invalidClosingTime, 'error');
      return;
    }
    const commit = async () => {
      const patch = { closingTime: closingDraft };
      const saved = await saveWith({ type: 'settings', payload: { patch } }, t.closingTimeSaved, 'closing-time');
      if (saved) setClosingDraft(null);
    };
    if (onlineQueueOpen(state, new Date(now)) && !onlineQueueOpen(preview.nextState, new Date(now))) {
      setConfirmation({ message: t.confirmCutoffTime, onConfirm: commit });
      return;
    }
    await commit();
  }

  function barberAvailability(barber) {
    const active = state.queue.some(entry => entry.barberId === barber.id && ['Called', 'In chair'].includes(entry.status));
    if (active) return { label: t.busy, kind: 'busy' };
    if (barber.availability === 'break') return { label: t.onBreak, kind: 'break' };
    if (barber.onDuty) return { label: t.available, kind: 'available' };
    return { label: t.offDuty, kind: 'off-duty' };
  }

  return (
    <main className="owner-page page-enter">
      <div className="owner-shell">
        <header className="owner-heading">
          <div>
            <p className="section-kicker">{t.salonName} · {t.staffOnly}</p>
            <h1>{t.admin}</h1>
            <p>{t.adminIntro}</p>
            <span className="owner-date-line">{dateLabel} <i aria-hidden="true">·</i> {timeLabel}</span>
          </div>
          <Link to="/reception" className="owner-reception-link">{t.reception}<span aria-hidden="true">↗</span></Link>
        </header>

        <section className="owner-overview-section" aria-label={t.todayStats}>
          <div className="owner-overview-heading"><div><p className="section-kicker">{t.demoDerived}</p><h2>{t.todayStats}</h2></div><span className="owner-local-badge"><i aria-hidden="true" /><CloudConnectionLabel /></span></div>
          <div className="owner-overview-grid">
            <StatCard icon="✓" tone="served" label={t.customersServed} value={stats.served.toLocaleString(language === 'gu' ? 'gu-IN' : 'en-IN')} note={t.doneTodayOnly} />
            <StatCard icon="◷" tone="wait" label={t.averageActualWait} value={stats.averageWait === null ? t.noData : `${stats.averageWait} ${t.minutes}`} note={t.statsWaitNote} />
            <StatCard icon="!" tone="noshow" label={t.noShows} value={stats.noShows.toLocaleString(language === 'gu' ? 'gu-IN' : 'en-IN')} note={t.noShowsTodayOnly} />
            <StatCard icon="⌁" tone="queue" label={t.currentQueueSize} value={queueSize.toLocaleString(language === 'gu' ? 'gu-IN' : 'en-IN')} note={t.activeCustomers} />
          </div>
        </section>

        <section className="owner-settings-grid">
          <article className="owner-panel owner-services">
            <div className="owner-panel-heading owner-services-heading">
              <div><p className="section-kicker">01 · {t.ownerConfiguration}</p><h2>{t.serviceSettings}</h2></div>
              <p>{t.serviceHistoryNote}</p>
            </div>
            {state.services.length ? (
              <div className="owner-service-list">
                {state.services.map((service, index) => {
                  const editing = editingId === service.id;
                  const isSaving = pending === `service-${service.id}` || pending === `service-state-${service.id}`;
                  return (
                    <article key={service.id} className={`owner-service-card ${service.active ? 'service-card-is-active' : 'service-card-is-inactive'}`} style={{ '--owner-card-delay': `${index * 45}ms` }}>
                      <div className="owner-service-card-top">
                        <div className="owner-service-identity"><span className={`service-state ${service.active ? 'service-active' : ''}`}><i aria-hidden="true" />{service.active ? t.active : t.inactive}</span><strong>{service.name.en}</strong><span className="owner-service-gujarati">{service.name.gu}</span></div>
                        <label className="owner-switch owner-service-switch" aria-label={`${service.name.en}: ${service.active ? t.active : t.inactive}`}>
                          <input type="checkbox" checked={service.active} disabled={Boolean(pending) || editing} onChange={() => toggleService(service)} />
                          <span />
                        </label>
                      </div>

                      {editing && draft ? (
                        <form className="owner-service-edit-form" onSubmit={event => { event.preventDefault(); saveService(service.id); }}>
                          <div className="owner-service-fields">
                            <label>{t.nameEnglish}<input required className="form-input premium-input" value={draft.nameEn} onChange={event => setDraft(current => ({ ...current, nameEn: event.target.value }))} /></label>
                            <label>{t.nameGujarati}<input required className="form-input premium-input" value={draft.nameGu} onChange={event => setDraft(current => ({ ...current, nameGu: event.target.value }))} /></label>
                            <label>{t.duration}<span className="owner-input-with-unit"><input required type="number" min="1" step="1" className="form-input premium-input" value={draft.durationMinutes} onChange={event => setDraft(current => ({ ...current, durationMinutes: event.target.value }))} /><small>{t.minutes}</small></span></label>
                            <label>{t.price}<span className="owner-input-with-unit"><b>₹</b><input required type="number" min="0" step="1" className="form-input premium-input" value={draft.priceInr} onChange={event => setDraft(current => ({ ...current, priceInr: event.target.value }))} /></span></label>
                          </div>
                          <div className="owner-edit-actions">
                            <button type="button" className="owner-edit-cancel" disabled={Boolean(pending)} onClick={() => { setEditingId(null); setDraft(null); }}>{t.cancelEdit}</button>
                            <button type="submit" className="owner-edit-save" disabled={Boolean(pending)}>{isSaving ? t.savingChanges : t.saveChanges}<span aria-hidden="true">→</span></button>
                          </div>
                        </form>
                      ) : (
                        <div className="owner-service-readonly">
                          <div><span>{t.duration}</span><strong>{service.durationMinutes} {t.minutes}</strong></div>
                          <div><span>{t.price}</span><strong>₹{Number(service.priceInr).toLocaleString('en-IN')}</strong></div>
                          <button type="button" className="owner-edit-button" disabled={Boolean(pending)} onClick={() => startEditing(service)}><span aria-hidden="true">✎</span>{t.editService}</button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : <div className="owner-empty-state"><span aria-hidden="true">✦</span><p>{t.noServicesConfigured}</p></div>}
          </article>

          <div className="owner-side-panels">
            <article className="owner-panel owner-barbers-panel">
              <div className="owner-panel-heading"><div><p className="section-kicker">02 · {t.ownerConfiguration}</p><h2>{t.barbersOnDuty}</h2></div></div>
              <p className="owner-panel-intro">{t.dutyVsAvailability}</p>
              {state.barbers.length ? (
                <div className="owner-staff-list">
                  {state.barbers.map((barber, index) => {
                    const availability = barberAvailability(barber);
                    const isSaving = pending === `barber-${barber.id}`;
                    return (
                      <article key={barber.id} className="owner-staff-card">
                        <span className={`ops-avatar ops-avatar-${index % 3}`} aria-hidden="true">{barber.name[0]}</span>
                        <div className="owner-staff-name"><strong>{barber.name}</strong><span className={`owner-duty-badge ${barber.onDuty ? 'is-on-duty' : 'is-off-duty'}`}><i aria-hidden="true" />{barber.onDuty ? t.onDuty : t.offDuty}</span><small>{t.availability}: <b className={`availability-${availability.kind}`}>{availability.label}</b></small></div>
                        <label className="owner-switch owner-duty-switch" aria-label={`${barber.name}: ${barber.onDuty ? t.onDuty : t.offDuty}`}>
                          <input type="checkbox" checked={barber.onDuty} disabled={Boolean(pending)} onChange={() => toggleBarberDuty(barber)} />
                          <span />
                        </label>
                      </article>
                    );
                  })}
                </div>
              ) : <div className="owner-empty-state"><span aria-hidden="true">✦</span><p>{t.noBarbersConfigured}</p></div>}
            </article>

            <article className="owner-panel owner-queue-panel">
              <div className="owner-panel-heading"><div><p className="section-kicker">03 · {t.ownerConfiguration}</p><h2>{t.queueControls}</h2></div></div>
              <div className={`owner-queue-status-card ${onlineOpen ? 'queue-is-open' : 'queue-is-closed'}`}>
                <span className="owner-queue-status-dot" aria-hidden="true" />
                <div><strong>{onlineOpen ? t.onlineCurrentlyOpen : t.onlineCurrentlyClosed}</strong><p>{onlineOpen ? t.onlineOpenUntilCutoff : state.settings.onlineOpen ? t.onlineClosedByCutoffExplanation : t.onlineClosedExplanation}</p></div>
              </div>
              <label className="owner-queue-toggle">
                <span><strong>{t.onlineJoin}</strong><small>{state.settings.onlineOpen ? t.onlineSwitchManuallyOpen : t.onlineSwitchManuallyClosed}</small><small>{t.onlineJoinControlHint}</small></span>
                <span className="owner-switch"><input type="checkbox" checked={state.settings.onlineOpen} disabled={Boolean(pending)} onChange={event => toggleOnlineQueue(event.target.checked)} /><span /></span>
              </label>
              <div className="owner-closing-summary"><span>{t.closesAt}</span><strong>{state.settings.closingTime}</strong></div>
              <form className="owner-closing-form" onSubmit={saveClosingTime}>
                <label className="owner-closing-field">{t.configuredClosing}<input type="time" className="form-input premium-input" value={closingDraft ?? state.settings.closingTime} onChange={event => setClosingDraft(event.target.value)} /></label>
                {closingDraft !== null && closingDraft !== state.settings.closingTime && <button type="submit" className="owner-closing-save" disabled={Boolean(pending)}>{t.saveChanges}</button>}
              </form>
              <p className="owner-note owner-cutoff-note">{t.cutoffNote}</p>
              <p className="owner-note">{t.noOpeningTime}</p>
            </article>
          </div>
        </section>
      </div>

      {confirmation && (
        <div className="owner-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setConfirmation(null); }}>
          <section ref={confirmationDialogRef} className="owner-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="owner-confirm-title" aria-describedby="owner-confirm-message">
            <span className="owner-dialog-mark" aria-hidden="true">!</span>
            <h2 id="owner-confirm-title">{t.confirmActionTitle}</h2>
            <p id="owner-confirm-message">{confirmation.message}</p>
            <div className="owner-dialog-actions">
              <button type="button" className="owner-edit-cancel" onClick={() => setConfirmation(null)}>{t.keepSettings}</button>
              <button ref={confirmButtonRef} type="button" className="owner-edit-save" onClick={() => { const action = confirmation.onConfirm; setConfirmation(null); action(); }}>{t.confirmChange}</button>
            </div>
          </section>
        </div>
      )}
      {toast && <div key={toast.id} className={`owner-toast toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'} aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}><span aria-hidden="true">{toast.kind === 'error' ? '!' : '✓'}</span><p>{toast.message}</p><button type="button" aria-label={t.dismiss} onClick={() => setToast(null)}>×</button></div>}
    </main>
  );
}

function StatCard({ icon, tone, label, value, note }) {
  return <article className={`owner-overview-card overview-${tone}`}><span className="owner-overview-icon" aria-hidden="true">{icon}</span><p>{label}</p><strong>{value}</strong><small>{note}</small></article>;
}

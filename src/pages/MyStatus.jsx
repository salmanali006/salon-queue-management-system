import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { queueRepository } from '../data/storage.js';
import { getCustomerQueueStatus } from '../domain/customerQueue.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function MyStatus() {
  const { id } = useParams(); const { t, language } = useLanguage();
  const [state, setState] = useState(() => queueRepository.read()); const [error, setError] = useState(''); const [cancelling, setCancelling] = useState(false);
  useEffect(() => queueRepository.subscribe(setState), []);
  const { entry, position, waitMinutes } = getCustomerQueueStatus(state, id);
  async function cancel() {
    if (cancelling || !window.confirm(t.cancelConfirm)) return;
    setCancelling(true);
    setError('');
    try {
      const result = await queueRepository.update({ type: 'cancel', payload: { entryId: id } });
      if (!result.ok) {
        setState(queueRepository.read());
        setError(result.error === 'notWaiting' ? t.cancelUnavailable : t[result.error] ?? t.cloudUnavailable);
        return;
      }
    } catch {
      setError(t.cloudUnavailable);
    } finally {
      setCancelling(false);
    }
  }
  const statusLabels = { Waiting: t.waiting, Called: t.called, 'In chair': t.inChair, Done: t.done, Cancelled: t.cancelled, 'No-show': t.noShow };
  const barber = state.barbers.find(item => item.id === entry?.barberId);
  const waitingCount = state.queue.filter(item => item.status === 'Waiting').length;
  const aheadCount = position === null ? null : Math.max(0, position - 1);
  const progress = position ? Math.max(0, Math.min(100, ((waitingCount - aheadCount) / Math.max(waitingCount, 1)) * 100)) : 0;
  const activeStep = ['Waiting', 'Called', 'In chair', 'Done'].indexOf(entry?.status);
  const barberStatus = !barber ? t.notAssigned : !barber.onDuty ? t.offDuty : barber.availability === 'break' ? t.onBreak : state.queue.some(item => item.barberId === barber.id && ['Called', 'In chair'].includes(item.status)) ? t.busy : t.available;
  return <main className="status-page page-enter">
    <Link to="/" className="back-link">← {t.goBack}</Link>
    {!entry ? <article className="status-missing"><span className="status-missing-icon">?</span><p className="section-kicker">{t.brand}</p><h1>{t.status}</h1><p>{t.missingToken}</p></article> : <article className={`status-card status-state-${entry.status.toLowerCase().replace(/\s+/g,'-')}`}>
      <div className="status-topline"><span className="section-kicker">{t.liveQueue}</span><span className={`status-chip chip-${entry.status.toLowerCase().replace(/\s+/g,'-')}`}><i />{statusLabels[entry.status] ?? entry.status}</span></div>
      <div className="status-token-block"><p>{t.yourToken}</p><h1>{entry.token}</h1><span>{entry.name}</span></div>
      {entry.status === 'Waiting' && <section className="status-estimate-grid"><div className="status-metric position-metric"><span>{t.position}</span><strong key={position} className="position-number">{position}</strong><small>{aheadCount === 0 ? t.noCustomersAhead : `${aheadCount} ${t.customersAhead}`}</small></div><div className="status-metric status-metric-gold wait-metric"><span>{t.approxWait}</span><div className="wait-indicator"><strong>{waitMinutes === null ? '—' : waitMinutes}</strong></div><small>{waitMinutes === null ? t.noEstimate : t.minutes}</small></div></section>}
      {entry.status === 'Waiting' && <div className="queue-progress"><div className="progress-labels"><span>{t.queueProgress}</span><strong>{t.position} {position} / {waitingCount}</strong></div><div className="progress-track" role="progressbar" aria-label={t.queueProgress} aria-valuemin="0" aria-valuemax={waitingCount} aria-valuenow={position}><span key={position} style={{ width: `${progress}%` }} /></div><div className="progress-steps"><span className={activeStep >= 0 ? 'step-active' : ''}>{t.waiting}</span><span className={position === 2 ? 'step-next' : ''}>{position === 2 ? t.startComing : t.called}</span><span>{t.inChair}</span></div></div>}
      {entry.status === 'Waiting' && position === 2 && <div className="status-callout callout-next"><span>✦</span><p>{t.startComing}</p></div>}
      {entry.status === 'Called' && <div className="status-callout callout-called"><span>✦</span><div><p>{t.itsYourTurn}</p><strong>{t.goTo} {barber?.name ?? '—'}</strong></div></div>}
      {entry.status === 'In chair' && <div className="status-callout callout-chair"><span>✦</span><p>{t.serviceInProgress}</p></div>}
      {entry.status === 'Done' && <div className="status-callout callout-done"><span>✓</span><p>{t.completedMessage}</p></div>}
      {['Cancelled', 'No-show'].includes(entry.status) && <div className="status-callout callout-ended"><span>–</span><p>{t.spotEnded}</p></div>}
      <div className="status-details"><div><span>{t.services}</span><p>{(entry.services ?? []).map(service => service.name?.[language] ?? service.name?.en ?? service.name).join(' · ')}</p></div><div className="assigned-barber"><span>{entry.barberId === 'any' && entry.status === 'Waiting' ? t.barberPreference : t.assignedBarber}</span><p>{entry.barberId === 'any' && entry.status === 'Waiting' ? t.anyBarber : barber?.name ?? t.unavailableBarber}</p>{barber && <small className={`assigned-barber-state ${barberStatus === t.busy ? 'assigned-busy' : ''}`}><i />{barberStatus}</small>}{entry.barberId === 'any' && entry.status === 'Waiting' && <small className="assigned-barber-state">{t.barberAssignedWhenCalled}</small>}</div><div><span>{t.duration}</span><p>{entry.durationMinutes} {t.minutes}</p></div></div>
      {entry.status === 'Waiting' && <p className="status-disclaimer">{t.estimateDisclaimer}</p>}
      {error && <p role="alert" className="form-error status-error">{error}</p>}
      {entry.status === 'Waiting' && <button disabled={cancelling} onClick={cancel} className="cancel-secondary">{cancelling ? t.cancellingSpot : t.cancelSpot}</button>}
    </article>}
    <p className="status-local-note">{t.cloudDisclosure}</p>
  </main>;
}

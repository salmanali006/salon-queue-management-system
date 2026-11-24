import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { queueRepository } from '../data/storage.js';
import { activeServices, eligibleBarbers, estimateForNewJoin, onlineQueueOpen, serviceTotals } from '../domain/customerQueue.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function JoinQueue() {
  const { t, language } = useLanguage(); const navigate = useNavigate();
  const [state, setState] = useState(() => queueRepository.getSnapshot());
  const [now, setNow] = useState(Date.now());
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [serviceIds, setServiceIds] = useState([]); const [barberId, setBarberId] = useState('any'); const [error, setError] = useState(''); const [duplicate, setDuplicate] = useState(null); const [saving, setSaving] = useState(false);
  useEffect(() => queueRepository.subscribe(setState), []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const activeServiceIds = new Set(activeServices(state).map(service => service.id));
    const eligibleBarberIds = new Set(eligibleBarbers(state).map(barber => barber.id));
    setServiceIds(current => {
      const remaining = current.filter(id => activeServiceIds.has(id));
      return remaining.length === current.length ? current : remaining;
    });
    setBarberId(current => current === 'any' || eligibleBarberIds.has(current) ? current : 'any');
  }, [state]);
  const services = activeServices(state); const barbers = eligibleBarbers(state); const totals = serviceTotals(services.filter(service => serviceIds.includes(service.id))); const wait = estimateForNewJoin(state); const open = onlineQueueOpen(state, new Date(now));
  function toggleService(id) { setError(''); setDuplicate(null); setServiceIds(current => current.includes(id) ? current.filter(item => item !== id) : current.length < 3 ? [...current, id] : (setError('serviceLimit'), current)); }
  async function submit(event) {
    event.preventDefault(); setError(''); setDuplicate(null);
    if (saving) return;
    setSaving(true);
    try {
      const input = { name, phone, serviceIds, barberId };
      const result = await queueRepository.update({ type: 'join', payload: { input, requestId: crypto.randomUUID() } });
      if (!result.ok) {
        if (result.duplicate) setDuplicate(result.duplicate);
        else setError(result.error === 'saveFailed' ? 'localSaveError' : result.error ?? 'cloudUnavailable');
        return;
      }
      navigate(`/status/${result.entry.id}`);
    } catch {
      setError('localSaveError');
    } finally {
      setSaving(false);
    }
  }
  const errorText = error ? t[error] : '';
  return <main className="join-page page-enter">
    <header className="join-intro"><Link to="/" className="back-link">← {t.goBack}</Link><p className="section-kicker">{t.joinKicker}</p><h1>{t.join}</h1><p>{t.joinExplanation}</p></header>
    {!open && <div className="form-notice" role="status"><span>⌁</span><p>{t.queueClosed}<small>{t.walkinStillAvailable}</small></p></div>}
    <form className="join-layout" onSubmit={submit}>
      <div className="join-form-main">
        <section className="form-section"><div className="form-section-title"><span>01</span><div><h2>{t.yourDetails}</h2><p>{t.detailsPrivacy}</p></div></div><div className="form-fields"><label className="field-label">{t.name}<input className="form-input premium-input" value={name} onChange={event => setName(event.target.value)} autoComplete="name" placeholder={t.namePlaceholder} /></label><label className="field-label">{t.phone}<input className="form-input premium-input" value={phone} onChange={event => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="98765 43210" /></label></div></section>

        <fieldset className="form-section"><legend className="form-section-title"><span>02</span><div><h2>{t.services}</h2><p>{t.servicesHint} <b>{serviceIds.length}/3</b></p></div></legend><div className="service-grid">{services.map((service, index) => { const selected = serviceIds.includes(service.id); return <label key={service.id} className={`premium-service-card ${selected ? 'premium-service-selected' : ''}`} style={{ '--card-delay': `${index * 45}ms` }}><input type="checkbox" checked={selected} onChange={() => toggleService(service.id)} disabled={!selected && serviceIds.length >= 3} /><span className="service-check" aria-hidden="true">{selected ? '✓' : '+'}</span><span className="service-copy"><strong>{service.name[language]}</strong><span>{service.durationMinutes} {t.minutes}</span></span><b className="service-price">₹{service.priceInr.toLocaleString('en-IN')}</b></label>; })}</div></fieldset>

        <fieldset className="form-section"><legend className="form-section-title"><span>03</span><div><h2>{t.barberPreference}</h2><p>{t.barberChoiceHint}</p></div></legend><div className="barber-choice-grid"><label className={`barber-choice-card ${barberId === 'any' ? 'choice-selected' : ''}`}><input type="radio" name="barber" checked={barberId === 'any'} onChange={() => setBarberId('any')} /><span className="choice-avatar any-avatar">✦</span><span><strong>{t.anyBarber}</strong><small>{t.anyBarberHint}</small></span><i>{barberId === 'any' ? '✓' : ''}</i></label>{state.barbers.map(barber => { const enabled = barbers.some(candidate => candidate.id === barber.id); const selected = barberId === barber.id; return <label key={barber.id} className={`barber-choice-card ${selected ? 'choice-selected' : ''} ${!enabled ? 'choice-disabled' : ''}`}><input type="radio" name="barber" checked={selected} disabled={!enabled} onChange={() => setBarberId(barber.id)} /><span className="choice-avatar">{barber.name.slice(0, 1)}</span><span><strong>{barber.name}</strong><small>{enabled ? t.available : t.unavailableBarber}</small></span><i>{selected ? '✓' : ''}</i></label>; })}</div></fieldset>
      </div>

      <aside className="booking-summary"><div className="summary-heading"><span className="summary-mark">S</span><div><p>{t.salonName}</p><h2>{t.bookingSummary}</h2></div></div><div className="summary-service-count">{serviceIds.length} {t.servicesSelected}</div><div className="summary-line"><span>{t.duration}</span><strong>{totals.minutes} {t.minutes}</strong></div><div className="summary-line"><span>{t.price}</span><strong>₹{totals.price.toLocaleString('en-IN')}</strong></div><div className="summary-wait"><span>{t.expectedWait}</span><strong>{wait === null ? t.noEstimate : <>{wait} {t.minutes}</>}</strong></div><p className="summary-disclaimer">{t.estimateDisclaimerShort}</p>
        {(errorText || duplicate) && <div role="alert" className="form-error">{duplicate ? <>{t.duplicate} <strong>{duplicate.token}</strong><Link to={`/status/${duplicate.id}`}>{t.viewExisting} ↗</Link></> : <>{errorText}<span>{t.fixFieldsHint}</span></>}</div>}
        <button disabled={!open || saving} className="button-primary submit-join">{saving ? t.saving : t.confirmJoin}<span aria-hidden="true">↗</span></button>
        <p className="summary-reassurance">{t.noPayment}</p>
      </aside>
    </form>
  </main>;
}

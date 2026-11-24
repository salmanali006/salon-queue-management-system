import { useQueueConnection } from '../data/QueueConnectionContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function CloudConnectionLabel({ className = '' }) {
  const { t } = useLanguage();
  const { status } = useQueueConnection();
  const label = status === 'connected' ? t.sharedLiveQueue
    : status === 'connecting' ? t.cloudConnecting
      : status === 'unconfigured' ? t.cloudSetupRequired
        : t.cloudReconnecting;
  return <span className={className} data-cloud-status={status}>{label}</span>;
}

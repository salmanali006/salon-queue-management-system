import { createContext, useContext, useEffect, useState } from 'react';
import { queueRepository } from './storage.js';

const QueueConnectionContext = createContext(queueRepository.connection);

export function QueueConnectionProvider({ children }) {
  const [connection, setConnection] = useState(queueRepository.connection);

  useEffect(() => {
    const unsubscribe = queueRepository.subscribeConnection(setConnection);
    const stop = queueRepository.start();
    return () => { unsubscribe(); stop(); };
  }, []);

  return <QueueConnectionContext.Provider value={connection}>{children}</QueueConnectionContext.Provider>;
}

export function useQueueConnection() {
  return useContext(QueueConnectionContext);
}

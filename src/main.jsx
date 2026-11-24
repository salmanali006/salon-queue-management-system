import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { LanguageProvider } from './i18n/LanguageContext.jsx';
import { QueueConnectionProvider } from './data/QueueConnectionContext.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><LanguageProvider><QueueConnectionProvider><BrowserRouter><App /></BrowserRouter></QueueConnectionProvider></LanguageProvider></React.StrictMode>);

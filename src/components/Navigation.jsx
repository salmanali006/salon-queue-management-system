import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import CloudConnectionLabel from './CloudConnectionLabel.jsx';

const barbers = [
  { id: 'ravi', name: 'Ravi' },
  { id: 'amit', name: 'Amit' },
  { id: 'imran', name: 'Imran' },
];

const links = [
  { to: '/', key: 'home' },
  { to: '/join', key: 'join' },
  { to: '/reception', key: 'reception' },
  { to: '/display', key: 'display' },
  { to: '/admin', key: 'admin' },
];

function linkClass({ isActive }) {
  return `navigation-link${isActive ? ' navigation-link-active' : ''}`;
}

export default function Navigation() {
  const { t, language, toggleLanguage } = useLanguage();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const barberActive = pathname.startsWith('/barber/');
  const closeMenu = () => setMenuOpen(false);

  return <header className={`site-header${pathname === '/display' ? ' tv-navigation-hidden' : ''}`}>
    <div className="site-header-inner">
      <Link to="/" className="site-brand" onClick={closeMenu}>{t.brand}</Link>

      <nav className="desktop-navigation" aria-label={t.primaryNavigation}>
        {links.slice(0, 3).map(item => <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>{t[item.key]}</NavLink>)}
        <details className={`barber-menu${barberActive ? ' barber-menu-active' : ''}`}>
          <summary className="navigation-link">{t.barber}</summary>
          <div className="barber-menu-options">{barbers.map(barber => <NavLink key={barber.id} to={`/barber/${barber.id}`} className={linkClass}>{barber.name}</NavLink>)}</div>
        </details>
        {links.slice(3).map(item => <NavLink key={item.to} to={item.to} className={linkClass}>{t[item.key]}</NavLink>)}
      </nav>

      <div className="desktop-navigation-tools">
        <CloudConnectionLabel className="local-pill" />
        <button className="touch-button language-toggle" onClick={toggleLanguage} aria-label={t.language}>{language === 'en' ? 'EN | ગુજરાતી' : 'ગુજરાતી | EN'}</button>
      </div>

      <button className="menu-toggle" type="button" aria-label={menuOpen ? t.closeNavigation : t.openNavigation} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(open => !open)}>
        <span className={`menu-icon${menuOpen ? ' menu-icon-open' : ''}`} aria-hidden="true"><i /><i /><i /></span>
      </button>
    </div>

    <div id="mobile-navigation" className={`mobile-navigation${menuOpen ? ' mobile-navigation-open' : ''}`} aria-hidden={!menuOpen}>
      <nav className="mobile-navigation-links" aria-label={t.primaryNavigation}>
        {links.slice(0, 3).map(item => <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass} onClick={closeMenu}>{t[item.key]}</NavLink>)}
        <div className={`mobile-barber-group${barberActive ? ' mobile-barber-active' : ''}`}>
          <span className="mobile-group-label">{t.barber}</span>
          {barbers.map(barber => <NavLink key={barber.id} to={`/barber/${barber.id}`} className={linkClass} onClick={closeMenu}>{barber.name}</NavLink>)}
        </div>
        {links.slice(3).map(item => <NavLink key={item.to} to={item.to} className={linkClass} onClick={closeMenu}>{t[item.key]}</NavLink>)}
        <button className="touch-button language-toggle mobile-language-toggle" onClick={() => { toggleLanguage(); closeMenu(); }}>{language === 'en' ? 'EN | ગુજરાતી' : 'ગુજરાતી | EN'}</button>
        <CloudConnectionLabel className="local-pill mobile-local-pill" />
      </nav>
    </div>
  </header>;
}

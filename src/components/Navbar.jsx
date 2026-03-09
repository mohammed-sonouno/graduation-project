import { useState, useEffect, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isAdmin, isDean, isSupervisor, isCommunityLeader, isStudent, DEAN_DISPLAY_NAME, SUPERVISOR_DISPLAY_NAME, COMMUNITY_LEADER_DISPLAY_NAME, STUDENT_DISPLAY_NAME } from "../utils/permissions";
import { getNotifications, markNotificationRead, createWelcomeNotification } from "../api";

const centerLinks = [
  { to: "/", label: "Home", end: true },
  { to: "/colleges", label: "Colleges" },
  { to: "/majors", label: "Majors" },
  { to: "/events", label: "Events" },
  { to: "/admin", label: "Admin Portal", adminOnly: true },
  { to: "/manage-events", label: "Manage Events", leaderOrAdmin: true },
  { to: "/event-approval", label: "Event Approval", approvalFlow: true },
];

function LogoPlaceholder({ className = "" }) {
  return (
    <img
      src="/main-logo.png"
      alt="Main Logo - An-Najah National University"
      className={`flex-shrink-0 object-contain ${className}`}
      style={{ height: "100%", width: "auto" }}
    />
  );
}

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [logoError, setLogoError] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const avatarRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    getNotifications()
      .then((list) => {
        setNotifications(Array.isArray(list) ? list : []);
        if (Array.isArray(list) && list.length === 0) {
          createWelcomeNotification().then((n) => n && setNotifications((prev) => [n, ...prev])).catch(() => {});
        }
      })
      .catch(() => setNotifications([]));
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!notificationOpen) return;
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [notificationOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    const unread = notifications.filter((n) => !n.read);
    unread.forEach((n) => markNotificationRead(n.id).catch(() => {}));
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    setOpen(false);
    setMenuOpen(false);
    logout();
    navigate("/login", { replace: true });
  };

  const userInitial = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?";
  const admin = isAdmin(user);
  const dean = isDean(user);
  const supervisor = isSupervisor(user);
  const communityLeader = isCommunityLeader(user);
  const roleLabel = admin ? "Administrator" : dean ? DEAN_DISPLAY_NAME : supervisor ? SUPERVISOR_DISPLAY_NAME : communityLeader ? COMMUNITY_LEADER_DISPLAY_NAME : isStudent(user) ? STUDENT_DISPLAY_NAME : null;
  const visibleCenterLinks = centerLinks.filter(
    (link) =>
      !(link.adminOnly && !admin) &&
      !(link.deanOrAdmin && !admin && !dean && !communityLeader) &&
      !(link.leaderOrAdmin && !admin && !communityLeader) &&
      !(link.approvalFlow && !admin && !dean && !supervisor && !communityLeader)
  );

  const centerLinkClass = ({ isActive }) =>
    `relative text-sm font-medium tracking-wide transition-all duration-200 pb-1 group
    ${isActive
      ? "text-[#00356b] font-semibold"
      : "text-slate-600 hover:text-[#00356b]"
    }`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Scheherazade+New:wght@500;700&display=swap');

        .nav-link-underline::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 0;
          height: 2px;
          background: #00356b;
          transition: width 0.25s ease;
        }
        .nav-link-underline:hover::after,
        .nav-link-underline.active::after {
          width: 100%;
        }
        .nav-link-underline.active::after {
          width: 100%;
        }

        .navbar-scrolled {
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 1px 20px rgba(0, 0, 0, 0.08);
          border-bottom: 1px solid rgba(0, 53, 107, 0.08);
        }
        .navbar-top {
          background: #ffffff;
          border-bottom: 1px solid #e8edf2;
        }

        .login-btn {
          font-family: 'Libre Baskerville', serif;
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          padding: 0.35rem 1.2rem;
          color: #00356b;
          background: transparent;
          border: 1px solid rgba(0,53,107,0.35);
          border-radius: 20px;
          text-decoration: none;
          transition: all 0.22s ease;
          display: inline-block;
          cursor: pointer;
        }
        .login-btn:hover {
          border-color: #00356b;
          background: #00356b;
          color: #ffffff;
        }

        .nav-text {
          font-family: 'EB Garamond', serif;
          font-size: 1.15rem;
          font-weight: 500;
          letter-spacing: 0.02em;
        }

        .brand-ar {
          font-family: 'Scheherazade New', serif;
          font-size: 1.35rem;
          font-weight: 700;
          color: #00356b;
          line-height: 1.2;
        }
        .brand-en {
          font-family: 'Libre Baskerville', serif;
          font-size: 0.58rem;
          font-weight: 400;
          font-style: italic;
          letter-spacing: 0.05em;
          color: #64748b;
        }

        .mobile-menu {
          background: rgba(255,255,255,0.98);
          backdrop-filter: blur(12px);
        }
      `}</style>

      <header
        className={`sticky top-0 z-50 w-full transition-all duration-300 ${
          scrolled ? "navbar-scrolled" : "navbar-top"
        }`}
      >
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-10 flex items-center justify-between gap-4"
          style={{ height: scrolled ? '54px' : '62px', transition: 'height 0.3s ease' }}
        >
          {/* Brand */}
          <NavLink to="/" className="flex items-center gap-3 lg:gap-4 flex-shrink-0 min-w-0" style={{ textDecoration: 'none' }}>
            <div className="flex items-center gap-3 flex-shrink-0">
              {logoError ? (
                <LogoPlaceholder className={scrolled ? "h-11 w-11" : "h-13 w-13"} />
              ) : (
                <img
                  src="/main-logo.png"
                  alt="Main Logo - An-Najah National University"
                  style={{
                    height: scrolled ? '50px' : '60px',
                    width: 'auto',
                    objectFit: 'contain',
                    transition: 'height 0.3s ease',
                    flexShrink: 0
                  }}
                  onError={() => setLogoError(true)}
                />
              )}
              <div className="flex flex-col leading-tight min-w-0">
                <span className="brand-ar" dir="rtl">جامعة النجاح الوطنية</span>
                <span className="brand-en">An-Najah National University</span>
              </div>
            </div>
          </NavLink>

          {/* Center links — desktop only */}
          <nav className="hidden lg:flex flex-1 justify-center gap-8 xl:gap-10 min-w-0" aria-label="Main">
            {visibleCenterLinks.map(({ to, label, end }) => (
              <NavLink
                key={label}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `nav-text nav-link-underline relative pb-1 transition-all duration-200
                  ${isActive ? "text-[#00356b] font-semibold active" : "text-slate-600 hover:text-[#00356b]"}`
                }
                style={{ textDecoration: 'none' }}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Right side: auth + notifications */}
          <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
            {user ? (
              <>
                <div className="relative" ref={notifRef}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setNotificationOpen((o) => !o); setOpen(false); }}
                    className="relative p-2 rounded-full text-slate-600 hover:text-[#00356b] hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 transition-colors"
                    aria-expanded={notificationOpen}
                    aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" aria-hidden />
                    )}
                  </button>
                  {notificationOpen && (
                    <div className="absolute right-0 mt-2 w-80 max-h-[min(24rem,70vh)] bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50 flex flex-col">
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900">Notifications</span>
                        {unreadCount > 0 && (
                          <button type="button" onClick={markAllRead} className="text-xs font-medium text-[#00356b] hover:underline">
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {notifications.length === 0 ? (
                          <p className="px-4 py-6 text-sm text-slate-500 text-center">No notifications yet.</p>
                        ) : (
                          <ul className="py-2">
                            {notifications.map((n) => (
                              <li key={n.id} className={`px-4 py-3 border-b border-slate-50 last:border-0 ${!n.read ? "bg-[#00356b]/5" : ""}`}>
                                <p className="text-sm font-medium text-slate-900">{n.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative" ref={avatarRef}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setNotificationOpen(false); setOpen((o) => !o); }}
                  className="relative h-10 w-10 rounded-full bg-blue-900 text-white font-semibold flex items-center justify-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-900/30 focus:ring-offset-2"
                  aria-expanded={open}
                  aria-haspopup="true"
                  aria-label="User menu"
                >
                  <span>{userInitial}</span>
                  {admin && (
                    <span
                      className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white"
                      aria-hidden
                    />
                  )}
                </button>
                {open && (
                  <div
                    className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50"
                    role="menu"
                  >
                    <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100">
                      <div className="relative flex-shrink-0 h-10 w-10 rounded-full bg-blue-900 text-white font-semibold flex items-center justify-center text-sm">
                        <span>{userInitial}</span>
                        {admin && (
                          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{user?.name || 'User'}</p>
                        <p className="text-xs text-slate-500 truncate">{user?.email || ''}</p>
                        {roleLabel && <p className="text-[10px] font-medium text-[#00356b] mt-0.5">{roleLabel}</p>}
                      </div>
                    </div>
                    <NavLink
                      to="/profile"
                      end
                      className="block px-4 py-2 text-sm text-slate-700 hover:bg-gray-100 cursor-pointer transition-colors"
                      style={{ textDecoration: 'none' }}
                      onClick={() => setOpen(false)}
                      role="menuitem"
                    >
                      Profile
                    </NavLink>
                    <button
                      type="button"
                      onClick={() => { setOpen(false); setShowLogoutConfirm(true); }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer transition-colors border-t border-slate-100 font-medium"
                      role="menuitem"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
              </>
            ) : (
              <NavLink
                to="/login"
                end
                className="login-btn"
                style={{ textDecoration: 'none' }}
              >
                Login
              </NavLink>
            )}
          </div>

          {/* Mobile: hamburger */}
          <div className="flex lg:hidden items-center gap-2 flex-shrink-0">
            <button
              type="button"
              className="p-2 rounded-md text-slate-600 hover:text-[#00356b] hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 transition-colors"
              aria-expanded={menuOpen}
              aria-controls="nav-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile dropdown panel */}
        <div
          id="nav-menu"
          className={`lg:hidden overflow-hidden transition-all duration-300 ${
            menuOpen ? "max-h-[80vh] opacity-100" : "max-h-0 opacity-0"
          }`}
          aria-hidden={!menuOpen}
        >
          <nav
            className="mobile-menu border-t border-slate-100 shadow-lg mx-4 mb-4 rounded-lg border border-slate-200 py-4 px-4"
            aria-label="Mobile"
          >
            <ul className="flex flex-col gap-1">
              {visibleCenterLinks.map(({ to, label, end }) => (
                <li key={label}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `block py-3 px-4 rounded-md nav-text transition-colors duration-150
                      ${isActive
                        ? "font-semibold text-[#00356b] bg-blue-50/60"
                        : "text-slate-600 hover:text-[#00356b] hover:bg-slate-50"
                      }`
                    }
                    style={{ textDecoration: 'none' }}
                    onClick={() => setMenuOpen(false)}
                  >
                    {label}
                  </NavLink>
                </li>
              ))}
              <li className="border-t border-slate-100 mt-2 pt-3 flex flex-col gap-2">
                {user ? (
                  <>
                    <NavLink
                      to="/profile"
                      end
                      className="block py-3 px-4 rounded-md nav-text text-slate-600 hover:text-[#00356b] hover:bg-slate-50 transition-colors"
                      style={{ textDecoration: 'none' }}
                      onClick={() => setMenuOpen(false)}
                    >
                      Profile
                    </NavLink>
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); setShowLogoutConfirm(true); }}
                      className="w-full text-center py-3 px-4 rounded-md text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <NavLink
                    to="/login"
                    end
                    className="login-btn text-center"
                    style={{ textDecoration: 'none', textAlign: 'center' }}
                    onClick={() => setMenuOpen(false)}
                  >
                    Login
                  </NavLink>
                )}
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {/* Logout confirmation modal */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/30"
          aria-modal="true"
          role="dialog"
          aria-labelledby="logout-confirm-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden border-l-4 border-l-[#00356b]">
            <div className="p-6">
              <h2 id="logout-confirm-title" className="text-lg font-semibold text-[#0b2d52]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                Log out?
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Are you sure you want to log out?
              </p>
              <div className="mt-6 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Navbar;
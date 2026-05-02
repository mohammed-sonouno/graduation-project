import { useState, useEffect, useRef, useMemo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { eventImageUrl } from "../lib/api";
import { isAdmin, isDean, isSupervisor, isCommunityLeader, isStudent, isStaff, DEAN_DISPLAY_NAME, SUPERVISOR_DISPLAY_NAME, COMMUNITY_LEADER_DISPLAY_NAME, STUDENT_DISPLAY_NAME } from "../utils/permissions";
import { getNotifications, markNotificationRead, createWelcomeNotification } from "../lib/api";
import { COLLEGES_ROUTE_PREFIX } from "../utils/facultySlug";

const centerLinks = [
  { to: "/", label: "Home", end: true },
  { to: COLLEGES_ROUTE_PREFIX, label: "Faculties" },
  { to: "/majors", label: "Programs" },
  { to: "/events", label: "Events" },
  { to: "/communities", label: "Communities", requireAuth: true },
  { to: "/admin", label: "Admin Portal", staffOnly: true },
];

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
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const notificationsFetchedForRef = useRef(null);
  useEffect(() => {
    if (!user) { setNotifications([]); notificationsFetchedForRef.current = null; return; }
    if (notificationsFetchedForRef.current === user.id) return;
    notificationsFetchedForRef.current = user.id;
    getNotifications()
      .then((list) => {
        setNotifications(Array.isArray(list) ? list : []);
        if (Array.isArray(list) && list.length === 0) {
          createWelcomeNotification().then((n) => n && setNotifications((p) => [n, ...p])).catch(() => {});
        }
      })
      .catch(() => setNotifications([]));
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (avatarRef.current && !avatarRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [open]);

  useEffect(() => {
    if (!notificationOpen) return;
    const h = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotificationOpen(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [notificationOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    notifications.filter((n) => !n.read).forEach((n) => markNotificationRead(n.id).catch(() => {}));
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleLogout = () => {
    setShowLogoutConfirm(false); setOpen(false); setMenuOpen(false);
    logout(); navigate("/login", { replace: true });
  };

  const userInitial = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?";
  const avatarSrc = useMemo(() => (user?.picture ? eventImageUrl(user.picture) : null), [user?.picture]);
  const [avatarImageError, setAvatarImageError] = useState(false);
  useEffect(() => { setAvatarImageError(false); }, [user?.picture]);

  const admin = isAdmin(user);
  const dean = isDean(user);
  const supervisor = isSupervisor(user);
  const communityLeader = isCommunityLeader(user);
  const roleLabel = admin ? "Administrator"
    : dean ? DEAN_DISPLAY_NAME
    : supervisor ? SUPERVISOR_DISPLAY_NAME
    : communityLeader ? COMMUNITY_LEADER_DISPLAY_NAME
    : isStudent(user) ? STUDENT_DISPLAY_NAME : null;

  const isStaffUser = isStaff(user);
  const visibleCenterLinks = centerLinks.filter(
    (l) => !(l.staffOnly && !isStaffUser) && !(l.requireAuth && !user)
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Scheherazade+New:wght@500;700&display=swap');

        .navbar-base {
          background: #ffffff;
          border-bottom: 1px solid #d4d9e0;
        }
        .navbar-scrolled {
          background: rgba(255,255,255,0.97);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid #d4d9e0;
          box-shadow: 0 2px 16px rgba(0,0,0,0.06);
        }

        .brand-ar {
          font-family: 'Scheherazade New', serif;
          font-size: 1.25rem;
          font-weight: 700;
          color: #00356b;
          line-height: 1.25;
        }
        .brand-en {
          font-family: 'Libre Baskerville', serif;
          font-size: 0.54rem;
          font-weight: 400;
          font-style: italic;
          letter-spacing: 0.05em;
          color: #8494a8;
        }

        .nav-item {
          font-family: 'Libre Baskerville', Georgia, serif;
          font-size: 0.72rem;
          font-weight: 400;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: #526070;
          text-decoration: none;
          position: relative;
          padding-bottom: 3px;
          transition: color 0.18s ease;
          white-space: nowrap;
        }
        .nav-item::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 0;
          height: 1.5px;
          background: #00356b;
          transition: width 0.22s ease;
        }
        .nav-item:hover { color: #00356b; }
        .nav-item:hover::after { width: 100%; }
        .nav-item.nav-active {
          color: #00356b;
          font-weight: 700;
        }
        .nav-item.nav-active::after { width: 100%; }

        .login-btn {
          font-family: 'Libre Baskerville', serif;
          font-size: 0.64rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 0.42rem 1.35rem;
          color: #00356b;
          background: transparent;
          border: 1.5px solid #00356b;
          border-radius: 2px;
          text-decoration: none;
          transition: background 0.18s ease, color 0.18s ease;
          display: inline-block;
          cursor: pointer;
          line-height: 1.5;
        }
        .login-btn:hover {
          background: #00356b;
          color: #ffffff;
        }

        .notif-panel, .user-panel {
          background: #ffffff;
          border: 1px solid #d4d9e0;
          border-radius: 3px;
          box-shadow: 0 6px 28px rgba(0,0,0,0.09);
        }

        .menu-item {
          font-family: 'Libre Baskerville', serif;
          font-size: 0.72rem;
          letter-spacing: 0.04em;
          color: #3d4f62;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.55rem 1rem;
          transition: background 0.14s ease, color 0.14s ease;
        }
        .menu-item:hover { background: #f4f6f9; color: #00356b; }

        .mobile-panel {
          background: #ffffff;
          border: 1px solid #d4d9e0;
          border-radius: 3px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.07);
        }
        .mobile-nav-item {
          font-family: 'Libre Baskerville', serif;
          font-size: 0.72rem;
          font-weight: 400;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: #526070;
          text-decoration: none;
          display: block;
          padding: 0.65rem 0.85rem;
          border-radius: 2px;
          transition: background 0.14s ease, color 0.14s ease;
        }
        .mobile-nav-item:hover { background: #f4f6f9; color: #00356b; }
        .mobile-nav-item.nav-active { background: #edf1f8; color: #00356b; font-weight: 700; }

        .sep { width: 1px; height: 18px; background: #d4d9e0; display: inline-block; }
      `}</style>

      <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${scrolled ? "navbar-scrolled" : "navbar-base"}`}>
        <div
          className="max-w-screen-xl mx-auto px-6 lg:px-10 flex items-center justify-between gap-6"
          style={{ height: scrolled ? "56px" : "66px", transition: "height 0.3s ease" }}
        >
          {/* Brand */}
          <NavLink to="/" className="flex items-center gap-3 flex-shrink-0" style={{ textDecoration: "none" }}>
            {!logoError ? (
              <img
                src="/university-logo.png"
                alt="An-Najah National University"
                style={{ height: scrolled ? "44px" : "52px", width: "auto", objectFit: "contain", transition: "height 0.3s ease", flexShrink: 0 }}
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-10 h-10 bg-[#00356b] flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ borderRadius: "2px" }}>NU</div>
            )}
            <div className="hidden sm:flex flex-col leading-tight">
              <span className="brand-ar" dir="rtl">An-Najah National University</span>
              <span className="brand-en">Since 1918 - Nablus, Palestine</span>
            </div>
          </NavLink>

          {/* Center nav – desktop */}
          <nav className="hidden lg:flex flex-1 justify-center items-center gap-7 xl:gap-9" aria-label="Main">
            {visibleCenterLinks.map(({ to, label, end }) => (
              <NavLink
                key={label} to={to} end={end}
                className={({ isActive }) => `nav-item${isActive ? " nav-active" : ""}`}
                style={{ textDecoration: "none" }}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Right – desktop */}
          <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
            {user ? (
              <>
                {/* Bell */}
                <div className="relative" ref={notifRef}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setNotificationOpen((o) => !o); setOpen(false); }}
                    className="relative p-2 text-slate-500 hover:text-[#00356b] hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-[#00356b]/25 transition-colors"
                    style={{ borderRadius: "2px" }}
                    aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#c0392b] ring-2 ring-white" />
                    )}
                  </button>
                  {notificationOpen && (
                    <div className="notif-panel absolute right-0 mt-2 w-80 max-h-[min(22rem,70vh)] overflow-hidden z-50 flex flex-col">
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                        <span style={{ fontFamily: "'Libre Baskerville', serif", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, color: "#3d4f62" }}>
                          Notifications
                        </span>
                        {unreadCount > 0 && (
                          <button type="button" onClick={markAllRead}
                            style={{ fontFamily: "'Libre Baskerville', serif", fontSize: "0.65rem", color: "#00356b" }}
                            className="hover:underline">
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {notifications.length === 0 ? (
                          <p className="px-4 py-8 text-center text-slate-400" style={{ fontFamily: "'Libre Baskerville', serif", fontSize: "0.75rem" }}>
                            No notifications yet.
                          </p>
                        ) : (
                          <ul className="py-1">
                            {notifications.map((n) => (
                              <li key={n.id} className={`px-4 py-3 border-b border-slate-50 last:border-0 ${!n.read ? "bg-[#eef2f9]" : ""}`}>
                                <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <span className="sep" aria-hidden />

                {/* Avatar */}
                <div className="relative" ref={avatarRef}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setNotificationOpen(false); setOpen((o) => !o); }}
                    className="relative h-9 w-9 bg-[#00356b] text-white font-semibold flex items-center justify-center overflow-hidden focus:outline-none focus:ring-1 focus:ring-[#00356b]/30 focus:ring-offset-1 transition-opacity hover:opacity-90 rounded-full"                    aria-expanded={open} aria-haspopup="true" aria-label="User menu"
                  >
                    {avatarSrc && !avatarImageError ? (
                      <img src={avatarSrc} alt="" className="h-9 w-9 object-cover" onError={() => setAvatarImageError(true)} />
                    ) : (
                      <span style={{ fontFamily: "'Libre Baskerville', serif", fontSize: "0.8rem" }}>{userInitial}</span>
                    )}
                    {admin && <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 border-2 border-white" />}
                  </button>

                  {open && (
                    <div className="user-panel absolute right-0 mt-2 w-56 overflow-hidden z-50" role="menu">
                      <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100 bg-slate-50/60">
                        <div className="relative flex-shrink-0 h-9 w-9 bg-[#00356b] text-white font-semibold flex items-center justify-center text-sm overflow-hidden" style={{ borderRadius: "2px" }}>
                          {avatarSrc && !avatarImageError ? (
                            <img src={avatarSrc} alt="" className="h-9 w-9 object-cover" onError={() => setAvatarImageError(true)} />
                          ) : (
                            <span style={{ fontFamily: "'Libre Baskerville', serif" }}>{userInitial}</span>
                          )}
                          {admin && <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 border-2 border-white" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate">{user?.name || "User"}</p>
                          <p className="text-xs text-slate-500 truncate leading-relaxed">{user?.email || ""}</p>
                          {roleLabel && (
                            <p style={{ fontFamily: "'Libre Baskerville', serif", fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, color: "#00356b", marginTop: "2px" }}>
                              {roleLabel}
                            </p>
                          )}
                        </div>
                      </div>
                      <NavLink to="/profile" end
                        className="menu-item"
                        style={{ textDecoration: "none" }} onClick={() => setOpen(false)} role="menuitem">
                        <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Profile
                      </NavLink>
                      <button type="button"
                        onClick={() => { setOpen(false); setShowLogoutConfirm(true); }}
                        className="w-full border-t border-slate-100 transition-colors"
                        style={{ fontFamily: "'Libre Baskerville', serif", fontSize: "0.72rem", letterSpacing: "0.04em", color: "#b91c1c", display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.55rem 1rem", background: "transparent", cursor: "pointer" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#fef2f2"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        role="menuitem">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: "#ef4444" }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <NavLink
                to="/login"
                className="login-btn"
                style={{ textDecoration: "none" }}
              >
                Log in
              </NavLink>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="flex lg:hidden items-center gap-2 flex-shrink-0">
            <button
              type="button"
              className="p-2 text-slate-600 hover:text-[#00356b] hover:bg-slate-50 focus:outline-none transition-colors"
              style={{ borderRadius: "2px" }}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        <div className={`lg:hidden overflow-hidden transition-all duration-300 ease-in-out ${menuOpen ? "max-h-[80vh] opacity-100" : "max-h-0 opacity-0"}`}>
          <nav className="mobile-panel mx-4 mb-4 mt-1 py-3 px-3" aria-label="Mobile">
            <ul className="flex flex-col gap-0.5">
              {visibleCenterLinks.map(({ to, label, end }) => (
                <li key={label}>
                  <NavLink to={to} end={end}
                    className={({ isActive }) => `mobile-nav-item${isActive ? " nav-active" : ""}`}
                    style={{ textDecoration: "none" }} onClick={() => setMenuOpen(false)}>
                    {label}
                  </NavLink>
                </li>
              ))}

              <li className="border-t border-slate-100 mt-2 pt-2 flex flex-col gap-1.5">
                {user ? (
                  <>
                    <NavLink to="/profile" end
                      className="mobile-nav-item flex items-center gap-2.5"
                      style={{ textDecoration: "none" }} onClick={() => setMenuOpen(false)}>
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Profile
                    </NavLink>
                    <button type="button"
                      onClick={() => { setMenuOpen(false); setShowLogoutConfirm(true); }}
                      className="w-full text-center py-2.5 px-4 text-xs font-bold uppercase tracking-widest text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
                      style={{ fontFamily: "'Libre Baskerville', serif", borderRadius: "2px", letterSpacing: "0.08em" }}>
                      Logout
                    </button>
                  </>
                ) : (
                  <NavLink to="/login" end
                    className="login-btn text-center"
                    style={{ textDecoration: "none", textAlign: "center" }} onClick={() => setMenuOpen(false)}>
                    Log in
                  </NavLink>
                )}
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {/* Logout confirm modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40"
             aria-modal="true" role="dialog">
          <div className="w-full max-w-sm bg-white border border-slate-200 shadow-xl overflow-hidden" style={{ borderRadius: "3px", borderLeft: "3px solid #00356b" }}>
            <div className="p-6">
              <h2 className="text-base font-bold text-[#0b2d52]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                Log out?
              </h2>
              <p className="mt-2 text-sm text-slate-500" style={{ fontFamily: "'Libre Baskerville', serif" }}>
                Are you sure you want to log out of your account?
              </p>
              <div className="mt-6 flex gap-3 justify-end">
                <button type="button" onClick={() => setShowLogoutConfirm(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 focus:outline-none transition-colors"
                  style={{ fontFamily: "'Libre Baskerville', serif", borderRadius: "2px", letterSpacing: "0.04em" }}>
                  Cancel
                </button>
                <button type="button" onClick={handleLogout}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 focus:outline-none transition-colors"
                  style={{ fontFamily: "'Libre Baskerville', serif", borderRadius: "2px", letterSpacing: "0.04em" }}>
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

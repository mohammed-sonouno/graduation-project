import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";

const centerLinks = [
  { to: "/", label: "Home", end: true },
  { to: "/colleges", label: "Colleges" },
  { to: "/majors", label: "Majors" },
  { to: "/events", label: "Events" },
];

function LogoPlaceholder({ className = "" }) {
  return (
    <svg
      className={`flex-shrink-0 ${className}`}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="20" cy="20" r="18" stroke="#00356b" strokeWidth="2" fill="none" />
      <text x="20" y="26" fontFamily="Georgia, serif" fontSize="18" fontWeight="600" fill="#00356b" textAnchor="middle">N</text>
    </svg>
  );
}

function Navbar() {
  const location = useLocation();
  const [logoError, setLogoError] = useState(false);
  const [user, setUser] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
    window.location.href = "/login";
  };

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
          font-size: 1.05rem;
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
                  src="/najah-logo.png"
                  alt="An-Najah National University"
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
            {centerLinks.map(({ to, label, end }) => (
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

          {/* Right side: auth */}
          <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
            {user?.role === "admin" && (
              <NavLink
                to="/admin"
                end
                className="login-btn"
                style={{ textDecoration: 'none' }}
              >
                Admin
              </NavLink>
            )}
            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="login-btn"
              >
                Logout
              </button>
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
              {centerLinks.map(({ to, label, end }) => (
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
                  <button
                    type="button"
                    onClick={() => { handleLogout(); setMenuOpen(false); }}
                    className="login-btn text-center"
                    style={{ width: '100%' }}
                  >
                    Logout
                  </button>
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
    </>
  );
}

export default Navbar;
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { COLLEGES_ROUTE_PREFIX } from '../utils/facultySlug';

function Footer() {
  const { user } = useAuth();
  const quickLinks = useMemo(() => {
    const links = [
      { label: 'Home', to: '/' },
      { label: 'Academic Majors', to: '/majors' },
      { label: 'Campus Events', to: '/events' },
      ...(user ? [{ label: 'Communities', to: '/communities' }] : []),
      { label: 'Faculties', to: COLLEGES_ROUTE_PREFIX },
    ];
    return links;
  }, [user]);

  return (
    <footer className="bg-[#07172e] text-slate-400">
      <div className="max-w-screen-xl mx-auto px-6 lg:px-8 pt-16 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">

          {/* Col 1 — Logo + description */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-5">
              <img
                src="/university-logo.png"
                alt="An-Najah National University"
                style={{ height: "44px", width: "auto", objectFit: "contain", transition: "height 0.3s ease", flexShrink: 0 }}
              />  
              <div>
                <p className="text-white font-semibold text-sm leading-snug" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                  An-Najah National University
                </p>
                <p className="text-slate-500 text-xs mt-0.5">Nablus, Palestine</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-400 mb-6">
              A leading Palestinian university committed to academic excellence, research innovation, and building the leaders of tomorrow.
            </p>
            <div className="flex items-center gap-3">
              {[
                { label: 'Facebook', href: 'https://www.facebook.com/search/top?q=%D8%AC%D8%A7%D9%85%D8%B9%D8%A9%20%D8%A7%D9%84%D9%86%D8%AC%D8%A7%D8%AD%20%D8%A7%D9%84%D9%88%D8%B7%D9%86%D9%8A%D8%A9%20-%20an-najah%20national%20university', icon: <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" /> },
                { label: 'X', href: 'https://x.com/ANajahUni?fbclid=IwY2xjawRhlcZleHRuA2FlbQIxMABicmlkETEwTlBsMXNIYlV6UWFGZGJQc3J0YwZhcHBfaWQQMjIyMDM5MTc4ODIwMDg5MgABHlDFBUszacTD8FajVTIidUG1Duu9P3S71gUMoYKrfveGYIaceuFJqRKLWdcf_aem_18hwKDUbBWJgQKrRfm87oQ', icon: <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" to='' /> },
                { label: 'Instagram', href: 'https://www.instagram.com/ANajahUni?fbclid=IwY2xjawRhlSZleHRuA2FlbQIxMABicmlkETEwTlBsMXNIYlV6UWFGZGJQc3J0YwZhcHBfaWQQMjIyMDM5MTc4ODIwMDg5MgABHlDFBUszacTD8FajVTIidUG1Duu9P3S71gUMoYKrfveGYIaceuFJqRKLWdcf_aem_18hwKDUbBWJgQKrRfm87oQ', icon: <><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></> },
                { label: 'LinkedIn', href: 'https://www.linkedin.com/company/an-najah-national-university/', icon: <><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></> },
              ].map(({ label, href, icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-400 hover:text-white transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    {icon}
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Col 2 — Quick links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-300 mb-5">Quick Links</h4>
            <ul className="space-y-3">
              {quickLinks.map(({ label, to }) => (
                <li key={label}>
                  <Link
                    to={to}
                    className="text-sm text-slate-400 hover:text-white transition-colors duration-200 flex items-center gap-2 group"
                    style={{ textDecoration: 'none' }}
                  >
                    <span className="w-1 h-1 rounded-full bg-[#00356b] group-hover:bg-blue-400 transition-colors flex-shrink-0" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Account */}
          <div>
  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-300 mb-5">
    Account
  </h4>

  <ul className="space-y-3">
    {[
      !user && { label: 'Login', to: '/login' },
      { label: 'My Profile', to: '/profile' },
      { label: 'Privacy Policy', to: '#' },
      { label: 'Accessibility', to: '#' },
    ]
      .filter(Boolean)
      .map(({ label, to }) => (
        <li key={label}>
          <Link
            to={to}
            className="text-sm text-slate-400 hover:text-white transition-colors duration-200 flex items-center gap-2 group"
            style={{ textDecoration: 'none' }}
          >
            <span className="w-1 h-1 rounded-full bg-[#00356b] group-hover:bg-blue-400 transition-colors flex-shrink-0" />
            {label}
          </Link>
        </li>
      ))}
  </ul>
</div>
          {/* Col 4 — Contact */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-300 mb-5">Contact</h4>
            <ul className="space-y-4">
              {[
                {
                  icon: <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />,
                  text: 'Nablus, West Bank, Palestine',
                },
                {
                  icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />,
                  text: '+970 9 234 5113',
                },
                {
                  icon: <><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></>,
                  text: 'info@najah.edu',
                },{
                  icon: <><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></>,
                  text: 'helpdesk@najah.edu',
                },
                
              ].map(({ icon, text }, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center mt-0.5">
                    <svg className="w-3.5 h-3.5 text-[#4a90d9]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      {icon}
                    </svg>
                  </span>
                  <span className="text-sm text-slate-400 leading-relaxed">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} An-Najah National University. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            {['Site Map', 'Feedback', 'Terms of Use'].map((label) => (
              <a key={label} href="#" className="text-xs text-slate-600 hover:text-slate-300 transition-colors duration-200">
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

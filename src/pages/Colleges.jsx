import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getColleges } from '../api';

function slugify(name) {
  return (name || '').toLowerCase().replace(/\s+&\s+/g, '-').replace(/\s+/g, '-').replace(/&/g, 'and');
}

const ICONS = {
  engineering: (
    <svg className="w-7 h-7 text-[#00356b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  medicine: (
    <svg className="w-7 h-7 text-[#00356b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  arts: (
    <svg className="w-7 h-7 text-[#00356b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  ),
  business: (
    <svg className="w-7 h-7 text-[#00356b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  law: (
    <svg className="w-7 h-7 text-[#00356b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  ),
  it: (
    <svg className="w-7 h-7 text-[#00356b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
};

const DEFAULT_DESCRIPTION = 'Dedicated to excellence in teaching, research, and innovation.';
const ICON_KEYS = ['engineering', 'medicine', 'arts', 'business', 'law', 'it'];

function getIconKey(name) {
  if (!name || typeof name !== 'string') return 'arts';
  const lower = name.toLowerCase();
  if (lower.includes('engineer') || lower.includes('it ') || lower.includes(' it')) return 'engineering';
  if (lower.includes('medicine') || lower.includes('health')) return 'medicine';
  if (lower.includes('business') || lower.includes('commerce')) return 'business';
  if (lower.includes('law') || lower.includes('legal')) return 'law';
  if (lower.includes('information') || lower.includes('technology') || lower.includes('comput')) return 'it';
  return 'arts';
}

function Colleges() {
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getColleges()
      .then((list) => {
        const raw = Array.isArray(list) ? list : [];
        setColleges(
          raw.map((c) => ({
            id: c.id,
            name: c.name ?? '',
            slug: slugify(c.name),
            description: (c.description ?? DEFAULT_DESCRIPTION).trim() || DEFAULT_DESCRIPTION,
            icon: ICON_KEYS.includes(c.icon) ? c.icon : getIconKey(c.name),
          }))
        );
      })
      .catch((err) => {
        setColleges([]);
        setError(err?.message ?? 'Failed to load colleges.');
      })
      .finally(() => setLoading(false));
  }, []);

  const iconSafe = (college) => ICONS[college.icon] ?? ICONS.arts;

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center bg-[#f7f6f3]">
        <p className="text-slate-500">Loading colleges...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center bg-[#f7f6f3] px-4">
        <div className="text-center max-w-md">
          <p className="text-red-600 font-medium">Unable to load colleges</p>
          <p className="mt-2 text-slate-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="text-gray-900">
      <section className="bg-[#f7f6f3] pt-12 pb-20">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-10">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-[#0b2d52] leading-tight tracking-tight mb-5">
              Our Colleges
            </h1>
            <p className="text-slate-600 leading-relaxed">
              Explore our diverse range of colleges, each dedicated to excellence in teaching, research, and innovation.
            </p>
            <p className="mt-4 text-sm text-slate-500">Showing all {colleges.length} colleges</p>
          </div>

          {colleges.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-slate-200 bg-white text-slate-600">
              <p className="font-medium">No colleges found</p>
              <p className="mt-2 text-sm">Colleges will appear here when added to the system.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {colleges.map((college) => (
                <div
                  key={college.id}
                  className="bg-white border border-slate-100 rounded-lg shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-6 flex flex-col"
                >
                  <div className="w-12 h-12 rounded-lg bg-[#00356b]/10 flex items-center justify-center mb-5 flex-shrink-0">
                    {iconSafe(college)}
                  </div>
                  <h2 className="font-serif text-lg font-semibold text-[#0b2d52] leading-snug mb-3">
                    {college.name}
                  </h2>
                  <p className="text-slate-600 text-sm leading-relaxed mb-5 flex-1">
                    {college.description}
                  </p>
                  <Link
                    to={`/colleges/${college.id}`}
                    className="text-sm font-semibold text-[#00356b] hover:underline inline-flex items-center gap-1"
                  >
                    View Programs
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default Colleges;

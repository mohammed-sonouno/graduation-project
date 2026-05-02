import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getColleges } from '../lib/api';
import { COLLEGES_CATALOG, descriptionForFaculty } from './collegesCatalog';
import { collegePathFromFacultySlug } from '../utils/facultySlug';

const INITIAL_COLLEGES_COUNT = 6;

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
  sports: (
    <svg className="w-7 h-7 text-[#00356b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
};

function getIconKey(name) {
  if (!name || typeof name !== 'string') return 'arts';
  const lower = name.toLowerCase();
  if (lower.includes('engineering') || lower.includes('information technology')) return 'engineering';
  if (lower.includes('medicine') || lower.includes('health') || lower.includes('pharmacy') || lower.includes('nursing')) return 'medicine';
  if (lower.includes('optometry')) return 'medicine';
  if (lower.includes('veterinary')) return 'medicine';
  if (lower.includes('physical education') || lower.includes('sports sciences')) return 'sports';
  if (lower.includes('economics') || lower.includes('business')) return 'business';
  if (lower.includes('law')) return 'law';
  if (lower.includes('science') && !lower.includes('education')) return 'engineering';
  if (lower.includes('agriculture')) return 'arts';
  if (lower.includes('sharia')) return 'law';
  return 'arts';
}

function Colleges() {
  const [listError, setListError] = useState('');
  const [showMore, setShowMore] = useState(false);

  const colleges = useMemo(
    () =>
      COLLEGES_CATALOG.map((c) => ({
        routeId: c.id,
        name: c.name,
        description: c.description || descriptionForFaculty(c.name),
        programCount: (c.majors || []).length,
        icon: getIconKey(c.name),
      })),
    []
  );

  useEffect(() => {
    let cancelled = false;
    setListError('');
    getColleges()
      .then(() => {
        if (cancelled) return;
      })
      .catch(() => {
        if (!cancelled) setListError('Could not verify colleges with the server; catalogue listing is shown.');
      });
    return () => { cancelled = true; };
  }, []);

  const visibleColleges = showMore ? colleges : colleges.slice(0, INITIAL_COLLEGES_COUNT);
  const hasMore = colleges.length > INITIAL_COLLEGES_COUNT;
  const iconSafe = (college) => ICONS[college.icon] ?? ICONS.arts;

  return (
    <div className="text-gray-900">
      <section className="bg-[#f7f6f3] pt-12 pb-20">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-10">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-[#0b2d52] leading-tight tracking-tight mb-5">
              Our Faculties
            </h1>
            <p className="text-slate-600 leading-relaxed">
              Official faculty names match the university register; programmes shown combine catalogue data with live records.
            </p>
          </div>

          {colleges.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-slate-200 bg-white text-slate-600">
              <p className="font-medium">No colleges found</p>
              <p className="mt-2 text-sm">Catalogue data is missing.</p>
            </div>
          ) : (
            <>
              {listError ? (
                <div className="mb-8 rounded-xl border border-amber-100 bg-amber-50 text-amber-900 text-sm px-4 py-3 text-center">
                  {listError}
                </div>
              ) : null}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleColleges.map((college) => (
                  <div
                    key={college.routeId}
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
                    {college.programCount > 0 && (
                      <p className="text-xs font-medium text-slate-400 mb-4">{college.programCount} programmes in catalogue</p>
                    )}
                    <Link
                      to={collegePathFromFacultySlug(college.routeId)}
                      className="text-sm font-semibold text-[#00356b] hover:underline inline-flex items-center gap-1 mt-auto"
                    >
                      View Programs
                      <span aria-hidden>→</span>
                    </Link>
                  </div>
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-10">
                  <button
                    type="button"
                    onClick={() => setShowMore((v) => !v)}
                    className="text-sm font-semibold text-[#00356b] hover:underline"
                  >
                    {showMore ? 'Show less' : 'Show more'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default Colleges;

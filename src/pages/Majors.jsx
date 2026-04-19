import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getColleges, getMajors } from '../api';

function slugify(name) {
  return (name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const getMajorImage = (slug) => `/majors/${slug || 'placeholder'}.jpg`;

function Majors() {
  const [colleges, setColleges] = useState([]);
  const [majors, setMajors] = useState([]);
  const [search, setSearch] = useState('');
  const [collegeIds, setCollegeIds] = useState([]);

  useEffect(() => {
    getColleges().then((list) => setColleges(Array.isArray(list) ? list : [])).catch(() => setColleges([]));
  }, []);

  useEffect(() => {
    getMajors()
      .then((list) => setMajors(Array.isArray(list) ? list : []))
      .catch(() => setMajors([]));
  }, []);

  const majorsWithMeta = useMemo(
    () =>
      majors.map((m) => ({
        ...m,
        collegeName: colleges.find((c) => String(c.id) === String(m.collegeId))?.name || '',
        slug: slugify(m.name),
        degreeType: 'B.Sc.',
        description: '',
      })),
    [majors, colleges]
  );

  const collegeFilters = useMemo(
    () => colleges.map((c) => ({ id: String(c.id), label: c.name })),
    [colleges]
  );

  const toggleCollege = (id) => {
    const normalizedId = String(id);
    setCollegeIds((prev) =>
      prev.includes(normalizedId) ? prev.filter((x) => x !== normalizedId) : [...prev, normalizedId]
    );
  };

  const filteredMajors = useMemo(() => {
    const query = search.trim().toLowerCase();
    return majorsWithMeta.filter((m) => {
      const matchSearch =
        !query ||
        [m.name, m.collegeName, m.description, m.slug, m.degreeType]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(query));
      const matchCollege = collegeIds.length === 0 || collegeIds.includes(String(m.collegeId));
      return matchSearch && matchCollege;
    });
  }, [majorsWithMeta, search, collegeIds]);

  const totalCount = filteredMajors.length;

  return (
    <div className="text-gray-900 bg-[#f7f6f3] min-h-screen">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-10 py-12">
        <div className="text-center mb-10">
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-[#0b2d52] leading-tight tracking-tight mb-5">
            Academic Majors
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto mb-8 leading-relaxed">
            Explore our diverse range of undergraduate and graduate programs designed to inspire intellectual curiosity and professional growth.
          </p>
          <form className="max-w-xl mx-auto relative" onSubmit={(e) => e.preventDefault()} role="search">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="search"
              placeholder="Search for a major, department, or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
              aria-label="Search majors"
              autoComplete="off"
            />
          </form>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          <aside className="lg:w-72 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm p-5 sticky top-24">
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
                Filter by College
              </h3>
              <ul className="space-y-2">
                {collegeFilters.map((c) => (
                  <li key={c.id}>
                    <input
                      type="checkbox"
                      id={`college-${c.id}`}
                      checked={collegeIds.includes(c.id)}
                      onChange={() => toggleCollege(c.id)}
                      className="peer sr-only"
                    />
                    <label
                      htmlFor={`college-${c.id}`}
                      className="flex items-start gap-3 rounded-md px-2 py-1.5 cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <span className="mt-0.5 flex h-4 w-4 min-h-4 min-w-4 flex-shrink-0 items-center justify-center rounded-sm border border-slate-400 bg-white peer-checked:border-[#00356b] peer-checked:bg-[#00356b]">
                        <svg
                          className="hidden h-3 w-3 text-white peer-checked:block"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <span className="text-sm leading-5 text-slate-700">
                        {c.label}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-500 mb-6">Showing all {totalCount} majors</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredMajors.map((major) => (
                <Link
                  key={major.id}
                  to={`/majors/${major.id}`}
                  state={{ from: 'majors' }}
                  className="group bg-white rounded-lg shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex"
                >
                  <div className="relative w-24 h-24 flex-shrink-0 bg-slate-100">
                    <img
                      src={getMajorImage(major.slug)}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        const fallback = e.target.nextElementSibling;
                        if (fallback) fallback.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden absolute inset-0 flex items-center justify-center bg-[#00356b]/10">
                      <span className="text-xs text-[#00356b] font-semibold uppercase">Major</span>
                    </div>
                  </div>
                  <div className="p-4 flex flex-col flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      {major.degreeType}
                    </p>
                    <h2 className="font-serif text-lg font-semibold text-[#0b2d52] leading-snug mb-1 group-hover:underline">
                      {major.name}
                    </h2>
                    <p className="text-sm font-medium text-[#00356b] mb-2">{major.collegeName || 'Unassigned college'}</p>
                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-2 flex-1">
                      {major.description || 'Browse the programme page for more details about this major.'}
                    </p>
                    <span className="text-sm font-semibold text-[#00356b] mt-2 inline-flex items-center gap-1">
                      View Details
                      <span aria-hidden>→</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {totalCount === 0 && (
              <p className="text-center text-slate-500 py-12">No majors match your filters.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Majors;

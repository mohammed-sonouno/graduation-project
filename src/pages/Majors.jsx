import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getColleges, getMajors } from '../api';

const INITIAL_VISIBLE = 6;

const DEGREE_FILTERS = [
  { id: 'B.Sc.', label: 'Bachelor of Science (B.Sc.)' },
  { id: 'B.A.', label: 'Bachelor of Arts (B.A.)' },
  { id: 'Associate', label: 'Associate Degree' },
];

function slugify(name) {
  return (name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
};

const getMajorImage = (slug) => `/majors/${slug || 'placeholder'}.jpg`;

function Majors() {
  const [colleges, setColleges] = useState([]);
  const [majors, setMajors] = useState([]);
  const [search, setSearch] = useState('');
  const [collegeIds, setCollegeIds] = useState([]);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    getColleges().then((list) => setColleges(Array.isArray(list) ? list : [])).catch(() => setColleges([]));
  }, []);
  useEffect(() => {
    getMajors()
      .then((list) => setMajors(Array.isArray(list) ? list : []))
      .catch(() => setMajors([]));
  }, []);

  const collegeFilters = useMemo(() => colleges.map((c) => ({ id: c.id, label: c.name })), [colleges]);

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

  const toggleCollege = (id) => {
    setCollegeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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

  const visibleMajors = showMore ? filteredMajors : filteredMajors.slice(0, INITIAL_VISIBLE);
  const hasMore = filteredMajors.length > INITIAL_VISIBLE;
  const totalCount = filteredMajors.length;

  return (
    <div className="text-gray-900 bg-[#f7f6f3] min-h-screen">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-10 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-[#0b2d52] leading-tight tracking-tight mb-5">
            Academic Majors
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto mb-8 leading-relaxed">
            Explore our diverse range of undergraduate and graduate programs designed to inspire intellectual curiosity and professional growth.
          </p>
          <form
            className="max-w-xl mx-auto relative"
            onSubmit={(e) => e.preventDefault()}
            role="search"
          >
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
          {/* Sidebar filters */}
          <aside className="lg:w-56 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm p-5 sticky top-24">
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
                Filter by College
              </h3>
              <ul className="space-y-2">
                {collegeFilters.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`college-${c.id}`}
                      checked={collegeIds.includes(c.id)}
                      onChange={() => toggleCollege(c.id)}
                      className="w-4 h-4 rounded border-slate-300 text-[#00356b] focus:ring-[#00356b]/30"
                    />
                    <label htmlFor={`college-${c.id}`} className="text-sm text-slate-700 cursor-pointer">
                      {c.label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-500 mb-6">
              Showing {Math.min(visibleMajors.length, totalCount)} of {totalCount} majors
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {visibleMajors.map((major) => (
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
                    <h2 className="font-serif text-lg font-semibold text-[#0b2d52] leading-snug mb-2 group-hover:underline">
                      {major.name}
                    </h2>
                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-2 flex-1">
                      {major.description}
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

            {hasMore && totalCount > 0 && (
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default Majors;

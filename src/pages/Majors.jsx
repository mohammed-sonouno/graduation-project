import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';

const INITIAL_VISIBLE = 6;

const COLLEGE_FILTERS = [
  { id: '3', label: 'Arts & Sciences' },
  { id: '1', label: 'Engineering & IT' },
  { id: '4', label: 'Business School' },
  { id: '2', label: 'Medicine & Health' },
  { id: '5', label: 'Law & Policy' },
];

const DEGREE_FILTERS = [
  { id: 'B.Sc.', label: 'Bachelor of Science (B.Sc.)' },
  { id: 'B.A.', label: 'Bachelor of Arts (B.A.)' },
  { id: 'Associate', label: 'Associate Degree' },
];

// All majors: collegeId matches COLLEGE_FILTERS, degreeType matches DEGREE_FILTERS
const ALL_MAJORS = [
  { id: 'eng-mis', name: 'Management Information Systems', degreeType: 'B.Sc.', collegeId: '1', collegeName: 'Engineering & IT', slug: 'management-information-systems', description: 'Bridging business strategy and information technology for modern organizations.' },
  { id: 'eng-cs', name: 'Computer Science', degreeType: 'B.Sc.', collegeId: '1', collegeName: 'Engineering & IT', slug: 'computer-science', description: 'Study algorithms, software systems, and computational theory to solve complex problems.' },
  { id: 'eng-ee', name: 'Electrical Engineering', degreeType: 'B.Sc.', collegeId: '1', collegeName: 'Engineering & IT', slug: 'electrical-engineering', description: 'Design and analyze electrical systems, from microelectronics to power grids.' },
  { id: 'eng-ce', name: 'Civil Engineering', degreeType: 'B.Sc.', collegeId: '1', collegeName: 'Engineering & IT', slug: 'civil-engineering', description: 'Plan, design, and manage infrastructure that shapes our built environment.' },
  { id: 'eng-me', name: 'Mechanical Engineering', degreeType: 'B.Sc.', collegeId: '1', collegeName: 'Engineering & IT', slug: 'mechanical-engineering', description: 'Apply principles of mechanics and thermodynamics to create machines and systems.' },
  { id: 'eng-it', name: 'Information Technology', degreeType: 'B.Sc.', collegeId: '1', collegeName: 'Engineering & IT', slug: 'information-technology', description: 'Bridge business and technology with skills in systems, networks, and data.' },
  { id: 'eng-se', name: 'Software Engineering', degreeType: 'B.Sc.', collegeId: '1', collegeName: 'Engineering & IT', slug: 'software-engineering', description: 'Build reliable, scalable software through systematic design and development.' },
  { id: 'arts-econ', name: 'Economics', degreeType: 'B.A.', collegeId: '3', collegeName: 'Arts & Sciences', slug: 'economics', description: 'Understand markets, policy, and economic theory to analyze real-world issues.' },
  { id: 'arts-psych', name: 'Psychology', degreeType: 'B.A.', collegeId: '3', collegeName: 'Arts & Sciences', slug: 'psychology', description: 'Study human behavior and mental processes through research and applied practice.' },
  { id: 'arts-bio', name: 'Biology', degreeType: 'B.Sc.', collegeId: '3', collegeName: 'Arts & Sciences', slug: 'biology', description: 'Explore living systems from molecular mechanisms to ecosystems.' },
  { id: 'bus-mgmt', name: 'Business Administration', degreeType: 'B.Sc.', collegeId: '4', collegeName: 'Business School', slug: 'business-administration', description: 'Prepare for leadership in management, strategy, and organizational development.' },
  { id: 'med-nursing', name: 'Nursing', degreeType: 'B.Sc.', collegeId: '2', collegeName: 'Medicine & Health', slug: 'nursing', description: 'Train for clinical practice and patient care in diverse healthcare settings.' },
  { id: 'law-legal', name: 'Law', degreeType: 'B.A.', collegeId: '5', collegeName: 'Law & Policy', slug: 'law', description: 'Develop legal reasoning and advocacy for practice or policy roles.' },
];

const TRENDING_MAJORS = [
  { id: 'eng-cs', name: 'Computer Science' },
  { id: 'arts-econ', name: 'Economics' },
  { id: 'arts-psych', name: 'Psychology' },
];

const getMajorImage = (slug) => `/majors/${slug || 'placeholder'}.jpg`;

function Majors() {
  const [search, setSearch] = useState('');
  const [collegeIds, setCollegeIds] = useState([]);
  const [showMore, setShowMore] = useState(false);

  const toggleCollege = (id) => {
    setCollegeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const filteredMajors = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = ALL_MAJORS.filter((m) => {
      const matchSearch =
        !query ||
        [m.name, m.collegeName, m.description, m.slug, m.degreeType]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(query));
      const matchCollege = collegeIds.length === 0 || collegeIds.includes(m.collegeId);
      return matchSearch && matchCollege;
    });
    return list;
  }, [search, collegeIds]);

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
                {COLLEGE_FILTERS.map((c) => (
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

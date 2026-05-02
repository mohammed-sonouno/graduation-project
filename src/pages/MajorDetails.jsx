import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import MajorChat from '../components/MajorChat';
import { MAJORS_CATALOG } from './majorsCatalog';
import { catalogCollegeBucketNameForMajorFaculty } from './collegesCatalog';
import { facultySlug, collegePathFromFacultySlug, COLLEGES_ROUTE_PREFIX } from '../utils/facultySlug';
import { MAJOR_COURSES_MAP } from './majorCoursesData';

const INFO_CARD_ICONS = {
  gpa: (
    <svg className="w-5 h-5 text-[#00356b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  track: (
    <svg className="w-5 h-5 text-[#00356b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  ),
  duration: (
    <svg className="w-5 h-5 text-[#00356b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  degree: (
    <svg className="w-5 h-5 text-[#00356b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zM12 14l6.16 3.422a12.083 12.083 0 01-.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01-.665-6.479L12 14zm0 0V7" />
    </svg>
  ),
  credits: (
    <svg className="w-5 h-5 text-[#00356b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
};

const slugify = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9/-]/g, '');

function MajorDetails() {
  const { id } = useParams();
  const location = useLocation();
  const [major, setMajor] = useState(null);
  const [loading, setLoading] = useState(true);
  const LEGACY_MAJOR_SLUG_MAP = {
    'eng-mis': 'management-information-systems',
    'eng-cs': 'computer-science',
    'eng-ee': 'electrical-engineering',
    'eng-ce': 'civil-engineering',
    'eng-me': 'mechanical-engineering',
    'eng-it': 'information-technology',
    'eng-se': 'software-engineering',
    'arts-econ': 'economics',
    'arts-psych': 'psychology-psychological-counseling',
    'arts-bio': 'life-sciences',
    'bus-mgmt': 'business-administration',
    'med-nursing': 'nursing',
    'law-legal': 'law',
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id, location.state]);

  useEffect(() => {
    const fromState = location.state?.major;
    if (fromState) {
      setMajor(fromState);
      setLoading(false);
      return;
    }
    const mappedSlug = LEGACY_MAJOR_SLUG_MAP[id] || id;
    const found = MAJORS_CATALOG.find((m) => m.slug === mappedSlug || m.id === id);
    setMajor(found || null);
    setLoading(false);
  }, [id, location.state]);

  const resolvedCourses = useMemo(() => {
    if (!major) return [];
    const aliases = {
      biotechnology: 'biology-major-/-biotechnology-minor',
      'english-/-american-studies': 'english-language-and-literature',
      'english-/-french': 'english-language-and-literature',
      'french-/-english': 'french-language-and-literature',
      'tourism-/-archaeological-site-management': 'tourism-and-archaeology',
      'tourism-/-hotel-management': 'tourism-and-archaeology',
      'tourism-/-reservation--travel': 'tourism-and-archaeology',
      'psychology-/-psychological-counseling': 'psychology-and-counseling',
      'islamic-banking': 'sharia-and-islamic-banking',
      'finance-and-banking': 'financial-and-banking-sciences',
      'political-sciences': 'political-science',
      'journalism-and-media': 'written-and-electronic-journalism',
      'public-relations-and-advertising': 'public-relations-and-communication',
      'music': 'music-sciences',
      'materials-science-and-engineering': 'materials-science-engineering',
      'planning-engineering-and-city-technology': 'urban-planning-engineering',
      'animal-production-and-veterinary-sciences': 'animal-production-and-animal-health',
    };

    const primaryKey = slugify(major.name);
    const fallbackKey = aliases[primaryKey];
    const match = MAJOR_COURSES_MAP[primaryKey] || (fallbackKey ? MAJOR_COURSES_MAP[fallbackKey] : null);
    return match?.courses || [];
  }, [major]);

  const aboutMajorText = useMemo(() => {
    if (!major) return '';
    const parts = [
      `${major.name} is a ${major.duration} undergraduate program in the ${major.facultyName}.`,
      major.majorType ? `Academic track (major type): ${major.majorType}.` : '',
      `The program requires ${major.creditHours} credit hours with a minimum admission average of ${major.minAdmission}.`,
      major.notes ? `Program note: ${major.notes}` : '',
    ].filter(Boolean);
    return parts.join(' ');
  }, [major]);

  const majorChatContext = useMemo(() => {
    if (!major) return '';
    const coursesContext = resolvedCourses
      .slice(0, 120)
      .map((c) => `${c.code || '—'} - ${c.title || '—'} (${c.creditHours || '—'} cr)`)
      .join(' ; ');
    return [
      `Major: ${major.name}`,
      `Faculty: ${major.facultyName}`,
      `Major Type: ${major.majorType || '—'}`,
      `Credit Hours: ${major.creditHours}`,
      `Duration: ${major.duration}`,
      `Minimum Admission Average: ${major.minAdmission}`,
      `Notes: ${major.notes || '—'}`,
      `Courses count: ${resolvedCourses.length}`,
      coursesContext ? `Courses: ${coursesContext}` : '',
    ].join(' | ');
  }, [major, resolvedCourses]);

  if (loading) {
    return (
      <div className="bg-[#f7f6f3] min-h-[50vh] flex items-center justify-center">
        <p className="text-slate-600">Loading program…</p>
      </div>
    );
  }
  if (!major) {
    return (
      <div className="bg-[#f7f6f3] min-h-[50vh] flex items-center justify-center">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-10 text-center">
          <h1 className="font-serif text-2xl text-[#0b2d52] mb-4">Program not found</h1>
          <Link to={COLLEGES_ROUTE_PREFIX} className="text-[#00356b] font-semibold hover:underline">
            ← Back to Colleges
          </Link>
        </div>
      </div>
    );
  }

  const infoCards = [
    { key: 'gpa', label: 'Minimum Admission Average', value: major.minAdmission },
    { key: 'track', label: 'Faculty', value: major.facultyName },
    ...(major.majorType ? [{ key: 'degree', label: 'Major Type', value: major.majorType }] : []),
    { key: 'duration', label: 'Study Duration', value: major.duration },
    { key: 'credits', label: 'Credit Hours', value: major.creditHours ? `${major.creditHours}` : '' },
  ].filter((c) => c.value);

  const tagline = major.notes;
  const facultyBucketName = catalogCollegeBucketNameForMajorFaculty(major.facultyName);
  const facultyCollegeHref = collegePathFromFacultySlug(
    facultyBucketName ? facultySlug(facultyBucketName) : ''
  );
  return (
    <div className="text-gray-900 bg-white min-h-screen">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-10 pt-8 pb-20">
        <nav className="flex items-center gap-2 text-sm mb-8" aria-label="Breadcrumb">
          <Link to={COLLEGES_ROUTE_PREFIX} className="text-slate-500 hover:text-[#00356b] hover:underline transition">
            Colleges
          </Link>
          <span className="text-slate-300" aria-hidden>›</span>
          <Link
            to={facultyCollegeHref}
            className="text-slate-500 hover:text-[#00356b] hover:underline transition"
          >
            {major.facultyName}
          </Link>
          <span className="text-slate-300" aria-hidden>›</span>
          <span className="font-semibold text-[#00356b]">{major.name}</span>
        </nav>

        <div className="text-center mb-12">
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-[#0b2d52] leading-tight tracking-tight mb-4">
            {major.name}
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-2 text-slate-600 text-sm">
            <span>{major.facultyName}</span>
            {tagline && (
              <>
                <span className="text-slate-300" aria-hidden>|</span>
                <span>{tagline}</span>
              </>
            )}
          </div>
        </div>

        {infoCards.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-14">
            {infoCards.map(({ key, label, value }) => (
              <div
                key={key}
                className="bg-white border border-slate-100 rounded-lg shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-4 text-center"
              >
                <div className="flex justify-center mb-3">
                  {INFO_CARD_ICONS[key]}
                </div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  {label}
                </p>
                <p className="font-serif text-lg font-semibold text-[#0b2d52]">
                  {value}
                </p>
              </div>
            ))}
          </div>
        )}

        {(major.notes || major.majorType) && (
          <section className="mb-14">
            <h2 className="font-serif text-2xl font-semibold text-[#0b2d52] text-center mb-6">
              About the Major
            </h2>
            <p className="text-slate-600 leading-relaxed text-center max-w-3xl mx-auto">
              {aboutMajorText}
            </p>
          </section>
        )}

        <MajorChat
          majorName={major.name}
          majorShortName={major.name}
          majorFaculty={majorChatContext}
        />
      </div>
    </div>
  );
}

export default MajorDetails;

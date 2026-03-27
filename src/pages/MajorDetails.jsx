import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiUrl } from '../api';
import MajorChat from '../components/MajorChat';

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
  degree: (
    <svg className="w-5 h-5 text-[#00356b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  duration: (
    <svg className="w-5 h-5 text-[#00356b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
};

function MajorDetails() {
  const { id } = useParams();
  const [major, setMajor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(apiUrl(`/api/programs/${id}`))
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setMajor(data);
      })
      .catch(() => { if (!cancelled) setMajor(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

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
          <Link to="/colleges" className="text-[#00356b] font-semibold hover:underline">
            ← Back to Colleges
          </Link>
        </div>
      </div>
    );
  }

  const infoCards = [
    { key: 'gpa', label: 'Required GPA', value: major.required_gpa },
    { key: 'track', label: 'High School Track', value: major.high_school_track },
    { key: 'degree', label: 'Degree Type', value: major.degree_type },
    { key: 'duration', label: 'Study Duration', value: major.duration },
  ].filter((c) => c.value);

  const tagline = major.description || major.about_text;

  return (
    <div className="text-gray-900 bg-white min-h-screen">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-10 pt-8 pb-20">
        <nav className="flex items-center gap-2 text-sm mb-8" aria-label="Breadcrumb">
          <Link to="/colleges" className="text-slate-500 hover:text-[#00356b] hover:underline transition">
            Colleges
          </Link>
          <span className="text-slate-300" aria-hidden>›</span>
          <Link to={`/colleges/${major.college_id}`} className="text-slate-500 hover:text-[#00356b] hover:underline transition">
            {major.college_short_name}
          </Link>
          <span className="text-slate-300" aria-hidden>›</span>
          <span className="font-semibold text-[#00356b]">{major.name}</span>
        </nav>

        {major.image_url && (
          <div className="rounded-xl overflow-hidden bg-slate-100 mb-10 h-48 md:h-64">
            <img src={major.image_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="text-center mb-12">
          {major.department && (
            <p className="text-xs font-semibold text-[#00356b]/80 uppercase tracking-widest mb-2">
              {major.department}
            </p>
          )}
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-[#0b2d52] leading-tight tracking-tight mb-4">
            {major.name}
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-2 text-slate-600 text-sm">
            <span>{major.college_name}</span>
            {tagline && (
              <>
                <span className="text-slate-300" aria-hidden>|</span>
                <span>{tagline}</span>
              </>
            )}
          </div>
        </div>

        {infoCards.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
            {infoCards.map(({ key, label, value }) => (
              <div
                key={key}
                className="bg-white border border-slate-100 rounded-lg shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-5 text-center"
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

        {(major.about_text || major.description) && (
          <section className="mb-14">
            <h2 className="font-serif text-2xl font-semibold text-[#0b2d52] text-center mb-6">
              About the Major
            </h2>
            <p className="text-slate-600 leading-relaxed text-center max-w-3xl mx-auto">
              {major.about_text || major.description}
            </p>
          </section>
        )}

        <MajorChat majorName={major.name} majorShortName={major.name} />
      </div>
    </div>
  );
}

export default MajorDetails;

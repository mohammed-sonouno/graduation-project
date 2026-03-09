import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isAdmin, isDean, isSupervisor, isCommunityLeader, DEAN_DISPLAY_NAME, SUPERVISOR_DISPLAY_NAME, COMMUNITY_LEADER_DISPLAY_NAME } from "../utils/permissions";
import { getEventRegistrations, getStudentProfile, saveStudentProfile as saveProfileApi } from "../api";


function IconId(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
    </svg>
  );
}
function IconEnvelope(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function IconDepartment(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  );
}
function IconCalendar(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function IconPin(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function IconCheck(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function isEventCompleted(reg) {
  if (!reg.date) return false;
  const d = new Date(reg.date);
  return !isNaN(d.getTime()) && d < new Date();
}

function Profile() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [registrations, setRegistrations] = useState([]);
  const [studentProfile, setStudentProfile] = useState({});
  const [viewMode, setViewMode] = useState("grid");
  const photoInputRef = useRef(null);

  const saveStudentProfile = (updates) => {
    if (!user) return;
    const next = { ...studentProfile, ...updates };
    setStudentProfile(next);
    saveProfileApi(next).catch((e) => console.warn("Could not save profile", e));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      saveStudentProfile({ picture: reader.result });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  useEffect(() => {
    if (!user) return;
    getEventRegistrations()
      .then((list) => setRegistrations(Array.isArray(list) ? list : []))
      .catch(() => setRegistrations([]));
    getStudentProfile()
      .then((data) => setStudentProfile(data || {}))
      .catch(() => setStudentProfile({}));
  }, [user?.id]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f6f3]">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  const admin = isAdmin(user);
  const dean = isDean(user);
  const supervisor = isSupervisor(user);
  const communityLeader = isCommunityLeader(user);
  const displayName = user.name || user.email || "User";
  const initial = (displayName[0] || "?").toUpperCase();
  const pictureUrl = studentProfile.picture || user.picture || null;
  const studentUniNumber = user.student_number ?? (user.email ? user.email.split("@")[0] : null) ?? "—";
  const college = studentProfile.college || user.college || "—";
  const major = studentProfile.major || user.major || "—";
  return (
    <div className="min-h-screen bg-slate-50/80 text-slate-900">
      {/* Header — refined */}
      <section className="bg-[#0b2d52] border-b border-[#0b2d52]/80">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8">
          <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/60" style={{ fontFamily: "'EB Garamond', serif" }}>
            An-Najah National University
          </p>
          <h1 className="mt-2 text-2xl md:text-[1.75rem] font-semibold text-white tracking-tight" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            Profile
          </h1>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8 lg:py-10">
        {/* Admin: professional card */}
        {admin && (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200/90 overflow-hidden mb-6">
              <div className="p-6 lg:p-8 flex flex-col sm:flex-row items-start gap-6">
                <div className="flex-shrink-0 w-20 h-20 rounded-full bg-[#00356b] text-white flex items-center justify-center text-2xl font-semibold ring-4 ring-white shadow-md" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-slate-900 tracking-tight" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                    {displayName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                  <span className="inline-flex mt-2 rounded-md bg-[#00356b]/10 px-2.5 py-1 text-xs font-medium text-[#00356b]">
                    Administrator
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200/90 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-800">Quick actions</h3>
              </div>
              <div className="p-6">
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-2 rounded-md bg-[#00356b] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#002a54] focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:ring-offset-2 transition-colors"
                >
                  Open Admin Portal
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </Link>
              </div>
            </div>
          </>
        )}

        {/* Dean Of A College: professional card */}
        {!admin && dean && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200/90 overflow-hidden mb-6">
            <div className="p-6 lg:p-8 flex flex-col sm:flex-row items-start gap-6">
              <div className="flex-shrink-0 w-20 h-20 rounded-full bg-[#0b2d52] text-white flex items-center justify-center text-2xl font-semibold ring-4 ring-white shadow-md" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-slate-900 tracking-tight" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                  {displayName}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                <span className="inline-flex mt-2 rounded-md bg-[#0b2d52]/10 px-2.5 py-1 text-xs font-medium text-[#0b2d52]">
                  {DEAN_DISPLAY_NAME}
                </span>
                {user.collegeName && <p className="mt-2 text-sm text-slate-600">College: {user.collegeName}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Supervisor: professional card */}
        {!admin && !dean && supervisor && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200/90 overflow-hidden mb-6">
            <div className="p-6 lg:p-8 flex flex-col sm:flex-row items-start gap-6">
              <div className="flex-shrink-0 w-20 h-20 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-2xl font-semibold ring-4 ring-white shadow-md" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-slate-900 tracking-tight" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                  {displayName}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                <span className="inline-flex mt-2 rounded-md bg-[#1e3a5f]/10 px-2.5 py-1 text-xs font-medium text-[#1e3a5f]">
                  {SUPERVISOR_DISPLAY_NAME}
                </span>
                {user.communityName && <p className="mt-2 text-sm text-slate-600">Community: {user.communityName}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Community Leader: professional card */}
        {!admin && !dean && !supervisor && communityLeader && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200/90 overflow-hidden mb-6">
            <div className="p-6 lg:p-8 flex flex-col sm:flex-row items-start gap-6">
              <div className="flex-shrink-0 w-20 h-20 rounded-full bg-[#2d5a87] text-white flex items-center justify-center text-2xl font-semibold ring-4 ring-white shadow-md" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-slate-900 tracking-tight" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                  {displayName}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                <span className="inline-flex mt-2 rounded-md bg-[#2d5a87]/10 px-2.5 py-1 text-xs font-medium text-[#2d5a87]">
                  {COMMUNITY_LEADER_DISPLAY_NAME}
                </span>
                <Link
                  to="/event-registrations"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#00356b] px-4 py-2 text-sm font-medium text-white hover:bg-[#002a54] focus:outline-none focus:ring-2 focus:ring-[#00356b]/30"
                >
                  Manage event registrations
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Student: reference layout — left profile, right events grid */}
        {!admin && !dean && !supervisor && !communityLeader && (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8 lg:gap-10">
            {/* Left: profile — sticky so it stays visible when scrolling */}
            <div className="lg:sticky lg:top-24 lg:self-start h-fit order-2 lg:order-1">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 flex flex-col items-center">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-hidden
                    onChange={handlePhotoChange}
                  />
                  <div className="relative">
                    {pictureUrl ? (
                      <img src={pictureUrl} alt="" className="w-28 h-28 rounded-full object-cover ring-2 ring-slate-100" />
                    ) : (
                      <div className="w-28 h-28 rounded-full bg-[#00356b] text-white flex items-center justify-center text-3xl font-semibold ring-2 ring-slate-100" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                        {initial}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="absolute bottom-0 right-0 w-8 h-8 rounded-lg bg-[#00356b] text-white flex items-center justify-center shadow-md hover:bg-[#002a54] focus:outline-none focus:ring-2 focus:ring-[#00356b]/40"
                      aria-label="Change profile picture"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                  </div>
                  <h2 className="mt-4 text-xl font-bold text-slate-900 text-center" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                    {displayName}
                  </h2>
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#00356b] px-3 py-1 text-xs font-medium text-white">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    Active Student
                  </span>
                </div>
                <div className="px-6 pb-6 space-y-4">
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-[#00356b]">
                      <IconId className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Student ID</p>
                      <p className="text-sm font-medium text-slate-900">{studentUniNumber}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-[#00356b]">
                      <IconEnvelope className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Email address</p>
                      <p className="text-sm font-medium text-slate-900 break-all">{user.email || "—"}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-[#00356b]">
                      <IconDepartment className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">College</p>
                      <p className="text-sm font-medium text-slate-900">{college}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-[#00356b]">
                      <IconDepartment className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Major</p>
                      <p className="text-sm font-medium text-slate-900">{major}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: My Registered Events — header + grid/list toggle + event cards grid + Discover card */}
            <div className="min-w-0 order-1 lg:order-2">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#00356b]/10 text-[#00356b]">
                      <IconCalendar className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                        My Registered Events
                      </h3>
                      <p className="text-xs text-slate-500">{registrations.length} event{registrations.length !== 1 ? "s" : ""} registered</p>
                    </div>
                  </div>
                  <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50/50">
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      className={`p-2 rounded-md transition-colors ${viewMode === "grid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                      aria-label="Grid view"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("list")}
                      className={`p-2 rounded-md transition-colors ${viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                      aria-label="List view"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  {viewMode === "grid" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {registrations.map((reg) => {
                        const completed = isEventCompleted(reg);
                        const card = (
                          <>
                            <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden">
                              {reg.image ? (
                                <img src={reg.image} alt="" className={`h-full w-full object-cover ${completed ? "grayscale" : "group-hover:scale-105 transition-transform duration-200"}`} />
                              ) : (
                                <div className={`h-full w-full flex items-center justify-center ${completed ? "text-slate-400" : "text-slate-300"}`}>
                                  <IconCalendar className="w-12 h-12" />
                                </div>
                              )}
                              <span className={`absolute top-2 right-2 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white ${completed ? "bg-slate-500" : "bg-[#00356b]"}`}>
                                {completed ? "Completed" : "Upcoming"}
                              </span>
                              {reg.status === 'pending_payment' || reg.status === 'pending' ? (
                                <span className="absolute bottom-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-amber-500 text-white">Pending payment</span>
                              ) : reg.status === 'paid' ? (
                                <span className="absolute bottom-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-blue-500 text-white">Paid — awaiting approval</span>
                              ) : reg.status === 'rejected' ? (
                                <span className="absolute bottom-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-red-500 text-white">Rejected</span>
                              ) : null}
                            </div>
                            <div className="p-4">
                              <h4 className="font-semibold text-slate-900 line-clamp-2">{reg.title}</h4>
                              <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                                <IconCalendar className="w-3.5 h-3.5 flex-shrink-0" />
                                {reg.date}
                                {reg.time ? ` · ${reg.time}` : ""}
                              </p>
                              {completed ? (
                                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                                  <IconCheck className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600" />
                                  Participation Certificate Issued
                                </p>
                              ) : (
                                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                                  <IconPin className="w-3.5 h-3.5 flex-shrink-0" />
                                  {reg.location || "—"}
                                </p>
                              )}
                              {completed ? (
                                <button
                                  type="button"
                                  className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                  Download Certificate
                                </button>
                              ) : (
                                <p className="mt-2 text-sm font-medium text-[#00356b] group-hover:underline">View Details</p>
                              )}
                            </div>
                          </>
                        );
                        return completed ? (
                          <div key={reg.eventId} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                            {card}
                          </div>
                        ) : (
                          <Link key={reg.eventId} to={`/events/${reg.eventId}`} className="group block rounded-xl border border-slate-200 bg-white overflow-hidden hover:border-[#00356b]/30 hover:shadow-md transition-all">
                            {card}
                          </Link>
                        );
                      })}
                      <Link
                        to="/events"
                        className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 hover:border-[#00356b]/40 hover:bg-slate-50 transition-colors min-h-[200px]"
                      >
                        <span className="flex items-center justify-center w-14 h-14 rounded-full bg-slate-200 text-slate-500 mb-3">
                          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </span>
                        <span className="font-semibold text-slate-700">Discover Events</span>
                        <span className="mt-1 text-xs text-slate-500 text-center">Register for more academic activities</span>
                      </Link>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {registrations.map((reg) => {
                        const completed = isEventCompleted(reg);
                        const row = (
                          <>
                            <div className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden ${completed ? "bg-slate-300" : "bg-slate-200"}`}>
                              {reg.image ? <img src={reg.image} alt="" className={`h-full w-full object-cover ${completed ? "grayscale" : ""}`} /> : <div className="h-full w-full flex items-center justify-center text-slate-400"><IconCalendar className="w-8 h-8" /></div>}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold text-slate-900">{reg.title}</h4>
                              <span className={`inline-block mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${completed ? "bg-slate-400 text-white" : "bg-[#00356b] text-white"}`}>
                                {completed ? "Completed" : "Upcoming"}
                              </span>
                              {(reg.status === 'pending_payment' || reg.status === 'paid') && (
                                <span className={`inline-block mt-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${reg.status === 'paid' ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>
                                  {reg.status === 'paid' ? "Paid — awaiting approval" : "Pending payment"}
                                </span>
                              )}
                              <p className="mt-1 text-xs text-slate-500 flex items-center gap-1.5">
                                <IconCalendar className="w-3.5 h-3.5" />
                                {reg.date}
                                {reg.time ? ` · ${reg.time}` : ""}
                              </p>
                              {completed ? (
                                <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1.5">
                                  <IconCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  Participation Certificate Issued
                                </p>
                              ) : (
                                <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1.5">
                                  <IconPin className="w-3.5 h-3.5" />
                                  {reg.location || "—"}
                                </p>
                              )}
                              {completed ? (
                                <button type="button" className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                  Download Certificate
                                </button>
                              ) : (
                                <p className="mt-1 text-sm font-medium text-[#00356b]">View Details</p>
                              )}
                            </div>
                            {!completed && (
                              <div className="flex-shrink-0 self-center text-slate-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                              </div>
                            )}
                          </>
                        );
                        return completed ? (
                          <li key={reg.eventId} className="flex gap-4 rounded-lg border border-slate-100 bg-slate-50/30 p-4">
                            {row}
                          </li>
                        ) : (
                          <li key={reg.eventId}>
                            <Link to={`/events/${reg.eventId}`} className="flex gap-4 rounded-lg border border-slate-100 bg-slate-50/30 p-4 hover:bg-slate-50 hover:border-slate-200 transition-all">
                              {row}
                            </Link>
                          </li>
                        );
                      })}
                      <Link
                        to="/events"
                        className="flex items-center gap-4 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/30 p-4 hover:bg-slate-50 transition-colors"
                      >
                        <span className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-200 text-slate-500">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </span>
                        <div>
                          <span className="font-semibold text-slate-700">Discover Events</span>
                          <span className="block text-xs text-slate-500">Register for more academic activities</span>
                        </div>
                      </Link>
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;

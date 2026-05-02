import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isAdmin } from "../utils/permissions";
import { getCommunities as fetchAssociationsForStaff, getMajors } from "../lib/api";
import { buildCanonicalCollegeOptions } from "../canonicalCollege";

// ── Role config ──────────────────────────────────────────────────────────────
const ROLES = [
  { value: "student",          label: "User",          color: "bg-slate-100 text-slate-700" },
  { value: "community_leader", label: "Association Leader", color: "bg-blue-100 text-blue-700" },
  { value: "supervisor",       label: "Supervisor",       color: "bg-purple-100 text-purple-700" },
  { value: "dean",             label: "Dean",             color: "bg-amber-100 text-amber-700" },
  { value: "admin",            label: "Admin",            color: "bg-teal-100 text-green-700" },
];

const roleColor = (role) =>
  ROLES.find((r) => r.value === role)?.color ?? "bg-slate-100 text-slate-600";

const roleLabel = (role) =>
  ROLES.find((r) => r.value === role)?.label ?? role ?? "—";

// ── API helpers ──────────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const res = await fetch(path, { credentials: "include", ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}


const getUsers   = ()               => apiFetch("/api/admin/users");
const getColleges = ()              => apiFetch("/api/colleges");
const patchUserRole = (id, body)    =>
  apiFetch(`/api/admin/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

// ── Role Badge ────────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColor(role)}`}>
      {roleLabel(role)}
    </span>
  );
}

// ── Edit Role Modal ───────────────────────────────────────────────────────────
function EditRoleModal({ user: targetUser, colleges, communities, onClose, onSaved }) {
  const [selectedRole, setSelectedRole] = useState(targetUser.role || "student");
  const [collegeId, setCollegeId]       = useState(targetUser.collegeId ?? "");
  const [communityId, setCommunityId]   = useState(targetUser.communityId ?? "");
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");

  const needsCollege    = selectedRole === "dean";
  const needsCommunity  = selectedRole === "supervisor" || selectedRole === "community_leader";

  async function handleSave() {
    setError("");
    if (needsCollege && !collegeId) { setError("Please select a college."); return; }
    if (needsCommunity && !communityId) { setError("Please select an association."); return; }

    setSaving(true);
    try {
      const body = { role: selectedRole };
      if (needsCollege)   body.collegeId   = Number(collegeId);
      if (needsCommunity) body.communityId  = Number(communityId);
      const updated = await patchUserRole(targetUser.id, body);
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#0b2d52]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              Edit Role
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 truncate">{targetUser.email}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Current role */}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Current role:</span>
            <RoleBadge role={targetUser.role} />
          </div>

          {/* Role selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">New Role</label>
            <div className="grid grid-cols-1 gap-2">
              {ROLES.map((r) => (
                <label key={r.value} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-[#00356b]/40 hover:bg-slate-50 transition-all has-[:checked]:border-[#00356b] has-[:checked]:bg-[#00356b]/5">
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={selectedRole === r.value}
                    onChange={() => { setSelectedRole(r.value); setCollegeId(""); setCommunityId(""); }}
                    className="text-[#00356b] focus:ring-[#00356b]"
                  />
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${r.color}`}>
                    {r.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* College selector (dean only) */}
          {needsCollege && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assign to College</label>
              <select
                value={collegeId}
                onChange={(e) => setCollegeId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:border-[#00356b]"
              >
                <option value="">Select a college…</option>
                {colleges.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Community selector (supervisor / community_leader) */}
          {needsCommunity && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assign to association</label>
              <select
                value={communityId}
                onChange={(e) => setCommunityId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:border-[#00356b]"
              >
                <option value="">Select an association (club/society)…</option>
                {communities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-[#00356b] text-white hover:bg-[#00356b]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function ManageUsers() {
  const navigate          = useNavigate();
  const { user, loading } = useAuth();

  const [users, setUsers]               = useState([]);
  const [colleges, setColleges]         = useState([]);
  const [communities, setCommunities]   = useState([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError]     = useState("");
  const [search, setSearch]             = useState("");
  const [roleFilter, setRoleFilter]     = useState("all");
  const [editingUser, setEditingUser]   = useState(null);
  const [successMsg, setSuccessMsg]     = useState("");

  // Guard: admin only
  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/login", { replace: true }); return; }
    if (!isAdmin(user)) { navigate("/admin", { replace: true }); }
  }, [user, loading, navigate]);

  // Load data
  const loadData = useCallback(async () => {
    setFetchLoading(true);
    setFetchError("");
    try {
      const [usersData, collegesData, majorsData, communitiesData] = await Promise.all([
        getUsers(),
        getColleges(),
        getMajors(),
        fetchAssociationsForStaff({ kind: "association", limit: 100 }),
      ]);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setColleges(
        buildCanonicalCollegeOptions(
          Array.isArray(collegesData) ? collegesData : [],
          Array.isArray(majorsData) ? majorsData : []
        )
      );
      setCommunities(Array.isArray(communitiesData) ? communitiesData : []);
    } catch (err) {
      setFetchError(err.message || "Failed to load users.");
    } finally {
      setFetchLoading(false);
    }
  }, []);

  useEffect(() => { if (user && isAdmin(user)) loadData(); }, [user, loadData]);

  // Filter
  const filtered = users.filter((u) => {
    const matchRole   = roleFilter === "all" || u.role === roleFilter;
    const matchSearch = !search || u.email?.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  // After save
  function handleSaved(updated) {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
    setEditingUser(null);
    setSuccessMsg(`Role updated for ${updated.email}`);
    setTimeout(() => setSuccessMsg(""), 4000);
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f6f3]">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!isAdmin(user)) return null;

  return (
    <div className="min-h-screen bg-[#f7f6f3] text-slate-900">
      {/* Modal */}
      {editingUser && (
        <EditRoleModal
          user={editingUser}
          colleges={colleges}
          communities={communities}
          onClose={() => setEditingUser(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Success toast */}
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 rounded-xl shadow-lg px-5 py-3 text-sm font-medium animate-fade-in">
          <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {successMsg}
        </div>
      )}

      {/* Page header */}
      <section className="bg-[#f7f6f3] pt-6 pb-2">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-10">
          <nav className="text-sm" aria-label="Breadcrumb">
            <Link to="/admin" className="text-slate-500 hover:text-slate-700 transition-colors">
              Admin Portal
            </Link>
            <span className="mx-2 text-slate-400" aria-hidden>&gt;</span>
            <span className="font-semibold text-[#00356b]">Manage Users</span>
          </nav>
        </div>
      </section>

      <section className="bg-[#f7f6f3] pt-10 pb-6">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-10">
          <div className="text-center max-w-2xl mx-auto mb-6">
            <h1
              className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-[#0b2d52] leading-tight tracking-tight mb-4"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              Manage Users
            </h1>
            <p className="text-slate-600 leading-relaxed">
              View all platform users and assign or change their roles.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-screen-2xl mx-auto px-6 lg:px-10 pb-16">

        {/* Stats row */}
        {!fetchLoading && !fetchError && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            {ROLES.map((r) => {
              const count = users.filter((u) => u.role === r.value).length;
              return (
                <button
                  key={r.value}
                  onClick={() => setRoleFilter(roleFilter === r.value ? "all" : r.value)}
                  className={`rounded-xl border p-4 text-left transition-all duration-150 ${
                    roleFilter === r.value
                      ? "border-[#00356b] bg-white shadow-md"
                      : "border-slate-200 bg-white hover:border-[#00356b]/40 hover:shadow-sm"
                  }`}
                >
                  <p className="text-2xl font-bold text-[#0b2d52]">{count}</p>
                  <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${r.color}`}>
                    {r.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Search + filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:border-[#00356b] transition"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:border-[#00356b] transition"
          >
            <option value="all">All Roles</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 hover:border-[#00356b]/40 hover:text-[#00356b] transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Loading */}
        {fetchLoading && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-12 text-center">
            <div className="inline-block w-8 h-8 border-2 border-[#00356b] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-slate-500 text-sm">Loading users…</p>
          </div>
        )}

        {/* Error */}
        {fetchError && !fetchLoading && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700 text-sm">
            <p>{fetchError}</p>
            <button onClick={loadData} className="mt-3 text-[#00356b] underline text-sm">Try again</button>
          </div>
        )}

        {/* Table */}
        {!fetchLoading && !fetchError && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                No users found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      <th className="text-left px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">#</th>
                      <th className="text-left px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Email</th>
                      <th className="text-left px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Role</th>
                      <th className="text-left px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Assigned To</th>
                      <th className="text-right px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((u, idx) => (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5 text-slate-400">{idx + 1}</td>
                        <td className="px-5 py-3.5 font-medium text-slate-800">{u.email}</td>
                        <td className="px-5 py-3.5">
                          <RoleBadge role={u.role} />
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          {(() => {
                            const showRoleCollege =
                              (u.role === "dean" || u.role === "student") && u.collegeName;
                            const showAssoc =
                              u.role === "supervisor" || u.role === "community_leader";
                            const commCollege =
                              showAssoc && u.assignedCollegeName ? u.assignedCollegeName : null;
                            const commName = showAssoc && u.communityName ? u.communityName : null;
                            const has =
                              showRoleCollege || commCollege || commName;
                            if (!has) {
                              return <span className="text-slate-300">—</span>;
                            }
                            return (
                              <div className="flex flex-col gap-1">
                                {showRoleCollege ? (
                                  <span className="flex items-center gap-1.5">
                                    <span aria-hidden>🏛</span>
                                    {u.collegeName}
                                  </span>
                                ) : null}
                                {commCollege ? (
                                  <span className="flex items-center gap-1.5">
                                    <span aria-hidden>🏛</span>
                                    {commCollege}
                                  </span>
                                ) : null}
                                {commName ? (
                                  <span className="flex items-center gap-1.5">
                                    <span aria-hidden>👥</span>
                                    {commName}
                                  </span>
                                ) : null}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {u.role !== "admin" && (
                            <button
                              onClick={() => setEditingUser(u)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:border-[#00356b]/40 hover:text-[#00356b] hover:bg-[#00356b]/5 transition-all"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                              Change Role
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-400">
                  Showing {filtered.length} of {users.length} users
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ManageUsers;
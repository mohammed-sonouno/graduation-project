import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function AdminPortal() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      const u = stored ? JSON.parse(stored) : null;
      if (!u || u.role !== "admin") {
        navigate("/login", { replace: true });
        return;
      }
      setUser(u);
    } catch {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-blue-900">Admin Portal</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              Log out
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Welcome, Admin</h2>
          <p className="text-gray-600">
            You are logged in with the <strong>admin</strong> role from the database.
            Use this portal to manage the platform.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/manage-events"
            className="block p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow transition"
          >
            <h3 className="font-semibold text-gray-900">Manage Events</h3>
            <p className="text-sm text-gray-500 mt-1">Create, edit, and submit events for approval.</p>
          </Link>
          <Link
            to="/event-approval"
            className="block p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow transition"
          >
            <h3 className="font-semibold text-gray-900">Event Approval</h3>
            <p className="text-sm text-gray-500 mt-1">Review and approve events.</p>
          </Link>
          <Link
            to="/dashboard"
            className="block p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow transition"
          >
            <h3 className="font-semibold text-gray-900">Dashboard</h3>
            <p className="text-sm text-gray-500 mt-1">View dashboard.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default AdminPortal;

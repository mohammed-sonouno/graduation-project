import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import Colleges from './pages/Colleges';
import SingleCollege from './pages/SingleCollege';
import Majors from './pages/Majors';
import MajorDetails from './pages/MajorDetails';
import Events from './pages/Events';
import EventDetails from './pages/EventDetails';
import Dashboard from './pages/Dashboard';
import EventApproval from './pages/EventApproval';
import Profile from './pages/Profile';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import AdminPortal from './pages/AdminPortal';
import ManageEvents from './pages/ManageEvents';
import EventRegistrations from './pages/EventRegistrations';
import ForgotPassword from './pages/ForgotPassword';
import CompleteProfile from './pages/CompleteProfile';
import ChangePassword from './pages/ChangePassword';
import ManageUsers from './pages/ManageUsers';
import CommunitiesPage from './pages/CommunitiesPage';
import CommunityDetails from './pages/Communitydetails';
import OwnerJoinRequestsPage from './pages/OwnerJoinRequestsPage';
import CommunityChatPage from './pages/CommunityChatPage';
import AdminCommunityRequests from './pages/AdminCommunityRequests';
import RequireAuth from './components/RequireAuth';

function NotFound() {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="text-2xl font-bold text-[#0b2d52] font-serif">Page not found</h1>
      <p className="mt-2 text-slate-600">The page you're looking for doesn't exist.</p>
      <Link to="/" className="mt-6 text-[#00356b] font-semibold hover:underline">Go to home</Link>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="colleges" element={<Colleges />} />
          <Route path="colleges/:id" element={<SingleCollege />} />
          <Route path="majors" element={<Majors />} />
          <Route path="majors/:id" element={<MajorDetails />} />
          <Route path="events" element={<Events />} />
          <Route path="events/:id" element={<EventDetails />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="event-approval" element={<EventApproval />} />
          <Route path="admin" element={<AdminPortal />} />
          <Route path="manage-events" element={<ManageEvents />} />
          <Route path="manage-users" element={<ManageUsers />} />
          <Route path="event-registrations" element={<EventRegistrations />} />
          <Route path="profile" element={<Profile />} />
          <Route path="login" element={<Login />} />
          <Route path="admin-login" element={<AdminLogin />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="complete-profile" element={<CompleteProfile />} />
          <Route path="change-password" element={<ChangePassword />} />

          {/* Community routes — login required (specific paths before :id) */}
          <Route path="communities" element={<RequireAuth><CommunitiesPage /></RequireAuth>} />
          <Route path="communities/:id/join-requests" element={<RequireAuth><OwnerJoinRequestsPage /></RequireAuth>} />
          <Route path="communities/:id/chat" element={<RequireAuth><CommunityChatPage /></RequireAuth>} />
          <Route path="communities/:id" element={<RequireAuth><CommunityDetails /></RequireAuth>} />
          <Route path="admin-community-requests" element={<AdminCommunityRequests />} />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
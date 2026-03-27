import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

function Layout() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#f7f7f5]">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

export default Layout;

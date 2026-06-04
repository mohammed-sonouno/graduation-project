import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ChatbotWidget from './ChatbotWidget';

function Layout() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#f7f7f5]">
        <Outlet />
      </main>
      <Footer />
      <ChatbotWidget />
    </>
  );
}

export default Layout;

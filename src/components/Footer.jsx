function Footer() {
  return (
    <footer className="bg-[#081a35] text-gray-300 py-16 w-full min-w-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
        <div>
          <h3 className="text-white font-serif text-2xl font-bold mb-4">Najah</h3>
          <p className="text-sm leading-relaxed">
            The Najah Platform is dedicated to excellence in education, research, and fostering an inclusive community of scholars.
          </p>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Resources</h4>
          <ul className="space-y-3 text-sm">
            <li><a href="#accessibility" className="hover:text-white transition">Accessibility at Najah</a></li>
            <li><a href="#privacy" className="hover:text-white transition">Privacy Policy</a></li>
            <li><a href="#work" className="hover:text-white transition">Work at Najah</a></li>
            <li><a href="#emergency" className="hover:text-white transition">Emergency Info</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Contact</h4>
          <ul className="space-y-3 text-sm">
            <li>Najah University Campus</li>
            <li>Main Gate, Academic Drive</li>
            <li>+1 (555) 123-4567</li>
            <li>contact@najah.edu</li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Follow Us</h4>
          <div className="flex gap-6 text-sm">
            <a href="#fb" className="hover:text-white transition" aria-label="Facebook">FB</a>
            <a href="#tw" className="hover:text-white transition" aria-label="Twitter">TW</a>
            <a href="#ig" className="hover:text-white transition" aria-label="Instagram">IG</a>
            <a href="#li" className="hover:text-white transition" aria-label="LinkedIn">LI</a>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-12 pt-8 pb-6 border-t border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-500 uppercase tracking-wide">
        <p>© 2023 Najah University. All rights reserved.</p>
        <div className="flex gap-6">
          <a href="#sitemap" className="hover:text-white transition">Site Map</a>
          <a href="#feedback" className="hover:text-white transition">Feedback</a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

import { useState } from 'react';
import { Link } from 'react-router-dom';

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setMessage('Registration is not yet connected. Please contact the university for enrollment.');
  };

  const layeredBg = {
    background: `linear-gradient(158deg,
      #ffffff 0%,
      #f7f4f4 38%,
      #f0eded 38%,
      #f6f6f6 58%,
      #efefef 58%,
      #efefef 78%,
      #e8e8e8 78%,
      #e8e8e8 100%
    )`,
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center py-12" style={layeredBg}>
      <div className="max-w-md w-full mx-auto px-6 relative">
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-md p-8 md:p-10">
          <h1 className="mt-2 text-center text-2xl md:text-3xl font-bold text-[#0b2d52] leading-tight">
            Create account
          </h1>
          <p className="mt-2 text-center text-sm text-slate-600 leading-relaxed">
            Register for the Najah platform. Use your university email.
          </p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="reg-email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. student@stu.najah.edu"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
              />
            </div>
            <div>
              <label htmlFor="reg-password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
              />
            </div>
            {message && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {message}
              </div>
            )}
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center rounded-xl bg-[#00356b] px-6 py-3 text-white font-semibold shadow-sm hover:bg-[#002a54] focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:ring-offset-2"
            >
              Create account
            </button>
          </form>
          <p className="mt-8 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-[#00356b] hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;

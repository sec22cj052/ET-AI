import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Register
      const regRes = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password, 
          full_name: fullName, 
          role,
          company: company || undefined
        }),
      });

      if (!regRes.ok) {
        const data = await regRes.json();
        throw new Error(data.detail || 'Failed to register');
      }

      // 2. Login immediately after
      const loginRes = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!loginRes.ok) {
        throw new Error('Registered, but failed to login automatically');
      }

      const { access_token, refresh_token } = await loginRes.json();
      await login(access_token, refresh_token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest py-10">
      <div className="w-full max-w-md p-8 hub-card shadow-lg">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white text-2xl mb-4">
            <span className="material-symbols-outlined">person_add</span>
          </div>
          <h1 className="text-headline-sm font-headline-sm text-on-surface">Create an Account</h1>
          <p className="text-body-md text-on-surface-variant mt-2">Join the Industrial Knowledge Platform</p>
        </div>

        {/* Admin | Operator Toggle */}
        <div className="flex p-1 bg-surface-container-low rounded-lg mb-6">
          <button
            type="button"
            onClick={() => setRole('admin')}
            className={`flex-1 py-2 text-label-md font-bold rounded-md transition-all ${
              role === 'admin' 
                ? 'bg-white text-primary shadow-sm' 
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => setRole('user')}
            className={`flex-1 py-2 text-label-md font-bold rounded-md transition-all ${
              role === 'user' 
                ? 'bg-white text-primary shadow-sm' 
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Operator
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-body-sm rounded-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">error</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-label-md font-bold text-on-surface mb-1.5">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full px-4 py-2 border border-outline-variant rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <label className="block text-label-md font-bold text-on-surface mb-1.5">Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-outline-variant rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              placeholder={role === 'admin' ? 'admin@company.com' : 'operator@company.com'}
              required
            />
          </div>

          {role === 'admin' && (
            <div>
              <label className="block text-label-md font-bold text-on-surface mb-1.5">Company (Optional)</label>
              <input
                type="text"
                value={company}
                onChange={e => setCompany(e.target.value)}
                className="w-full px-4 py-2 border border-outline-variant rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="Acme Corp"
              />
            </div>
          )}

          <div>
            <label className="block text-label-md font-bold text-on-surface mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-outline-variant rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-bold text-label-lg transition-colors flex items-center justify-center gap-2 mt-2 disabled:opacity-70"
          >
            {loading ? (
              <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            ) : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-body-sm text-on-surface-variant mt-8">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-bold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '../components/common/Button.jsx';
import { Input } from '../components/common/Input.jsx';
import { Lock, Mail, AlertTriangle } from 'lucide-react';

export function LoginPage({ onNavigateToRegister }) {
  const { signIn, configured, authError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 selection:bg-indigo-100">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-brand-gradient text-white font-bold text-lg flex items-center justify-center mx-auto shadow-xs">
            M
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            MOM Creator
          </h1>
          <p className="text-xs text-slate-500">
            Sign in to access your meeting minutes and action items.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          {!configured && (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs flex items-start gap-2.5 text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Supabase Environment Configuration</p>
                <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                  Provide <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">VITE_SUPABASE_URL</code> and <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">VITE_SUPABASE_ANON_KEY</code> in your local <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">.env</code> file.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              label="Email Address"
              placeholder="you@company.com"
              icon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />

            <Input
              type="password"
              label="Password"
              placeholder="••••••••"
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {(error || authError) && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                {error || authError}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              loading={loading}
              disabled={!configured}
            >
              Sign In
            </Button>
          </form>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Don't have an account?</span>
            <button
              type="button"
              onClick={onNavigateToRegister}
              className="text-brand-gradient font-semibold hover:text-indigo-700 cursor-pointer"
            >
              Create Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

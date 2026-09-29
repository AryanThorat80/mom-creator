import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '../components/common/Button.jsx';
import { Input } from '../components/common/Input.jsx';
import { Lock, Mail, User, CheckCircle2, ArrowRight } from 'lucide-react';

export function RegisterPage({ onNavigateToLogin }) {
  const { signUp } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailConfirmationRequired, setEmailConfirmationRequired] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await signUp(email.trim(), password, name.trim());
      // When email confirmation is enabled in Supabase, res.user is created but res.session is null
      if (res?.user && !res?.session) {
        setEmailConfirmationRequired(true);
      }
    } catch (err) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 selection:bg-indigo-100">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold text-lg flex items-center justify-center mx-auto shadow-xs">
            M
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Create Your Account
          </h1>
          <p className="text-xs text-slate-500">
            Get started with AI-generated Minutes of Meeting and task tracking.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          {emailConfirmationRequired ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900">Check Your Email</h3>
                <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                  We've sent a verification link to <span className="font-semibold text-slate-800">{email}</span>. Please verify your email, then proceed to sign in.
                </p>
              </div>
              <div className="pt-2">
                <Button
                  onClick={onNavigateToLogin}
                  icon={ArrowRight}
                  className="w-full"
                >
                  Go to Sign In
                </Button>
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  type="text"
                  label="Full Name"
                  placeholder="Aryan Thorat"
                  icon={User}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />

                <Input
                  type="email"
                  label="Work Email"
                  placeholder="you@company.com"
                  icon={Mail}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <Input
                  type="password"
                  label="Password"
                  placeholder="At least 6 characters"
                  icon={Lock}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                {error && (
                  <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  loading={loading}
                >
                  Sign Up
                </Button>
              </form>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Already have an account?</span>
                <button
                  type="button"
                  onClick={onNavigateToLogin}
                  className="text-indigo-600 font-semibold hover:text-indigo-700 cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

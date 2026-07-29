import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import openWebLogo from '@/assets/openweb-logo.png';
import { authService } from '@/services/authService';
import { IS_EXTENSION } from '@/config/appMode';
import { formatError } from '@/utils/errorFormatter';
import { Checkbox } from '@/components/ui/checkbox';
import {
  loadSavedCredentials,
  saveCredentials,
  clearSavedCredentials,
} from '@/utils/extensionCredentials';

/**
 * Login Page Component
 * Handles user authentication with email/password and Google OAuth
 */
export default function Login() {
  const defaultAppRoute = IS_EXTENSION ? '/RealmDashboard' : '/Dashboard';
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rememberMe, setRememberMe] = useState(IS_EXTENSION);

  useEffect(() => {
    if (authService.getAuthStatus()) {
      navigate(defaultAppRoute);
      return;
    }
    if (!IS_EXTENSION) return;
    loadSavedCredentials().then((saved) => {
      if (!saved) return;
      setEmail(saved.email || '');
      setPassword(saved.password || '');
      setRememberMe(true);
    });
  }, [navigate, defaultAppRoute]);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError('Please provide both email and password');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await authService.login(email, password);
      if (IS_EXTENSION) {
        if (rememberMe) {
          await saveCredentials(email, password);
        } else {
          await clearSavedCredentials();
        }
      }
      setSuccess('Login successful! Redirecting...');
      setTimeout(() => {
        navigate(defaultAppRoute);
      }, 1000);
    } catch (err) {
      const errorMessage = err.message || err.toString() || '';

      if (errorMessage.includes('401') ||
          errorMessage.includes('Unauthorized') ||
          errorMessage.includes('Invalid credentials') ||
          errorMessage.includes('Login failed: 401')) {
        setError('Invalid email or password. Please check your credentials and try again.');
      } else if (errorMessage.includes('CORS') ||
                 errorMessage.includes('Failed to fetch') ||
                 errorMessage.includes('NetworkError') ||
                 errorMessage.includes('Network request failed')) {
        setError(formatError(err, null));
      } else if (errorMessage.includes('503') ||
                 errorMessage.includes('502') ||
                 errorMessage.includes('500')) {
        setError(formatError(err, null));
      } else {
        setError(errorMessage || formatError(err, null));
      }
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    if (error) setError('');
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="absolute inset-0">
        <div className="absolute -top-24 -left-24 h-56 w-56 rounded-full bg-[rgb(75,99,226)] opacity-20 blur-3xl" />
        <div className="absolute -bottom-32 -right-10 h-64 w-64 rounded-full bg-indigo-500 opacity-10 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 opacity-95" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full flex-col md:flex-row">
        <section className="flex w-full items-center justify-center px-4 py-10 sm:px-8 md:w-1/2 md:bg-slate-50 md:py-16 lg:w-2/5">
          <Card className="w-full max-w-md border-slate-200 shadow-xl">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 hidden md:flex">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-white shadow">
                  <span className="text-lg font-bold text-slate-900">AY</span>
                </div>
              </div>

              <CardTitle className="text-2xl font-bold text-slate-900 md:text-3xl">
                Welcome back
              </CardTitle>
              <CardDescription className="text-sm text-slate-600">
                Sign in to access the Adyoulike configuration dashboard
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-200 bg-green-50">
                  <AlertDescription className="text-green-800">{success}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleLogin} className="space-y-4" autoComplete="on">
                <div className="space-y-2">
                  <Label htmlFor="email" variant="body">
                    Email Address *
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-slate-400" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearError();
                      }}
                      className="pl-10"
                      autoComplete="username email"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" variant="body">
                      Password *
                    </Label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-xs font-semibold uppercase tracking-wide text-[rgb(75,99,226)] hover:text-indigo-600"
                      disabled={loading}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-slate-400" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearError();
                      }}
                      className="pl-10 pr-10"
                      autoComplete="current-password"
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transform text-slate-400 hover:text-slate-600 md:hidden"
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {IS_EXTENSION && (
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                    <Checkbox
                      id="remember-me"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked === true)}
                      disabled={loading}
                    />
                    <span>Remember email and password on this device</span>
                  </label>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>

              <div className="block rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 sm:text-sm md:hidden">
                <p className="font-semibold text-slate-700">Need a hand?</p>
                <p className="mt-1 leading-relaxed">
                  If you have trouble typing your password on mobile, rotate your device or use the
                  “Show” button above. Still stuck? Contact{' '}
                  <span className="font-medium text-[rgb(75,99,226)]">support@adyoulike.com</span>.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="relative flex w-full items-center justify-center px-6 py-16 text-center text-white md:w-1/2 md:px-10 lg:w-3/5">
          <div className="absolute inset-0 bg-gradient-to-br from-black via-slate-900 to-black opacity-95" />
          <div className="relative z-10 flex max-w-lg flex-col items-center gap-8">
            <div className="flex flex-col items-center gap-6">
              <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-6 backdrop-blur">
                <p className="text-sm tracking-[0.6em] text-white/70">AD</p>
                <p className="text-sm tracking-[0.6em] text-white/70">YOU</p>
                <p className="text-sm tracking-[0.6em] text-white/70">LIKE</p>
              </div>
              <div className="flex items-center gap-3 text-white/70">
                <img
                  src={openWebLogo}
                  alt="OpenWeb logo"
                  className="h-6 w-auto drop-shadow-[0_0_8px_rgba(0,0,0,0.4)]"
                  style={{ filter: 'brightness(0) invert(1)' }}
                />
                <span className="text-xs uppercase tracking-[0.3em]">An OpenWeb company</span>
              </div>
            </div>

            <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
              Every brand has a story to tell.
            </h2>
          </div>
        </section>
      </div>

      <footer className="relative z-10 px-6 pb-8 text-center text-xs text-white/50">
        © {new Date().getFullYear()} Adyoulike. All rights reserved.
      </footer>
    </div>
  );
}

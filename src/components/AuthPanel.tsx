import React, { useState } from 'react';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInAnonymously 
} from '../firebase';
import { LogIn, Rocket, UserPlus, AlertTriangle } from 'lucide-react';

interface AuthPanelProps {
  onAuthSuccess: () => void;
}

export default function AuthPanel({ onAuthSuccess }: AuthPanelProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      onAuthSuccess();
    } catch (err: any) {
      console.error(err);
      setError('Google Sign-In blocked or failed. Please try Email/Password or Play as Guest!');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onAuthSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email. Toggle "Create Account" below!');
      } else if (err.code === 'auth/wrong-password') {
        setError('Invalid password. Please double check.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else {
        setError(err.message || 'Authentication failed. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestPlay = async () => {
    setLoading(true);
    setError('');
    try {
      await signInAnonymously(auth);
      onAuthSuccess();
    } catch (err: any) {
      console.error(err);
      setError('Guest option failed. Please use standard account settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-panel-container" className="flex flex-col items-center bg-slate-900/40 text-slate-100 p-8 rounded-3xl border border-slate-800/80 shadow-2xl backdrop-blur-sm w-full max-w-md mx-auto relative overflow-hidden">
      {" "}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500"></div>

      <div className="flex flex-col items-center text-center mb-6">
        <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-500/10 rounded-2xl border border-cyan-500/30 mb-3">
          <svg className="w-10 h-10 text-cyan-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h2 className="text-3xl font-black tracking-tighter italic">
          SLITHER<span className="text-cyan-400 text-xl not-italic ml-1">.IO</span>
        </h2>
        <p className="text-slate-400 text-xs mt-2 font-medium">
          Save your progress, unlock exotic skins, and dominate the global leaderboards!
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-950/20 border border-red-500/20 rounded-xl p-3 mb-4 text-xs text-red-300 w-full">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Google Login Trigger */}
      <button
        id="google-signin-btn"
        onClick={handleGoogleLogin}
        disabled={loading}
        className="flex items-center justify-center gap-3 w-full bg-white hover:bg-slate-100 text-slate-950 font-bold py-3.5 px-4 rounded-xl transition duration-200 cursor-pointer shadow-lg active:scale-[0.98]"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#ea4335"
            d="M12 5.04c1.62 0 3.08.56 4.22 1.65l3.15-3.15C17.43 1.63 14.93 1 12 1 7.37 1 3.4 3.65 1.51 7.5l3.65 2.85C6.1 7.4 8.84 5.04 12 5.04z"
          />
          <path
            fill="#34a853"
            d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.44c-.28 1.48-1.12 2.73-2.38 3.58l3.68 2.85c2.15-1.98 3.39-4.9 3.39-8.58z"
          />
          <path
            fill="#4285f4"
            d="M5.16 10.35c-.24-.71-.38-1.48-.38-2.27s.14-1.56.38-2.27L1.51 6.96C.54 8.78 0 10.84 0 13s.54 4.22 1.51 6.04l3.65-2.85c-.24-.71-.38-1.48-.38-2.27z"
          />
          <path
            fill="#fbbc05"
            d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.68-2.85c-1.11.75-2.53 1.19-4.28 1.19-3.16 0-5.9-2.36-6.84-5.31L1.51 16c1.89 3.85 5.86 6.5 10.49 6.5z"
          />
        </svg>
        <span className="text-xs uppercase font-extrabold tracking-wider">Connect Google Account</span>
      </button>

      <div className="flex items-center gap-3 w-full my-5">
        <div className="h-[1px] bg-slate-800 grow"></div>
        <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">OR USE EMAIL</span>
        <div className="h-[1px] bg-slate-800 grow"></div>
      </div>

      {/* Email Password Form */}
      <form onSubmit={handleEmailAction} className="space-y-3.5 w-full">
        <div>
          <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-widest">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition"
            required
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-widest">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 px-4 rounded-xl transition duration-200 cursor-pointer shadow-lg active:scale-[0.98]"
        >
          {isRegistering ? (
            <>
              <UserPlus className="w-4.5 h-4.5" />
              <span className="text-xs uppercase font-extrabold tracking-wider">Create Account & Play</span>
            </>
          ) : (
            <>
              <LogIn className="w-4.5 h-4.5" />
              <span className="text-xs uppercase font-extrabold tracking-wider">Sign In & Play</span>
            </>
          )}
        </button>
      </form>

      {/* Toggle Sign-In vs Register */}
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => {
            setIsRegistering(!isRegistering);
            setError('');
          }}
          className="text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-4 cursor-pointer"
        >
          {isRegistering ? 'Already have an account? Sign In' : "Don't have an account yet? Register Here"}
        </button>
      </div>

      <div className="w-full h-[1px] bg-slate-855 my-5"></div>

      {/* Guest Play */}
      <button
        onClick={handleGuestPlay}
        disabled={loading}
        className="flex items-center justify-center gap-2 w-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-bold py-3 px-4 rounded-xl transition duration-200 cursor-pointer border border-slate-750 active:scale-[0.98]"
      >
        <Rocket className="w-4.5 h-4.5 text-cyan-400" />
        <span className="text-xs uppercase font-extrabold tracking-wider">Play immediately as Guest</span>
      </button>

      <span className="text-[9px] text-slate-500 mt-4 text-center leading-relaxed font-bold uppercase tracking-wide">
        Guest sessions only preserve local data. Authenticate to secure persistent stats.
      </span>
    </div>
  );
}

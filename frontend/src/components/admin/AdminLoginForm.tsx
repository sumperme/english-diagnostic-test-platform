import { FormEvent, useState } from 'react';
import { AnimatedCharacters } from './AnimatedCharacters';

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3l18 18M10.5 10.7A3 3 0 0 0 12 15a3 3 0 0 0 2.3-1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M7.2 7.2C5.4 8.5 3.8 10.4 2 12c0 0 4 7 10 7 1.6 0 3.1-.4 4.4-1M14.8 14.8C13.9 15.5 12.9 16 12 16c-2.2 0-4-1.8-4-4 0-.9.5-1.9 1.2-2.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M9.9 5.1A10.7 10.7 0 0 1 12 5c6 0 10 7 10 7a17.5 17.5 0 0 1-2.7 3.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

type AdminLoginFormProps = {
  onLogin: (pw: string) => void;
};

export function AdminLoginForm({ onLogin }: AdminLoginFormProps) {
  const [adminName, setAdminName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Password required.');
      return;
    }
    setError('');
    onLogin(password);
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left panel — animated characters */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-edt-forest via-edt-indigo to-edt-forest p-12 lg:flex">
        <div className="relative z-20 text-xl font-bold tracking-wide text-edt-soft">EDT Admin</div>

        <div className="relative z-20 flex h-[500px] items-end justify-center">
          <AnimatedCharacters
            isTyping={isTyping}
            showPassword={showPassword}
            passwordLength={password.length}
          />
        </div>

        <div className="relative z-20 flex items-center gap-6 text-[13px] text-edt-soft/45">
          <span>English Diagnostic Test</span>
        </div>

        <div
          className="pointer-events-none absolute right-[10%] top-[15%] z-0 h-[300px] w-[300px] rounded-full bg-edt-neon/20 blur-[80px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute bottom-[10%] left-[5%] z-0 h-[400px] w-[400px] rounded-full bg-edt-gold/15 blur-[100px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"
          aria-hidden="true"
        />
      </div>

      {/* Right panel — login form */}
      <div className="flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-12 flex items-center justify-center gap-2 font-display text-lg font-bold text-edt-forest lg:hidden">
            EDT Admin
          </div>

          <div className="mb-10 text-center">
            <h1 className="mb-2.5 font-display text-[26px] font-bold leading-tight tracking-tight text-edt-forest">
              Sign in to Admin
            </h1>
            <p className="text-sm leading-relaxed text-edt-olive">
              Enter the admin password to manage e-vouchers.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-5" autoComplete="off">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium tracking-wide text-edt-forest">
                Admin name <span className="font-normal text-edt-olive">(optional)</span>
              </label>
              <div className="relative flex h-12 items-center rounded-[10px] border border-edt-olive/30 bg-[#fafafa] transition-colors focus-within:border-edt-neon focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(206,255,26,0.12)]">
                <span className="pointer-events-none pl-3.5 text-edt-olive/70">
                  <UserIcon />
                </span>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  onFocus={() => setIsTyping(true)}
                  onBlur={() => setIsTyping(false)}
                  placeholder="Enter your name"
                  className="h-full w-full bg-transparent px-3 text-sm text-edt-forest outline-none placeholder:text-edt-olive/50"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium tracking-wide text-edt-forest">
                Password
              </label>
              <div className="relative flex h-12 items-center rounded-[10px] border border-edt-olive/30 bg-[#fafafa] transition-colors focus-within:border-edt-neon focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(206,255,26,0.12)]">
                <span className="pointer-events-none pl-3.5 text-edt-olive/70">
                  <LockIcon />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="h-full w-full bg-transparent px-3 pr-11 text-sm text-edt-forest outline-none placeholder:text-edt-olive/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 flex items-center text-edt-olive transition-colors hover:text-edt-forest"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                </button>
              </div>
            </div>

            {error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-600">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="h-12 w-full rounded-[10px] bg-edt-gold text-[15px] font-semibold uppercase tracking-wide text-edt-forest transition-colors hover:bg-edt-neon"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

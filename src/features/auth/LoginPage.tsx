import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { AlertCircle, ArrowRight, Boxes, Layers, ShieldCheck } from 'lucide-react';
import { ErpButton, ErpInput, Field } from '../../components/erp';

const PHONE_RE = /^[6-9]\d{9}$/;

/** Keep digits only; drop a pasted +91 / 0 prefix, cap at 10 digits. */
function normalizePhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

export function LoginPage() {
  const { requestOtp, resendOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [userId, setUserId] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!PHONE_RE.test(phoneNumber)) {
      setError('Enter a valid 10-digit Indian mobile number (starts with 6–9).');
      return;
    }
    setLoading(true);
    try {
      const result = await requestOtp({
        phoneNumber,
        countryCode: '+91',
        mode: 'login',
      });
      setUserId(result.userId);
      setOtpSent(true);
      setOtp('');
      setCooldown(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{4,6}$/.test(otp)) {
      setError('Enter the 4–6 digit OTP from SMS.');
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(userId, otp);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!userId || cooldown > 0) return;
    setError('');
    setLoading(true);
    try {
      await resendOtp(userId);
      setCooldown(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--erp-bg)]">
      {/* Brand panel */}
      <aside className="relative hidden w-[44%] max-w-[640px] flex-col justify-between overflow-hidden bg-[#0f172a] p-10 text-white lg:flex xl:p-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(600px 400px at 0% 0%, rgb(37 99 235 / 0.45), transparent 60%), radial-gradient(500px 360px at 100% 100%, rgb(56 189 248 / 0.18), transparent 60%)',
          }}
        />
        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--erp-accent)] text-sm font-bold shadow-lg">EF</span>
          <span className="text-lg font-semibold tracking-tight">ERP Factory</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-[28px] font-semibold leading-tight tracking-tight">
            Run your garment factory from design to dispatch.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-300">
            One workspace for product development, purchasing, stock, production and quality.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              { icon: Layers, title: 'Design to production, connected', text: 'Designs, patterns, samples and BOMs flow straight into production orders.' },
              { icon: Boxes, title: 'Live stock and purchasing', text: 'Know what is on hand, what is reserved and what needs reordering.' },
              { icon: ShieldCheck, title: 'Quality and approvals built in', text: 'Inspections, CAPA and approval workflows with a full audit trail.' },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon size={16} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-slate-400">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} ERP Factory</p>
      </aside>

      {/* Form */}
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--erp-accent)] text-[13px] font-bold text-white">EF</span>
            <span className="text-base font-semibold text-erp-text-primary">ERP Factory</span>
          </div>

          <div className="rounded-xl border border-[var(--erp-border)] bg-[var(--erp-surface)] p-6 shadow-[var(--erp-shadow-md)] sm:p-8">
            <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} noValidate>
              <h1 className="text-xl font-semibold tracking-tight text-erp-text-primary">
                {otpSent ? 'Enter verification code' : 'Sign in'}
              </h1>
              <p className="mt-1 text-sm text-erp-text-muted">
                {otpSent
                  ? <>We sent a code by SMS to <span className="font-medium text-erp-text-secondary">+91 {phoneNumber}</span>.</>
                  : 'Use your registered mobile number. We’ll text you a one-time code.'}
              </p>

              {error && (
                <div className="erp-alert-error mt-5 flex items-start gap-2" role="alert">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <div className="mt-6 space-y-4">
                <Field label="Mobile number" htmlFor="login-phone">
                  <div className="flex gap-2">
                    <ErpInput value="+91" readOnly aria-label="Country code" className="!w-16 shrink-0 text-center" tabIndex={-1} />
                    <ErpInput
                      id="login-phone"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      // No maxLength: it would truncate a pasted "+91 98765 43210" before we strip the prefix.
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(normalizePhoneInput(e.target.value))}
                      placeholder="10-digit number"
                      disabled={otpSent}
                      required
                      autoFocus={!otpSent}
                    />
                  </div>
                </Field>

                {otpSent && (
                  <Field label="One-time code" htmlFor="login-otp">
                    <ErpInput
                      id="login-otp"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit code"
                      autoComplete="one-time-code"
                      className="tracking-[0.3em]"
                      required
                      autoFocus
                    />
                  </Field>
                )}
              </div>

              <ErpButton
                type="submit"
                variant="primary"
                loading={loading}
                block
                className="mt-6 !min-h-10"
                iconRight={!loading ? <ArrowRight size={16} aria-hidden="true" /> : undefined}
              >
                {loading
                  ? otpSent ? 'Verifying…' : 'Sending code…'
                  : otpSent ? 'Verify and sign in' : 'Send code'}
              </ErpButton>

              {otpSent && (
                <div className="mt-4 flex items-center justify-between text-[13px]">
                  <button
                    type="button"
                    className="erp-btn-link"
                    disabled={loading || cooldown > 0}
                    onClick={handleResend}
                  >
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                  </button>
                  <button
                    type="button"
                    className="erp-btn-link !text-erp-text-secondary"
                    onClick={() => {
                      setOtpSent(false);
                      setOtp('');
                      setUserId('');
                      setError('');
                    }}
                  >
                    Change number
                  </button>
                </div>
              )}
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-erp-text-muted">
            Trouble signing in? Ask your factory administrator to check your account.
          </p>
        </div>
      </main>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { ErpButton, ErpCard, ErpInput } from '../../components/erp';

const PHONE_RE = /^[6-9]\d{9}$/;

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
    <div className="erp-main-area flex min-h-screen items-center justify-center p-6">
      <ErpCard className="w-full max-w-md p-8">
        <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}>
          <h1 className="mb-2 text-[var(--erp-font-lg)] font-bold text-erp-text-primary">ERP Factory</h1>
          <p className="mb-6 text-[var(--erp-font-sm)] text-erp-text-muted">Sign in with your mobile number</p>
          {error && <p className="erp-alert-error mb-4">{error}</p>}
          <label className="erp-label mb-4 block">
            <span className="mb-1 block font-medium text-erp-text-secondary">Mobile number</span>
            <div className="flex gap-2">
              <ErpInput value="+91" readOnly className="w-16 shrink-0 text-center" />
              <ErpInput
                inputMode="numeric"
                maxLength={10}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit number"
                disabled={otpSent}
                required
              />
            </div>
          </label>
          {otpSent && (
            <label className="erp-label mb-4 block">
              <span className="mb-1 block font-medium text-erp-text-secondary">OTP</span>
              <ErpInput
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                autoComplete="one-time-code"
                required
              />
            </label>
          )}
          <ErpButton type="submit" variant="primary" disabled={loading} className="w-full py-2">
            {loading
              ? otpSent ? 'Verifying...' : 'Sending OTP...'
              : otpSent ? 'Verify OTP' : 'Send OTP'}
          </ErpButton>
          {otpSent && (
            <div className="mt-3 flex items-center justify-between text-[var(--erp-font-xs)] text-erp-text-muted">
              <button
                type="button"
                className="underline disabled:no-underline disabled:opacity-50"
                disabled={loading || cooldown > 0}
                onClick={handleResend}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
              </button>
              <button
                type="button"
                className="underline"
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
      </ErpCard>
    </div>
  );
}

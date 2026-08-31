import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { ErpButton, ErpCard, ErpInput } from '../../components/erp';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@demo.local');
  const [password, setPassword] = useState('FactoryAdmin@123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="erp-main-area flex min-h-screen items-center justify-center p-6">
      <ErpCard className="w-full max-w-md p-8">
        <form onSubmit={handleSubmit}>
          <h1 className="mb-2 text-[var(--erp-font-lg)] font-bold text-erp-text-primary">ERP Factory</h1>
          <p className="mb-6 text-[var(--erp-font-sm)] text-erp-text-muted">Textile Manufacturing ERP</p>
          {error && <p className="erp-alert-error mb-4">{error}</p>}
          <label className="erp-label mb-4 block">
            <span className="mb-1 block font-medium text-erp-text-secondary">Email</span>
            <ErpInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="erp-label mb-6 block">
            <span className="mb-1 block font-medium text-erp-text-secondary">Password</span>
            <ErpInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <ErpButton type="submit" variant="primary" disabled={loading} className="w-full py-2">
            {loading ? 'Signing in...' : 'Sign in'}
          </ErpButton>
          <p className="mt-4 text-[var(--erp-font-xs)] text-erp-text-muted">
            Demo: admin@demo.local / FactoryAdmin@123 or superadmin@erp.local / SuperAdmin@123
          </p>
        </form>
      </ErpCard>
    </div>
  );
}

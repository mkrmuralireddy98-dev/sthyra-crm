'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ApiError, createOrg } from '@/lib/api';

const REGIONS = ['us-east', 'us-west', 'us-fedramp', 'eu-west', 'eu-central', 'ap-southeast', 'ap-northeast', 'ksa'] as const;
const PLANS = ['free', 'pro', 'enterprise', 'gov'] as const;

export default function NewOrgPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [region, setRegion] = useState<(typeof REGIONS)[number]>('us-east');
  const [plan, setPlan] = useState<(typeof PLANS)[number]>('pro');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createOrg({ name, region, plan });
      router.push('/');
    } catch (err) {
      const msg = err instanceof ApiError ? `${err.title}: ${err.detail}` : String(err);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: 'var(--space-8) var(--space-6)' }}>
      <Link href="/" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>
        ← Dashboard
      </Link>
      <h1 style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-2xl)' }}>Create a new org</h1>
      <p style={{ color: 'var(--color-fg-muted)', marginBottom: 'var(--space-6)' }}>
        The org is the top-level tenant. All projects, captures, and users belong to it.
      </p>

      <form onSubmit={onSubmit} className="plumb-card" style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <label style={{ display: 'grid', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fontWeight-medium)' }}>Organization name</span>
          <input
            required
            className="plumb-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Hudson Tower GC"
          />
        </label>

        <label style={{ display: 'grid', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fontWeight-medium)' }}>Region</span>
          <select className="plumb-input" value={region} onChange={(e) => setRegion(e.target.value as typeof region)}>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fontWeight-medium)' }}>Plan</span>
          <select className="plumb-input" value={plan} onChange={(e) => setPlan(e.target.value as typeof plan)}>
            {PLANS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <div
            role="alert"
            style={{
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--color-critical)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <Link href="/" className="plumb-button plumb-button--ghost">
            Cancel
          </Link>
          <button type="submit" className="plumb-button" disabled={submitting || !name}>
            {submitting ? 'Creating…' : 'Create org'}
          </button>
        </div>
      </form>
    </main>
  );
}

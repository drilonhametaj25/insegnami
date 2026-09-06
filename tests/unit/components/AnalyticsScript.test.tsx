import { render } from '@testing-library/react';
import { AnalyticsScript } from '@/components/public/AnalyticsScript';

const ENV_KEYS = ['NEXT_PUBLIC_UMAMI_URL', 'NEXT_PUBLIC_UMAMI_WEBSITE_ID'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('AnalyticsScript', () => {
  it('renders nothing when env vars are missing', () => {
    const { container } = render(<AnalyticsScript />);
    expect(container.querySelector('script')).toBeNull();
  });

  it('renders nothing when only one env var is set', () => {
    process.env.NEXT_PUBLIC_UMAMI_URL = 'https://analytics.example.com';
    const { container } = render(<AnalyticsScript />);
    expect(container.querySelector('script')).toBeNull();
  });

  it('renders the Umami script when both env vars are set', () => {
    process.env.NEXT_PUBLIC_UMAMI_URL = 'https://analytics.example.com/';
    process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID = 'abc-123';
    const { container } = render(<AnalyticsScript />);
    const script = container.querySelector('script');
    expect(script).not.toBeNull();
    expect(script).toHaveAttribute('src', 'https://analytics.example.com/script.js');
    expect(script).toHaveAttribute('data-website-id', 'abc-123');
    expect(script).toHaveAttribute('defer');
  });

  it('accepts a full script URL ending in .js as-is', () => {
    process.env.NEXT_PUBLIC_UMAMI_URL = 'https://analytics.example.com/custom.js';
    process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID = 'abc-123';
    const { container } = render(<AnalyticsScript />);
    expect(container.querySelector('script')).toHaveAttribute(
      'src',
      'https://analytics.example.com/custom.js'
    );
  });
});

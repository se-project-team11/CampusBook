import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WaitlistBadge } from '../components/WaitlistBadge';

describe('WaitlistBadge', () => {
  it('renders the waitlist position number', () => {
    render(<WaitlistBadge position={3} />);
    expect(screen.getByText(/Waitlisted #3/)).toBeInTheDocument();
  });

  it('renders position 1 correctly', () => {
    render(<WaitlistBadge position={1} />);
    expect(screen.getByText(/Waitlisted #1/)).toBeInTheDocument();
  });

  it('renders the hourglass emoji', () => {
    render(<WaitlistBadge position={2} />);
    expect(screen.getByText(/⏳/)).toBeInTheDocument();
  });
});

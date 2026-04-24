import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// ── ui/Badge ──────────────────────────────────────────────────────────────────
import { Badge } from '../components/ui/Badge';

describe('Badge', () => {
  it('renders the label text', () => {
    render(<Badge label="CONFIRMED" />);
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
  });

  it('uses state-based class for CONFIRMED', () => {
    const { container } = render(<Badge label="CONFIRMED" />);
    expect(container.firstChild).toHaveClass('text-green-700');
  });

  it('uses state-based class for NO_SHOW', () => {
    const { container } = render(<Badge label="NO_SHOW" />);
    expect(container.firstChild).toHaveClass('text-red-600');
  });

  it('uses state-based class for RESERVED (amber)', () => {
    const { container } = render(<Badge label="RESERVED" />);
    expect(container.firstChild).toHaveClass('text-yellow-700');
  });

  it('falls back to gray for unknown state', () => {
    const { container } = render(<Badge label="UNKNOWN" />);
    expect(container.firstChild).toHaveClass('text-gray-600');
  });

  it('uses explicit color prop over state lookup', () => {
    const { container } = render(<Badge label="CONFIRMED" color="red" />);
    expect(container.firstChild).toHaveClass('text-red-700');
  });
});

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { EmptyState } from '../components/ui/EmptyState';

describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState title="No results" />);
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('renders default icon 📭 when icon is not provided', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.getByText('📭')).toBeInTheDocument();
  });

  it('renders a custom icon when provided', () => {
    render(<EmptyState icon="🎉" title="Yay" />);
    expect(screen.getByText('🎉')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<EmptyState title="Nothing here" subtitle="Try again later" />);
    expect(screen.getByText('Try again later')).toBeInTheDocument();
  });

  it('does not render subtitle when omitted', () => {
    render(<EmptyState title="Title only" />);
    expect(screen.queryByRole('paragraph')).toBeNull();
  });

  it('renders an action node when provided', () => {
    render(
      <EmptyState title="Go somewhere" action={<button>Click here</button>} />
    );
    expect(screen.getByRole('button', { name: 'Click here' })).toBeInTheDocument();
  });

  it('does not render action wrapper when action is omitted', () => {
    const { container } = render(<EmptyState title="No action" />);
    // There should be no div.mt-4 action wrapper
    expect(container.querySelector('.mt-4')).toBeNull();
  });
});

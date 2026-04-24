import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Modal } from '../components/ui/Modal';

describe('Modal', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <Modal open={false} onClose={vi.fn()}>content</Modal>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders children when open=true', () => {
    render(<Modal open onClose={vi.fn()}>Hello modal</Modal>);
    expect(screen.getByText('Hello modal')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(<Modal open onClose={vi.fn()} title="My Title">body</Modal>);
    expect(screen.getByText('My Title')).toBeInTheDocument();
  });

  it('does not render title element when title is omitted', () => {
    render(<Modal open onClose={vi.fn()}>body</Modal>);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('calls onClose when the × button is clicked', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="T">body</Modal>);
    fireEvent.click(screen.getByText('×'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the backdrop (target === currentTarget)', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open onClose={onClose}>body</Modal>
    );
    // The outermost div is the backdrop
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop, { target: backdrop });
    // jsdom sets target and currentTarget to the same element by default on direct dispatch
    expect(onClose).toHaveBeenCalled();
  });

  it('does NOT call onClose when clicking inside the modal panel', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="T">inner content</Modal>);
    fireEvent.click(screen.getByText('inner content'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

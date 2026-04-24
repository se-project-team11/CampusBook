import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResourceCard } from '../components/ResourceCard';
import type { Resource } from '../types';

const mockResource: Resource = {
  id: 'res-1',
  name: 'North Library — Room 101',
  type: 'STUDY_ROOM',
  location: 'North Quad',
  capacity: 6,
  amenities: ['WiFi', 'Whiteboard'],
};

describe('ResourceCard', () => {
  it('renders resource name', () => {
    render(<ResourceCard resource={mockResource} onSelect={vi.fn()} />);
    expect(screen.getByText('North Library — Room 101')).toBeInTheDocument();
  });

  it('renders location', () => {
    render(<ResourceCard resource={mockResource} onSelect={vi.fn()} />);
    expect(screen.getByText('North Quad')).toBeInTheDocument();
  });

  it('renders capacity', () => {
    render(<ResourceCard resource={mockResource} onSelect={vi.fn()} />);
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('renders type label', () => {
    render(<ResourceCard resource={mockResource} onSelect={vi.fn()} />);
    expect(screen.getByText('Study Room')).toBeInTheDocument();
  });

  it('renders amenities', () => {
    render(<ResourceCard resource={mockResource} onSelect={vi.fn()} />);
    expect(screen.getByText('WiFi, Whiteboard')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(<ResourceCard resource={mockResource} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('North Library — Room 101'));
    expect(onSelect).toHaveBeenCalledWith(mockResource);
  });

  it('renders LAB type correctly', () => {
    const lab = { ...mockResource, type: 'LAB' as const, name: 'Science Lab' };
    render(<ResourceCard resource={lab} onSelect={vi.fn()} />);
    expect(screen.getByText('Lab')).toBeInTheDocument();
  });

  it('renders SPORTS type correctly', () => {
    const sports = { ...mockResource, type: 'SPORTS' as const, name: 'Sports Hall' };
    render(<ResourceCard resource={sports} onSelect={vi.fn()} />);
    expect(screen.getByText('Sports')).toBeInTheDocument();
  });

  it('renders SEMINAR type correctly', () => {
    const seminar = { ...mockResource, type: 'SEMINAR' as const, name: 'Seminar Hall A' };
    render(<ResourceCard resource={seminar} onSelect={vi.fn()} />);
    expect(screen.getByText('Seminar Hall')).toBeInTheDocument();
  });

  it('renders without amenities', () => {
    const noAmenities = { ...mockResource, amenities: [] };
    render(<ResourceCard resource={noAmenities} onSelect={vi.fn()} />);
    expect(screen.getByText('North Library — Room 101')).toBeInTheDocument();
  });
});

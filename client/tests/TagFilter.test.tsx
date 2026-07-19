import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Tag } from '../src/api/types';

// Mock the tags API module
vi.mock('../src/api/tags', () => ({
  listTags: vi.fn(),
}));

import { listTags } from '../src/api/tags';
import TagFilter from '../src/components/TagFilter';

const mockListTags = listTags as ReturnType<typeof vi.fn>;

const mockTags: Tag[] = [
  { id: 'tag-1', name: 'Bug', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'tag-2', name: 'Feature', createdAt: '2024-01-02T00:00:00Z' },
  { id: 'tag-3', name: 'Urgent', createdAt: '2024-01-03T00:00:00Z' },
];

describe('TagFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all fetched tags', async () => {
    mockListTags.mockResolvedValue(mockTags);
    const onSelectionChange = vi.fn();

    render(<TagFilter selectedTagIds={[]} onSelectionChange={onSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByText('Bug')).toBeInTheDocument();
    });
    expect(screen.getByText('Feature')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('toggles tag selection and calls onSelectionChange when selecting', async () => {
    mockListTags.mockResolvedValue(mockTags);
    const onSelectionChange = vi.fn();

    render(<TagFilter selectedTagIds={[]} onSelectionChange={onSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByText('Bug')).toBeInTheDocument();
    });

    // Click a tag to select it
    fireEvent.click(screen.getByText('Bug'));
    expect(onSelectionChange).toHaveBeenCalledWith(['tag-1']);
  });

  it('toggles tag selection and calls onSelectionChange when deselecting', async () => {
    mockListTags.mockResolvedValue(mockTags);
    const onSelectionChange = vi.fn();

    render(<TagFilter selectedTagIds={['tag-1']} onSelectionChange={onSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByText('Bug')).toBeInTheDocument();
    });

    // Click the already-selected tag to deselect it
    fireEvent.click(screen.getByText('Bug'));
    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it('clear button deselects all tags', async () => {
    mockListTags.mockResolvedValue(mockTags);
    const onSelectionChange = vi.fn();

    render(<TagFilter selectedTagIds={['tag-1', 'tag-2']} onSelectionChange={onSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByText('Bug')).toBeInTheDocument();
    });

    // Verify Clear button exists and click it
    const clearButton = screen.getByText('Clear');
    expect(clearButton).toBeInTheDocument();
    fireEvent.click(clearButton);
    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it('renders error state with retry button', async () => {
    mockListTags.mockRejectedValueOnce(new Error('Network error'));
    const onSelectionChange = vi.fn();

    render(<TagFilter selectedTagIds={[]} onSelectionChange={onSelectionChange} />);

    // Verify error message and retry button appear
    await waitFor(() => {
      expect(screen.getByText('Failed to load tags')).toBeInTheDocument();
    });
    expect(screen.getByText('Retry')).toBeInTheDocument();

    // Click retry — mock succeeds this time
    mockListTags.mockResolvedValueOnce(mockTags);
    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(screen.getByText('Bug')).toBeInTheDocument();
    });
    expect(screen.getByText('Feature')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('renders empty state message when no tags exist', async () => {
    mockListTags.mockResolvedValue([]);
    const onSelectionChange = vi.fn();

    render(<TagFilter selectedTagIds={[]} onSelectionChange={onSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByText('No tags available')).toBeInTheDocument();
    });
  });
});

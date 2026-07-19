import { useState, useEffect } from 'react';
import { listTags } from '../api/tags';
import type { Tag } from '../api/types';

interface TagFilterProps {
  selectedTagIds: string[];
  onSelectionChange: (tagIds: string[]) => void;
}

export default function TagFilter({ selectedTagIds, onSelectionChange }: TagFilterProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listTags();
      setTags(data);
    } catch {
      setError('Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleToggle = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onSelectionChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onSelectionChange([...selectedTagIds, tagId]);
    }
  };

  const handleClear = () => {
    onSelectionChange([]);
  };

  if (loading) {
    return <div style={{ marginBottom: '16px', color: '#6b7280' }}>Loading tags...</div>;
  }

  if (error) {
    return (
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#dc2626' }}>{error}</span>
        <button
          onClick={fetchTags}
          style={{
            padding: '4px 10px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            background: '#ffffff',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (tags.length === 0) {
    return <div style={{ marginBottom: '16px', color: '#6b7280' }}>No tags available</div>;
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
      {tags.map((tag) => {
        const isSelected = selectedTagIds.includes(tag.id);
        return (
          <button
            key={tag.id}
            onClick={() => handleToggle(tag.id)}
            aria-pressed={isSelected}
            style={{
              padding: '4px 12px',
              borderRadius: '16px',
              border: isSelected ? '2px solid #1d4ed8' : '1px solid #d1d5db',
              background: isSelected ? '#2563eb' : '#ffffff',
              color: isSelected ? '#ffffff' : '#374151',
              fontWeight: isSelected ? 600 : 400,
              cursor: 'pointer',
              fontSize: '14px',
              lineHeight: '20px',
            }}
          >
            {tag.name}
          </button>
        );
      })}
      {selectedTagIds.length > 0 && (
        <button
          onClick={handleClear}
          style={{
            padding: '4px 10px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            background: '#ffffff',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}

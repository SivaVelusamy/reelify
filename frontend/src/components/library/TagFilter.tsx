import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Plus, Tag as TagIcon } from 'lucide-react';
import { useCreateTag, useTags } from '../../hooks/useLibrary';
import { cn } from '../../lib/utils';
import { AnimatedInput } from '../ui/AnimatedInput';
import { GradientButton } from '../ui/GradientButton';
import { Spinner } from '../ui/Spinner';

const DEFAULT_COLOR = '#8b5cf6';

interface TagFilterProps {
  selectedId?: number;
  onSelect: (tagId: number | undefined) => void;
}

/** Chips from useTags with toggle selection, plus an inline "new tag" form. */
export function TagFilter({ selectedId, onSelect }: TagFilterProps) {
  const { data: tags, isLoading, isError } = useTags();
  const createTag = useCreateTag();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [formError, setFormError] = useState<string | null>(null);

  const toggle = (tagId: number): void => {
    onSelect(selectedId === tagId ? undefined : tagId);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFormError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError('Enter a tag name.');
      return;
    }
    try {
      const created = await createTag.mutateAsync({ name: trimmed, color });
      setName('');
      setColor(DEFAULT_COLOR);
      setAdding(false);
      onSelect(created.id);
    } catch {
      setFormError('Could not create the tag. Please try again.');
    }
  };

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <TagIcon size={16} />
        Tags
      </div>

      {isLoading && <Spinner size={18} />}
      {isError && !isLoading && (
        <p className="text-sm text-red-600">Could not load tags.</p>
      )}

      {!isLoading && !isError && (
        <div className="flex flex-wrap items-center gap-2">
          {(tags ?? []).map((tag) => {
            const active = selectedId === tag.id;
            return (
              <motion.button
                key={tag.id}
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => toggle(tag.id)}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                  active
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                )}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </motion.button>
            );
          })}

          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setAdding((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
          >
            <Plus size={12} />
            New tag
          </motion.button>
        </div>
      )}

      {adding && (
        <form
          onSubmit={handleCreate}
          className="mt-3 flex flex-wrap items-end gap-3"
        >
          <div className="w-48">
            <AnimatedInput
              id="new-tag-name"
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Color
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-11 w-16 cursor-pointer rounded-xl border-2 border-slate-200 bg-white"
            />
          </label>
          <GradientButton type="submit" isLoading={createTag.isPending}>
            Add
          </GradientButton>
          {formError && (
            <p className="w-full text-sm text-red-600" role="alert">
              {formError}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

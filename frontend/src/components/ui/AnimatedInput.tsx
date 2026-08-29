import { motion } from 'framer-motion';
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/** DOM drag/animation handlers whose signatures collide with framer-motion's. */
type MotionConflicts =
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd';

interface AnimatedInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, MotionConflicts> {
  label?: string;
  error?: string;
}

export const AnimatedInput = forwardRef<HTMLInputElement, AnimatedInputProps>(
  ({ label, error, className = '', id, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium mb-1 text-slate-700">
          {label}
        </label>
      )}
      <motion.input
        ref={ref}
        id={id}
        whileFocus={{ scale: 1.01 }}
        className={cn(
          'w-full px-4 py-3 rounded-xl border-2 bg-white outline-none transition-colors',
          error
            ? 'border-red-500 focus:border-red-500'
            : 'border-slate-200 focus:border-brand-500',
          className,
        )}
        {...props}
      />
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  ),
);

AnimatedInput.displayName = 'AnimatedInput';

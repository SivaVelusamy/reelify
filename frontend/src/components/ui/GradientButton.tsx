import { motion } from 'framer-motion';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

/** DOM drag/animation handlers whose signatures collide with framer-motion's. */
type MotionConflicts =
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd';

interface GradientButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, MotionConflicts> {
  children: ReactNode;
  isLoading?: boolean;
}

export function GradientButton({
  children,
  className = '',
  isLoading = false,
  disabled,
  ...props
}: GradientButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      disabled={disabled || isLoading}
      className={cn(
        'px-6 py-3 rounded-full font-semibold text-white bg-gradient-to-r from-brand-500 to-accent-500 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    >
      {isLoading ? 'Loading…' : children}
    </motion.button>
  );
}

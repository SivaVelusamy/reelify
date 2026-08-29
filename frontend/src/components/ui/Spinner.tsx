import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

export function Spinner({ size = 24, className, label = 'Loading' }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex', className)}>
      <motion.span
        style={{ width: size, height: size }}
        className="block rounded-full border-2 border-brand-200 border-t-brand-600"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, ease: 'linear', duration: 0.8 }}
      />
    </span>
  );
}

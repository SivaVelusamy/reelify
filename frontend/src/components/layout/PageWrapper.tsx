import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
  title?: string;
}

export function PageWrapper({ children, className, title }: PageWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className={cn('min-h-screen w-full', className)}
    >
      {title && (
        <h1 className="mb-6 text-2xl font-bold text-slate-900">{title}</h1>
      )}
      {children}
    </motion.div>
  );
}

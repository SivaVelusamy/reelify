import { Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GradientButton } from '../ui/GradientButton';
import { cn } from '../../lib/utils';

interface QuickUploadButtonProps {
  /** Route to send the user to in order to start a new upload. */
  to?: string;
  className?: string;
}

export function QuickUploadButton({
  to = '/projects',
  className,
}: QuickUploadButtonProps) {
  const navigate = useNavigate();

  return (
    <GradientButton
      type="button"
      onClick={() => navigate(to)}
      className={cn('inline-flex items-center gap-2', className)}
    >
      <Upload size={18} />
      New upload
    </GradientButton>
  );
}

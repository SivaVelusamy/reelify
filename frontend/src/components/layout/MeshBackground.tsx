export function MeshBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-accent-50" />
      <div className="absolute top-0 left-1/4 h-96 w-96 animate-pulse rounded-full bg-brand-200 opacity-30 blur-3xl" />
      <div className="absolute bottom-0 right-1/4 h-96 w-96 animate-pulse rounded-full bg-accent-200 opacity-30 blur-3xl" />
    </div>
  );
}

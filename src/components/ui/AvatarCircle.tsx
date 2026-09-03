type AvatarCircleProps = {
  url?: string | null;
  alt: string;
  className?: string;
};

export function AvatarCircle({ url, alt, className }: AvatarCircleProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-full bg-surface ${className ?? ""}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className="size-full object-cover" />
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="absolute inset-[18%] text-gold"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden
        >
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5 19c1.6-3.2 4.2-4.8 7-4.8s5.4 1.6 7 4.8" />
        </svg>
      )}
    </div>
  );
}

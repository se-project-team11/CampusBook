interface Props {
  position: number;
}

export function WaitlistBadge({ position }: Props) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">
      ⏳ Waitlisted #{position}
    </span>
  );
}

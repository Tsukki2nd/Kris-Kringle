/** Wordmark lockup for the company: icon tile + "Talkstation" + "CAVITE". */
export default function CompanyBrand() {
  return (
    <div className="inline-flex items-center gap-3 rounded-full bg-white/85 py-1.5 pl-1.5 pr-5 shadow-[0_6px_24px_rgba(0,0,0,0.08)] ring-1 ring-ink/10 backdrop-blur">
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden className="shrink-0">
        <rect width="36" height="36" rx="18" fill="#0A0A0A" />
        <rect x="9" y="9.5" width="18" height="13" rx="4.5" fill="#FFFFFF" />
        <path d="M13 21.5 L13 27 L18.5 21.5Z" fill="#FFFFFF" />
        <circle cx="14.5" cy="16" r="1.5" fill="#DC2626" />
        <circle cx="18" cy="16" r="1.5" fill="#0A0A0A" />
        <circle cx="21.5" cy="16" r="1.5" fill="#16A34A" />
      </svg>
      <div className="text-left leading-none">
        <p className="text-[17px] font-semibold tracking-tight text-ink">Talkstation</p>
        <p className="mt-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.32em] text-crimson">
          Cavite
          <span aria-hidden className="h-px w-5 bg-emerald/60" />
        </p>
      </div>
    </div>
  );
}

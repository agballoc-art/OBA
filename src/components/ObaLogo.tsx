import React from 'react';

interface ObaLogoProps {
  compact?: boolean;
}

export const ObaLogo: React.FC<ObaLogoProps> = ({ compact = false }) => {
  return (
    <div className="inline-flex items-center gap-3 select-none">
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={compact ? 'w-9 h-9 shrink-0' : 'w-12 h-12 shrink-0'}
        aria-hidden="true"
      >
        <circle cx="24" cy="24" r="22" stroke="#D4AF37" strokeWidth="1.5" fill="#16110E" />
        <path
          d="M12 31L15 18L21 23L24 14L27 23L33 18L36 31H12Z"
          stroke="#D4AF37"
          strokeWidth="1.8"
          strokeLinejoin="round"
          fill="#3B1F11"
        />
        <path d="M13 35H35" stroke="#A97142" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="24" cy="12" r="1.7" fill="#E5C158" />
        <circle cx="14.5" cy="16" r="1.3" fill="#D4AF37" />
        <circle cx="33.5" cy="16" r="1.3" fill="#D4AF37" />
      </svg>
      <div className="flex flex-col leading-none">
        <span
          className={`font-display font-bold tracking-[0.14em] text-[#FAF7F0] whitespace-nowrap ${
            compact ? 'text-xl' : 'text-2xl sm:text-3xl'
          }`}
        >
          OBA IMPÉRIAL
        </span>
        {!compact && (
          <span className="mt-1 text-[10px] sm:text-xs font-medium tracking-[0.22em] text-[#D4AF37] uppercase whitespace-nowrap">
            BORN FROM AFRICA ROYALTIES
          </span>
        )}
      </div>
    </div>
  );
};

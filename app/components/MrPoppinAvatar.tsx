import Image from "next/image";

const ALT = "Mr. Poppin, sipping chai on a stack of books";

type Size = 24 | 28 | 32 | 40 | 48 | 96;

/** Small circular face for chat chrome and CTAs. */
export function MrPoppinAvatar({ size = 28, className = "" }: { size?: Size; className?: string }) {
  return (
    <Image
      src="/mr-poppin/mr-poppin-avatar-96.png"
      alt={ALT}
      width={size}
      height={size}
      className={`rounded-full shrink-0 ${className}`}
    />
  );
}

/** Full figure for the desktop intro panel (cream art on a soft card). */
export function MrPoppinHero({ className = "" }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/10 bg-[#F5EDE0] shadow-inner ${className}`}
    >
      <Image
        src="/mr-poppin/mr-poppin-full-1024.png"
        alt={ALT}
        width={1024}
        height={1024}
        className="w-full h-auto max-w-[220px] mx-auto block"
        sizes="(min-width: 1024px) 220px, 0px"
        priority
      />
    </div>
  );
}

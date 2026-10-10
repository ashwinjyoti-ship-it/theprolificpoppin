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

/** Full-figure hero for the desktop intro — square asset, no card or letterboxing. */
export function MrPoppinHero({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/mr-poppin/mr-poppin-full-1024-transparent.png"
      alt={ALT}
      width={240}
      height={240}
      className={`block h-auto w-[min(100%,240px)] ${className}`}
      sizes="240px"
      priority
    />
  );
}

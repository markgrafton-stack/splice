import Image from "next/image";

export function Logo({
  variant = "black",
  size = 40,
}: {
  variant?: "black" | "white";
  size?: number;
}) {
  const src = variant === "black" ? "/brand/fst-logo-black.png" : "/brand/fst-logo-white.png";
  return (
    <Image
      src={src}
      alt="FST"
      width={size}
      height={size}
      className="rounded-full"
      priority
    />
  );
}

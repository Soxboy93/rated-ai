import type { Guide } from "./guides";

/** A guide's face: an emoji on a soft tinted circle (one calm look instead of illustrated characters). */
export default function Avatar({ guide, size = 56, bob = false }: { guide: Pick<Guide, "emoji" | "color">; size?: number; bob?: boolean }) {
  return (
    <span className={`k-avatar${bob ? " k-bob" : ""}`} style={{ ["--c" as string]: guide.color, width: size, height: size, fontSize: size * 0.54 }} aria-hidden="true">
      {guide.emoji}
    </span>
  );
}

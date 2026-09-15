import { teamLogoUrl } from "@/lib/data/teamLogos";

// Renders nothing (rather than a broken-image icon) for a team with no
// logo -- currently just the synthetic FCS filler team.
export function TeamLogo({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  const src = teamLogoUrl(name);
  if (!src) return null;
  return <img src={src} alt="" className={`${className} inline-block shrink-0 object-contain align-middle`} />;
}

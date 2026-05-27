import * as Icons from "lucide-react";

type Props = {
  name: string;
  size?: number;
  className?: string;
};

function toPascalCase(str: string) {
  return str
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

export default function Icon({ name, size = 16, className }: Props) {
  const LucideIcon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[toPascalCase(name)];

  if (!LucideIcon) return <span className="text-xs text-gray-400 font-mono">{name}</span>;
  return <LucideIcon size={size} className={className} />;
}

import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-white/[0.06]",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:bg-gradient-to-r before:from-transparent before:via-white/[0.08] before:to-transparent",
        "before:animate-[shimmer_2s_ease-in-out_infinite]",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton }

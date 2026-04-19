import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps page content with a subtle fade-in + slide-up entrance animation.
 * Uses pure CSS (defined in theme.css) — no framer-motion dependency needed.
 */
export function PageTransition({ children, className = "" }: PageTransitionProps) {
  return (
    <div className={`animate-fade-in-up ${className}`}>
      {children}
    </div>
  );
}

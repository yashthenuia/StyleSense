"use client";
import { motion } from "framer-motion";
import { useSeenOnce } from "@/lib/useSeenOnce";

interface PageHeaderProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  // When set, the subtitle is treated as a first-visit hint: shown once, then
  // auto-hidden on subsequent visits (persisted in localStorage).
  tutorialKey?: string;
}

export function PageHeader({ eyebrow, title, subtitle, action, tutorialKey }: PageHeaderProps) {
  const seen = useSeenOnce(tutorialKey ?? "");
  const showSubtitle = !!subtitle && (!tutorialKey || !seen);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="flex items-end justify-between mb-8"
    >
      <div>
        {eyebrow && (
          <div
            className={title ? "text-xs mb-2" : "text-sm"}
            style={{
              color: "var(--gold)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </div>
        )}
        {title && <h1 className="font-display text-5xl leading-tight">{title}</h1>}
        {showSubtitle && (
          <p className="mt-3 max-w-xl" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </motion.div>
  );
}

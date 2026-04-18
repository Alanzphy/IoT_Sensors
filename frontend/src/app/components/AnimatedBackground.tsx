import { motion } from "motion/react";

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10" style={{ background: 'var(--background)' }}>
      {/* Dot grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(143,175,122,0.4) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Blob 1 — top-left green */}
      <motion.div
        className="absolute top-[-15%] left-[-10%] w-[60%] h-[60%] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(109,126,94,0.18) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
        animate={{ x: ["0%", "12%", "0%"], y: ["0%", "18%", "0%"] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Blob 2 — bottom-right gold */}
      <motion.div
        className="absolute bottom-[-20%] right-[-10%] w-[65%] h-[65%] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(166,138,97,0.12) 0%, transparent 70%)',
          filter: 'blur(100px)',
        }}
        animate={{ x: ["0%", "-18%", "0%"], y: ["0%", "-14%", "0%"] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Blob 3 — center right faint green */}
      <motion.div
        className="absolute top-[30%] right-[10%] w-[40%] h-[40%] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(90,111,75,0.08) 0%, transparent 70%)',
          filter: 'blur(100px)',
        }}
        animate={{ x: ["0%", "-10%", "0%"], y: ["0%", "20%", "0%"] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Vignette edges */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)',
        }}
      />
    </div>
  );
}

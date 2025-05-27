"use client"

import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { FaHome, FaGamepad, FaDice, FaChess, FaPuzzlePiece, FaTrophy } from "react-icons/fa"
import { useEffect, useState } from "react"

const floatingIcons = [
  { Icon: FaGamepad, color: "text-purple-500", size: "text-4xl" },
  { Icon: FaDice, color: "text-blue-500", size: "text-5xl" },
  { Icon: FaChess, color: "text-green-500", size: "text-4xl" },
  { Icon: FaPuzzlePiece, color: "text-yellow-500", size: "text-5xl" },
  { Icon: FaTrophy, color: "text-red-500", size: "text-4xl" },
]

const randomPosition = () => ({
  x: Math.random() * 1000 - 500,
  y: Math.random() * 1000 - 500,
  rotation: Math.random() * 360,
  scale: 0.5 + Math.random() * 1,
})

export default function NotFound() {
  const [isVisible, setIsVisible] = useState(false)
  const [glitch, setGlitch] = useState(false)

  useEffect(() => {
    setIsVisible(true)
    const glitchInterval = setInterval(() => {
      setGlitch(true)
      setTimeout(() => setGlitch(false), 150)
    }, 3000)
    return () => clearInterval(glitchInterval)
  }, [])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3,
      },
    },
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 12,
      },
    },
  }

  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50 to-gray-100 z-0">
        <div 
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,0,0,0.02)_0%,transparent_50%)]"
          style={{
            animation: "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2UwZTBlMCIgb3BhY2l0eT0iMC4yIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />
      </div>

      {floatingIcons.map((icon, index) => (
        <AnimatePresence key={index}>
          {isVisible && (
            <motion.div
              className={`absolute ${icon.color} ${icon.size} opacity-20`}
              initial={randomPosition()}
              animate={{
                x: [null, Math.random() * 1000 - 500],
                y: [null, Math.random() * 1000 - 500],
                rotate: [null, Math.random() * 360],
                scale: [null, 0.5 + Math.random()],
                transition: {
                  duration: 15 + Math.random() * 10,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "linear",
                },
              }}
            >
              <icon.Icon />
            </motion.div>
          )}
        </AnimatePresence>
      ))}

      <div className="grid place-items-center min-h-screen p-8 relative z-10">
        <motion.div
          className="text-center relative"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            className="relative mb-12"
            animate={{
              x: glitch ? [-2, 2, -2, 0] : 0,
              y: glitch ? [1, -1, 1, 0] : 0,
            }}
            transition={{ duration: 0.2 }}
          >
            <motion.h1
              className="text-[150px] font-bold text-black relative"
              style={{
                textShadow: glitch
                  ? "2px 2px #ff00ea, -2px -2px #00ff00, 0 0 8px rgba(0,0,0,0.1)"
                  : "0 0 8px rgba(0,0,0,0.1)",
              }}
              variants={itemVariants}
            >
              404
            </motion.h1>
            <motion.div
              className="absolute -inset-4 rounded-full bg-gradient-to-r from-purple-100 via-blue-100 to-green-100 opacity-70 blur-lg -z-10"
              animate={{
                rotate: [0, 360],
                scale: [0.9, 1.1, 0.9],
              }}
              transition={{
                duration: 15,
                repeat: Infinity,
                repeatType: "loop",
              }}
            />
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="mb-12 relative"
          >
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Game Over!</h2>
            <p className="text-xl text-gray-600">This level doesn&apos;t exist... yet!</p>
          </motion.div>

          <motion.div 
            className="flex justify-center"
            variants={itemVariants}
          >
            <Link href="/">
              <motion.button
                className="group relative flex items-center justify-center gap-3 bg-black text-white px-8 py-4 rounded-lg overflow-hidden"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-purple-500 via-blue-500 to-green-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  animate={{
                    backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                  }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
                <motion.div className="relative flex items-center gap-3">
                  <FaHome className="text-xl" />
                  <span className="font-semibold">Return to Lobby</span>
                </motion.div>
              </motion.button>
            </Link>
          </motion.div>

          <motion.p
            variants={itemVariants} 
            className="mt-12 text-sm text-gray-400 italic"
          >
            Press any key to continue... or just use the button above 😉
          </motion.p>
        </motion.div>
      </div>
    </div>
  )
}

"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { FaHome } from "react-icons/fa"

export default function NotFound() {
  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50 to-gray-100 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,0,0,0.02)_0%,transparent_50%)] animate-pulse"></div>
      </div>

      <div className="grid place-items-center min-h-screen p-8 relative z-10">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-8xl font-bold text-black mb-4">404</h1>
          <p className="text-xl text-gray-600 mb-8">Oops! This page doesn&apos;t exist.</p>
            <div className="flex justify-center">
            <Link href="/">
              <motion.button
                className="flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FaHome />
                <span>Back to Home</span>
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

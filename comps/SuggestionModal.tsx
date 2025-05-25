import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FaTimes } from 'react-icons/fa'

interface SuggestionModalProps {
  isOpen: boolean
  onClose: () => void
  username?: string | null
  userId?: string | null
}

export default function SuggestionModal({ isOpen, onClose, username, userId }: SuggestionModalProps) {
  const [suggestion, setSuggestion] = useState('')
  const [type, setType] = useState<'game' | 'general'>('game')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestion, type, userId, username })
      })

      if (!response.ok) throw new Error()

      setSubmitted(true)
      setSuggestion('')
      setTimeout(() => {
        onClose()
        setSubmitted(false)
      }, 2000)
    } catch (error) {
      alert('Failed to submit suggestion. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="text-black fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-lg p-6 max-w-md w-full"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Submit a Suggestion</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <FaTimes />
            </button>
          </div>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-green-600 py-8"
            >
              Thank you for your suggestion!
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="game"
                      checked={type === 'game'}
                      onChange={e => setType(e.target.value as 'game')}
                      className="mr-2"
                    />
                    Game Idea
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="general"
                      checked={type === 'general'}
                      onChange={e => setType(e.target.value as 'general')}
                      className="mr-2"
                    />
                    General Feedback
                  </label>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Your Suggestion</label>
                <textarea
                  value={suggestion}
                  onChange={e => setSuggestion(e.target.value)}
                  className="w-full p-2 border-2 border-gray-200 rounded-lg focus:border-black transition-colors"
                  rows={4}
                  required
                  maxLength={1000}
                  placeholder={type === 'game' ? 'Describe your game idea...' : 'Share your feedback...'}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Suggestion'}
              </button>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

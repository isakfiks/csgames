import { Suspense } from "react"
import ProfileContent from "@/app/components/ProfileContent"

function Loading() {
  return (
    <div className="bg-white min-h-screen p-8 flex items-center justify-center font-[family-name:var(--font-geist-sans)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
        <p className="text-black">Loading profile...</p>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<Loading />}>
      <ProfileContent />
    </Suspense>
  )
}

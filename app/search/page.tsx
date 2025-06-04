import React, { Suspense } from "react"
import SearchPageClient from "./SearchPageClient"

export default function Page() {
  return (
    <Suspense fallback={<div className="text-center py-8">Loading...</div>}>
      <SearchPageClient />
    </Suspense>
  )
}

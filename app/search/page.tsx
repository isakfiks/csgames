import React, { Suspense } from "react"
import SearchPageClient from "./SearchPageClient"

function SearchSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <div className="h-10 w-1/2 bg-gray-200 animate-pulse rounded mb-4"></div>
        <div className="h-6 w-1/3 bg-gray-200 animate-pulse rounded mb-2"></div>
      </div>
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-gray-100 border-2 border-black rounded-lg p-4 flex items-center gap-4 animate-pulse">
            <div className="w-12 h-12 bg-gray-200 rounded-full" />
            <div className="flex-1">
              <div className="h-5 w-1/4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchPageClient />
    </Suspense>
  )
}

"use client"

import { createRestaurant } from "@/actions/authActions"
import { isValidSlugFormat } from "@/utils/validateSlug"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function OnboardingForm() {
  const [restaurantName, setRestaurantName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugError, setSlugError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSlugBlur = () => {
    if (slug && !isValidSlugFormat(slug)) {
      setSlugError("Slug must be 3–50 lowercase letters, numbers, or hyphens")
    } else {
      setSlugError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidSlugFormat(slug)) {
      setSlugError("Slug must be 3–50 lowercase letters, numbers, or hyphens")
      return
    }
    setIsLoading(true)
    setFormError(null)
    setSlugError(null)

    const result = await createRestaurant({ name: restaurantName, slug })

    setIsLoading(false)
    if (!result.success) {
      if (result.code === "SLUG_TAKEN" || result.code === "SLUG_INVALID") {
        setSlugError(result.error)
      } else {
        setFormError(result.error)
      }
      return
    }
    router.push("/admin")
  }

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-text-primary">
          Set up your restaurant
        </h1>
        <p className="text-sm text-text-secondary">
          Your restaurant name and a unique URL for customers
        </p>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-6">
          <div className="grid gap-2">
            <label htmlFor="restaurant-name" className="text-sm font-medium">
              Restaurant name
            </label>
            <input
              id="restaurant-name"
              type="text"
              placeholder="The Blue Plate"
              required
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              className="flex h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="slug" className="text-sm font-medium">
              URL slug
            </label>
            <div className="flex h-10 w-full items-center rounded-md border border-border bg-transparent text-sm">
              <span className="px-3 text-text-tertiary">dine-in/</span>
              <input
                id="slug"
                type="text"
                placeholder="blue-plate"
                required
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase())
                  setSlugError(null)
                }}
                onBlur={handleSlugBlur}
                className="flex-1 bg-transparent pr-3 focus:outline-none"
              />
            </div>
            {slugError && (
              <p role="alert" className="text-sm text-red-500">
                {slugError}
              </p>
            )}
          </div>
          {formError && (
            <p role="alert" className="text-sm text-red-500">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex w-full items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {isLoading ? "Creating restaurant…" : "Go to dashboard"}
          </button>
        </div>
      </form>
    </div>
  )
}

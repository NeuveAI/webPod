import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges class names, letting a later Tailwind utility win over an earlier one
 * in the same category.
 *
 * Every shadcn component generated into this repo imports this from
 * `@webpod/ui/lib/utils`, which is what `components.json` declares as the
 * `utils` alias. It exists in the skeleton so the first `shadcn add` resolves
 * rather than writing a component that cannot import its own helper.
 *
 * `twMerge` is what makes `cn('p-2', 'p-4')` yield `p-4` instead of both:
 * plain `clsx` would emit the pair and let source order in the stylesheet
 * decide, which is not the caller's intent.
 */
export function cn(...inputs: Array<ClassValue>): string {
  return twMerge(clsx(inputs))
}

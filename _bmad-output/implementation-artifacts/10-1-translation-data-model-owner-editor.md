# Story 10.1: Translation Data Model & Owner Editor

Status: review (post-code-review patches applied 2026-05-21; awaiting Task 9 manual smoke)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a restaurant owner,
I want to enter translations for each menu item alongside the original content,
so that customers can read my menu in their preferred language.

## Acceptance Criteria

1. **Given** the schema migration is applied
   **When** `menu_items` and `restaurants` are inspected
   **Then** these columns exist:
   - `menu_items.translations jsonb DEFAULT '{}'::jsonb NOT NULL` — shape `{ [lang_code]: { name: string, description?: string } }`. Backfills to `{}` for existing rows.
   - `restaurants.supported_languages text[] DEFAULT ARRAY[]::text[] NOT NULL` — list of enabled language codes from a fixed set
   - `restaurants.default_language text DEFAULT 'en' NOT NULL` — the canonical fallback language
   **And** the existing `menu_items.name` / `menu_items.description` columns remain unchanged and continue to act as the **default** values when no translation matches
   **And** a CHECK constraint enforces `supported_languages <@ ARRAY['en','es','fr','ja','zh']::text[]` (only the initial Phase-2 set is allowed at the DB layer)
   **And** a CHECK constraint enforces `default_language = ANY(ARRAY['en','es','fr','ja','zh']::text[])`
   **And** `types/supabase.ts` is regenerated to expose the new columns

2. **Given** the database types are regenerated
   **When** `types/app.ts` is updated
   **Then** the `MenuItem` interface adds `translations: Record<string, { name: string; description?: string }>` (required, defaults to `{}` from the DB)
   **And** `MenuItemUpdate` adds an optional `translations?: Record<string, { name: string; description?: string }>` (used by `updateMenuItem` for bulk replace; the targeted translation Server Action below is preferred for incremental edits)
   **And** a new `RestaurantLanguageSettings` interface is exported: `{ supported_languages: string[]; default_language: string }`
   **And** a new constant `ALLOWED_LANGUAGES = ['en', 'es', 'fr', 'ja', 'zh'] as const` is exported with a sibling `LANGUAGE_LABEL: Record<typeof ALLOWED_LANGUAGES[number], string>` mapping each code to its English-language display name (`en → 'English'`, `es → 'Spanish'`, `fr → 'French'`, `ja → 'Japanese'`, `zh → 'Chinese'`). Place these in a new file `utils/languages.ts`; do NOT put them in `types/app.ts` (which is types-only)

3. **Given** the existing RLS policies on `menu_items` and `restaurants`
   **When** the new columns are added
   **Then** no new RLS policies are required — the existing owner-row-write policies (`owner_update_menu_items`, `owner_update_restaurants`) cover the whole row including the new columns
   **And** the existing RLS integration tests (`tests/rls/tenant-isolation.spec.ts`) continue to pass without modification (smoke-check during dev to confirm)

4. **Given** an authenticated owner edits a menu item that exists in the database
   **When** they enter or change a translation for an enabled language
   **Then** a new Server Action `updateMenuItemTranslation(itemId, langCode, payload)` is called with shape `payload: { name: string; description?: string | null }`
   **And** the action:
   - Validates auth + restaurant context (re-uses `getAuthContext`)
   - Validates `langCode` against the restaurant's `supported_languages` array — rejection returns `code: 'INVALID_LANGUAGE'`, `error: 'Language not enabled for this restaurant'`
   - Validates `payload.name` is non-empty (trimmed) — rejection returns `code: 'INVALID_NAME'`, `error: 'Translation name cannot be empty'`
   - Persists the translation by calling a new Postgres function `update_menu_item_translation(item_id uuid, lang_code text, payload jsonb)` defined in the migration. The function runs `UPDATE menu_items SET translations = jsonb_set(translations, ARRAY[lang_code], payload, true) WHERE id = item_id AND restaurant_id = (SELECT get_my_restaurant_id())` — atomic per-language update; never overwrites other language keys
   - Uses `count: 'exact'` (or function return value) to detect 0-row matches → returns `code: 'NOT_FOUND'`
   - Returns `ActionResult<{ item: MenuItem }>` on success with the freshly-read row (one extra round-trip via `.select().single()` — owner client + RLS, no 42501 trap because owners have full row SELECT)

5. **Given** an authenticated owner saves a translation
   **When** the auto-save debounce fires
   **Then** the request is atomic at the SQL level — even if two languages are saved concurrently, neither overwrites the other (verified by the `jsonb_set` approach + per-key write)
   **And** the in-flight guard mirrors the existing `MenuItemForm` pattern: one debounced timer **per language**, not shared with the main field timer

6. **Given** the owner is on `/admin/menu/[item_id]` editing a menu item
   **When** the page renders **and** the restaurant has at least one enabled language other than `default_language`
   **Then** a "Translations" expandable `<details>` section is rendered beneath the main fields (between "Availability" and "Image"). The section is collapsed by default.
   **And** for each enabled language code in `supported_languages` that is NOT the `default_language`, a card is shown containing:
   - Language label as the card header (`"Spanish"` etc. from `LANGUAGE_LABEL`)
   - A `name` text input pre-populated from `item.translations[langCode]?.name ?? ''`
   - A `description` textarea pre-populated from `item.translations[langCode]?.description ?? ''`
   - A per-language status line (`Saving…` / `Saved ✓` / `Saving failed — tap to retry`) below the inputs
   **And** translations auto-save with a 2-second debounce per language (same UX as the main field auto-save)
   **And** an empty `name` for a translation is allowed in the UI state but the auto-save Server Action **does not fire** until both `name.trim()` is non-empty (mirrors the main form's `if (!name.trim()) return` guard)

7. **Given** the owner is on `/admin/menu/new` (creating a new item)
   **When** the page renders
   **Then** the "Translations" section is **not** rendered — translations require a saved `item.id`. The main form's first save creates the item; only then is the translation editor available (on the redirect target `/admin/menu/[item_id]`)

8. **Given** the owner is on the Settings page (`/admin/settings`)
   **When** the page renders
   **Then** a new "Languages" section is shown below "Restaurant profile":
   - 5 checkboxes for the allowed languages (`en`, `es`, `fr`, `ja`, `zh`) with their `LANGUAGE_LABEL` text
   - `en` checkbox is checked **and disabled** (always supported; cannot be unchecked) — the array always contains at least `'en'`
   - A "Default language" radio group below the checkboxes, listing only currently-checked languages
   - A single "Save" button below the radio group
   - The current `restaurants.supported_languages` and `restaurants.default_language` are passed in from the Server Component (`app/admin/settings/page.tsx` extends its select to include both)
   **And** a new Server Action `updateRestaurantLanguages(supported_languages, default_language)` is called on submit. The action:
   - Validates auth + restaurant context
   - Validates every entry of `supported_languages` is in `ALLOWED_LANGUAGES`
   - Validates `supported_languages` length is between 1 and 5 (inclusive) and contains `'en'`
   - Validates `default_language` is in `supported_languages`
   - Updates `restaurants.supported_languages` and `restaurants.default_language` atomically in a single UPDATE
   - Returns `ActionResult<void>`

9. **Given** an item already has translations for a language
   **When** the owner **disables** that language in Settings (un-checks it)
   **Then** the existing `menu_items.translations` data is **preserved** in the DB — disabling a language hides the editor card and stops customer-facing rendering (Story 10.2's concern), but does NOT delete the JSON entry. Re-enabling restores access without re-typing.
   **And** the UPDATE to `restaurants.supported_languages` does NOT trigger any side-effect on `menu_items.translations` (no trigger, no orphan cleanup in 10.1)

10. **Given** RTL languages (Arabic, Hebrew, etc.)
    **When** the language selector renders
    **Then** RTL languages are **not** in `ALLOWED_LANGUAGES` and are not selectable — RTL support is **explicitly out of scope** for Phase 2 per epics. No `dir="rtl"` handling, no RTL-aware UI changes.

11. **Given** the test suite
    **When** Story 10.1 lands
    **Then** unit tests cover:
    - `updateMenuItemTranslation` success path (writes via the RPC, returns the updated item)
    - `updateMenuItemTranslation` rejects `langCode` not in `supported_languages` → `INVALID_LANGUAGE`
    - `updateMenuItemTranslation` rejects empty `name` → `INVALID_NAME`
    - `updateMenuItemTranslation` rejects unauthenticated → `NOT_AUTHENTICATED`
    - `updateMenuItemTranslation` rejects missing item (RLS denial or wrong tenant) → `NOT_FOUND`
    - `updateRestaurantLanguages` success path
    - `updateRestaurantLanguages` rejects entries outside `ALLOWED_LANGUAGES`
    - `updateRestaurantLanguages` rejects > 5 entries
    - `updateRestaurantLanguages` rejects `default_language` not in `supported_languages`
    - `updateRestaurantLanguages` rejects missing `'en'`
    - MenuItemForm: Translations section is hidden in create mode (no `item.id`)
    - MenuItemForm: Translations section is hidden when restaurant has no non-default languages
    - MenuItemForm: Translations section renders one card per non-default supported language
    - MenuItemForm: Editing a translation `name` triggers `updateMenuItemTranslation` after 2s debounce
    - MenuItemForm: Per-language save status renders independently (saving on `es` doesn't show "Saving…" on `fr`)
    - RestaurantSettings: 5 language checkboxes render
    - RestaurantSettings: `en` checkbox is checked and disabled
    - RestaurantSettings: Default-language radio only lists currently-checked languages
    - RestaurantSettings: Submit calls `updateRestaurantLanguages` with selected values
    **And** existing tests for `MenuItemForm`, `RestaurantSettings`, `updateMenuItem`, `updateRestaurantName`, and any test that constructs a `MenuItem` fixture continue to pass (fixtures need a `translations: {}` field; do a project-wide sweep)

---

## Tasks / Subtasks

- [x] **Task 1 — Schema migration** (AC: #1, #3)
  - [x] Create `supabase/migrations/20260521100000_add_menu_translations_and_restaurant_languages.sql` with:
    - `ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS translations jsonb DEFAULT '{}'::jsonb NOT NULL;`
    - `ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS supported_languages text[] DEFAULT ARRAY[]::text[] NOT NULL;`
    - `ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS default_language text DEFAULT 'en' NOT NULL;`
    - `ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_supported_languages_check CHECK (supported_languages <@ ARRAY['en','es','fr','ja','zh']::text[]);`
    - `ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_default_language_check CHECK (default_language IN ('en','es','fr','ja','zh'));`
    - `CREATE OR REPLACE FUNCTION public.update_menu_item_translation(item_id uuid, lang_code text, payload jsonb) RETURNS SETOF public.menu_items LANGUAGE sql SECURITY INVOKER AS $$ UPDATE public.menu_items SET translations = jsonb_set(translations, ARRAY[lang_code], payload, true) WHERE id = item_id AND restaurant_id = public.get_my_restaurant_id() RETURNING *; $$;`
    - `GRANT EXECUTE ON FUNCTION public.update_menu_item_translation(uuid, text, jsonb) TO authenticated;`
  - [x] Apply the migration via Supabase MCP (`mcp__supabase__apply_migration`)
  - [x] Regenerate `types/supabase.ts` via `supabase gen types` (or the equivalent MCP tool `mcp__supabase__generate_typescript_types`) and commit the diff
  - [x] **DO NOT** drop or rename `menu_items.name` / `menu_items.description` — they remain the canonical defaults per AC#1
  - [x] **DO NOT** add an `ON UPDATE` trigger on `restaurants.supported_languages` to clean up orphaned `menu_items.translations` keys — AC#9 explicitly preserves them
  - [x] **DO NOT** introduce a separate `languages` enum type — use `text` with CHECK constraints. The list will grow over time and an enum requires a migration per addition; a CHECK constraint is one-line to amend

- [x] **Task 2 — App types + language constants** (AC: #2)
  - [x] Edit `types/app.ts`:
    - Add `translations: Record<string, { name: string; description?: string }>` to `MenuItem` (required field)
    - Add `translations?: Record<string, { name: string; description?: string }>` to `MenuItemUpdate` (optional)
    - Do NOT add to `MenuItemCreate` — translations are added AFTER first save (AC#7)
    - Add `export interface RestaurantLanguageSettings { supported_languages: string[]; default_language: string }`
  - [x] Create `utils/languages.ts`:
    ```ts
    export const ALLOWED_LANGUAGES = ['en', 'es', 'fr', 'ja', 'zh'] as const
    export type AllowedLanguage = typeof ALLOWED_LANGUAGES[number]
    export const LANGUAGE_LABEL: Record<AllowedLanguage, string> = {
      en: 'English', es: 'Spanish', fr: 'French', ja: 'Japanese', zh: 'Chinese',
    }
    export function isAllowedLanguage(value: unknown): value is AllowedLanguage {
      return typeof value === 'string' && (ALLOWED_LANGUAGES as readonly string[]).includes(value)
    }
    ```
  - [x] Sweep test fixtures: every test that builds a `MenuItem` object literal must now include `translations: {}`. Locations to update (search for `name: ` near `price_cents:` to find them quickly):
    - `tests/unit/menu/MenuItemForm.test.tsx`
    - `tests/unit/menu/MenuItemList.test.tsx`
    - `tests/unit/menu/MenuPreview.test.tsx`
    - `tests/unit/customer/MenuItemRow.test.tsx`
    - `tests/unit/customer/ItemConfigSheet.test.tsx`
    - `tests/unit/menu/menuActions.item.test.ts`
    - any other file flagged by TypeScript after the type change
  - [x] **DO NOT** add `translations` to `MenuItemCreate` (per AC#7 — first save creates the row with no translations; the editor only appears in edit mode)

- [x] **Task 3 — Server Action: `updateMenuItemTranslation`** (AC: #4, #5)
  - [x] Edit `actions/menuActions.ts`:
    - Add a `TranslationPayload` type (file-local): `{ name: string; description?: string | null }`
    - Add `export async function updateMenuItemTranslation(itemId: string, langCode: string, payload: TranslationPayload): Promise<ActionResult<{ item: MenuItem }>>`
    - Use the same `ActionResult.code` taxonomy established by Stories 9.1/9.2: `NOT_AUTHENTICATED`, `NOT_FOUND`, `INVALID_LANGUAGE`, `INVALID_NAME`, `UPDATE_FAILED`. (See memory `feedback_action_error_codes.md` — distinct codes per failure mode are the project standard.)
    - Implementation:
      ```ts
      export async function updateMenuItemTranslation(
        itemId: string,
        langCode: string,
        payload: TranslationPayload,
      ): Promise<ActionResult<{ item: MenuItem }>> {
        const { supabase, user, restaurantId } = await getAuthContext()
        if (!user) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
        if (!restaurantId) return { success: false, error: 'No restaurant found', code: 'NOT_FOUND' }

        const trimmedName = payload.name.trim()
        if (!trimmedName) {
          return { success: false, error: 'Translation name cannot be empty', code: 'INVALID_NAME' }
        }

        // Validate langCode against the restaurant's enabled languages
        const { data: restaurant, error: restError } = await supabase
          .from('restaurants')
          .select('supported_languages')
          .eq('id', restaurantId)
          .single()
        if (restError || !restaurant) {
          return { success: false, error: 'Restaurant not found', code: 'NOT_FOUND' }
        }
        if (!(restaurant.supported_languages as string[]).includes(langCode)) {
          return { success: false, error: 'Language not enabled for this restaurant', code: 'INVALID_LANGUAGE' }
        }

        const jsonbPayload: { name: string; description?: string } = { name: trimmedName }
        const desc = payload.description?.trim()
        if (desc) jsonbPayload.description = desc

        const { data: rows, error } = await supabase.rpc('update_menu_item_translation', {
          item_id: itemId,
          lang_code: langCode,
          payload: jsonbPayload,
        })
        if (error) {
          console.error('[updateMenuItemTranslation]', error)
          return { success: false, error: 'Save failed — tap to retry', code: 'UPDATE_FAILED' }
        }
        const row = Array.isArray(rows) ? rows[0] : null
        if (!row) return { success: false, error: 'Item not found', code: 'NOT_FOUND' }
        return { success: true, data: { item: toMenuItem(row as Record<string, unknown>) } }
      }
      ```
  - [x] **DO NOT** call `.update({ translations: {...} })` directly on the JS client — that would overwrite the entire jsonb column, blowing away other languages' entries on a concurrent save (per memory `feedback_action_error_codes.md` and the AC#5 atomicity requirement). The RPC + `jsonb_set` is the only correct path.
  - [x] **DO NOT** add an empty-description guard — `description` is optional. If trimmed-empty, omit the key from the payload (so the stored object is `{ name }` not `{ name, description: '' }`)

- [x] **Task 4 — Server Action: `updateRestaurantLanguages`** (AC: #8)
  - [x] Edit `actions/restaurantActions.ts`:
    - Import `ALLOWED_LANGUAGES, isAllowedLanguage` from `@/utils/languages`
    - Add `export async function updateRestaurantLanguages(supported_languages: string[], default_language: string): Promise<ActionResult<void>>`
    - Validation order:
      1. `getAuthContext` → 401 / 404 as established
      2. `Array.isArray(supported_languages)` and `supported_languages.every(isAllowedLanguage)` → `INVALID_LANGUAGE` on fail
      3. `supported_languages.length >= 1 && supported_languages.length <= 5` → `INVALID_LANGUAGE` on fail
      4. `supported_languages.includes('en')` → `INVALID_LANGUAGE` on fail (with message `"English is required"`)
      5. `supported_languages.includes(default_language)` → `INVALID_LANGUAGE` on fail (with message `"Default language must be one of the enabled languages"`)
    - On success: single UPDATE statement setting both columns. No partial save.
  - [x] Add `ActionResult.code` values per the project standard: `NOT_AUTHENTICATED`, `NOT_FOUND`, `INVALID_LANGUAGE`, `UPDATE_FAILED`

- [x] **Task 5 — MenuItemForm: Translations section** (AC: #6, #7)
  - [x] Edit `components/admin/MenuItemForm.tsx`:
    - Extend `Props` to add `supportedLanguages: string[]` and `defaultLanguage: string` (both required — Server Component is responsible for fetching from `restaurants` and passing them down)
    - Compute `nonDefaultLanguages = supportedLanguages.filter((l) => l !== defaultLanguage)` once at the top of the component
    - Render the Translations `<details>` section only when **both** `item?.id` exists (edit mode) **AND** `nonDefaultLanguages.length > 0`. Place it between the Availability and Image sections.
    - For each language in `nonDefaultLanguages`, render a `<TranslationCard>` (new component, defined in the same file or a sibling file `TranslationCard.tsx` — see Task 6 for the file boundary). Each card:
      - Maintains its own `name` / `description` state, seeded from `item.translations?.[langCode]?.name ?? ''` etc.
      - Has its own `setTimeout`-based 2s debounce that calls `updateMenuItemTranslation(item.id, langCode, { name, description: description || null })`
      - Renders its own per-language status (`Saving…` / `Saved ✓` / `Saving failed — tap to retry`)
      - **Does not fire** the save if `name.trim() === ''` (mirrors the main form's guard at line 125)
    - Update the page that renders `MenuItemForm` (`app/admin/menu/[itemId]/page.tsx` and `app/admin/menu/new/page.tsx`) to read `supported_languages` + `default_language` from the restaurants row and pass them in
  - [x] **DO NOT** share the existing `timerRef` between the main form and translation cards — each card needs its own timer. Shared timer would cause the main form's "Saving…" status to display while a translation is saving.
  - [x] **DO NOT** reuse the existing `doSave` for translations — it persists the entire main-field set via `updateMenuItem`. Translations have their own targeted Server Action.
  - [x] **DO NOT** auto-expand the `<details>` section on initial render — it's collapsed by default (per AC#6). The owner taps to open.

- [x] **Task 6 — TranslationCard component** (AC: #6)
  - [x] Create `components/admin/TranslationCard.tsx`:
    ```tsx
    'use client'
    import { useEffect, useRef, useState } from 'react'
    import { updateMenuItemTranslation } from '@/actions/menuActions'
    import { LANGUAGE_LABEL, type AllowedLanguage } from '@/utils/languages'

    type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

    interface Props {
      itemId: string
      langCode: AllowedLanguage
      initialName: string
      initialDescription: string
    }

    export function TranslationCard({ itemId, langCode, initialName, initialDescription }: Props) {
      const [name, setName] = useState(initialName)
      const [description, setDescription] = useState(initialDescription)
      const [status, setStatus] = useState<SaveStatus>('idle')
      const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
      const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

      useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current)
        if (!name.trim()) return
        timerRef.current = setTimeout(async () => {
          setStatus('saving')
          const result = await updateMenuItemTranslation(itemId, langCode, {
            name,
            description: description.trim() || null,
          })
          if (!result.success) {
            setStatus('error')
            return
          }
          setStatus('saved')
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
          savedTimerRef.current = setTimeout(() => setStatus('idle'), 2000)
        }, 2000)
        return () => { if (timerRef.current) clearTimeout(timerRef.current) }
      }, [name, description, itemId, langCode])

      return (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <h3 className="text-sm font-medium text-text-primary">{LANGUAGE_LABEL[langCode]}</h3>
          <input
            type="text"
            placeholder={`Item name (${LANGUAGE_LABEL[langCode]})`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label={`${LANGUAGE_LABEL[langCode]} name`}
            className="h-10 rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <textarea
            placeholder={`Description (${LANGUAGE_LABEL[langCode]})`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            aria-label={`${LANGUAGE_LABEL[langCode]} description`}
            className="rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
          <div className="min-h-[1.25rem] text-xs" role="status" aria-live="polite">
            {status === 'saving' && <span className="text-text-tertiary">Saving…</span>}
            {status === 'saved' && <span className="text-green-600">Saved ✓</span>}
            {status === 'error' && <span className="text-red-500">Saving failed — tap to retry</span>}
          </div>
        </div>
      )
    }
    ```
  - [x] **DO NOT** inline the card inside MenuItemForm — separating to its own file keeps MenuItemForm under 400 lines and makes the per-language debounce isolation explicit
  - [x] **DO NOT** add a "remove translation" button — disabling a language in Settings is the only path to hide a translation (and the data is preserved per AC#9). A delete-button would invite accidental data loss

- [x] **Task 7 — RestaurantSettings: Languages section** (AC: #8)
  - [x] Edit `app/admin/settings/page.tsx`:
    - Extend the `.select(...)` to include `supported_languages, default_language`
    - Pass them into `<RestaurantSettings>` as new required props
  - [ ] Edit `components/admin/RestaurantSettings.tsx`:
    - Add required props: `supportedLanguages: string[]` and `defaultLanguage: string`
    - Add new state: `selectedLanguages: AllowedLanguage[]` and `selectedDefault: AllowedLanguage` seeded from props
    - Add a new `<section>` below "Restaurant profile" titled **"Languages"**:
      ```tsx
      <section className="rounded-lg border border-border bg-surface-raised p-6">
        <h2 className="mb-4 text-base font-semibold text-text-primary">Languages</h2>
        <form onSubmit={handleSaveLanguages} className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-text-primary mb-2">Enabled languages</legend>
            {ALLOWED_LANGUAGES.map((code) => (
              <label key={code} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedLanguages.includes(code)}
                  disabled={code === 'en'}
                  onChange={() => toggleLanguage(code)}
                  aria-label={LANGUAGE_LABEL[code]}
                />
                {LANGUAGE_LABEL[code]}
                {code === 'en' && <span className="text-xs text-text-tertiary">(always required)</span>}
              </label>
            ))}
            <p className="text-xs text-text-tertiary">Up to 5 languages. English is always enabled.</p>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-text-primary mb-2">Default language</legend>
            {selectedLanguages.map((code) => (
              <label key={code} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="default-language"
                  value={code}
                  checked={selectedDefault === code}
                  onChange={() => setSelectedDefault(code)}
                />
                {LANGUAGE_LABEL[code]}
              </label>
            ))}
          </fieldset>

          {languagesError && <p role="alert" className="text-sm text-red-500">{languagesError}</p>}
          {languagesSuccess && <p role="status" className="text-sm text-green-600">Languages updated.</p>}
          <div>
            <button type="submit" disabled={isSubmittingLanguages} className="rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              {isSubmittingLanguages ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </section>
      ```
    - `toggleLanguage(code)` enforces:
      - Cannot uncheck `'en'`
      - Max 5 selections (no-op if already 5)
      - If the unchecked language was the `selectedDefault`, reset `selectedDefault` to `'en'`
    - `handleSaveLanguages` calls `updateRestaurantLanguages(selectedLanguages, selectedDefault)` — wires up the Server Action
  - [x] **DO NOT** combine the "Restaurant profile" form and "Languages" form into one submit — they're independent. The existing "Restaurant profile" form is its own submission.

- [x] **Task 8 — Tests** (AC: #11)
  - [x] Create `tests/unit/menu/menuActions.translation.test.ts` mirroring the `advanceOrderStatus` test layout (uses `makeOwnerClient` pattern from `orderActions.test.ts`, but extended with an `.rpc()` mock since the new function uses RPC). Cover all five `updateMenuItemTranslation` paths (success, INVALID_LANGUAGE, INVALID_NAME, NOT_AUTHENTICATED, NOT_FOUND).
  - [x] Extend `tests/unit/menu/restaurantActions.test.ts` (create if it doesn't exist — current file may only test `updateRestaurantName`) with `updateRestaurantLanguages` cases: success, rejects bad enum value, rejects > 5 entries, rejects missing 'en', rejects default not in supported, rejects NOT_AUTHENTICATED.
  - [x] Extend `tests/unit/menu/MenuItemForm.test.tsx`:
    - Pass new required props `supportedLanguages` + `defaultLanguage` to every existing render call (use `['en']` + `'en'` for tests that don't care about translations)
    - Add: Translations section is hidden in create mode (`item` prop undefined)
    - Add: Translations section is hidden when restaurant has no non-default languages (`supportedLanguages={['en']}`, `defaultLanguage='en'`)
    - Add: Translations section renders one TranslationCard per non-default language when `supportedLanguages=['en', 'es', 'fr']` and `defaultLanguage='en'`
  - [x] Create `tests/unit/admin/TranslationCard.test.tsx`:
    - Renders the language label header
    - Editing `name` triggers `updateMenuItemTranslation` after 2s debounce (use fake timers)
    - Empty `name` does NOT trigger the action (mirrors the main form guard)
    - Success status displays then resets to idle after 2s
    - Failure status displays and persists
    - Each card has independent state — saving on one card doesn't affect another
  - [x] Extend or create `tests/unit/admin/RestaurantSettings.test.tsx` (currently there may be no test file for RestaurantSettings — check). If new file, set up `vi.mock` for `updateRestaurantName` + `updateRestaurantLanguages`. Cover all AC#8 behaviors.
  - [x] Sweep `MenuItem` fixtures: every existing test that builds a `MenuItem` object literal needs `translations: {}` (TypeScript will flag them — fix mechanically, no logic changes)
  - [x] **DO NOT** mock the Supabase RPC chain in a clever way — the simplest mock is `supabase.rpc = vi.fn().mockResolvedValue({ data: [row], error: null })`. The current `getAuthContext` mock pattern in `menuActions.test.ts` (which doesn't exist yet — see existing `menuActions.item.test.ts`) is the closest reference; if a different pattern is in use, mirror that.
  - [x] **DO NOT** write a Playwright RLS test for the new RPC — `update_menu_item_translation` is `SECURITY INVOKER`, so the existing `owner_update_menu_items` RLS policy gates it. The existing RLS tests prove tenant isolation transitively. (If a future hardening makes this `SECURITY DEFINER`, that's the moment for a dedicated RLS test.)

- [ ] **Task 9 — Manual smoke test** (AC: #1–#11)
  - [ ] Start local Supabase (`supabase start`) and the dev server (`npm run dev`).
  - [ ] Sign in as an owner. Navigate to `/admin/settings`. Confirm the new "Languages" section renders with all 5 checkboxes, `en` checked and disabled, default-language radio listing only `en`.
  - [ ] Check `es` and `fr`. The default-language radio expands to list `en`, `es`, `fr`. Leave default as `en`. Save. Confirm "Languages updated." success message.
  - [ ] Navigate to `/admin/menu` → pick an existing item → editor opens. Confirm the new "Translations" `<details>` section is collapsed, between Availability and Image. Tap to expand. Confirm 2 cards render (Spanish, French — English is the default and is skipped).
  - [ ] Type a Spanish name. After ~2s the status should change to "Saving…" → "Saved ✓" → back to idle. Refresh the page. The Spanish name should still be there.
  - [ ] Type an empty Spanish name (delete what was just saved). Confirm: no save fires (status stays idle — empty name is guarded). Type a new value. Save fires again.
  - [ ] In Settings, uncheck Spanish. Save. Refresh the menu item editor — the Spanish card is now hidden, but the underlying `menu_items.translations.es` data is preserved in the DB (verify via `supabase db query` or the Supabase dashboard).
  - [ ] Re-check Spanish in Settings → the Spanish card re-appears in the menu item editor with the previously-saved value.
  - [ ] **Cross-tenant smoke:** Sign out, sign in as a different restaurant's owner, navigate to `/admin/menu/[some-other-restaurant-item-id]`. Confirm 404 / redirect (existing RLS coverage). The translation editor should never load for another tenant's item.
  - [ ] **DB sanity:** With a translation present for `es`, manually run `UPDATE restaurants SET supported_languages = ARRAY[]::text[] WHERE id = ...` to disable all extra languages, then re-load the menu item editor. The Translations section should be hidden (no non-default languages). The `menu_items.translations.es` data is unchanged.
  - [ ] **Constraint sanity:** Attempt via direct SQL to set `default_language = 'de'` — should fail the CHECK constraint. Attempt to add `'de'` to `supported_languages` — should fail.

---

## Dev Notes

### Schema design choices

**Why `jsonb` for `menu_items.translations` rather than a separate `menu_item_translations` table?**

- A side table would require a JOIN (or denormalization) on every menu render — current customer SSR is one `menu_items` select and we want to keep it that way for performance (avoid N+1 or extra round-trip).
- The shape is naturally hierarchical (`{ es: { name, description } }`) and small (≤ 5 languages × 2 fields per item). jsonb fits.
- Querying / filtering by translation content is not a requirement (FR55 is about display, not search). If full-text search across translations is needed later, a `GIN (translations jsonb_path_ops)` index can be added without a rewrite.
- `jsonb_set` provides per-language atomicity — exactly the AC#5 guarantee.

**Why a Postgres function `update_menu_item_translation` instead of inlining the SQL in the Server Action?**

- The JS Supabase client cannot express `jsonb_set(translations, ARRAY[lang_code], payload, true)` — it would have to send the entire jsonb column on every save, which races with concurrent edits to other languages.
- An RPC pushes the merge to the DB, where it's atomic by definition (single UPDATE statement).
- `SECURITY INVOKER` (the default) means RLS still applies — the function does not bypass tenant isolation.
- The function is small enough that a future migration can replace it without breaking callers.

**Why CHECK constraints instead of a Postgres enum for the language list?**

- A Postgres `CREATE TYPE ... AS ENUM` requires `ALTER TYPE` migrations to add values, which lock the type briefly.
- A CHECK constraint with an array literal is a one-line `ALTER TABLE ... DROP CONSTRAINT / ADD CONSTRAINT` change.
- The TypeScript side `ALLOWED_LANGUAGES` constant is the single source of truth for both the UI and validation; the DB CHECK is defense-in-depth.

### Why translations live next to the row, not on a separate `i18n_strings` table

**`menu_items.translations`** holds per-item content that changes per restaurant (item names, descriptions).
**`i18n/{lang}.json` bundles** (Story 10.2) hold the UI chrome (button labels, headings) that's the same for every restaurant.

These are two different concerns. Story 10.1 only addresses the first. Story 10.2 will introduce the bundle loading; nothing in 10.1 should preempt that design.

### The `menu_items.translations` data lifecycle

| Event | Behavior |
|---|---|
| Item created | `translations` = `{}` (default) |
| Owner saves a translation for `'es'` | `translations` = `{ es: { name, description? } }` (jsonb_set, atomic) |
| Owner edits the Spanish name | `translations.es.name` overwritten; other keys untouched |
| Owner saves a translation for `'fr'` | `translations` = `{ es: {...}, fr: {...} }` — concurrent saves preserve both |
| Owner disables `'es'` in Settings | `restaurants.supported_languages` no longer contains `'es'`, but `menu_items.translations.es` is **preserved** (per AC#9) |
| Owner re-enables `'es'` | The preserved `menu_items.translations.es` is shown again in the editor card |
| Item deleted | The whole row (including translations) is deleted — no cleanup needed |

This means there's an asymmetry: the UI only shows translations for currently-enabled languages, but the DB stores everything ever written. That's intentional. A disabled-then-re-enabled language should restore content without re-typing.

### Auto-save UX consistency

The 2-second debounce + per-card status indicator mirrors the existing `MenuItemForm` pattern. Three small differences:

1. The main form has one shared `timerRef` and one shared `saveStatus`. Translation cards each get their own — saving the Spanish translation should not flash "Saving…" on the French card.
2. The main form's save status uses `<div className="text-sm min-h-[1.25rem]">`. Translation cards use `<div className="min-h-[1.25rem] text-xs" role="status" aria-live="polite">` (slightly smaller, with explicit ARIA live-region — multiple cards rendering near each other benefits from `aria-live="polite"` so screen readers don't lose context).
3. The main form's "Saving failed" message ends with "tap to try again". Translations end with "tap to retry" — both are valid actionable strings; the shorter one fits the smaller card.

### `MenuItemForm` Props evolution

Before this story:
```ts
interface Props { categories: Category[]; item?: MenuItem }
```

After this story:
```ts
interface Props {
  categories: Category[]
  item?: MenuItem
  supportedLanguages: string[]
  defaultLanguage: string
}
```

Both new props are **required**. The pages that render this form (`app/admin/menu/[itemId]/page.tsx` and `app/admin/menu/new/page.tsx`) become responsible for fetching the restaurant's language settings server-side and passing them down. This is a small breaking change at the call sites — verify both pages are updated.

### Test fixture sweep

The `MenuItem` type gains a required `translations` field. TypeScript will flag every test fixture that doesn't include it. Approach:

1. Run `npx tsc --noEmit` after Task 2 to get the full list of broken fixtures.
2. Add `translations: {}` to each. The trivial empty-object satisfies the type without changing test intent.
3. This is mechanical — do NOT use this opportunity to refactor fixtures into a shared factory. Pre-existing test pattern uses inline literals; honor that convention. (Memory note from Story 9.2 retrospective: six `makeOrder` factories duplicating the same shape — consolidating was rejected as out-of-scope.)

### Anti-pattern reminders (from project-context + prior story learnings)

| Anti-pattern | Correct pattern (this story) |
|---|---|
| `supabase.from('menu_items').update({ translations: {...} })` from the JS client | RPC call to `update_menu_item_translation(item_id, lang_code, payload)` — atomic `jsonb_set` |
| Adding a Postgres enum for languages | CHECK constraint with array literal `<@ ARRAY['en','es','fr','ja','zh']` |
| Sharing the main form's `timerRef` for translation saves | One `useRef` per `TranslationCard` |
| Empty `name` triggering a translation save | Guard `if (!name.trim()) return` mirroring the main form's pattern |
| Deleting `menu_items.translations.es` when `'es'` is removed from `supported_languages` | Preserve the data (AC#9). The display is gated by `supported_languages`, not by the data's presence. |
| Adding `translations` to `MenuItemCreate` | Translations are post-save (AC#7). `MenuItemCreate` stays as-is. |
| Importing the admin client (`@/lib/supabase/admin`) for these owner-context writes | Owner Server Actions use `lib/supabase/server.ts → createClient()` (cookie client). Admin client is only for sessionless customer SSR. |
| Throwing in the Server Action | Return `{ success: false, error, code }` — Server Actions never throw (project-context rule) |
| Mocking the Supabase RPC by chaining `.from().update().eq()` in the test | The RPC is invoked via `supabase.rpc('update_menu_item_translation', {...})` — mock `client.rpc` directly |

### Files this story touches (NEW / UPDATE) vs. files it must NOT touch

**NEW in 10.1:**
- `supabase/migrations/20260521100000_add_menu_translations_and_restaurant_languages.sql` — schema migration + RPC function
- `utils/languages.ts` — `ALLOWED_LANGUAGES`, `LANGUAGE_LABEL`, `AllowedLanguage` type, `isAllowedLanguage` guard
- `components/admin/TranslationCard.tsx` — per-language editor card
- `tests/unit/menu/menuActions.translation.test.ts` — unit tests for `updateMenuItemTranslation`
- `tests/unit/admin/TranslationCard.test.tsx` — unit tests for the card

**UPDATE in 10.1:**
- `types/supabase.ts` — regenerated to expose new columns
- `types/app.ts` — `MenuItem` gains `translations`; `MenuItemUpdate` gains optional `translations`; new `RestaurantLanguageSettings` interface
- `actions/menuActions.ts` — new `updateMenuItemTranslation` Server Action
- `actions/restaurantActions.ts` — new `updateRestaurantLanguages` Server Action
- `components/admin/MenuItemForm.tsx` — new required props (`supportedLanguages`, `defaultLanguage`); render Translations `<details>` section
- `components/admin/RestaurantSettings.tsx` — new required props; new "Languages" section with checkboxes + radio + Server Action wiring
- `app/admin/settings/page.tsx` — extend `.select(...)` to include language columns; pass them down
- `app/admin/menu/[itemId]/page.tsx` (and `/new/page.tsx`) — fetch + pass language props to MenuItemForm
- `tests/unit/menu/MenuItemForm.test.tsx` — new required props on every render; new translation-section tests
- `tests/unit/menu/restaurantActions.test.ts` — new `updateRestaurantLanguages` cases (create file if missing)
- `tests/unit/menu/MenuItemList.test.tsx`, `tests/unit/menu/MenuPreview.test.tsx`, `tests/unit/customer/MenuItemRow.test.tsx`, `tests/unit/customer/ItemConfigSheet.test.tsx`, `tests/unit/menu/menuActions.item.test.ts` — `MenuItem` fixtures gain `translations: {}`
- Possibly: `tests/unit/admin/RestaurantSettings.test.tsx` (create if missing)

**MUST NOT touch in 10.1:**
- Customer-facing menu page (`app/[restaurant_slug]/[table_number]/page.tsx`) — that's 10.2 (customer rendering / language switcher)
- Customer components (`components/customer/*`) — same
- `i18n/` directory or any UI-chrome bundle loading — that's 10.2
- `Accept-Language` header parsing or language negotiation — that's 10.2
- The `?lang=` URL search param — that's 10.2
- `<html lang="...">` attribute on customer pages — that's 10.2
- `tests/rls/*` — existing policies cover the new columns; no new RLS test needed (per AC#3)
- `tests/e2e/*` — no E2E test for translations in 10.1 (manual smoke covers the flow)
- `_bmad-output/project-context.md` — no anti-pattern updates needed in 10.1
- `stores/*` — no Zustand changes needed (translations are server-state, not client-state)

### Acceptance gate / Done Gate

This story has no real-time / DB-write integration concerns that require manual smoke beyond the standard owner-flow validation. The smoke test (Task 9) covers:
- Schema migration applied correctly (column existence, CHECK constraints)
- Settings UI flow (enable/disable language, change default)
- Menu item translation UI flow (auto-save, status, persistence across reload)
- Data lifecycle (disable-then-re-enable preserves data)
- RLS still works (cross-tenant cannot read/write)
- CHECK constraints reject invalid values

After Task 9 passes, flip the story to `done` in sprint-status.yaml.

### Open questions for future work (not blocking 10.1)

1. **Translation coverage UI:** Show "Spanish: 5 of 12 items translated" on the menu page or settings — a future story (probably 10.3) once we have real owner feedback.
2. **Bulk translation import:** CSV / XLSX import for translation strings — future story.
3. **AI-suggested translations:** "Auto-translate from English" button per card — future story; needs cost analysis (DeepL, OpenAI, etc.) and a UX for review-before-save.
4. **RTL language support:** Arabic, Hebrew, Persian. Explicitly out of scope per AC#10. Requires a separate story to add `dir="rtl"` plumbing, mirror layouts, and locale-aware breakpoints.
5. **Per-category translations:** Currently only item name/description translate; category names (e.g., "Starters" → "Entrantes") use the original English. A future story can extend the model — categories don't have a `translations` column today.
6. **Restaurant name translations:** Same as above — `restaurants.name` is single-language. Customer surfaces show the original.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.1: Translation Data Model & Owner Editor]
- [Source: _bmad-output/planning-artifacts/prd.md#FR55] — owner defines per-language translations
- [Source: _bmad-output/planning-artifacts/architecture.md] — no i18n-specific sections; pattern is mostly inherited from existing menu_items architecture
- [Source: _bmad-output/implementation-artifacts/9-1-order-status-data-model-server-action.md] — established the `ActionResult.code` taxonomy used here (`NOT_AUTHENTICATED`, `NOT_FOUND`, `INVALID_*`, `UPDATE_FAILED`)
- [Source: components/admin/MenuItemForm.tsx] — existing 2s-debounce auto-save pattern that translation cards mirror
- [Source: components/admin/RestaurantSettings.tsx] — current settings page; gets a new section appended
- [Source: actions/menuActions.ts] — `getAuthContext`, `toMenuItem`, established Server Action structure
- [Source: actions/restaurantActions.ts] — `updateRestaurantName` pattern for the new `updateRestaurantLanguages`
- [Source: supabase/migrations/20260511100000_add_menu_item_variants.sql] — example of a jsonb-column ADD migration with default
- [Source: supabase/migrations/20260520100001_add_get_restaurant_analytics_function.sql] — example of a Postgres function migration
- [Memory: project_postgres_42501_returning.md] — owner-context writes don't hit the 42501 RETURNING trap (owners have SELECT policies); informational
- [Memory: feedback_action_error_codes.md] — distinct `ActionResult.code` per failure mode is the project standard; followed here

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

No blocking issues. Two test fixes required:
1. `getByLabelText('Spanish'/'English')` was ambiguous in `RestaurantSettings.test.tsx` because the checkbox `aria-label` and the radio's wrapping `<label>` text both matched — fixed by using `getByRole('checkbox', { name: ... })`.
2. `vi.mocked(createClient).mock.results[0].value` returns the Promise (not the resolved value) — fixed by saving the client reference before calling `mockResolvedValue`.

### Completion Notes List

- Tasks 1–8 complete; Task 9 (manual smoke) deferred to user.
- `toMenuItem` updated to default `translations` to `{}` so existing mock data without the field continues to work.
- `menuActions.item.test.ts` fixtures (returned from mocks) don't need `translations: {}` because they're used as raw DB row objects that flow through `toMenuItem`, which defaults the field.
- All 575 unit tests pass.

### File List

**NEW:**
- `supabase/migrations/20260521100000_add_menu_translations_and_restaurant_languages.sql`
- `utils/languages.ts`
- `components/admin/TranslationCard.tsx`
- `tests/unit/menu/menuActions.translation.test.ts`
- `tests/unit/admin/TranslationCard.test.tsx`
- `tests/unit/admin/RestaurantSettings.test.tsx`

**UPDATED:**
- `types/supabase.ts` — regenerated with new columns + RPC function
- `types/app.ts` — `MenuItem.translations` (required), `MenuItemUpdate.translations` (optional), `RestaurantLanguageSettings` interface
- `actions/menuActions.ts` — `toMenuItem` defaults `translations`; `TranslationPayload` type; `updateMenuItemTranslation` Server Action
- `actions/restaurantActions.ts` — `updateRestaurantLanguages` Server Action
- `components/admin/MenuItemForm.tsx` — new `supportedLanguages`/`defaultLanguage` props; Translations `<details>` section; `TranslationCard` import
- `components/admin/RestaurantSettings.tsx` — new `supportedLanguages`/`defaultLanguage` props; Languages section with checkboxes + radio + Server Action wiring
- `app/admin/settings/page.tsx` — extended select + passes language props
- `app/admin/menu/[item_id]/page.tsx` — fetches language settings, passes to `MenuItemForm`
- `app/admin/menu/new/page.tsx` — fetches language settings, passes to `MenuItemForm`
- `tests/unit/menu/MenuItemForm.test.tsx` — new required props on all renders; `TranslationCard` mock; 3 new translation-section tests
- `tests/unit/menu/restaurantActions.test.ts` — `updateRestaurantLanguages` test suite appended
- `tests/unit/menu/MenuItemList.test.tsx` — `translations: {}` in fixtures
- `tests/unit/menu/MenuPreview.test.tsx` — `translations: {}` in fixtures
- `tests/unit/customer/MenuItemRow.test.tsx` — `translations: {}` in baseItem
- `tests/unit/customer/ItemConfigSheet.test.tsx` — `translations: {}` in baseItem

### Review Findings

**Code review 2026-05-21** — 3 reviewers (Blind Hunter / Edge Case Hunter / Acceptance Auditor). 3 decision-needed, 8 patches, 15 deferred, 18 dismissed.

- [x] **[Review][Decision→Patch] Migration `supported_languages` column defaults to `ARRAY[]::text[]`** — Resolved: change default + backfill existing rows. Applied in `supabase/migrations/20260521110000_strengthen_restaurant_languages.sql`.
- [x] **[Review][Decision→Patch] Add DB-level defense-in-depth CHECK constraints** — Resolved: added `restaurants_supported_languages_nonempty`, `restaurants_supported_languages_includes_en`, `restaurants_default_language_in_supported` in the same follow-up migration.
- [x] **[Review][Decision→Patch] TranslationCard stale-response race** — Resolved: added `saveSeqRef` sequence-id guard in `components/admin/TranslationCard.tsx`. Out-of-order responses are now ignored.

- [x] **[Review][Patch] Dedupe `supported_languages` before validation** [actions/restaurantActions.ts:106] — Applied: `Array.from(new Set(...))` before length/inclusion checks. Test updated to assert dedupe behavior (now expects success on `['en','es','fr','ja','zh','en']` with the unique array persisted).
- [x] **[Review][Patch] Normalize `selectedDefault` at seed time** [components/admin/RestaurantSettings.tsx:25] — Applied: seed falls back to `'en'` if `defaultLanguage` is not in the deduped seeded `selectedLanguages`.
- [x] **[Review][Patch] TranslationCard sends untrimmed `name`** [components/admin/TranslationCard.tsx:27] — Applied: payload now sends `trimmedName`.
- [x] **[Review][Patch] TranslationCard `savedTimerRef` not cleared on unmount** [components/admin/TranslationCard.tsx] — Applied: added a mount-only cleanup effect that clears both `timerRef` and `savedTimerRef`.
- [x] **[Review][Patch] `updateRestaurantLanguages` leaks raw DB error to UI** [actions/restaurantActions.ts:124] — Applied: now returns `'Save failed — tap to retry'`; raw error kept in `console.error`.
- [x] **[Review][Patch] Clear success/error banners when user toggles a checkbox** [components/admin/RestaurantSettings.tsx] — Applied: `clearLanguagesBanners()` called in both `toggleLanguage` and radio `onChange`.
- [x] **[Review][Patch] TranslationCard error status sticks when user clears name** [components/admin/TranslationCard.tsx] — Applied: empty-name path resets `status` to `'idle'` when previously `'error'`.
- [x] **[Review][Patch] Update "rejects > 5 entries" test** [tests/unit/menu/restaurantActions.test.ts] — Applied: replaced with `'deduplicates supported_languages before validation and persists the unique set'`, asserting the deduped UPDATE payload.

- [x] **[Review][Defer] `updateMenuItemTranslation` re-reads `supported_languages` on every save** [actions/menuActions.ts:264] — Extra DB round-trip per debounced save. Acceptable at 2s debounce; revisit if hot.
- [x] **[Review][Defer] `UPDATE_FAILED` code conflates DB errors and RLS denials** [actions/menuActions.ts:280] — Distinct codes would require parsing Postgres error codes. Project standard is one user-facing error string per action.
- [x] **[Review][Defer] `.single()` crashes for owner without `profiles` row** [app/admin/menu/[item_id]/page.tsx:15] — Pre-existing project pattern. Middleware-level auth handles unauthenticated; missing profile is a deeper data-integrity issue.
- [x] **[Review][Defer] Silent null fallback in Settings/Edit pages** [app/admin/settings/page.tsx:18] — `?? ['en']` masks query errors. Relies on middleware auth gate; pages don't repeat the check.
- [x] **[Review][Defer] TranslationCards autosave when `<details>` is collapsed** [components/admin/MenuItemForm.tsx:266] — Cards mount once and stay mounted; status indicator is hidden when collapsed. Works as intended per AC#6.
- [x] **[Review][Defer] `toMenuItem` does not validate `translations` shape** [actions/menuActions.ts:8] — Defensive against legacy/manual JSONB writes; rare. DB CHECK on shape would be a follow-up.
- [x] **[Review][Defer] Test gap: concurrent typing on same TranslationCard** — Race tests not added in 10.1.
- [x] **[Review][Defer] Test gap: cross-tenant at action layer for `updateMenuItemTranslation`** — RLS covers via `get_my_restaurant_id()` in the RPC; existing RLS tests prove tenant isolation transitively.
- [x] **[Review][Defer] Migration not idempotent (`ADD CONSTRAINT` without `IF NOT EXISTS`)** — Project applies migrations one-shot via MCP; re-runs are not part of the workflow.
- [x] **[Review][Defer] Name/description length unbounded** — No spec requirement; matches existing `updateMenuItem` pattern.
- [x] **[Review][Defer] `revalidatePath` not called after translation/language saves** — Project doesn't use `revalidatePath` pattern; pages don't cache owner-specific data.
- [x] **[Review][Defer] `update_menu_item_translation` lacks `SET search_path = ''`** — Hardening concern; other DB functions in project don't set this either.
- [x] **[Review][Defer] `jsonb_set(null, ...)` returns NULL** — Mitigated by `NOT NULL DEFAULT '{}'` column constraint. Legacy NULL data path is unreachable.
- [x] **[Review][Defer] Auth gate at page level for `/admin/*` pages** — Project relies on middleware. Pages don't repeat the auth check.
- [x] **[Review][Defer] Network exception in `updateRestaurantLanguages` not try/catch wrapped** — Server Actions per project rule never throw; runtime crash is out of normal flow.

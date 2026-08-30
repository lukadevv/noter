import { ingestBlob, ingestUrl, type IngestResult } from './ingest'
import { ui } from '$lib/stores/ui.svelte'
import { t } from '$lib/i18n/index.svelte'

/** Turns ingest results into markdown, reporting anything that was rejected. */
function collect(results: IngestResult[]): string[] {
  const snippets: string[] = []
  const problems: string[] = []

  for (const result of results) {
    if (result.kind === 'stored') snippets.push(result.markdown)
    else if (result.kind === 'external') {
      snippets.push(result.markdown)
      problems.push(result.reason)
    } else problems.push(result.reason)
  }

  if (problems.length > 0) {
    ui.toast(problems[0]!, 'warn')
  }
  return snippets
}

/** Stores dropped, pasted or picked image files and returns their markdown. */
export async function insertImages(
  files: File[],
  origin: 'paste' | 'file' | 'share' = 'paste',
): Promise<string[]> {
  const results: IngestResult[] = []
  for (const file of files) {
    results.push(await ingestBlob(file, origin))
  }
  const snippets = collect(results)
  if (snippets.length > 0) {
    ui.toast(
      snippets.length === 1 ? t('toast.imageSaved') : t('toast.imagesSaved', { count: snippets.length }),
      'ok',
    )
  }
  return snippets
}

/**
 * Handles a pasted URL. Returns markdown for an image, or null when the URL is
 * not an image at all and should be pasted as ordinary text.
 */
export async function insertUrl(url: string): Promise<string | null> {
  const result = await ingestUrl(url)
  if (result.kind === 'skipped') return null
  const [markdown] = collect([result])
  return markdown ?? null
}

/** Opens the system file picker and returns markdown for whatever was chosen. */
export function pickImages(): Promise<string[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.addEventListener('change', () => {
      const files = [...(input.files ?? [])]
      resolve(files.length > 0 ? insertImages(files, 'file') : Promise.resolve([]))
    })
    // Safari ignores a click on an input that is not in the document.
    input.style.display = 'none'
    document.body.append(input)
    input.click()
    setTimeout(() => input.remove(), 0)
  })
}

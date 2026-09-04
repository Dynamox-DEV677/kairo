/**
 * Which pages must not be unmounted right now.
 *
 * Pages stay mounted and hide with display:none so that navigating away and
 * back does not destroy live state. Nothing evicted them, though, so every
 * screen a student visited stayed in the DOM for the rest of the session --
 * 233,000 characters of it, growing with every tap.
 *
 * The Dashboard now keeps only the few most recent. That is safe for almost
 * everything, because a page rebuilds itself from stored rows. It is NOT safe
 * for a page holding something the student would be upset to lose, so those
 * pin themselves here for exactly as long as they are busy.
 */

/** How many recently-used pages stay in the DOM, on top of any pinned ones. */
export const KEEP_MOUNTED = 3

const busy = new Set<string>()

/**
 * Pin a page while it is mid-something. Call from an effect and use the
 * returned function as the cleanup, so an unmount can never leave it pinned:
 *
 *   useEffect(() => (running ? keepPageMounted('practice') : undefined), [running])
 */
export function keepPageMounted(id: string): () => void {
  busy.add(id)
  return () => { busy.delete(id) }
}

export function busyPages(): ReadonlySet<string> {
  return busy
}

/**
 * Cancel generation counter for agent jobs (main process).
 *
 * The cancel token (cancel-token.ts) only knows runs that called beginRun(), and killing the CLI child only helps
 * once a child exists. An agent job spends minutes before the CLI starts (naver grounding, Genspark research up to
 * 10 minutes), and a stop during that time used to be ignored: the CLI started anyway and published a "stopped"
 * article. A job takes a snapshot when it starts and asks whether a cancel arrived since then. A cancel that came
 * before the job started never touches it.
 */
let epoch = 0;

/** Called by the cancel-task handler. */
export function bumpAgentCancelEpoch(): number {
  epoch += 1;
  return epoch;
}

/** Returns a function that is true once a cancel has arrived after this call. */
export function snapshotAgentCancel(): () => boolean {
  const at = epoch;
  return () => epoch !== at;
}

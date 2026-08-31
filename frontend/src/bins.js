// Local registry of bins this browser knows about. Source of truth for the
// index list; each bin still lives in the backend for request capture.

const KEY = 'requestbin.bins';
const LEGACY_KEY = 'requestbin.binId'; // single-bin key from the first version

export function loadBins() {
  let bins = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(parsed)) bins = parsed;
  } catch {
    bins = [];
  }

  // one-time migration: fold the old single bin into the list
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy) {
    if (!bins.some((b) => b.binId === legacy)) {
      bins = [{ binId: legacy, createdAt: new Date().toISOString() }, ...bins];
    }
    localStorage.removeItem(LEGACY_KEY);
    saveBins(bins);
  }

  return bins;
}

export function saveBins(bins) {
  localStorage.setItem(KEY, JSON.stringify(bins));
}

export function addBin(bin) {
  const bins = loadBins();
  if (bins.some((b) => b.binId === bin.binId)) return bins;
  const next = [{ binId: bin.binId, createdAt: bin.createdAt }, ...bins];
  saveBins(next);
  return next;
}

export function removeBin(binId) {
  const next = loadBins().filter((b) => b.binId !== binId);
  saveBins(next);
  return next;
}

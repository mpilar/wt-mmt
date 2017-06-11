export default function clearCommand(storage, cb) {
    const FORCE_LEVEL = 1;
    storage.set({ trackingIDs: []}, { force: FORCE_LEVEL }, cb)
}
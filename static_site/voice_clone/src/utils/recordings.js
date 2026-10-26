export function recordingsComplete(email) {
  if (!email) return false;
  for (let i = 0; i < 5; i++) {
    const key = `voiceclone_${email}_${i}`;
    if (localStorage.getItem(key) !== "true") return false;
  }
  return true;
}

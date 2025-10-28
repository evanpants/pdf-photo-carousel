export function getOrCreateGuestSessionId(): string {
  const storageKey = 'guest_session_id';
  
  let guestId = localStorage.getItem(storageKey);
  
  if (!guestId) {
    guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(storageKey, guestId);
  }
  
  return guestId;
}

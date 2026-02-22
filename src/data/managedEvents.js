export const MANAGED_EVENTS_KEY = 'managedEvents';

export function getManagedEvents() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(MANAGED_EVENTS_KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function mapManagedToPublicEvent(m) {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    date: m.startDate ? new Date(m.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '',
    time: m.startTime || '',
    location: m.location || '',
    image: m.image || '/event1.jpg',
    category: m.category || 'Event',
    status: 'upcoming',
    featured: false,
    price: m.price,
    priceMember: m.priceMember,
    seatsRemaining: m.availableSeats,
    totalCapacity: m.availableSeats,
    customSections: m.customSections || [],
  };
}

export function getApprovedManagedEvents() {
  return getManagedEvents().filter((e) => e.status === 'approved').map(mapManagedToPublicEvent);
}

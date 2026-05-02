/** Build a sortable datetime from date + time strings (ms for newest-first sort). */
export function eventSortKey(startDate, startTime) {
  if (!startDate) return 0;
  const timePart = (startTime || '').trim() || '00:00';
  const combined = startDate.includes('T') ? startDate : `${startDate}T${timePart}`;
  const d = new Date(combined);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/** True if event end datetime has passed (used for Past vs Upcoming). */
export function isEventEndPast(endDate, endTime) {
  if (!endDate) return false;
  const timePart = (endTime || '').trim() || '23:59';
  const combined = endDate.includes('T') ? endDate : `${endDate}T${timePart}`;
  const end = new Date(combined);
  return !isNaN(end.getTime()) && end.getTime() < Date.now();
}

export function mapEventFromApi(e) {
  if (!e || e.id == null) return null;
  const start = e.startDate ? new Date(e.startDate) : null;
  const end = e.endDate ? new Date(e.endDate) : null;
  const dateStr = start && !isNaN(start.getTime())
    ? start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';
  const endDateStr = end && !isNaN(end.getTime())
    ? end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';
  const organizerName = (e.clubName ?? '').trim();
  const endPast = isEventEndPast(e.endDate, e.endTime);
  const displayStatus = endPast ? 'past' : 'upcoming';
  return {
    id: e.id,
    title: e.title ?? '',
    description: e.description ?? '',
    category: e.category ?? 'Event',
    date: dateStr,
    endDate: endDateStr,
    time: e.startTime ?? '',
    endTime: e.endTime ?? '',
    location: e.location ?? '',
    image: e.image ?? 'event1.jpg',
    status: displayStatus,
    featured: Boolean(e.featured),
    sortKey: eventSortKey(e.startDate, e.startTime),
    createdAt: e.createdAt ?? null,
    price: e.price,
    priceMember: e.priceMember,
    organizerName,
    collegeName: (e.collegeName ?? '').trim(),
    communityName: (e.communityName ?? '').trim(),
    organizer: organizerName,
  };
}

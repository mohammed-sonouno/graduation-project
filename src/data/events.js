export const EVENTS = [
  {
    id: 'symp-2024',
    title: 'Symposium on Global Innovation 2024',
    category: 'Symposium',
    date: 'October 12, 2024',
    time: '9:00 AM',
    location: 'Main Auditorium, Yata Building',
    description:
      'A full-day symposium bringing together scholars and industry leaders to discuss research, innovation, and the future of technology.',
    image: '/event1.jpg',
    status: 'upcoming',
    featured: true,
    price: 25,
    priceMember: 15,
  },
  {
    id: 'future-projects',
    title: 'AI in Higher Ed: Future Prospects',
    category: 'Technology',
    date: 'October 24, 2024',
    time: '10:00 AM',
    location: 'Innovation Lab, New Campus',
    description:
      'A focused session on how universities can responsibly adopt AI for teaching, learning, and administration.',
    image: '/event2.jpg',
    status: 'upcoming',
    featured: false,
  },
  {
    id: 'leadership-retreat',
    title: 'Annual Leadership Retreat 2024',
    category: 'Community',
    date: 'October 28, 2024',
    time: '2:00 PM',
    location: 'Student Affairs Center',
    description:
      'A retreat designed for student leaders to strengthen collaboration, communication, and campus impact.',
    image: '/event3.jpg',
    status: 'upcoming',
    featured: false,
  },
  {
    id: 'bio-genomics',
    title: 'Bio-Genomics Workshop',
    category: 'Science & Medicine',
    date: 'September 18, 2024',
    time: '11:00 AM',
    location: 'Science Hall, Room 204',
    description:
      'Hands-on workshop introducing modern genomic analysis methods with practical case studies and tools.',
    image: '/event4.jpg',
    status: 'past',
    featured: false,
  },
  {
    id: 'digital-transformation',
    title: 'Digital Transformation Summit',
    category: 'Research',
    date: 'August 07, 2024',
    time: '9:30 AM',
    location: 'Conference Center, Old Campus',
    description:
      'A summit exploring digital strategy, data governance, and implementation frameworks in higher education.',
    image: '/event1.jpg',
    status: 'past',
    featured: false,
  },
  {
    id: 'careers-networking',
    title: 'Alumni Networking Night',
    category: 'Career Development',
    date: 'July 20, 2024',
    time: '6:00 PM',
    location: 'Graduate Lounge',
    description:
      'Meet alumni across industries, learn about career paths, and expand your professional network.',
    image: '/event2.jpg',
    status: 'past',
    featured: false,
  },
  {
    id: 'careers-networking',
    title: 'Alumni Networking Night',
    category: 'Career Development',
    date: 'July 20, 2024',
    time: '6:00 PM',
    location: 'Graduate Lounge',
    description:
      'Meet alumni across industries, learn about career paths, and expand your professional network.',
    image: '/event2.jpg',
    status: 'past',
    featured: false,
  },
];

export const EVENT_CATEGORIES = [
  'All Categories',
  ...Array.from(new Set(EVENTS.map((e) => e.category))).sort(),
];

export const EVENT_ORGANIZERS = [
  'All Organizers',
  ...Array.from(new Set(EVENTS.map((e) => e.organizer).filter(Boolean))).sort(),
];


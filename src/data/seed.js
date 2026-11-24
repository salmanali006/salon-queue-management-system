export const seedData = {
  settings: { onlineOpen: true, closingTime: '21:00', timeZone: 'Asia/Kolkata' },
  barbers: [
    { id: 'ravi', name: 'Ravi', onDuty: true, availability: 'available' },
    { id: 'amit', name: 'Amit', onDuty: true, availability: 'available' },
    { id: 'imran', name: 'Imran', onDuty: true, availability: 'available' },
  ],
  services: [
    { id: 'haircut', name: { en: 'Haircut', gu: 'વાળ કાપવા' }, durationMinutes: 30, priceInr: 150, active: true },
    { id: 'beard-trim', name: { en: 'Beard trim', gu: 'દાઢી ટ્રિમ' }, durationMinutes: 15, priceInr: 80, active: true },
    { id: 'hair-spa', name: { en: 'Hair spa', gu: 'હેર સ્પા' }, durationMinutes: 45, priceInr: 400, active: true },
  ],
  queue: [], nextTokenNumber: 1,
};

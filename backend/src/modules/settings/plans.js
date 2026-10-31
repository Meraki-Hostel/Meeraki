// Subscription catalogue. Limits are enforced when properties, beds and staff are
// added (see assertWithinPlan). No money is charged for plans yet: changing plan
// only changes the limits. Prices are placeholders until real SaaS billing exists.
export const PLANS = [
  {
    id: "starter", tier: "starter", name: "Starter", pricePerMonth: 1999,
    propertyLimit: 2, bedLimit: 120, staffLimit: 10,
    features: ["Up to 2 properties and 120 beds", "Rooms, beds and student records", "Rent ledger and receipts", "Complaints and notices"],
  },
  {
    id: "growth", tier: "growth", name: "Growth", pricePerMonth: 4999,
    propertyLimit: 6, bedLimit: 400, staffLimit: 40,
    features: ["Up to 6 properties and 400 beds", "Everything in Starter", "Leave and visitor management", "Maintenance and inventory", "Owner analytics and exports"],
  },
  {
    id: "portfolio", tier: "portfolio", name: "Portfolio", pricePerMonth: 14999,
    propertyLimit: 25, bedLimit: 2500, staffLimit: 250,
    features: ["Up to 25 properties and 2,500 beds", "Everything in Growth", "Online rent collection", "Priority support"],
  },
];

export const planById = (id) => PLANS.find((p) => p.id === id) ?? PLANS[0];

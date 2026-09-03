// The answers the intake form actually offers.
//
// These lists are the form's own vocabulary, read back out of every submission
// we have taken. Keeping them here lets the lead page offer the same choices
// when somebody corrects an answer by hand, so an edited lead still filters and
// reports alongside the ones that came straight from the form. If the form
// gains an option, add it here too; a value we do not know about is still shown
// and kept, it just will not appear as a suggestion.

export const PROPERTY_TYPE_OPTIONS = [
  "Single Family Homes",
  "Multi-Family",
  "Townhomes",
  "Condos",
  "Communities / HOA",
  "Mixed-Use",
  "Other",
];

export const RENTAL_TYPE_OPTIONS = [
  "Conventional",
  "Affordable / Section 8",
  "Luxury",
  "Student Housing",
  "Senior Living",
  "Other",
];

export const DEBT_TYPE_OPTIONS = [
  "Residential Rental Debt",
  "Commercial Rental Debt",
  "Utility Debt",
  "Medical Debt",
  "Credit Card Debt",
  "Student Loan Debt",
  "Auto Loan Debt",
  "Other",
];

export const LISTING_SITE_OPTIONS = [
  "Zillow",
  "Apartments.com",
  "Facebook Marketplace",
  "Realtor.com",
  "Rent.com",
  "Own Website",
  "Trulia",
  "HotPads",
  "Craigslist",
  "Other",
];

export const PM_SOFTWARE_OPTIONS = [
  "None",
  "Buildium",
  "Zillow Rental Manager",
  "AppFolio",
  "TurboTenant",
  "RentRedi",
  "Yardi",
  "DoorLoop",
  "Rent Manager",
  "TenantCloud",
  "Rentec Direct",
  "Entrada",
  "PropertyWare",
  "Other",
];

export const OWNERSHIP_OPTIONS = [
  "We own them",
  "We manage for others",
  "We own and manage for others",
];

export const DEBTS_NOW_OPTIONS = [
  "Yes, we have accounts ready",
  "Not yet, but soon",
];

export const PRIOR_AGENCY_OPTIONS = ["Yes", "No"];

import type { BikeModel, Competitor } from './types';

export const BIKE_MODELS: BikeModel[] = [
  { id: 'kaveri100', name: 'Kaveri 100', category: 'commuter', price: 62000, maxSpeed: 24, accel: 5.0, brake: 9, handling: 1.0, grip: 1.0, tank: 9, kmpl: 2.4, color: '#d62828' },
  { id: 'star125', name: 'Meenakshi Star 125', category: 'commuter', price: 82000, maxSpeed: 27, accel: 5.6, brake: 9.5, handling: 1.05, grip: 1.02, tank: 10, kmpl: 2.2, color: '#1d70b8' },
  { id: 'street150', name: 'Chennai Street 150', category: 'street', price: 125000, maxSpeed: 31, accel: 7.0, brake: 10.5, handling: 1.15, grip: 1.1, tank: 11, kmpl: 2.0, color: '#2a9d8f' },
  { id: 'rapier200', name: 'Rapier RS 200', category: 'sports', price: 190000, maxSpeed: 38, accel: 9.5, brake: 12, handling: 1.2, grip: 1.2, tank: 12, kmpl: 1.6, color: '#f77f00' },
  { id: 'raja350', name: 'Raja Classic 350', category: 'cruiser', price: 220000, maxSpeed: 32, accel: 6.2, brake: 10, handling: 0.85, grip: 1.05, tank: 13, kmpl: 1.9, color: '#6b705c' },
  { id: 'nomad400', name: 'Nomad Adventure 400', category: 'adventure', price: 260000, maxSpeed: 34, accel: 7.2, brake: 10.5, handling: 1.0, grip: 1.15, tank: 15, kmpl: 1.8, color: '#bc6c25' },
  { id: 'thunder650', name: 'Thunder 650 Prime', category: 'premium', price: 550000, maxSpeed: 44, accel: 11, brake: 14, handling: 1.1, grip: 1.25, tank: 15, kmpl: 1.4, color: '#111827' },
];
export const modelOf = (id: string) => BIKE_MODELS.find((m) => m.id === id) ?? BIKE_MODELS[0];
export const COMPANY_MODEL_MAX_PRICE = 130000;

export const UPGRADE_COST: Record<'engine' | 'brake' | 'suspension' | 'tyre', number[]> = {
  engine: [8000, 14000, 22000], brake: [4000, 7000, 11000], suspension: [5000, 9000, 14000], tyre: [3000, 5000, 8000],
};
export const PAINTS = ['#d62828', '#1d70b8', '#2a9d8f', '#f77f00', '#6b705c', '#111827', '#f4f1de', '#7b2cbf', '#facc15'];

export interface FoodItem { id: string; name: string; price: number; hunger: number; thirst: number; energy: number; where: ('restaurant' | 'shop')[]; tier?: number }
export const FOOD: FoodItem[] = [
  { id: 'water', name: 'Water bottle', price: 20, hunger: 0, thirst: 50, energy: 0, where: ['shop', 'restaurant'] },
  { id: 'juice', name: 'Fresh lime soda', price: 35, hunger: 3, thirst: 40, energy: 4, where: ['shop', 'restaurant'] },
  { id: 'tea', name: 'Filter coffee / chai', price: 15, hunger: 3, thirst: 12, energy: 10, where: ['restaurant', 'shop'] },
  { id: 'snack', name: 'Biscuits & banana', price: 30, hunger: 18, thirst: 0, energy: 3, where: ['shop'] },
  { id: 'breakfast', name: 'Idli-vada breakfast', price: 50, hunger: 38, thirst: 8, energy: 4, where: ['restaurant'] },
  { id: 'lunch', name: 'Full meals (thali)', price: 90, hunger: 58, thirst: 10, energy: 5, where: ['restaurant'] },
  { id: 'dinner', name: 'Parotta & kurma dinner', price: 100, hunger: 58, thirst: 8, energy: 5, where: ['restaurant'] },
  { id: 'biryani', name: 'Chicken biryani', price: 190, hunger: 78, thirst: 6, energy: 8, where: ['restaurant'] },
  { id: 'feast', name: 'Chef\'s special platter', price: 380, hunger: 95, thirst: 15, energy: 12, where: ['restaurant'] },
];

export const HOMES = [
  { tier: 0, name: 'Rented room (Mariamman Lodge)', buy: 0, rentWeekly: 700, comfort: 1 },
  { tier: 1, name: '1BHK Rented Apartment', buy: 0, rentWeekly: 2400, comfort: 1.25, deposit: 15000 },
  { tier: 2, name: 'Lotus Apartments — 2BHK (own)', buy: 650000, rentWeekly: 0, comfort: 1.5 },
  { tier: 3, name: 'Villa with garden (own)', buy: 2800000, rentWeekly: 0, comfort: 2 },
];

export const COMPETITORS: Competitor[] = [
  { id: 'c1', name: 'ZipPillion', color: '#f43f5e', reputation: 68, riders: 40, districts: ['central', 'it', 'commercial'], price: 1 },
  { id: 'c2', name: 'Namma Wheels', color: '#22c55e', reputation: 62, riders: 34, districts: ['residential', 'industrial', 'central'], price: 0.97 },
  { id: 'c3', name: 'SwiftRaja Rides', color: '#3b82f6', reputation: 58, riders: 28, districts: ['coastal', 'airport', 'commercial'], price: 1.02 },
];

export const REGISTRATION_COSTS = [
  { id: 'reg', label: 'Company registration & GST/MSME filing', amount: 8000 },
  { id: 'brand', label: 'Branding: logo, signage & vinyl kit', amount: 3500 },
  { id: 'uniform', label: 'Uniform batch (5 T-shirts + caps)', amount: 3000 },
  { id: 'hq', label: 'Headquarters office (deposit + first month rent)', amount: 20000 },
  { id: 'app', label: 'Company app development (customer / employee / admin)', amount: 22000 },
  { id: 'admin', label: 'Admin system setup & licences', amount: 2500 },
];
export const REGISTRATION_TOTAL = REGISTRATION_COSTS.reduce((a, c) => a + c.amount, 0);
export const SAVINGS_TARGET = 100000;
export const SECURITY_DEPOSIT = 5000;

export const ROLE_INFO: Record<string, { label: string; salary: number; qual: string; duty: string }> = {
  rider: { label: 'Bike Taxi Rider', salary: 0, qual: 'Valid two-wheeler licence', duty: 'Carry passengers, 70% commission' },
  mechanic: { label: 'Mechanic', salary: 14000, qual: 'ITI / 2+ yrs garage work', duty: 'Services bikes, cuts service costs 20%' },
  receptionist: { label: 'Receptionist', salary: 11000, qual: '12th pass, communication', duty: 'Front desk; +5% demand' },
  accountant: { label: 'Accountant', salary: 18000, qual: 'B.Com', duty: 'Reduces tax & filing costs 25%' },
  support: { label: 'Customer Support Executive', salary: 12000, qual: 'Graduate', duty: 'Auto-resolves complaints' },
  hr: { label: 'HR Manager', salary: 22000, qual: 'MBA (HR)', duty: 'More applicants, fraud screening' },
  manager: { label: 'Branch Manager', salary: 30000, qual: '5+ yrs operations', duty: 'Runs a branch autonomously' },
};

export const FIRST_NAMES = ['Arun', 'Karthik', 'Suresh', 'Vijay', 'Ramesh', 'Manoj', 'Dinesh', 'Prakash', 'Senthil', 'Ganesh', 'Imran', 'Faisal', 'Anand', 'Raju', 'Mohan', 'Naveen', 'Praveen', 'Siva', 'Bala', 'Hari', 'Priya', 'Lakshmi', 'Divya', 'Meena', 'Anitha', 'Kavitha', 'Revathi', 'Deepa', 'Shanthi', 'Nithya', 'Rahul', 'Vikram', 'Ajay', 'Sanjay'];
export const LAST_NAMES = ['Kumar', 'Raj', 'Nair', 'Reddy', 'Iyer', 'Pillai', 'Murthy', 'Sharma', 'Babu', 'Rao', 'Khan', 'Naidu', 'Das', 'Gowda', 'Selvam', 'Mani', 'Prasad', 'Devi', 'Krishnan', 'Subramani'];

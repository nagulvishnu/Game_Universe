// Shared domain types for RIDE TO RICHES — THE BIKE TAXI LIFE
export type Weather = 'sunny' | 'cloudy' | 'lightRain' | 'heavyRain' | 'thunderstorm' | 'fog';
export type DistrictId = 'central' | 'residential' | 'it' | 'commercial' | 'coastal' | 'industrial' | 'airport';
export type RideCategory =
  | 'commuter' | 'student' | 'railway' | 'bus' | 'airport' | 'shopping' | 'restaurant'
  | 'tourist' | 'urgent' | 'night' | 'long' | 'premium';

export type PoiKind =
  | 'home' | 'hq' | 'branch' | 'garage' | 'restaurant' | 'shop' | 'bank' | 'regoffice' | 'hospital'
  | 'dealership' | 'petrol' | 'police' | 'railway' | 'bus' | 'airport' | 'mall' | 'itpark' | 'school'
  | 'hotel' | 'beach' | 'factory' | 'park' | 'office' | 'apartments' | 'market';

export interface Poi {
  id: string;
  name: string;
  kind: PoiKind;
  district: DistrictId;
  x: number; // door / pickup point (curb)
  z: number;
  enterable: boolean;
}

// ---------------- FARE ----------------
export interface FareRules {
  readonly version: number;
  readonly baseFare: number;
  readonly perKm: number;
  readonly perMinute: number;
  readonly minFare: number;
  readonly freeWaitMin: number;
  readonly waitPerMin: number;
  readonly maxPaidWaitMin: number;
  readonly maxDemandPct: number; // maximum surge as fraction of core fare
  readonly maxDiscountPct: number;
  readonly maxTotalUpliftPct: number; // demand + percentage surcharges cap
  readonly weatherPct: Readonly<Record<Weather, number>>;
  readonly nightPct: Readonly<{ evening: number; lateNight: number }>;
  readonly hubFee: number;
  readonly estimateProtectionPct: number;
  readonly cancel: Readonly<{ freeGraceMin: number; enrouteFee: number; arrivedFee: number }>;
  readonly employeeShare: number;
  readonly companyShare: number;
  readonly distanceScale: number; // fare-km per world-km (compressed map)
  readonly avgSpeedKmh: number;
}

export interface FareLine { code: string; label: string; amount: number }

export interface FareBreakdown {
  rulesVersion: number;
  distanceKm: number;
  durationMin: number;
  perKm: number;
  perMin: number;
  base: number;
  distance: number;
  time: number;
  demand: number;
  demandPct: number;
  surcharges: FareLine[];
  waiting: number;
  waitMinutes: number;
  minimumAdjustment: number;
  protectionAdjustment: number;
  total: number;
  capped: boolean;
  notes: string[];
}

export interface PricingContext {
  demandPct: number;
  weather: Weather;
  hour: number;
  hubFee: boolean;
  label: string; // human readable demand reason
  district: DistrictId;
  ratio: number;
}

export interface RouteInfo {
  meters: number; // world metres along the road network
  fareKm: number;
  durationMin: number;
  pts: [number, number][];
}

export type PaymentKind = 'charge' | 'refund' | 'cancelFee' | 'adjustment' | 'earning' | 'commission';
export interface PaymentRecord {
  id: string; rideId: string; kind: PaymentKind; amount: number; account: 'wallet' | 'company' | 'employee'; at: number; note: string;
}

export type RideStatus = 'requested' | 'assigned' | 'enroute' | 'arrived' | 'inprogress' | 'completed' | 'cancelled' | 'expired';
export type RideSource = 'personal' | 'company' | 'customerApp';
export interface Place { poiId: string; label: string; x: number; z: number; district: DistrictId }
export interface Passenger { name: string; personality: 'calm' | 'chatty' | 'rushed' | 'demanding' | 'friendly'; shirt: string; skin: string; kind: string }

export interface RideRecord {
  id: string;
  source: RideSource;
  driverType: 'player' | 'employee';
  driverId?: string;
  bikeId?: string;
  branchId?: string;
  passenger: Passenger;
  category: RideCategory;
  pickup: Place;
  dest: Place;
  routeMeters: number;
  pickupMeters: number;
  estimate: FareBreakdown;
  pricing: PricingContext;
  final?: FareBreakdown;
  status: RideStatus;
  requestedAt: number;
  assignedAt?: number;
  arrivedAt?: number;
  startedAt?: number;
  completedAt?: number;
  rating?: number;
  review?: string;
  complaint?: string;
  split?: { driver: number; company: number };
  cancelFee?: number;
  cancelledBy?: 'customer' | 'driver' | 'system';
  explanation?: string;
  payment: 'cash' | 'upi';
  prepaid?: number; // amount held from customer's wallet (customer app)
  eta?: { pickupEnd: number; waitEnd: number; rideEnd: number }; // employee rides (game minutes)
  routePts?: [number, number][];
  pickupPts?: [number, number][];
  payments: PaymentRecord[];
  urgent?: boolean;
  customerDelayMin?: number; // customer-caused delay at pickup (game minutes)
  telemetry?: { distanceM: number; elapsedSec: number; collisions: number; hardEvents: number; speedingSec: number };
  refunded?: number;
}

// ---------------- ENTITIES ----------------
export interface BikeModel {
  id: string; name: string; category: 'commuter' | 'street' | 'sports' | 'cruiser' | 'adventure' | 'premium';
  price: number; maxSpeed: number; accel: number; brake: number; handling: number; grip: number; tank: number; kmpl: number; color: string;
}
export interface ServiceEntry { day: number; kind: string; cost: number }
export interface Insurance { plan: 'none' | 'basic' | 'comprehensive'; expiresDay: number }
export interface Bike {
  id: string; owner: 'player' | 'company'; modelId: string; plate: string;
  x: number; z: number; heading: number;
  fuel: number; // 0..1
  damage: number; // 0..100 body damage
  oil: number; tyres: number; brakes: number; // 0..100 part life
  color: string; decal: number;
  upgrades: { engine: number; brake: number; suspension: number; tyre: number };
  odometerKm: number;
  serviceHistory: ServiceEntry[];
  assignedEmployeeId?: string;
  branchId?: string;
  insurance: Insurance;
  registrationExpiryDay: number;
  status: 'parked' | 'repair' | 'seized';
  repairUntil?: number;
  baselineWear?: number;
}

export type StaffRole = 'rider' | 'mechanic' | 'receptionist' | 'accountant' | 'support' | 'hr' | 'manager';
export type LicenceState = 'valid' | 'expired' | 'none' | 'forged';
export interface Licence { number: string; expiryDay: number; state: LicenceState }
export type ShiftType = 'morning' | 'evening' | 'flex';

export interface Applicant {
  id: string; name: string; age: number; role: StaffRole; qualification: string;
  licence: Licence | null; experience: number;
  skill: number; service: number; safety: number; reliability: number; accidents: number;
  availability: ShiftType; expectedSalary: number; // monthly for staff roles; 0 for commission riders
  status: 'pending' | 'interview' | 'approved' | 'rejected';
  interviewed: boolean; licenceVerified: boolean; appliedDay: number; verifiedResult?: string;
}

export interface LeaveRequest { id: string; fromDay: number; toDay: number; reason: string; status: 'pending' | 'approved' | 'rejected' }
export interface Employee {
  id: string; name: string; age: number; role: StaffRole; licence: Licence | null; experience: number;
  skill: number; service: number; safety: number; reliability: number; accidents: number;
  rating: number; ratingCount: number; branchId: string; shift: ShiftType;
  bikeId?: string; uniform: boolean; username: string; password: string;
  status: 'active' | 'suspended' | 'licenceExpired' | 'resigned' | 'terminated';
  suspendedUntilDay?: number;
  online: boolean; fatigue: number;
  state: 'offline' | 'idle' | 'busy' | 'noBike';
  posX: number; posZ: number;
  rideId?: string;
  deposit: number; salary: number; joinedDay: number;
  wallet: number; totalEarned: number; ridesDone: number;
  earnings: { day: number; amount: number; rideId: string }[];
  attendance: { day: number; present: boolean }[];
  leave: LeaveRequest[];
  notifications: string[];
  violations: number; complaints: number; absentToday?: boolean;
  bikeReports: { day: number; text: string }[];
  history: { day: number; text: string }[];
}

export interface Branch {
  id: string; district: DistrictId; name: string; poiId: string;
  status: 'needsManager' | 'open'; openedDay: number; managerId?: string;
  revenue: number; expenses: number; rides: number; rentMonthly: number;
}

export interface ScheduleRow { n: number; dueDay: number; emi: number; principalPart: number; interestPart: number; status: 'pending' | 'paid' | 'overdue'; paidDay?: number; lateFee: number }
export interface Loan {
  id: string; principal: number; ratePct: number; months: number; emi: number; outstanding: number; takenDay: number;
  nextDueDay: number; paidCount: number; schedule: ScheduleRow[]; status: 'active' | 'closed' | 'defaulted';
  overdueCount: number; lateFees: number; totalInterestPaid: number;
}

export type LedgerKind = 'income' | 'expense' | 'liability' | 'financing' | 'capital' | 'transfer';
export interface LedgerEntry {
  id: number; time: number; account: 'wallet' | 'savings' | 'company';
  kind: LedgerKind; category: string; label: string; amount: number; branchId?: string; balanceAfter: number;
}

export interface Complaint { id: string; day: number; rideId?: string; employeeId?: string; text: string; resolved: boolean }
export interface Competitor { id: string; name: string; color: string; reputation: number; riders: number; districts: DistrictId[]; price: number }

export interface Branding {
  name: string; tagline: string; primary: string; secondary: string;
  logoShape: 'circle' | 'shield' | 'hex' | 'square'; logoIcon: string; uniformStyle: 'plain' | 'stripe' | 'chest'; shirt: string;
}

export interface Needs { energy: number; hunger: number; thirst: number; health: number }

export interface Company {
  branding: Branding; registeredDay: number; bank: number; reputation: number; credit: number;
  ratingSum: number; ratingCount: number;
  loans: Loan[]; employees: Employee[]; applicants: Applicant[]; bikes: Bike[]; branches: Branch[];
  complaints: Complaint[]; nextBillingDay: number; ownerDraws: number; appBuilt: boolean;
  fuelPolicy: 'company' ; accidentsTotal: number; violationsTotal: number; ridesTotal: number; revenueTotal: number;
  uniformsStock: number; seizedBikes: number; lastApplicantDay: number; insuranceClaimsPaid: number;
}

export interface PersonalRide { id: string; day: number; fare: number; category: RideCategory; rating: number; from: string; to: string }

export interface GameState {
  version: number;
  rng: number;
  time: number; // game minutes since 00:00 day 0
  weather: Weather; weatherUntil: number;
  wallet: number; savings: number;
  needs: Needs;
  player: {
    x: number; z: number; heading: number; interior: string | null; onBike: boolean; bikeId: string | null;
    homeTier: number; rentPaidUntilDay: number; rentOverdue: number; finesDue: number; wearUniform: boolean;
    ridesDone: number; ratingSum: number; ratingCount: number; licenceExpiryDay: number; ownedHomes: string[];
    online: boolean; faint: number;
  };
  bikes: Bike[];
  company: Company | null;
  rides: RideRecord[]; // recent history (capped)
  activeRideId: string | null; // player's personal active ride
  offer: RideRecord | null; // pending personal offer
  myBooking: string | null; // customer-app booking by the player
  personalRides: PersonalRide[];
  ledger: LedgerEntry[]; ledgerSeq: number;
  notifications: { id: number; time: number; text: string; type: 'info' | 'good' | 'bad' | 'warn' }[];
  notifSeq: number;
  competitors: Competitor[];
  stats: Record<string, number>;
  settings: { timeScale: number; volume: number; shadows: boolean; quality: 'low' | 'medium' | 'high'; invertCam: boolean };
  unlocks: string[];
  lastSavedReal: number;
  offlineReport: OfflineReport | null;
  companyIncomeDay: Record<string, number>;
}

export interface OfflineReport {
  elapsedRealMin: number; simulatedGameMin: number; rides: number; revenue: number; expenses: number; emiPaid: number; events: string[]; capped: boolean;
}

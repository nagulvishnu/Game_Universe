import type { PoiKind } from '../game/types';

export interface Hotspot { id: string; label: string; x: number; z: number; action: string; arg?: string }
export interface Prop { x: number; y: number; z: number; w: number; h: number; d: number; color: string; emissive?: string }
export interface InteriorDef { hw: number; hd: number; floor: string; wall: string; hotspots: Hotspot[]; props: Prop[]; title: string }
export interface InteriorNpc { x: number; z: number; heading: number; shirt: string; pose: 'stand' | 'sit' }

const desk = (x: number, z: number, c = '#8b5e3c'): Prop[] => [{ x, y: 0.4, z, w: 2.2, h: 0.8, d: 1, color: c }];
const shelf = (x: number, z: number, w = 3): Prop => ({ x, y: 1.1, z, w, h: 2.2, d: 0.5, color: '#6b4f3a' });
const hall = (title: string, floor: string, wall: string, counter: string, width = 8): InteriorDef => ({
  hw: width, hd: 6, title, floor, wall, hotspots: [],
  props: [
    { x: 0, y: 0.5, z: -4.7, w: width * 1.35, h: 1, d: 1.1, color: counter },
    { x: -width + 1.2, y: 0.35, z: 1.8, w: 2.2, h: 0.7, d: 1.4, color: '#64748b' },
    { x: width - 1.2, y: 0.35, z: 1.8, w: 2.2, h: 0.7, d: 1.4, color: '#64748b' },
    { x: 0, y: 1.8, z: -5.35, w: 5.2, h: 1.2, d: 0.1, color: '#fde68a', emissive: '#fbbf24' },
  ],
});

export function interiorFor(kind: PoiKind, tier = 0): InteriorDef {
  const base = { hw: 7, hd: 5 };
  switch (kind) {
    case 'home': {
      const rich = tier >= 2;
      return {
        ...base, title: tier === 0 ? 'Your rented room' : tier === 1 ? 'Your apartment' : tier === 2 ? 'Your 2BHK' : 'Your villa', floor: rich ? '#c8b08a' : '#a89c8c', wall: rich ? '#f3e9d8' : '#d9d2c3',
        hotspots: [
          { id: 'bed', label: 'Sleep in bed', x: -4.6, z: -2.5, action: 'sleep' },
          { id: 'wardrobe', label: 'Wardrobe', x: 5.6, z: -3.9, action: 'wardrobe' },
          { id: 'table', label: 'Table — wallet & savings', x: 1.5, z: -2.2, action: 'savings' },
          { id: 'bath', label: 'Bathroom — freshen up', x: 5.8, z: 1, action: 'shower' },
          { id: 'window', label: 'Window — view of the city', x: -1.5, z: -4.4, action: 'window' },
        ],
        props: [
          { x: -4.6, y: 0.3, z: -3, w: 2.2, h: 0.6, d: 3.2, color: '#c0392b' }, { x: -4.6, y: 0.65, z: -3.9, w: 2, h: 0.2, d: 0.8, color: '#f5f5f5' },
          { x: 5.6, y: 1.2, z: -4.4, w: 2, h: 2.4, d: 0.8, color: '#7b5a3a' }, ...desk(1.5, -3.2), { x: 0.5, y: 0.25, z: -2.3, w: 0.6, h: 0.5, d: 0.6, color: '#6d4c41' },
          { x: 6.2, y: 0.5, z: 1.2, w: 1.2, h: 1, d: 2, color: '#e0f2fe' }, { x: -1.5, y: 1.7, z: -4.95, w: 2.4, h: 1.5, d: 0.1, color: '#9bd1ff', emissive: '#7ec8ff' },
          ...(rich ? [{ x: -1, y: 0.35, z: 2.2, w: 3.2, h: 0.7, d: 1.2, color: '#475569' }, { x: 3.5, y: 0.7, z: 3.5, w: 0.4, h: 1.4, d: 0.4, color: '#16a34a' }] : []),
        ],
      };
    }
    case 'hq':
      return {
        ...base, hw: 9, hd: 6, title: 'Company Headquarters', floor: '#9aa3ad', wall: '#e5e7eb',
        hotspots: [
          { id: 'admin', label: 'Owner desk — Admin portal', x: -5, z: -3.6, action: 'admin' },
          { id: 'recruit', label: 'HR desk — Recruitment', x: 0, z: -4.6, action: 'admin', arg: 'recruit' },
          { id: 'fleet', label: 'Garage bay — Inspect fleet', x: 6.5, z: -1.5, action: 'admin', arg: 'fleet' },
          { id: 'staff', label: 'Staff terminal — Employee portal', x: 6.5, z: 2.5, action: 'employee' },
          { id: 'kiosk', label: 'Reception kiosk — Customer portal', x: -6.5, z: 2.5, action: 'customer' },
          { id: 'brand', label: 'Brand wall — company identity', x: 3, z: -4.6, action: 'brandwall' },
        ],
        props: [...desk(-5, -4.5, '#334155'), ...desk(0, -5.3, '#334155'), { x: 7.5, y: 0.3, z: -1.5, w: 2.4, h: 0.6, d: 3.6, color: '#f59e0b' }, ...desk(7.5, 2.5, '#475569'), ...desk(-7.5, 2.5, '#475569'),
          { x: 3, y: 1.8, z: -5.8, w: 3.6, h: 2.4, d: 0.1, color: '#0ea5e9', emissive: '#0ea5e9' }, { x: -2.5, y: 0.3, z: 2, w: 3, h: 0.6, d: 1, color: '#64748b' }],
      };
    case 'branch':
      return {
        ...base, title: 'Branch office', floor: '#9aa3ad', wall: '#e5e7eb',
        hotspots: [
          { id: 'admin', label: 'Manager desk — Branch admin', x: -4, z: -3.4, action: 'admin', arg: 'branches' },
          { id: 'fleet', label: 'Garage bay — Inspect fleet', x: 5.5, z: -2, action: 'admin', arg: 'fleet' },
          { id: 'staff', label: 'Staff terminal', x: 5.5, z: 2.5, action: 'employee' },
        ],
        props: [...desk(-4, -4.3, '#334155'), { x: 6.5, y: 0.3, z: -2, w: 2.2, h: 0.6, d: 3.2, color: '#f59e0b' }, ...desk(6.5, 2.5, '#475569')],
      };
    case 'garage':
      return {
        ...base, title: 'Garage', floor: '#6b7280', wall: '#cbd5e1',
        hotspots: [
          { id: 'counter', label: 'Mechanic — service & upgrades', x: -3, z: -3.2, action: 'garage' },
          { id: 'fleet', label: 'Company fleet inspection', x: 4, z: -3, action: 'admin', arg: 'fleet' },
        ],
        props: [...desk(-3, -4, '#374151'), { x: 4, y: 0.3, z: -3.8, w: 3, h: 0.6, d: 1.5, color: '#b45309' }, { x: 0, y: 0.5, z: 0.5, w: 2.4, h: 0.15, d: 4, color: '#facc15' }, shelf(-6.4, 0, 4)],
      };
    case 'restaurant':
      return {
        ...base, title: 'Restaurant', floor: '#b88a5b', wall: '#f1d9a8',
        hotspots: [
          { id: 'counter', label: 'Order food & drinks', x: 0, z: -3.2, action: 'menu' },
          { id: 'dine', label: 'Sit down & order a meal', x: -4, z: 2.2, action: 'dine' },
        ],
        props: [
          { x: 0, y: 0.5, z: -4, w: 6, h: 1, d: 1.2, color: '#7c2d12' },
          { x: -4, y: 0.4, z: 1, w: 1.4, h: 0.8, d: 1.4, color: '#a16207' },
          { x: 0, y: 0.4, z: 1.5, w: 1.4, h: 0.8, d: 1.4, color: '#a16207' },
          { x: 4, y: 0.4, z: 1, w: 1.4, h: 0.8, d: 1.4, color: '#a16207' },
          { x: -4, y: 0.2, z: 2.15, w: 0.65, h: 0.4, d: 0.65, color: '#78350f' },
          { x: 0, y: 0.2, z: 2.65, w: 0.65, h: 0.4, d: 0.65, color: '#78350f' },
          { x: 4, y: 0.2, z: 2.15, w: 0.65, h: 0.4, d: 0.65, color: '#78350f' },
          { x: 0, y: 1.8, z: -4.9, w: 5, h: 1.2, d: 0.1, color: '#fde68a', emissive: '#fbbf24' },
        ],
      };
    case 'shop':
      return {
        ...base, title: 'Store', floor: '#9ca3af', wall: '#fef3c7',
        hotspots: [{ id: 'counter', label: 'Buy snacks, water & essentials', x: 3, z: -3, action: 'shop' }],
        props: [{ x: 3, y: 0.5, z: -3.8, w: 4, h: 1, d: 1.2, color: '#0f766e' }, shelf(-4, -4.4, 5), shelf(-4, -1, 5), shelf(-4, 2, 5)],
      };
    case 'bank':
      return {
        ...base, title: 'Bharat Union Bank', floor: '#d6d3d1', wall: '#e0e7ff',
        hotspots: [{ id: 'counter', label: 'Loan officer — business loans', x: 0, z: -3, action: 'bank' }],
        props: [{ x: 0, y: 0.55, z: -3.9, w: 7, h: 1.1, d: 1.2, color: '#1e3a8a' }, { x: -5, y: 0.3, z: 1, w: 2, h: 0.6, d: 0.8, color: '#64748b' }, { x: 5, y: 0.3, z: 1, w: 2, h: 0.6, d: 0.8, color: '#64748b' }],
      };
    case 'regoffice':
      return {
        ...base, title: 'City Registrar & Business Centre', floor: '#a8a29e', wall: '#ede9fe',
        hotspots: [{ id: 'desk', label: 'Registrar — company registration', x: 0, z: -3, action: 'register' }],
        props: [{ x: 0, y: 0.5, z: -3.9, w: 6, h: 1, d: 1.2, color: '#5b21b6' }, { x: -5, y: 0.3, z: 1, w: 2, h: 0.6, d: 1, color: '#64748b' }],
      };
    case 'hospital':
      return {
        ...base, title: 'Hospital', floor: '#e5e7eb', wall: '#f8fafc',
        hotspots: [{ id: 'desk', label: 'Doctor — medical treatment', x: 0, z: -3, action: 'medical' }],
        props: [{ x: 0, y: 0.5, z: -3.9, w: 5, h: 1, d: 1.2, color: '#0e7490' }, { x: -5, y: 0.35, z: 0, w: 1.2, h: 0.7, d: 2.4, color: '#f8fafc' }, { x: 5, y: 0.35, z: 0, w: 1.2, h: 0.7, d: 2.4, color: '#f8fafc' }],
      };
    case 'dealership':
      return {
        ...base, hw: 9, title: 'RoyalWheels Showroom', floor: '#d1d5db', wall: '#e2e8f0',
        hotspots: [{ id: 'desk', label: 'Sales desk — buy, sell & upgrade bikes', x: -5.5, z: -3, action: 'dealer' }],
        props: [...desk(-5.5, -4, '#4338ca'), { x: 2, y: 0.15, z: -1, w: 5, h: 0.3, d: 3.5, color: '#fbbf24' }, { x: 2, y: 0.7, z: -1, w: 0.5, h: 0.8, d: 1.6, color: '#ef4444' }],
      };
    case 'police':
      return {
        ...base, title: 'Police Station', floor: '#9ca3af', wall: '#dbeafe',
        hotspots: [{ id: 'desk', label: 'Duty officer — pay fines', x: 0, z: -3, action: 'police' }],
        props: [{ x: 0, y: 0.5, z: -3.9, w: 5, h: 1, d: 1.2, color: '#1e3a8a' }, { x: -5, y: 0.5, z: 0, w: 1.4, h: 1, d: 3, color: '#475569' }],
      };
    case 'hotel':
      return {
        ...base, hw: 9, title: 'Hotel', floor: '#c8a96e', wall: '#fdf6e3',
        hotspots: [
          { id: 'restaurant', label: 'Hotel restaurant — order food & drinks', x: 0, z: -3.5, action: 'menu' },
          { id: 'dine', label: 'Sit down & order a meal', x: 5, z: 2.2, action: 'dine' },
          { id: 'rest', label: 'Rest in lobby — restore energy', x: -6, z: 1.5, action: 'shower' },
        ],
        props: [
          { x: 0, y: 0.5, z: -4.4, w: 8, h: 1, d: 1.2, color: '#92400e' },
          { x: 0, y: 1.8, z: -4.9, w: 7, h: 1.2, d: 0.1, color: '#fde68a', emissive: '#fbbf24' },
          { x: -5.5, y: 0.4, z: 1.5, w: 2.4, h: 0.8, d: 1.4, color: '#78350f' },
          { x: -6.5, y: 0.35, z: 3.5, w: 1.2, h: 0.7, d: 2.4, color: '#d97706' },
          { x: 5, y: 0.4, z: 1, w: 1.4, h: 0.8, d: 1.4, color: '#78350f' },
          { x: 7, y: 0.4, z: 1, w: 1.4, h: 0.8, d: 1.4, color: '#78350f' },
          { x: 6, y: 0.4, z: 3, w: 1.4, h: 0.8, d: 1.4, color: '#78350f' },
        ],
      };
    case 'petrol': {
      const def = hall('Fuel station shop', '#77746a', '#d6d3d1', '#c2410c', 7);
      def.hotspots = [{ id: 'shop', label: 'Buy snacks & water', x: 0, z: -3, action: 'shop' }];
      def.props.push(shelf(-5, 0, 3), shelf(5, 0, 3));
      return def;
    }
    case 'railway': return hall('Railway station', '#9ca3af', '#dbeafe', '#1d4ed8', 9);
    case 'bus': return hall('Bus terminal', '#9ca3af', '#dbeafe', '#0369a1', 9);
    case 'airport': return hall('Airport terminal', '#cbd5e1', '#e0f2fe', '#0e7490', 10);
    case 'mall': {
      const def = hall('Shopping mall', '#d6d3d1', '#fdf2f8', '#be185d', 9);
      def.hotspots = [{ id: 'foodcourt', label: 'Food court — buy food & drinks', x: 0, z: -3, action: 'menu' }];
      def.props.push(shelf(-6.5, 0, 3), shelf(6.5, 0, 3));
      return def;
    }
    case 'market': {
      const def = hall('Local market', '#b88a5b', '#fef3c7', '#b45309', 9);
      def.hotspots = [{ id: 'stall', label: 'Market stall — buy snacks & water', x: 0, z: -3, action: 'shop' }];
      def.props.push(shelf(-6.5, 0, 3), shelf(6.5, 0, 3));
      return def;
    }
    case 'itpark': return hall('Technology campus', '#cbd5e1', '#e0f2fe', '#1e40af', 9);
    case 'school': return hall('School classroom', '#c8b08a', '#fef3c7', '#0f766e', 8);
    case 'factory': return hall('Factory floor', '#6b7280', '#d1d5db', '#475569', 9);
    case 'office': return hall('Business office', '#9ca3af', '#e5e7eb', '#334155', 8);
    case 'apartments': return hall('Apartment lobby', '#c8b08a', '#f3e9d8', '#78350f', 8);
    case 'park': return hall('Park visitor pavilion', '#8a9b70', '#e7edda', '#166534', 7);
    case 'beach': return hall('Beach visitor pavilion', '#d8bd8b', '#fff1d6', '#0369a1', 8);
    default:
      return { ...base, title: 'Building', floor: '#9ca3af', wall: '#e5e7eb', hotspots: [], props: [] };
  }
}

export function interiorPeopleFor(kind: PoiKind): InteriorNpc[] {
  const seated = (x: number, z: number, shirt: string): InteriorNpc => ({ x, z, heading: Math.PI, shirt, pose: 'sit' });
  const standing = (x: number, z: number, shirt: string): InteriorNpc => ({ x, z, heading: 0, shirt, pose: 'stand' });
  switch (kind) {
    case 'home': return [];
    case 'restaurant':
      return [seated(-4, 2.15, '#2563eb'), seated(0, 2.65, '#a16207'), standing(2.5, -3.5, '#7c2d12')];
    case 'hotel':
      return [seated(5, 2.15, '#2563eb'), seated(7, 2.15, '#a16207'), standing(2.5, -3.5, '#7c2d12')];
    case 'mall':
      return [seated(-6.5, 2.6, '#2563eb'), seated(6.5, 2.6, '#a16207'), standing(2.5, -3.5, '#7c2d12')];
    case 'garage': return [standing(1.5, -2.6, '#ea580c')];
    case 'school': return [seated(-3, 0.6, '#2563eb'), seated(0, 0.6, '#16a34a'), standing(3, -3.4, '#7c2d12')];
    case 'hospital': return [standing(-3.2, -2.2, '#0e7490'), seated(3.2, 1.5, '#f8fafc')];
    case 'police': return [standing(1.5, -2.2, '#1e3a8a')];
    case 'branch':
    case 'hq':
    case 'bank':
    case 'regoffice':
    case 'office':
    case 'itpark':
      return [standing(1.5, -2.3, '#1e3a8a'), seated(4, 1.5, '#64748b')];
    case 'dealership': return [standing(-3.5, -2.2, '#4338ca')];
    default: return [seated(-3, 1.5, '#0f766e'), standing(3.5, -2.4, '#475569')];
  }
}

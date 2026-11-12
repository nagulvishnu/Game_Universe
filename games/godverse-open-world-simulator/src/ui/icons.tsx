import {
  Flame, Zap, Snowflake, Waves, Tornado, Mountain, Wind, CloudLightning, Aperture, Orbit, Rocket, Sun, Globe, Radiation, Pause, Rewind,
  FastForward, Navigation, CircleDot, Atom, Shapes, Dumbbell, Gauge, Feather, Hand, ArrowUpFromLine, Shield, Magnet, Maximize, Building2,
  Car, Users, PawPrint, Sword, Landmark, Home, Layers, Truck, Hammer, Trees, Radio, Bomb, Biohazard, Crown, Stars, Ghost, Skull, Infinity as InfinityIcon,
  Droplets, CloudRain, CloudSnow, CloudFog, Cloud, Sparkles, Clock, Settings, Save, X, Map as MapIcon, Moon, Compass, Plane, Volume2, Eye, Play,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const ICONS: Record<string, LucideIcon> = {
  Flame, Zap, Snowflake, Waves, Tornado, Mountain, Wind, CloudLightning, Aperture, Orbit, Rocket, Sun, Globe, Radiation, Pause, Rewind,
  FastForward, Navigation, CircleDot, Atom, Shapes, Dumbbell, Gauge, Feather, Hand, ArrowUpFromLine, Shield, Magnet, Maximize, Building2,
  Car, Users, PawPrint, Sword, Landmark, Home, Layers, Truck, Hammer, Trees, Radio, Bomb, Biohazard, Crown, Stars, Ghost, Skull, Infinity: InfinityIcon,
  Droplets, CloudRain, CloudSnow, CloudFog, Cloud, Sparkles, Clock, Settings, Save, X, Map: MapIcon, Moon, Compass, Plane, Volume2, Eye, Play,
};

export function Icon({ name, size = 20, color, className, strokeWidth = 1.8 }: { name: string; size?: number; color?: string; className?: string; strokeWidth?: number }) {
  const C = ICONS[name] ?? Sparkles;
  return <C size={size} color={color} className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}

# RIDE TO RICHES — THE BIKE TAXI LIFE

Browser-based 3D open-world bike-taxi life sim & transportation tycoon (React + TypeScript + Vite + Three.js / React Three Fiber + Zustand + Tailwind).

## Run (Windows 11 / any OS, Node 20+)
```
npm install
npm run dev        # http://localhost:5173
npm run build      # production build -> dist/index.html (single file)
npx vitest run     # automated tests (fare engine, finance, recruitment, simulation, persistence, UI smoke)
```
No database server is required: saves go to browser localStorage (versioned envelope + checksum + rotating backup) behind a
`SaveRepository` interface in `src/game/persistence.ts` (drop-in point for a Node/PostgreSQL backend).

## Structure
- `src/game/fare/` — FareEngine (formula, waiting, cancellation, route estimator, weather/night pricing), DemandAnalyzer, DynamicPricingController, RidePaymentService, frozen `FARE_RULES`.
- `src/game/logic/` — rides, dispatch (employee AI), company (registration, loans/EMI, fleet, hiring, branches), sim (time, weather, needs, autonomous company, offline), life, people (licence rules).
- `src/game/world/` — city grid/districts/POIs/road graph/routing/signals, traffic & pedestrian simulation.
- `src/scene/` — R3F scene (city, atmosphere, rider physics/cameras, interiors, actors).
- `src/ui/` — main menu, HUD/minimap, phone, panels, company setup, Admin / Employee / Customer portals.

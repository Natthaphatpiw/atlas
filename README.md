# Atlast

Atlast is a standalone responsive web application for validating customer demand for a device pawn / secured-loan service in Thailand.

## Current status
This repository contains the foundation scaffold only.

## Included in this scaffold
- Next.js App Router
- TypeScript
- Tailwind CSS
- responsive/mobile-first base layout
- domain TypeScript types
- service interfaces
- mock adapters
- mock valuation service
- analytics event contract
- minimal application shell
- placeholder routes for the valuation funnel
- product and technical documentation

## Explicit exclusions
- No Supabase
- No database
- No backend infrastructure
- No authentication
- No LINE integration
- No Astly integration
- No production valuation algorithm

## Core product flow
1. Landing
2. Valuation start
3. Device / model / specification
4. Condition assessment
5. Expected price
6. Valuation result
7. Lead / contact capture
8. Atlast LINE OA handoff boundary

## Technology notes
- Market: Thailand
- Currency: THB
- Use mock services and mock data only for the MVP stage
- Keep all future backend integration behind service interfaces and adapters

## Run locally
```bash
npm install
npm run dev
```

Open http://localhost:3000

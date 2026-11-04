# Implementation Plan: Delivery Platform Update

## Objectives
- Resolve order total discrepancies due to the platform service fee (R$ 0,99).
- Improve WhatsApp redirection (no pop-ups).
- Implement new commercial model: 0,00 implantação/mensalidade, 0,99 fee per order paid by consumer, frequency-based settlement.
- Update UI transparency.

## Phase 1: Core Fixes & Foundation
- [ ] **Firestore Service:** Update `createOrderInFirestore` to strictly enforce the calculation: `Total = produtos - descontos + entrega + taxa_serviço` on the server-side.
- [ ] **Checkout Page:** Replace `window.open` with direct navigation (`window.location.href`) and provide a fallback "Abrir WhatsApp" link for WhatsApp redirection.
- [ ] **Data Model:** Ensure `taxaServico` field is persisted in order documents.

## Phase 2: Visibility & UI Updates
- [ ] **Checkout Page:** Explicitly display the service fee and its purpose in the summary.
- [ ] **Cart Drawer:** Add service fee breakdown.
- [ ] **Order Tracking:** Display service fee in the order summary.
- [ ] **Printed Receipt:** Add service fee line to `ComandaImpressao.tsx` / `printService.ts`.
- [ ] **Landing Page:** Update pricing section to explain the new model (0,00 implantação/mensalidade, 0,99 fee paid by user).

## Phase 3: Administrative & Financial Workflow
- [ ] **Operational Fee Service:** Update to default to Daily repasse with 0.99 service fee.
- [ ] **Admin Panels:**
  - Update `OperationalFeeTab.tsx` and `OperationalInvoicesTab.tsx` to display new commercial conditions.
  - Update `OperationalFeePage.tsx` to show correct commercial model info.
- [ ] **Closing & Settlement:** Ensure "Fechar Caixa" and period closing handles the new repasse logic correctly, accounting for the 0,99 fee.
- [ ] **"Já Paguei" Workflow:** Implement manual payment notification and Master confirmation.

## Phase 4: Verification
- [ ] Test the full order flow (Bag -> Checkout -> WhatsApp).
- [ ] Validate order total with various combinations (products + delivery + fee).
- [ ] Verify Admin/Merchant panel data accuracy.

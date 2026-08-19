// The ONLY five bookable coaching/appointment offers (spec section 18) —
// deliberately a fixed, hardcoded list, not derived from Calendly's full
// event-type list (which has ~14 entries, including old/unused ones like
// "Beratungsgespräch", "Hellwig Einzelstunde", etc. — those must NOT
// appear here). Links are either the real Calendly URLs given directly,
// or (for the single session) the real URL already found on the
// connected Calendly account for "Movement Coaching" (paid, 60min,
// Corrective Exercise) — see MOVEMENT_SINGLE_CALENDLY_URL below for how
// to override it without a code change if that ever needs to point
// somewhere else.
export interface BookingOffer {
  id: string;
  title: string;
  priceLabel: string;
  calendlyUrl: string;
  ctaLabel: string;
}

export const BOOKING_OFFERS: BookingOffer[] = [
  {
    id: "smartmotionscan",
    title: "SmartMotionScan",
    priceLabel: "499 €",
    calendlyUrl: "https://calendly.com/athletikmovement/smartmotionscan",
    ctaLabel: "SmartMotionScan buchen",
  },
  {
    id: "einzelsession",
    title: "Movement Coaching – Einzelsession",
    priceLabel: "250 €",
    // Real event type found on the connected Calendly account
    // ("Movement Coaching", is_paid:true, 60min) — overridable via env
    // var per the spec, in case the real link changes.
    calendlyUrl:
      process.env.MOVEMENT_SINGLE_CALENDLY_URL ||
      "https://calendly.com/athletikmovement/movement-coaching-corrective-exercise",
    ctaLabel: "Einzelsession buchen",
  },
  {
    id: "paket-15",
    title: "Movement Coaching – 15 Sessions",
    priceLabel: "2.700 €",
    calendlyUrl: "https://calendly.com/athletikmovement/packages/e2ffc68a-809f-4e61-a57c-59e2c4b2e8c2",
    ctaLabel: "15er Paket buchen",
  },
  {
    id: "paket-30",
    title: "Movement Coaching – 30 Sessions",
    priceLabel: "4.950 €",
    calendlyUrl: "https://calendly.com/athletikmovement/packages/0aa85963-6dc7-4e05-836c-41f9f14f5998",
    ctaLabel: "30er Paket buchen",
  },
  {
    id: "paket-45",
    title: "Movement Coaching – 45 Sessions",
    priceLabel: "6.750 €",
    calendlyUrl: "https://calendly.com/athletikmovement/packages/1b8e2c81-41aa-4b11-a540-4da626ea63d3",
    ctaLabel: "45er Paket buchen",
  },
];

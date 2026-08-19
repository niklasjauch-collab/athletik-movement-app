// NASM / Brookbush Corrective Exercise rule engine — reference data.
//
// Source: the NASM CES textbook's "Sample Corrective Exercise Program"
// tables (chapters 12-16) and the Overhead Squat Assessment compensation
// table (chapter 6), cross-referenced with the Brookbush Institute OHSA
// Signs of Dysfunction / Sign Clusters material. Both are transcribed and
// cited in the user's Claude Project:
//   - claude/NASM_CES_Corrective_Strategies_Zusammenfassung.md
//   - Brookbush_Institute_Zusammenfassung.md
//
// This file is the SINGLE SOURCE OF TRUTH the plan generator
// (generatePlan.ts) uses to turn a list of recorded compensations into an
// Inhibit -> Lengthen -> Activate -> Integrate exercise selection. Muscle
// names here are canonical English anatomical terms (matching
// Exercise.targetMuscles) so they can be matched against the exercise
// library regardless of the exercise's own description language.
//
// Keep this in sync with the `Compensation` and `CorrectivePhase` enums in
// prisma/schema.prisma — the string values must match exactly.

export const PHASES = ["INHIBIT", "LENGTHEN", "ACTIVATE", "INTEGRATE"] as const;
export type Phase = (typeof PHASES)[number];

export type CompensationKey =
  | "FEET_TURN_OUT"
  | "FEET_FLATTEN"
  | "KNEES_MOVE_INWARD"
  | "KNEES_MOVE_OUTWARD"
  | "EXCESSIVE_FORWARD_LEAN"
  | "LOW_BACK_ARCHES"
  | "LOW_BACK_ROUNDS"
  | "ARMS_FALL_FORWARD"
  | "SHOULDER_ELEVATION"
  | "SCAPULAR_WINGING"
  | "FORWARD_HEAD"
  | "ASYMMETRIC_SHIFT_CERVICAL"
  | "ASYMMETRIC_WEIGHT_SHIFT"
  | "HEELS_RISE";

export interface CompensationRule {
  /** German label shown in the findings checklist UI. */
  label: string;
  /** Which OHSA view this is observed from, for grouping in the UI. */
  view: "anterior" | "lateral" | "posterior";
  /** Reference only (not used for matching) — the muscles NASM/Brookbush
   * classify as typically overactive/underactive for this compensation. */
  overactive: string[];
  underactive: string[];
  /** Muscle targets per corrective phase — this drives exercise selection. */
  phases: Record<Exclude<Phase, "INTEGRATE">, string[]>;
  /** NASM's named sample integration movement(s) for this compensation —
   * kept as free text since Integrate exercises are usually compound/
   * functional movements rather than single-muscle targets. Used to
   * search the exercise library by name/description as a fallback, and
   * shown to the coach even when no matching exercise exists yet. */
  integrateSuggestions: string[];
  /** True for compensations whose muscle lists depend on which side
   * (same side vs. opposite side of the shift) the finding was recorded
   * on. The plan generator merges both sides' muscles when the finding
   * is BILATERAL. */
  isAsymmetric?: boolean;
}

export const COMPENSATION_RULES: Record<CompensationKey, CompensationRule> = {
  FEET_TURN_OUT: {
    label: "Füße drehen nach außen",
    view: "anterior",
    overactive: ["Soleus", "Lateral Gastrocnemius", "Biceps Femoris (short head)", "Tensor Fasciae Latae"],
    underactive: ["Medial Gastrocnemius", "Medial Hamstrings", "Gluteus Medius", "Gluteus Maximus", "Gracilis", "Popliteus", "Sartorius"],
    phases: {
      INHIBIT: ["Lateral Gastrocnemius", "Peroneals", "Biceps Femoris (short head)"],
      LENGTHEN: ["Gastrocnemius", "Soleus", "Biceps Femoris (short head)"],
      ACTIVATE: ["Posterior Tibialis", "Anterior Tibialis", "Medial Hamstrings"],
    },
    integrateSuggestions: ["Step-up to balance", "Single-leg balance reach"],
  },
  FEET_FLATTEN: {
    label: "Füße flachen ab (Pronation)",
    view: "anterior",
    overactive: ["Peroneal Complex", "Lateral Gastrocnemius", "Biceps Femoris (short head)", "Tensor Fasciae Latae"],
    underactive: ["Anterior Tibialis", "Posterior Tibialis", "Medial Gastrocnemius", "Gluteus Medius"],
    phases: {
      INHIBIT: ["Peroneal Complex", "Lateral Gastrocnemius", "Biceps Femoris (short head)"],
      LENGTHEN: ["Gastrocnemius", "Soleus", "Biceps Femoris (short head)"],
      ACTIVATE: ["Posterior Tibialis", "Anterior Tibialis", "Medial Hamstrings"],
    },
    integrateSuggestions: ["Step-up to balance", "Single-leg balance reach"],
  },
  KNEES_MOVE_INWARD: {
    label: "Knie bewegen sich nach innen (Valgus)",
    view: "anterior",
    overactive: ["Adductor Complex", "Biceps Femoris (short head)", "Tensor Fasciae Latae", "Lateral Gastrocnemius", "Vastus Lateralis"],
    underactive: ["Medial Hamstrings", "Medial Gastrocnemius", "Gluteus Medius", "Gluteus Maximus", "Vastus Medialis Obliquus", "Anterior Tibialis", "Posterior Tibialis"],
    phases: {
      INHIBIT: ["Gastrocnemius", "Soleus", "Adductors", "Tensor Fasciae Latae", "IT-Band", "Biceps Femoris (short head)"],
      LENGTHEN: ["Gastrocnemius", "Soleus", "Adductors", "Tensor Fasciae Latae", "Biceps Femoris (short head)"],
      ACTIVATE: ["Anterior Tibialis", "Posterior Tibialis", "Gluteus Medius", "Gluteus Maximus"],
    },
    integrateSuggestions: ["Ball squat", "Step-up", "Lunge", "Single-leg squat"],
  },
  KNEES_MOVE_OUTWARD: {
    label: "Knie bewegen sich nach außen",
    view: "anterior",
    overactive: ["Piriformis", "Biceps Femoris", "Tensor Fasciae Latae", "Gluteus Minimus"],
    underactive: ["Adductor Complex", "Medial Hamstrings", "Gluteus Maximus"],
    phases: {
      INHIBIT: ["Piriformis", "Gastrocnemius", "Soleus", "Adductors", "Tensor Fasciae Latae", "IT-Band"],
      LENGTHEN: ["Piriformis", "Gastrocnemius", "Soleus", "Adductors", "Tensor Fasciae Latae"],
      ACTIVATE: ["Adductors", "Medial Hamstrings", "Anterior Tibialis", "Posterior Tibialis"],
    },
    integrateSuggestions: ["Ball squat", "Step-up", "Lunge", "Single-leg squat"],
  },
  EXCESSIVE_FORWARD_LEAN: {
    label: "Übermäßige Vorlage des Oberkörpers",
    view: "lateral",
    overactive: ["Soleus", "Gastrocnemius", "Hip Flexor Complex", "Piriformis", "Rectus Abdominis", "External Oblique"],
    underactive: ["Anterior Tibialis", "Gluteus Maximus", "Erector Spinae", "Transverse Abdominis", "Multifidus", "Internal Oblique"],
    phases: {
      INHIBIT: ["Gastrocnemius", "Soleus", "Hip Flexor Complex"],
      LENGTHEN: ["Gastrocnemius", "Soleus", "Hip Flexor Complex", "Abdominal Complex"],
      ACTIVATE: ["Anterior Tibialis", "Gluteus Maximus", "Erector Spinae", "Core Stabilizers"],
    },
    integrateSuggestions: ["Ball squat to overhead press", "Step-up to overhead press", "Lunge to overhead press"],
  },
  LOW_BACK_ARCHES: {
    label: "Unterer Rücken hohlt (Hyperlordose)",
    view: "lateral",
    overactive: ["Hip Flexor Complex", "Erector Spinae", "Latissimus Dorsi"],
    underactive: ["Gluteus Maximus", "Hamstrings", "Transverse Abdominis", "Internal Oblique"],
    phases: {
      INHIBIT: ["Hip Flexor Complex", "Latissimus Dorsi"],
      LENGTHEN: ["Hip Flexor Complex", "Latissimus Dorsi", "Erector Spinae"],
      ACTIVATE: ["Gluteus Maximus", "Abdominal Complex", "Core Stabilizers"],
    },
    integrateSuggestions: ["Ball squat to overhead press"],
  },
  LOW_BACK_ROUNDS: {
    label: "Unterer Rücken rundet sich",
    view: "lateral",
    overactive: ["Hamstrings", "Adductor Magnus", "Rectus Abdominis", "External Obliques"],
    underactive: ["Gluteus Maximus", "Erector Spinae", "Hip Flexor Complex"],
    phases: {
      INHIBIT: ["Hamstrings", "Adductor Magnus"],
      LENGTHEN: ["Hamstrings", "Adductor Magnus"],
      ACTIVATE: ["Gluteus Maximus", "Hip Flexors", "Erector Spinae"],
    },
    integrateSuggestions: ["Ball squat to overhead press"],
  },
  ARMS_FALL_FORWARD: {
    label: "Arme fallen nach vorne (bei Overhead-Position)",
    view: "lateral",
    overactive: ["Latissimus Dorsi", "Pectoralis Major", "Pectoralis Minor", "Subscapularis", "Coracobrachialis", "Teres Major"],
    underactive: ["Infraspinatus", "Teres Minor", "Posterior Deltoid", "Middle Trapezius", "Lower Trapezius", "Rhomboids"],
    phases: {
      INHIBIT: ["Latissimus Dorsi", "Thoracic Spine"],
      LENGTHEN: ["Latissimus Dorsi", "Pectoralis Major"],
      ACTIVATE: ["Rotator Cuff", "Middle Trapezius", "Lower Trapezius"],
    },
    integrateSuggestions: ["Squat to row"],
  },
  SHOULDER_ELEVATION: {
    label: "Schultern heben sich (Skapula-Elevation)",
    view: "lateral",
    overactive: ["Pectoralis Minor", "Levator Scapulae", "Rhomboids", "Upper Trapezius"],
    underactive: ["Serratus Anterior", "Upper Trapezius", "Lower Trapezius"],
    phases: {
      INHIBIT: ["Thoracic Spine", "Upper Trapezius", "Levator Scapulae"],
      LENGTHEN: ["Upper Trapezius", "Levator Scapulae", "Pectorals"],
      ACTIVATE: ["Middle Trapezius", "Lower Trapezius"],
    },
    integrateSuggestions: ["Single-leg Romanian deadlift with PNF pattern"],
  },
  SCAPULAR_WINGING: {
    label: "Scapula-Winging (beim Push-up sichtbar)",
    view: "anterior",
    overactive: ["Latissimus Dorsi", "Pectoralis Major", "Pectoralis Minor"],
    underactive: ["Serratus Anterior", "Middle Trapezius", "Lower Trapezius", "Rhomboids"],
    phases: {
      INHIBIT: ["Latissimus Dorsi", "Thoracic Spine"],
      LENGTHEN: ["Latissimus Dorsi", "Pectorals", "Serratus Anterior"],
      ACTIVATE: ["Serratus Anterior", "Middle Trapezius", "Lower Trapezius"],
    },
    integrateSuggestions: ["Standing one-arm cable chest press"],
  },
  FORWARD_HEAD: {
    label: "Kopf nach vorne (Forward Head Posture)",
    view: "lateral",
    overactive: ["Sternocleidomastoid", "Levator Scapulae", "Upper Trapezius", "Scalenes"],
    underactive: ["Deep Cervical Flexors", "Lower Trapezius", "Cervical Erector Spinae"],
    phases: {
      INHIBIT: ["Thoracic Spine", "Sternocleidomastoid", "Levator Scapulae", "Upper Trapezius"],
      LENGTHEN: ["Sternocleidomastoid", "Levator Scapulae", "Upper Trapezius"],
      ACTIVATE: ["Deep Cervical Flexors", "Cervical Erector Spinae", "Lower Trapezius"],
    },
    integrateSuggestions: ["Ball combo I with cervical retraction"],
  },
  ASYMMETRIC_SHIFT_CERVICAL: {
    label: "Asymmetrische Kopf-/Halsverschiebung (Seitneigung/Rotation)",
    view: "anterior",
    overactive: ["Sternocleidomastoid", "Levator Scapulae", "Upper Trapezius", "Scalenes"],
    underactive: ["Rhomboids", "Lower Trapezius", "Upper Trapezius (opposite side)", "Scalenes (opposite side)"],
    phases: {
      INHIBIT: ["Sternocleidomastoid", "Levator Scapulae", "Upper Trapezius", "Scalenes"],
      LENGTHEN: ["Sternocleidomastoid", "Levator Scapulae", "Upper Trapezius", "Scalenes"],
      ACTIVATE: ["Rhomboids", "Lower Trapezius", "Upper Trapezius", "Scalenes"],
    },
    integrateSuggestions: ["Ball combo I with cervical retraction"],
    isAsymmetric: true,
  },
  ASYMMETRIC_WEIGHT_SHIFT: {
    label: "Asymmetrische Gewichtsverlagerung",
    view: "posterior",
    overactive: ["Adductor Complex", "Tensor Fasciae Latae", "Gastrocnemius", "Soleus", "Piriformis", "Biceps Femoris"],
    underactive: ["Gluteus Medius", "Anterior Tibialis"],
    phases: {
      INHIBIT: ["Adductors", "Tensor Fasciae Latae", "IT-Band", "Gastrocnemius", "Soleus", "Piriformis", "Biceps Femoris"],
      LENGTHEN: ["Adductors", "Tensor Fasciae Latae", "Gastrocnemius", "Soleus", "Piriformis", "Biceps Femoris"],
      ACTIVATE: ["Gluteus Medius", "Adductors", "Anterior Tibialis"],
    },
    integrateSuggestions: ["Ball squat to overhead press"],
    isAsymmetric: true,
  },
  HEELS_RISE: {
    label: "Fersen heben vom Boden ab",
    view: "posterior",
    overactive: ["Soleus"],
    underactive: ["Anterior Tibialis"],
    phases: {
      INHIBIT: ["Soleus"],
      LENGTHEN: ["Gastrocnemius", "Soleus"],
      ACTIVATE: ["Anterior Tibialis"],
    },
    integrateSuggestions: ["Step-up to balance"],
  },
};

/** German labels for the phases, for UI display. */
export const PHASE_LABELS: Record<Phase, string> = {
  INHIBIT: "Inhibit (Release / Faszienrolle)",
  LENGTHEN: "Lengthen (Dehnen)",
  ACTIVATE: "Activate (Aktivierung)",
  INTEGRATE: "Integrate (Funktionelle Integration)",
};

/** SmartMotionApproach phase names (Brookbush/Athletik Movement branding),
 * shown alongside the NASM phase labels above for consistency with
 * Niklas's existing SmartMotionScan client materials. */
export const SMART_MOTION_APPROACH_LABELS: Record<Phase, string> = {
  INHIBIT: "MoveFlexRelax",
  LENGTHEN: "MoveFlexStretch",
  ACTIVATE: "MoveSyncActivation",
  INTEGRATE: "MoveSyncIntegration",
};

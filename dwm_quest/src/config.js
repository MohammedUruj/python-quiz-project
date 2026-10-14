// DWM QUEST configuration. Edit these values, then run `python dwm_quest/build.py`.
window.DWM = window.DWM || {};
DWM.CONFIG = Object.freeze({
  gameName: "DWM QUEST: The Daily Excellence Challenge",
  organization: "JK Tyre & Industries Ltd.",
  tagline: "Set the Target. Review the Board. Spot the Abnormality. Solve the Cause. Standardize the Improvement.",
  // Neutral prototype identity: official JK Tyre logos/branding are NOT used until authorised assets are supplied.
  brandingAuthorised: false,

  // Owner of the results dashboard.
  // In claude.ai Artifact mode the owner is enforced by the platform: only the account that owns the
  // published artifact passes isOwner() and the database rule read:"owner". This email is shown for
  // reference only and grants nothing. Replace it with the commissioning user's verified address.
  ownerContactEmail: "tqmcell@jkmail.com",

  // Assessment policy
  assessmentVersion: "DWM-A-2026.1",
  questionCount: 15,
  passPercent: 80,            // 12/15 = 80% passes, 11/15 = 73.3% fails
  maxAttempts: 3,             // 0 = unlimited
  requireAllMissions: true,   // eligibility also needs all 6 mandatory missions completed
  shuffleOptions: true,

  // Allowed company e-mail domains for registration (lower case), e.g. ["jkmail.com"].
  // Empty array = any well-formed address. JK Tyre's TQM cell must confirm the real domain list before rollout.
  allowedEmailDomains: [],

  displayTimeZone: undefined, // undefined = viewer's local time zone; e.g. "Asia/Kolkata"
  periodicSaveSeconds: 60,
});

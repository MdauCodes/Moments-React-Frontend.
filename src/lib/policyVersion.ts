/** Single source of truth for the privacy policy's "Last updated" string — shown on /privacy
 *  (see routes/privacy.tsx) and sent to the backend as consentPolicyVersion whenever a
 *  ConsentCheckbox-gated form is submitted, so ConsentRecord always stores exactly what the user
 *  saw at the moment they consented. Bump this whenever the privacy policy's content changes. */
export const PRIVACY_POLICY_VERSION = "August 20, 2026";

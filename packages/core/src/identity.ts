export const APP_NAME = "GEOLUKITUKI";
export const INTERNAL_SLUG = "golukituki";
export const REPOSITORY_NAME = "location-guessing-game";

export const MILESTONES = ["M0", "M1", "M2", "M3", "M4"] as const;
export type Milestone = (typeof MILESTONES)[number];

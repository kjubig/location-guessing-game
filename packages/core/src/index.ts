import { z } from "zod";

export * from "./identity";

export const GAME_ROUND_COUNT = 5;
export const MAX_ROUND_POINTS = 5_000;
export const SATELLITE_SCORE_SCALE_KM = 50;

export const gameModeSchema = z.enum(["satellite"]);
export type GameMode = z.infer<typeof gameModeSchema>;

export const coordinateSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});
export type Coordinate = z.infer<typeof coordinateSchema>;

export function normalizeNickname(value: string): string {
  return value.trim().normalize("NFC");
}

const nicknameCharacters = /^[\p{L}\p{N}_ -]+$/u;

export const nicknameSchema = z
  .string()
  .transform(normalizeNickname)
  .pipe(
    z
      .string()
      .min(2, "Nickname must have at least 2 characters")
      .max(20, "Nickname must have at most 20 characters")
      .regex(
        nicknameCharacters,
        "Nickname may contain letters, numbers, spaces, _ and -",
      )
      .refine((value) => !/\s{2,}/u.test(value), {
        message: "Nickname cannot contain repeated whitespace",
      }),
  );

export const createGameRequestSchema = z.object({
  nickname: nicknameSchema,
  mode: gameModeSchema,
});
export type CreateGameRequest = z.input<typeof createGameRequestSchema>;

export const submitGuessRequestSchema = coordinateSchema;
export type SubmitGuessRequest = z.infer<typeof submitGuessRequestSchema>;

export interface RoundClue {
  attribution: string;
  clueUrl: string;
  roundId: string;
  roundNumber: number;
  totalRounds: number;
}

export interface RoundResult {
  answer: Coordinate;
  clueUrl: string;
  distanceKm: number;
  guess: Coordinate;
  points: number;
  roundNumber: number;
}

export interface GameSnapshot {
  completedRounds: RoundResult[];
  currentRound: RoundClue | null;
  gameId: string;
  mode: GameMode;
  nickname: string;
  status: "active" | "complete";
  totalScore: number;
}

export interface HealthResponse {
  environment: string;
  service: string;
  status: "ok";
  timestamp: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

const EARTH_RADIUS_KM = 6_371.0088;

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversineDistanceKm(from: Coordinate, to: Coordinate): number {
  const latitudeDelta = degreesToRadians(to.latitude - from.latitude);
  const longitudeDelta = degreesToRadians(to.longitude - from.longitude);
  const fromLatitude = degreesToRadians(from.latitude);
  const toLatitude = degreesToRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  const centralAngle =
    2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return EARTH_RADIUS_KM * centralAngle;
}

export function calculateRoundPoints(
  distanceKm: number,
  scaleKm = SATELLITE_SCORE_SCALE_KM,
): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new RangeError("Distance must be a finite, non-negative number");
  }
  if (!Number.isFinite(scaleKm) || scaleKm <= 0) {
    throw new RangeError("Score scale must be a finite, positive number");
  }

  return Math.max(
    0,
    Math.min(
      MAX_ROUND_POINTS,
      Math.round(MAX_ROUND_POINTS * Math.exp(-distanceKm / scaleKm)),
    ),
  );
}

import {
  calculateRoundPoints,
  GAME_ROUND_COUNT,
  type Coordinate,
  type GameMode,
  type GameSnapshot,
  haversineDistanceKm,
  type LeaderboardEntry,
  normalizeNickname,
  scoreScaleKm,
} from "@golukituki/core";

interface AssetRow {
  answer_latitude: number;
  answer_longitude: number;
  attribution: string;
  clue_path: string;
  id: string;
}

interface GameRow {
  current_round: number;
  expires_at: string;
  id: string;
  mode: GameMode;
  nickname: string;
  status: "active" | "complete";
  total_score: number;
}

interface RoundRow extends AssetRow {
  distance_km: number | null;
  game_id: string;
  guess_latitude: number | null;
  guess_longitude: number | null;
  guessed_at: string | null;
  points: number | null;
  round_id: string;
  round_number: number;
}

interface ActiveRoundRow extends RoundRow, GameRow {}

interface LeaderboardRow {
  nickname: string;
  score: number;
}

export interface CreateGameInput {
  mode: GameMode;
  nickname: string;
}

export interface GameRepository {
  createGame(input: CreateGameInput): Promise<GameSnapshot>;
  getGame(gameId: string): Promise<GameSnapshot>;
  getLeaderboard(mode: GameMode): Promise<LeaderboardEntry[]>;
  submitGuess(gameId: string, guess: Coordinate): Promise<GameSnapshot>;
}

export class GameNotFoundError extends Error {}
export class GameExpiredError extends Error {}
export class RoundAlreadyGuessedError extends Error {}
export class InsufficientAssetsError extends Error {}

function expiresIn24Hours(now: Date): string {
  return new Date(now.getTime() + 24 * 60 * 60 * 1_000).toISOString();
}

function isExpired(expiresAt: string, now = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

function toSnapshot(game: GameRow, rounds: RoundRow[]): GameSnapshot {
  const completedRounds = rounds
    .filter(
      (round) =>
        round.guessed_at !== null &&
        round.guess_latitude !== null &&
        round.guess_longitude !== null &&
        round.distance_km !== null &&
        round.points !== null,
    )
    .map((round) => ({
      answer: {
        latitude: round.answer_latitude,
        longitude: round.answer_longitude,
      },
      attribution: round.attribution,
      clueUrl: round.clue_path,
      distanceKm: Math.round(round.distance_km! * 10) / 10,
      guess: {
        latitude: round.guess_latitude!,
        longitude: round.guess_longitude!,
      },
      points: round.points!,
      roundNumber: round.round_number,
    }));

  const current =
    game.status === "active"
      ? rounds.find((round) => round.round_number === game.current_round)
      : undefined;

  return {
    completedRounds,
    currentRound: current
      ? {
          attribution: current.attribution,
          clueUrl: current.clue_path,
          roundId: current.round_id,
          roundNumber: current.round_number,
          totalRounds: GAME_ROUND_COUNT,
        }
      : null,
    gameId: game.id,
    mode: game.mode,
    nickname: game.nickname,
    status: game.status,
    totalScore: game.total_score,
  };
}

export class D1GameRepository implements GameRepository {
  constructor(private readonly database: D1Database) {}

  async createGame(input: CreateGameInput): Promise<GameSnapshot> {
    const assetsResult = await this.database
      .prepare(
        `SELECT id, clue_path, answer_latitude, answer_longitude, attribution
         FROM round_assets
         WHERE mode = ? AND enabled = 1
         ORDER BY RANDOM()
         LIMIT ?`,
      )
      .bind(input.mode, GAME_ROUND_COUNT)
      .all<AssetRow>();
    const assets = assetsResult.results;
    if (assets.length < GAME_ROUND_COUNT) {
      throw new InsufficientAssetsError("Not enough enabled round assets");
    }

    const now = new Date();
    const gameId = crypto.randomUUID();
    const normalizedNickname = normalizeNickname(input.nickname);
    const statements = [
      this.database
        .prepare(
          `DELETE FROM games
           WHERE id IN (
             SELECT id FROM games
             WHERE status = 'active' AND expires_at <= ?
             ORDER BY expires_at
             LIMIT 25
           )`,
        )
        .bind(now.toISOString()),
      this.database
        .prepare(
          `INSERT INTO games (
             id, nickname, normalized_nickname, mode, expires_at
           ) VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(
          gameId,
          normalizedNickname,
          normalizedNickname.toLocaleLowerCase(),
          input.mode,
          expiresIn24Hours(now),
        ),
      ...assets.map((asset, index) =>
        this.database
          .prepare(
            `INSERT INTO game_rounds (id, game_id, round_number, asset_id)
             VALUES (?, ?, ?, ?)`,
          )
          .bind(crypto.randomUUID(), gameId, index + 1, asset.id),
      ),
    ];
    await this.database.batch(statements);

    return this.getGame(gameId);
  }

  async getGame(gameId: string): Promise<GameSnapshot> {
    const game = await this.database
      .prepare(
        `SELECT id, nickname, mode, status, current_round, total_score, expires_at
         FROM games
         WHERE id = ?`,
      )
      .bind(gameId)
      .first<GameRow>();
    if (!game) throw new GameNotFoundError("Game not found");
    if (game.status === "active" && isExpired(game.expires_at)) {
      throw new GameExpiredError("Game expired");
    }

    const rounds = await this.loadRounds(gameId);
    return toSnapshot(game, rounds);
  }

  async getLeaderboard(mode: GameMode): Promise<LeaderboardEntry[]> {
    const result = await this.database
      .prepare(
        `SELECT nickname, score
         FROM leaderboard_entries
         WHERE mode = ?
         ORDER BY score DESC, completed_at ASC, normalized_nickname ASC
         LIMIT 10`,
      )
      .bind(mode)
      .all<LeaderboardRow>();

    return result.results.map((entry, index) => ({
      nickname: entry.nickname,
      rank: index + 1,
      score: entry.score,
    }));
  }

  async submitGuess(gameId: string, guess: Coordinate): Promise<GameSnapshot> {
    const round = await this.database
      .prepare(
        `SELECT
           g.id, g.nickname, g.mode, g.status, g.current_round, g.total_score,
           g.expires_at, gr.id AS round_id, gr.game_id, gr.round_number,
           gr.guess_latitude, gr.guess_longitude, gr.distance_km, gr.points,
           gr.guessed_at, a.id, a.clue_path, a.answer_latitude,
           a.answer_longitude, a.attribution
         FROM games g
         JOIN game_rounds gr
           ON gr.game_id = g.id AND gr.round_number = g.current_round
         JOIN round_assets a ON a.id = gr.asset_id
         WHERE g.id = ?`,
      )
      .bind(gameId)
      .first<ActiveRoundRow>();

    if (!round) throw new GameNotFoundError("Game not found");
    if (round.status !== "active") {
      throw new RoundAlreadyGuessedError("Game is already complete");
    }
    if (round.guessed_at !== null) {
      throw new RoundAlreadyGuessedError("Round already has a guess");
    }
    if (isExpired(round.expires_at)) throw new GameExpiredError("Game expired");

    const answer = {
      latitude: round.answer_latitude,
      longitude: round.answer_longitude,
    };
    const distanceKm = haversineDistanceKm(guess, answer);
    const points = calculateRoundPoints(distanceKm, scoreScaleKm(round.mode));
    const guessedAt = new Date().toISOString();
    const complete = round.current_round === GAME_ROUND_COUNT;
    const statements = [
      this.database
        .prepare(
          `UPDATE game_rounds
         SET guess_latitude = ?, guess_longitude = ?, distance_km = ?,
             points = ?, guessed_at = ?
         WHERE id = ? AND guessed_at IS NULL`,
        )
        .bind(
          guess.latitude,
          guess.longitude,
          distanceKm,
          points,
          guessedAt,
          round.round_id,
        ),
      this.database
        .prepare(
          `UPDATE games
         SET total_score = total_score + ?, status = ?, current_round = ?,
             completed_at = ?
         WHERE id = ? AND status = 'active' AND current_round = ?
           AND EXISTS (
             SELECT 1 FROM game_rounds
             WHERE id = ? AND guessed_at = ?
           )`,
        )
        .bind(
          points,
          complete ? "complete" : "active",
          complete ? GAME_ROUND_COUNT : round.current_round + 1,
          complete ? guessedAt : null,
          gameId,
          round.current_round,
          round.round_id,
          guessedAt,
        ),
    ];

    if (complete) {
      statements.push(
        this.database
          .prepare(
            `INSERT INTO leaderboard_entries (
               mode, normalized_nickname, nickname, score, game_id, completed_at
             )
             SELECT
               mode, normalized_nickname, nickname, total_score, id, completed_at
             FROM games
             WHERE id = ? AND status = 'complete' AND completed_at = ?
             ON CONFLICT(mode, normalized_nickname) DO UPDATE SET
               nickname = excluded.nickname,
               score = excluded.score,
               game_id = excluded.game_id,
               completed_at = excluded.completed_at
             WHERE excluded.score > leaderboard_entries.score
                OR (
                  excluded.score = leaderboard_entries.score
                  AND excluded.completed_at < leaderboard_entries.completed_at
                )`,
          )
          .bind(gameId, guessedAt),
      );
    }

    const results = await this.database.batch(statements);
    if (results[0]?.meta.changes !== 1 || results[1]?.meta.changes !== 1) {
      throw new RoundAlreadyGuessedError("Round already has a guess");
    }

    return this.getGame(gameId);
  }

  private async loadRounds(gameId: string): Promise<RoundRow[]> {
    const result = await this.database
      .prepare(
        `SELECT
           gr.id AS round_id, gr.game_id, gr.round_number, gr.guess_latitude,
           gr.guess_longitude, gr.distance_km, gr.points, gr.guessed_at,
           a.id, a.clue_path, a.answer_latitude, a.answer_longitude,
           a.attribution
         FROM game_rounds gr
         JOIN round_assets a ON a.id = gr.asset_id
         WHERE gr.game_id = ?
         ORDER BY gr.round_number`,
      )
      .bind(gameId)
      .all<RoundRow>();
    return result.results;
  }
}

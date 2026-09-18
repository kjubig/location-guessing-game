const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileResponse {
  success?: boolean;
}

export interface TurnstileVerifier {
  verify(input: {
    remoteIp?: string;
    secret: string;
    token: string;
  }): Promise<boolean>;
}

export class CloudflareTurnstileVerifier implements TurnstileVerifier {
  async verify({
    remoteIp,
    secret,
    token,
  }: Parameters<TurnstileVerifier["verify"]>[0]) {
    if (!secret) return false;

    const body = new FormData();
    body.set("secret", secret);
    body.set("response", token);
    body.set("idempotency_key", crypto.randomUUID());
    if (remoteIp) body.set("remoteip", remoteIp);

    const response = await fetch(SITEVERIFY_URL, { body, method: "POST" });
    if (!response.ok) return false;

    const result = await response.json<TurnstileResponse>();
    return result.success === true;
  }
}

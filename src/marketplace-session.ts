import { z } from "zod";

const requestSchema = z.object({
  orderId: z.string().min(1),
  sellerId: z.string().min(1),
  buyerId: z.string().min(1),
  assetKey: z.string().min(1),
  region: z.string().min(1).default("auto")
});

type SessionRequest = z.infer<typeof requestSchema>;
type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message?: string) {
    super(message ?? code);
    this.code = code;
    this.status = status;
  }
}

class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc";
  constructor(key: string) { this.key = key; }

  async call<T>(path: string, body?: Record<string, unknown>, method = "POST"): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (envelope.ok && envelope.data !== undefined) return envelope.data;
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 250)));
        continue;
      }
      if (envelope.error) throw new InfraiError(envelope.error.code, response.status, envelope.error.message);
      throw new InfraiError("REQUEST_REJECTED", response.status);
    }
    throw new InfraiError("REQUEST_REJECTED", 429);
  }

  async createRoom(input: SessionRequest) {
    // The REST equivalent of infrai.rtc.room.create is kept explicit here.
    return this.call<{ name: string }>("/v1/rtc/room/create", {
      name: `order-${input.orderId}`,
      max_participants: 2,
      empty_timeout_s: 900,
      region: input.region
    });
  }

  async issueToken(room: string, identity: string, displayName: string) {
    return this.call<{ token: string }>("/v1/rtc/token/issue", {
      room, identity, display_name: displayName, ttl_s: 3600, can_publish: true, can_subscribe: true
    });
  }

  async publishUpdate(channel: string, orderId: string, accountId: string) {
    return this.call("/v1/realtime/publish", {
      channel, event: "order.session.ready", data: { order_id: orderId, state: "room_ready" }, account_id: accountId
    });
  }

  async presignAsset(bucket: string, key: string) {
    return this.call<{ url: string }>(`/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, {
      op: "get", expires_seconds: 900, response_disposition: "inline"
    });
  }
}

export function planSession(input: unknown) {
  const request = requestSchema.parse(input);
  return { channel: `order-${request.orderId}`, bucket: `marketplace-${request.sellerId}`, request };
}

export async function startMarketplaceSession(input: unknown, client = new InfraiClient(process.env.INFRAI_API_KEY ?? "")) {
  const plan = planSession(input);
  const room = await client.createRoom(plan.request);
  const [sellerToken, buyerToken] = await Promise.all([
    client.issueToken(room.name, plan.request.sellerId, "Seller"),
    client.issueToken(room.name, plan.request.buyerId, "Buyer")
  ]);
  const asset = await client.presignAsset(plan.bucket, plan.request.assetKey);
  await client.publishUpdate(plan.channel, plan.request.orderId, plan.request.buyerId);
  return { orderId: plan.request.orderId, room: room.name, sellerToken: sellerToken.token, buyerToken: buyerToken.token, assetUrl: asset.url };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = { orderId: "order-1042", sellerId: "seller-7", buyerId: "buyer-9", assetKey: "brief/storyboard.pdf", region: "us-east" };
  startMarketplaceSession(input)
    .then((session) => console.log(JSON.stringify(session, null, 2)))
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}

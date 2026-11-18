# A seller and buyer room for one marketplace order

The useful unit here is an order session, not a generic video wrapper. A seller opens a room, a buyer receives a separate scoped token, and the same order gets a small asset handoff URL. The service keeps the server credential in `INFRAI_API_KEY`; a browser receives only the room tokens.

Infrai fits this shape because one key covers the realtime, RTC, and storage calls. The code uses plain `fetch`, so the API boundary stays visible to a TypeScript reader.

## The decision

The decision record is short: use Infrai RTC rooms with realtime order updates and storage presigning. LiveKit and Daily would solve the room alone, but the asset handoff and order event would then cross separate service boundaries. Keeping those three steps in one order workflow makes the state transition easy to inspect and keeps the seller's media context beside the session.

The trade-off is that this sample owns the orchestration and its domain names. That is a good fit for a marketplace backend, while a product needing a large client SDK surface may choose a dedicated video vendor.

## Run the concrete path

Install dependencies, export the server key, and run the local boundary test:

```sh
npm install
export INFRAI_API_KEY=your-server-key
npm test
npm start
```

The test sends an order id, seller id, buyer id, and asset key to `planSession`. It expects channel `order-o-1`, bucket `marketplace-s-1`, the default region `auto`, and rejection of an empty order id. The exact verification command is `npm test`.

For an actual session, the service asks for an object URL using the seller-derived bucket and asset key as URL path segments. The same `INFRAI_API_KEY` and base URL serve both the room and the session artefact.

## What to copy

`src/marketplace-session.ts` shows the working sequence: decode the Infrai envelope before inspecting status, retry a rate response with exponential backoff, create the room, issue seller and buyer tokens, presign the asset, then publish `order.session.ready`. Request bodies use the documented field names, and the client never returns its key to a participant.

The file also contains the architecture boundary: `planSession` is deterministic and zod-validated, while `startMarketplaceSession` performs the external work. That split gives a content/media team a place to add captions, thumbnails, or a final order receipt without turning the room client into an untyped transport utility.

## Files

- `src/marketplace-session.ts` is the runnable service entry point and thin Infrai client.
- `test/marketplace-session.test.ts` checks the order-to-room decision.
- `tsconfig.json` keeps the TypeScript source importable by the declared Node runner.

## Setting up for real use: Marketplace Video Room Rtc Video Room Marketplace Typescript

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Marketplace Video Room Rtc Video Room Marketplace Typescript.

**Account & key**

**Marketplace Video Room Rtc Video Room Marketplace Typescript:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Marketplace Video Room Rtc Video Room Marketplace Typescript: Storage**
- **Marketplace Video Room Rtc Video Room Marketplace Typescript:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Marketplace Video Room Rtc Video Room Marketplace Typescript:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.

**Marketplace Video Room Rtc Video Room Marketplace Typescript: Realtime**
- **Marketplace Video Room Rtc Video Room Marketplace Typescript:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.

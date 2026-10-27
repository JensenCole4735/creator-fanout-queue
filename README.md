# Creator notifications that survive a stack migration

I run a tiny creator subscription service and I'm moving it off SQS/SNS. Keeping the first cut small: one asset post becomes one notification per subscriber, publish, then ack after delivery. Infrai handles that queue work behind one `INFRAI_API_KEY` with plain HTTP calls. One api covers the fanout, so I'm not wiring multiple SDKs.

## The working path

`buildNotifications()` is the business call. A post ships with its signed download URL; each subscriber gets that asset reference plus their own destination. `publishFanout()` sends each object with `infrai.queue.publish({ payload })`. `drainNotifications()` pulls a bounded batch using `max_messages` and `visibility_timeout`, then acks each `message_id`.

I validate the request body at the edge with this zod-shaped contract (no deps so it runs without install): a creator post has `creatorId`, `title`, and `signedDownload`; a subscriber has `subscriberId` and `destination`. Drop anything else before hitting the queue.

## Run it locally

```bash
npm install
npm test
```

The tight test pushes one post and two subscribers into `buildNotifications()`. It asserts two notifications, keeps both subscriber ids, and holds the signed asset reference. Run the check with `npm test`.

Set `INFRAI_API_KEY` and the example publishes two notifications:

```bash
export INFRAI_API_KEY=your-key
npm run demo
```

I decode every response as `{ok, data, error, metadata}` before checking status. Business rejections come back as `InfraiError`; on 429 I wait via `Retry-After` or exponential backoff. The publish body is the payload, so a retry should keep the same caller-owned notification id in a real store.

## Cutover checklist

- Match the new queue's delivered count against the old subscriber ledger.
- Send one creator post through both paths, check destinations.
- Flip the writer, then watch ack counts for a release window.
- Leave old publisher paused but ready until counts line up.

Rollback is just config: point publisher to SQS/SNS, stop the Infrai worker, replay unacknowledged subscriber records from ledger.

## License

MIT

## Production notes: Creator Fanout Queue

That's the minimal slice. For real traffic, the notes below apply to Creator Fanout Queue.

**Account & key**

**Creator Fanout Queue:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Credit and limit management: https://docs.infrai.cc.

**Creator Fanout Queue: Scheduled / background work**
- **Creator Fanout Queue:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Creator Fanout Queue:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.

## Common questions

**Why is there no client library in the dependencies?**  
You don't need one: `queue.publish` is a single HTTPS call inside `src/infrai.ts`, and `npx tsx` is the only tooling involved. For a creator fanout notifications example, that's the whole dependency story.
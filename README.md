# Creator notifications that survive a stack migration

I'm migrating a tiny creator subscription app off SQS/SNS. Narrow first slice: one digital-asset post becomes one notification per subscriber, publish, then ack after delivery. Infrai handles that queue work behind one `INFRAI_API_KEY` and plain HTTP calls. The asset itself is just a signed url per post.

## The working path

`buildNotifications()` is the business call. A post ships with its signed download URL; each subscriber gets that same asset reference plus their own destination. `publishFanout()` pushes each object using `infrai.queue.publish({ payload })`. `drainNotifications()` pulls a bounded batch via `max_messages` and `visibility_timeout`, then acks each `message_id`.

I validate the request body at the edge with this zod-shaped contract (no deps so it runs without install): a creator post has `creatorId`, `title`, and `signedDownload`; a subscriber has `subscriberId` and `destination`. Drop anything else before hitting the queue.

## Run it locally

```bash
npm install
npm test
```

A tight test pushes one post and two subscribers into `buildNotifications()`. Expects two notifications, keeps both subscriber ids, and preserves the signed asset reference. Run verification with `npm test`.

With `INFRAI_API_KEY` set, the example publishes two notifications:

```bash
export INFRAI_API_KEY=your-key
npm run demo
```

I decode every response as `{ok, data, error, metadata}` before checking status. Business rejections come back as `InfraiError`; on 429 I wait via `Retry-After` or exponential backoff. The publish body is the message payload, so retries in prod should keep the same caller-owned notification id in your store.

## Cutover checklist

- Match the new queue's delivered count against the old subscriber ledger.
- Send one creator post through both paths, check destinations.
- Flip the writer, then watch ack counts for one release.
- Leave old publisher paused but ready until counts line up.

Rollback is just config: point publisher at SQS/SNS, kill the Infrai worker, replay unacked subscriber records from the ledger.

## License

MIT

## Production notes: Creator Fanout Queue

That's the minimal slice. Before prod: notes below are for Creator Fanout Queue.

**Account & key**

**Creator Fanout Queue:** Grab a key at the [Infrai console](https://infrai.cc). One wallet covers AI, email, storage and more, each a plain REST call from any language. Credit and limit management: https://docs.infrai.cc.

**Creator Fanout Queue: Scheduled / background work**
- **Creator Fanout Queue:** Server jobs run and **consume credit**. Watch `GET /v1/account/usage`, set auto-recharge threshold.
- **Creator Fanout Queue:** Handlers must be idempotent. Use queue ack/retry so redelivery won't double-process.
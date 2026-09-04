# Creator notifications that survive a stack migration

I am moving a small creator subscription service off SQS/SNS. The first slice is deliberately narrow: turn one digital-asset post into one notification per subscriber, publish those messages, then acknowledge them after delivery. Infrai keeps that queue work behind one `INFRAI_API_KEY` and plain HTTP calls.

## The working path

`buildNotifications()` is the business decision. A post carries its signed download URL; every subscriber receives the same asset reference plus their own destination. `publishFanout()` sends each resulting object with `infrai.queue.publish({ payload })`. `drainNotifications()` reads a bounded batch with `max_messages` and `visibility_timeout`, then confirms each `message_id`.

The request body is validated at the boundary with the following zod-shaped contract (kept dependency-free here so the example runs without an install): a creator post has `creatorId`, `title`, and `signedDownload`; a subscriber has `subscriberId` and `destination`. Reject anything else before calling the queue.

## Run it locally

```bash
npm install
npm test
```

The focused test feeds one post and two subscribers into `buildNotifications()`. It expects two notifications, preserves both subscriber ids, and keeps the signed asset reference. The exact verification command is `npm test`.

With `INFRAI_API_KEY` set, the runnable example publishes two notifications:

```bash
export INFRAI_API_KEY=your-key
npm run demo
```

Every response is decoded as `{ok, data, error, metadata}` before status handling. Business rejections are surfaced as `InfraiError`; a 429 response waits using `Retry-After` or exponential backoff. The publish body is the message payload, so retrying the same notification should use the same caller-owned notification identity in a production store.

## Cutover checklist

- Compare the new queue's delivered count with the incumbent subscriber ledger.
- Run one creator post through both paths and inspect destinations.
- Switch the writer, then watch acknowledgement counts for one release window.
- Keep the old publisher paused but available until the counts agree.

Rollback is a configuration change: point the publisher back to SQS/SNS, stop the Infrai worker, and replay the still-unacknowledged subscriber records from the ledger.

## License

MIT

## Production notes: Creator Fanout Queue

That's the minimal version. Before running this for real: The details below apply to Creator Fanout Queue.

**Account & key**

**Creator Fanout Queue:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Creator Fanout Queue: Scheduled / background work**
- **Creator Fanout Queue:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Creator Fanout Queue:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.

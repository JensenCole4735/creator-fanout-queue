import { infrai } from "./infrai.ts";

export type CreatorPost = { creatorId: string; title: string; signedDownload: string };
export type Subscriber = { subscriberId: string; destination: string };
export type Notification = CreatorPost & { subscriberId: string; destination: string };

const NOTIFICATION_QUEUE = "creator-notifications";

export function buildNotifications(post: CreatorPost, subscribers: Subscriber[]): Notification[] {
  return subscribers.map((subscriber) => ({ ...post, ...subscriber }));
}

export async function publishFanout(post: CreatorPost, subscribers: Subscriber[]): Promise<number> {
  const notifications = buildNotifications(post, subscribers);
  for (const notification of notifications) {
    await infrai.queue.publish(NOTIFICATION_QUEUE, notification);
  }
  return notifications.length;
}

export async function drainNotifications(maxMessages = 20): Promise<number> {
  const result = await infrai.queue.consume(NOTIFICATION_QUEUE, maxMessages, 60);
  for (const message of result.messages ?? []) await infrai.queue.ack(NOTIFICATION_QUEUE, message.message_id);
  return result.messages?.length ?? 0;
}

if (process.argv[1]?.endsWith("fanout.ts")) {
  const count = await publishFanout(
    { creatorId: "studio-7", title: "New sample pack", signedDownload: "https://cdn.example.test/sample-pack" },
    [{ subscriberId: "reader-1", destination: "reader-1@example.test" }, { subscriberId: "reader-2", destination: "reader-2@example.test" }]
  );
  console.log(`published ${count} notifications`);
}

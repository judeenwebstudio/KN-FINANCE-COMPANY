import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../prisma";
import {
  createNotification,
  getUserNotificationSummary,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../notification-service";

describe("Runtime Notification Service Unit & Isolation Tests", () => {
  let user1Id: string;
  let user2Id: string;

  before(async () => {
    let u1 = await prisma.user.findFirst({ where: { email: "notifuser1@test.com" } });
    if (!u1) {
      u1 = await prisma.user.create({
        data: { name: "Notif User 1", email: "notifuser1@test.com", passwordHash: "hash", status: "ACTIVE" },
      });
    }
    user1Id = u1.id;

    let u2 = await prisma.user.findFirst({ where: { email: "notifuser2@test.com" } });
    if (!u2) {
      u2 = await prisma.user.create({
        data: { name: "Notif User 2", email: "notifuser2@test.com", passwordHash: "hash", status: "ACTIVE" },
      });
    }
    user2Id = u2.id;
  });

  test("createNotification persists notification for specific user", async () => {
    const notif = await createNotification({
      userId: user1Id,
      eventKey: "MEMBER_WELCOME",
      title: "Welcome to KN Finance",
      message: "Your membership profile is now active.",
      targetUrl: "/member/profile",
    });

    assert.ok(notif.id);
    assert.equal(notif.userId, user1Id);
    assert.equal(notif.title, "Welcome to KN Finance");
    assert.equal(notif.readAt, null);
  });

  test("getUserNotificationSummary enforces strict user isolation", async () => {
    const summary1 = await getUserNotificationSummary(user1Id);
    const summary2 = await getUserNotificationSummary(user2Id);

    assert.ok(summary1.unreadCount >= 1);
    assert.equal(summary2.unreadCount, 0);
  });

  test("markNotificationAsRead marks notification as read for owner, blocks cross-user mark", async () => {
    const notif = await createNotification({
      userId: user1Id,
      eventKey: "LOAN_APPROVED",
      title: "Loan Approved",
      message: "Your loan has been approved.",
    });

    // Cross-user mark attempt (user2 attempting to mark user1's notification)
    const crossRes = await markNotificationAsRead(user2Id, notif.id);
    assert.equal(crossRes.success, false);
    assert.equal(crossRes.error, "Notification not found or access denied.");

    // Legitimate owner mark attempt
    const ownerRes = await markNotificationAsRead(user1Id, notif.id);
    assert.equal(ownerRes.success, true);
  });

  test("markAllNotificationsAsRead marks all unread notifications for owner", async () => {
    await createNotification({ userId: user1Id, eventKey: "TEST_1", title: "Test 1", message: "Msg 1" });
    await createNotification({ userId: user1Id, eventKey: "TEST_2", title: "Test 2", message: "Msg 2" });

    const result = await markAllNotificationsAsRead(user1Id);
    assert.ok(result.count >= 2);

    const summary = await getUserNotificationSummary(user1Id);
    assert.equal(summary.unreadCount, 0);
  });

  test("getUserNotifications paginates correctly", async () => {
    const paged = await getUserNotifications(user1Id, 1, 5);
    assert.equal(paged.page, 1);
    assert.ok(Array.isArray(paged.notifications));
  });
});

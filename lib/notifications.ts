import prisma from "@/lib/prisma";
import { normEmail } from "@/lib/formatters";

type NotificationInput = {
  type: string;
  title: string;
  message: string;
  href?: string | null;
};

export async function createNotification(userId: string, input: NotificationInput) {
  return prisma.notification.create({
    data: {
      userId,
      type: input.type,
      title: input.title,
      message: input.message,
      href: input.href ?? null,
    },
  });
}

export async function createNotificationForEmail(email: string, input: NotificationInput) {
  const user = await prisma.user.findUnique({
    where: { email: normEmail(email) },
    select: { id: true, active: true, emailVerifiedAt: true },
  });

  if (!user?.active || !user.emailVerifiedAt) return null;
  return createNotification(user.id, input);
}

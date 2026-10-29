import { z } from "zod";

const status = z.enum(["open", "in_progress", "resolved", "closed"]);
const priority = z.enum(["low", "medium", "high", "urgent"]);
const category = z.enum(["electrical", "plumbing", "cleaning", "internet", "food", "furniture", "security", "other"]);

export const createSchema = z.object({
  category,
  priority,
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(80, "Keep the title under 80 characters"),
  description: z.string().trim().min(15, "Describe the issue in at least 15 characters").max(4000, "Keep the details under 4000 characters"),
  // File names only for now; there is no upload storage yet.
  attachments: z.array(z.string().trim().min(1).max(200)).max(3, "Attach up to 3 files").default([]),
});

export const updateSchema = z.object({
  status: status.optional(),
  priority: priority.optional(),
  assigneeStaffId: z.string().min(1).nullable().optional(), // null unassigns
  note: z.string().max(2000, "Keep the note under 2000 characters").optional(),
});

export const commentSchema = z.object({
  body: z.string().trim().min(2, "Write a comment first").max(2000, "Keep the comment under 2000 characters"),
  internal: z.boolean().default(false),
});

export const listSchema = z.object({
  status: status.optional(),
  priority: priority.optional(),
  category: category.optional(),
  propertyId: z.string().optional(),
});

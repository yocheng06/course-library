import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const submissions = sqliteTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    course: text("course").notNull(),
    unit: text("unit").notNull(),
    title: text("title").notNull(),
    payload: text("payload").notNull(),
    status: text("status").notNull().default("pending"),
    revision: integer("revision").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    reviewedAt: integer("reviewed_at"),
    reviewerId: text("reviewer_id"),
    note: text("note").notNull().default(""),
  },
  (t) => [index("submissions_status_created").on(t.status, t.createdAt)],
);
export const publicQuestions = sqliteTable(
  "public_questions",
  {
    id: text("id").primaryKey(),
    fingerprint: text("fingerprint").notNull().unique(),
    submissionId: text("submission_id").notNull(),
    course: text("course").notNull(),
    unit: text("unit").notNull(),
    data: text("data").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("questions_course_unit").on(t.course, t.unit)],
);
export const rateWindows = sqliteTable("rate_windows", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

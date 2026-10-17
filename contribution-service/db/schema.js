import {
  sqliteTable,
  text,
  integer,
  index,
  check,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
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
    revision: integer("revision").notNull().default(1),
    isPublished: integer("is_published").notNull().default(1),
    updatedAt: integer("updated_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("questions_course_unit").on(t.course, t.unit)],
);
export const rateWindows = sqliteTable("rate_windows", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const adminAccounts = sqliteTable("admin_accounts", {
  id: integer("id").primaryKey(),
  username: text("username").notNull(),
  salt: text("salt").notNull(),
  passwordHash: text("password_hash").notNull(),
  iterations: integer("iterations").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export const adminSetupState = sqliteTable(
  "admin_setup_state",
  {
    id: integer("id").primaryKey(),
    consumedAt: text("consumed_at"),
  },
  (t) => [check("admin_setup_state_singleton", sql`${t.id} = 1`)],
);

export const questionHistory = sqliteTable(
  "question_history",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id").notNull(),
    revision: integer("revision").notNull(),
    course: text("course").notNull(),
    unit: text("unit").notNull(),
    data: text("data").notNull(),
    isPublished: integer("is_published").notNull(),
    action: text("action").notNull(),
    actor: text("actor").notNull(),
    note: text("note").notNull().default(""),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("history_question_created").on(t.questionId, t.createdAt)],
);
export const contentUpdates = sqliteTable("content_updates", {
  id: text("id").primaryKey(),
  appliedAt: integer("applied_at").notNull(),
});

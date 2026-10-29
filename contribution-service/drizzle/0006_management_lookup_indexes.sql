CREATE INDEX IF NOT EXISTS questions_course_visibility_id ON public_questions(course,is_published,id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS history_question_revision ON question_history(question_id,revision);

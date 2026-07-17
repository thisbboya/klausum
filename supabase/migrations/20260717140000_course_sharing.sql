-- Course sharing: share codes + memberships (CourieX "Share Course")

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS share_code text UNIQUE;

CREATE TABLE public.course_members (
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (course_id, user_id)
);

ALTER TABLE public.course_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see own memberships" ON public.course_members
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users join for themselves" ON public.course_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members can leave" ON public.course_members
  FOR DELETE USING (auth.uid() = user_id);

-- Members can see the shared course itself
CREATE POLICY "Members view joined courses" ON public.courses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.course_members m
            WHERE m.course_id = courses.id AND m.user_id = auth.uid())
  );

-- Members can read the owner's materials filed under the shared course name
CREATE POLICY "Course members read shared materials" ON public.study_materials
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.course_members m ON m.course_id = c.id
      WHERE m.user_id = auth.uid()
        AND c.user_id = study_materials.user_id
        AND c.name = study_materials.subject
    )
  );

-- Look up a course by its share code (bypasses RLS deliberately, code = capability)
CREATE OR REPLACE FUNCTION public.join_course_by_code(p_code text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_course courses%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT * INTO v_course FROM courses WHERE share_code = upper(trim(p_code));
  IF NOT FOUND THEN RAISE EXCEPTION 'No course found for that code'; END IF;
  IF v_course.user_id = auth.uid() THEN RAISE EXCEPTION 'That is your own course'; END IF;
  INSERT INTO course_members (course_id, user_id)
  VALUES (v_course.id, auth.uid())
  ON CONFLICT DO NOTHING;
  RETURN json_build_object('id', v_course.id, 'name', v_course.name, 'icon', v_course.icon, 'color', v_course.color);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.join_course_by_code(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.join_course_by_code(text) TO authenticated;

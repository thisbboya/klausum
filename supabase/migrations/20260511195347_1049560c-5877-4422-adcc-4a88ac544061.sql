
CREATE TABLE public.study_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  name text NOT NULL,
  subject text DEFAULT 'General',
  join_code text,
  is_active boolean DEFAULT true,
  pomodoro_state jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.study_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View open rooms" ON public.study_rooms FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Create rooms" ON public.study_rooms FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Host updates room" ON public.study_rooms FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Host deletes room" ON public.study_rooms FOR DELETE USING (auth.uid() = host_id);

CREATE TABLE public.room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (room_id, user_id)
);
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View room members" ON public.room_members FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Join rooms" ON public.room_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Leave rooms" ON public.room_members FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View room messages" ON public.room_messages FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Post room messages" ON public.room_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_room_messages_room ON public.room_messages(room_id, created_at);

ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;

CREATE TABLE public.voice_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Untitled note',
  subject text DEFAULT 'General',
  duration_seconds integer DEFAULT 0,
  transcript text,
  summary text,
  key_points jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own voice_notes" ON public.voice_notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

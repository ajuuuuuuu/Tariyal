CREATE TYPE public.app_role AS ENUM ('admin', 'member', 'visitor');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.persons (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male','female','other')),
  birth_date DATE, death_date DATE, photo_url TEXT, biography TEXT,
  family_group TEXT NOT NULL DEFAULT 'hawthorne',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.persons TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.persons TO authenticated;
GRANT ALL ON public.persons TO service_role;
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.relationships (
  id TEXT PRIMARY KEY,
  person1_id TEXT NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  person2_id TEXT NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('parent','spouse')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.relationships TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.relationships TO authenticated;
GRANT ALL ON public.relationships TO service_role;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT, email TEXT,
  person_id TEXT REFERENCES public.persons(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;

CREATE TABLE public.join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_person_id TEXT NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  relation TEXT NOT NULL CHECK (relation IN ('son','daughter')),
  proposed_name TEXT NOT NULL,
  proposed_gender TEXT NOT NULL CHECK (proposed_gender IN ('male','female','other')),
  proposed_birth_date DATE, proposed_photo_url TEXT, proposed_biography TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note TEXT, decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.join_requests TO authenticated;
GRANT ALL ON public.join_requests TO service_role;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id TEXT NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitter_name TEXT, submitter_email TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.suggestions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.suggestions TO authenticated;
GRANT ALL ON public.suggestions TO service_role;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.page_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL, path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.page_visits TO anon, authenticated;
GRANT SELECT ON public.page_visits TO authenticated;
GRANT ALL ON public.page_visits TO service_role;
ALTER TABLE public.page_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visits insert" ON public.page_visits FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "visits admin read" ON public.page_visits FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "persons read" ON public.persons FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "persons admin all" ON public.persons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "persons self update" ON public.persons FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.person_id = persons.id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.person_id = persons.id));

CREATE POLICY "rel read" ON public.relationships FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "rel admin all" ON public.relationships FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles admin all" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "roles self read" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles admin all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "jr own read" ON public.join_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "jr own insert" ON public.join_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "jr admin update" ON public.join_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "sug read" ON public.suggestions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR auth.uid() = user_id);
CREATE POLICY "sug insert anon" ON public.suggestions FOR INSERT TO anon WITH CHECK (user_id IS NULL);
CREATE POLICY "sug insert auth" ON public.suggestions FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "sug admin update" ON public.suggestions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'visitor') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_persons_updated BEFORE UPDATE ON public.persons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.persons (id, name, gender, birth_date, death_date, biography, family_group) VALUES
('p1','Arthur Hawthorne','male','1920-03-12','1995-08-04','Patriarch of the Hawthorne family. Carpenter and storyteller.','hawthorne'),
('p2','Eleanor Hawthorne','female','1923-07-22','2001-01-15','Matriarch. Schoolteacher for 40 years.','hawthorne'),
('p3','Robert Hawthorne','male','1948-11-02',NULL,'Eldest son. Civil engineer.','hawthorne'),
('p4','Margaret Hawthorne','female','1950-05-19',NULL,'Daughter-in-law. Painter. Born into the Blake family.','blake'),
('p5','Susan Hawthorne','female','1952-09-30',NULL,'Daughter. Doctor.','hawthorne'),
('p6','James Hawthorne','male','1975-02-14',NULL,'Son of Robert and Margaret. Software engineer.','hawthorne'),
('p7','Linda Hawthorne','female','1977-06-08',NULL,'James''s wife. Architect. Born into the Chen family.','chen'),
('p8','Emily Hawthorne','female','1978-10-21',NULL,'Daughter of Robert and Margaret. Journalist.','hawthorne'),
('p9','Oliver Hawthorne','male','2005-04-11',NULL,'Son of James and Linda.','hawthorne'),
('p10','Sophia Hawthorne','female','2008-12-03',NULL,'Daughter of James and Linda.','hawthorne'),
('b1','Henry Blake','male','1898-01-15','1972-04-20','Margaret''s grandfather. Farmer.','blake'),
('b2','Alice Blake','female','1902-09-08','1980-11-30','Margaret''s grandmother.','blake'),
('b3','Thomas Blake','male','1925-06-12','1998-02-14','Margaret''s father. Engineer.','blake'),
('b4','Dorothy Blake','female','1928-03-22','2005-07-18','Margaret''s mother. Librarian.','blake'),
('b5','Peter Blake','male','1953-08-05',NULL,'Margaret''s younger brother.','blake'),
('c1','Wei Chen','male','1920-11-03','1995-05-09','Linda''s grandfather. Merchant.','chen'),
('c2','Mei Chen','female','1924-02-18','2002-10-22','Linda''s grandmother.','chen'),
('c3','David Chen','male','1950-04-27',NULL,'Linda''s father. Professor.','chen'),
('c4','Helen Chen','female','1952-12-11',NULL,'Linda''s mother. Pianist.','chen'),
('c5','Grace Chen','female','1980-05-14',NULL,'Linda''s younger sister.','chen');

INSERT INTO public.relationships (id, person1_id, person2_id, type) VALUES
('r1','p1','p2','spouse'),('r2','p1','p3','parent'),('r3','p2','p3','parent'),
('r4','p1','p5','parent'),('r5','p2','p5','parent'),('r6','p3','p4','spouse'),
('r7','p3','p6','parent'),('r8','p4','p6','parent'),('r9','p3','p8','parent'),
('r10','p4','p8','parent'),('r11','p6','p7','spouse'),('r12','p6','p9','parent'),
('r13','p7','p9','parent'),('r14','p6','p10','parent'),('r15','p7','p10','parent'),
('rb1','b1','b2','spouse'),('rb2','b1','b3','parent'),('rb3','b2','b3','parent'),
('rb4','b3','b4','spouse'),('rb5','b3','p4','parent'),('rb6','b4','p4','parent'),
('rb7','b3','b5','parent'),('rb8','b4','b5','parent'),
('rc1','c1','c2','spouse'),('rc2','c1','c3','parent'),('rc3','c2','c3','parent'),
('rc4','c3','c4','spouse'),('rc5','c3','p7','parent'),('rc6','c4','p7','parent'),
('rc7','c3','c5','parent'),('rc8','c4','c5','parent');

-- Set the existing account as admin with the requested password
UPDATE auth.users
SET encrypted_password = crypt('Adrash@2372&#tar4', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE id = '9b1ca215-d673-4ae1-9777-2c73e6a63c83';

INSERT INTO public.profiles (id, display_name, email)
VALUES ('9b1ca215-d673-4ae1-9777-2c73e6a63c83', 'Adrash', 'adrashtariyal124@gmail.com')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, email = EXCLUDED.email;

INSERT INTO public.user_roles (user_id, role)
VALUES ('9b1ca215-d673-4ae1-9777-2c73e6a63c83', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
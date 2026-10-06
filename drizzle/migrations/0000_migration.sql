CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  class_name text NOT NULL DEFAULT '',
  code text NOT NULL UNIQUE,
  description text,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','ativa','encerrada','arquivada')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'prova' CHECK (type IN ('prova','atividade','questionario','diagnostico')),
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','disponivel','encerrada')),
  time_limit int,
  passing_score numeric NOT NULL DEFAULT 6,
  attempt_limit int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  type text NOT NULL CHECK (type IN ('unica','multipla','vf','curta','longa','escala')),
  prompt text NOT NULL,
  points numeric NOT NULL DEFAULT 1,
  options jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE TABLE public.answer_keys (
  question_id uuid PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
  correct jsonb
);
CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name text NOT NULL,
  class_name text NOT NULL,
  entry_date date NOT NULL DEFAULT current_date,
  entered_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  status text NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento','concluida')),
  score numeric,
  max_score numeric,
  needs_review boolean NOT NULL DEFAULT false
);
CREATE TABLE public.answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer jsonb,
  is_correct boolean,
  score_awarded numeric,
  UNIQUE (submission_id, question_id)
);
CREATE INDEX ON public.participants(room_id);
CREATE INDEX ON public.submissions(assessment_id);
CREATE INDEX ON public.submissions(participant_id);
CREATE INDEX ON public.questions(assessment_id);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['rooms','assessments','questions','answer_keys','participants','submissions','answers'] LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Demo data
INSERT INTO public.rooms (id,name,class_name,code,description,status) VALUES
 ('11111111-1111-1111-1111-111111111111','Informática — Terça-feira','Informática','INFO26','Turma de informática básica','ativa'),
 ('22222222-2222-2222-2222-222222222222','Excel Avançado','Excel','EXCEL7',NULL,'ativa');

INSERT INTO public.assessments (id,room_id,title,type,status,passing_score,attempt_limit) VALUES
 ('aaaaaaa1-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Prova de Excel','prova','disponivel',6,1),
 ('aaaaaaa1-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Pesquisa sobre as próximas aulas','questionario','disponivel',0,1),
 ('aaaaaaa1-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Prova de Word','prova','encerrada',6,1);

INSERT INTO public.questions (id,assessment_id,position,type,prompt,points,options) VALUES
 ('bbbbbbb1-0000-0000-0000-000000000001','aaaaaaa1-0000-0000-0000-000000000001',1,'unica','Qual função soma um intervalo de células?',2,'[{"id":"a","text":"=MEDIA()"},{"id":"b","text":"=SOMA()"},{"id":"c","text":"=CONT.NUM()"},{"id":"d","text":"=MAXIMO()"}]'),
 ('bbbbbbb1-0000-0000-0000-000000000002','aaaaaaa1-0000-0000-0000-000000000001',2,'vf','O símbolo $ fixa uma referência de célula.',2,'[{"id":"v","text":"Verdadeiro"},{"id":"f","text":"Falso"}]'),
 ('bbbbbbb1-0000-0000-0000-000000000003','aaaaaaa1-0000-0000-0000-000000000001',3,'multipla','Quais destes são tipos de gráfico do Excel?',3,'[{"id":"a","text":"Pizza"},{"id":"b","text":"Colunas"},{"id":"c","text":"Parágrafo"},{"id":"d","text":"Linhas"}]'),
 ('bbbbbbb1-0000-0000-0000-000000000004','aaaaaaa1-0000-0000-0000-000000000001',4,'longa','Explique para que serve a função PROCV.',3,'[]'),
 ('bbbbbbb1-0000-0000-0000-000000000011','aaaaaaa1-0000-0000-0000-000000000002',1,'multipla','Quais conteúdos você gostaria de aprender?',0,'[{"id":"a","text":"Excel avançado"},{"id":"b","text":"Inteligência Artificial"},{"id":"c","text":"Hardware"},{"id":"d","text":"Programação"},{"id":"e","text":"Edição"},{"id":"f","text":"Outro"}]'),
 ('bbbbbbb1-0000-0000-0000-000000000012','aaaaaaa1-0000-0000-0000-000000000002',2,'unica','Qual tipo de aula você prefere?',0,'[{"id":"a","text":"Aula prática"},{"id":"b","text":"Exercícios"},{"id":"c","text":"Projetos"},{"id":"d","text":"Jogos"},{"id":"e","text":"Desafios"}]'),
 ('bbbbbbb1-0000-0000-0000-000000000013','aaaaaaa1-0000-0000-0000-000000000002',3,'curta','Quais conteúdos você possui maior dificuldade?',0,'[]'),
 ('bbbbbbb1-0000-0000-0000-000000000014','aaaaaaa1-0000-0000-0000-000000000002',4,'longa','O que gostaria de aprender nas próximas aulas?',0,'[]'),
 ('bbbbbbb1-0000-0000-0000-000000000015','aaaaaaa1-0000-0000-0000-000000000002',5,'escala','De 1 a 5, como você avalia as aulas?',0,'[]'),
 ('bbbbbbb1-0000-0000-0000-000000000021','aaaaaaa1-0000-0000-0000-000000000003',1,'unica','Qual atalho deixa o texto em negrito?',10,'[{"id":"a","text":"Ctrl+N"},{"id":"b","text":"Ctrl+I"},{"id":"c","text":"Ctrl+S"}]');

INSERT INTO public.answer_keys (question_id,correct) VALUES
 ('bbbbbbb1-0000-0000-0000-000000000001','"b"'),
 ('bbbbbbb1-0000-0000-0000-000000000002','"v"'),
 ('bbbbbbb1-0000-0000-0000-000000000003','["a","b","d"]'),
 ('bbbbbbb1-0000-0000-0000-000000000021','"a"');

INSERT INTO public.participants (id,room_id,name,class_name) VALUES
 ('ccccccc1-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Maria Silva','Informática'),
 ('ccccccc1-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Carlos Souza','Informática'),
 ('ccccccc1-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Ana Pereira','Informática');

INSERT INTO public.submissions (id,assessment_id,participant_id,started_at,submitted_at,status,score,max_score,needs_review) VALUES
 ('ddddddd1-0000-0000-0000-000000000001','aaaaaaa1-0000-0000-0000-000000000001','ccccccc1-0000-0000-0000-000000000001',now()-interval '30 min',now()-interval '10 min','concluida',7,10,false),
 ('ddddddd1-0000-0000-0000-000000000002','aaaaaaa1-0000-0000-0000-000000000001','ccccccc1-0000-0000-0000-000000000002',now()-interval '25 min',now()-interval '5 min','concluida',4,10,false),
 ('ddddddd1-0000-0000-0000-000000000003','aaaaaaa1-0000-0000-0000-000000000002','ccccccc1-0000-0000-0000-000000000001',now()-interval '9 min',now()-interval '4 min','concluida',NULL,NULL,false),
 ('ddddddd1-0000-0000-0000-000000000004','aaaaaaa1-0000-0000-0000-000000000002','ccccccc1-0000-0000-0000-000000000003',now()-interval '8 min',now()-interval '2 min','concluida',NULL,NULL,false);

INSERT INTO public.answers (submission_id,question_id,answer,is_correct,score_awarded) VALUES
 ('ddddddd1-0000-0000-0000-000000000001','bbbbbbb1-0000-0000-0000-000000000001','"b"',true,2),
 ('ddddddd1-0000-0000-0000-000000000001','bbbbbbb1-0000-0000-0000-000000000002','"v"',true,2),
 ('ddddddd1-0000-0000-0000-000000000001','bbbbbbb1-0000-0000-0000-000000000003','["a","b"]',false,0),
 ('ddddddd1-0000-0000-0000-000000000001','bbbbbbb1-0000-0000-0000-000000000004','"Busca valores em uma tabela pela primeira coluna."',true,3),
 ('ddddddd1-0000-0000-0000-000000000002','bbbbbbb1-0000-0000-0000-000000000001','"a"',false,0),
 ('ddddddd1-0000-0000-0000-000000000002','bbbbbbb1-0000-0000-0000-000000000002','"v"',true,2),
 ('ddddddd1-0000-0000-0000-000000000002','bbbbbbb1-0000-0000-0000-000000000003','["c"]',false,0),
 ('ddddddd1-0000-0000-0000-000000000002','bbbbbbb1-0000-0000-0000-000000000004','"Procura coisas."',true,2),
 ('ddddddd1-0000-0000-0000-000000000003','bbbbbbb1-0000-0000-0000-000000000011','["a","b"]',NULL,NULL),
 ('ddddddd1-0000-0000-0000-000000000003','bbbbbbb1-0000-0000-0000-000000000012','"a"',NULL,NULL),
 ('ddddddd1-0000-0000-0000-000000000003','bbbbbbb1-0000-0000-0000-000000000013','"Fórmulas"',NULL,NULL),
 ('ddddddd1-0000-0000-0000-000000000003','bbbbbbb1-0000-0000-0000-000000000014','"Inteligência artificial aplicada ao trabalho"',NULL,NULL),
 ('ddddddd1-0000-0000-0000-000000000003','bbbbbbb1-0000-0000-0000-000000000015','5',NULL,NULL),
 ('ddddddd1-0000-0000-0000-000000000004','bbbbbbb1-0000-0000-0000-000000000011','["b","d"]',NULL,NULL),
 ('ddddddd1-0000-0000-0000-000000000004','bbbbbbb1-0000-0000-0000-000000000012','"c"',NULL,NULL),
 ('ddddddd1-0000-0000-0000-000000000004','bbbbbbb1-0000-0000-0000-000000000013','"Hardware"',NULL,NULL),
 ('ddddddd1-0000-0000-0000-000000000004','bbbbbbb1-0000-0000-0000-000000000014','"Montar um computador"',NULL,NULL),
 ('ddddddd1-0000-0000-0000-000000000004','bbbbbbb1-0000-0000-0000-000000000015','4',NULL,NULL);
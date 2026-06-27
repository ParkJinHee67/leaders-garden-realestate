-- 1. agencies 테이블에 사이트 설정을 위한 컬럼 추가
ALTER TABLE public.agencies
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS notification_phone TEXT,
ADD COLUMN IF NOT EXISTS registration_number TEXT,
ADD COLUMN IF NOT EXISTS naver_map_client_id TEXT,
ADD COLUMN IF NOT EXISTS emailjs_service_id TEXT,
ADD COLUMN IF NOT EXISTS emailjs_template_id TEXT,
ADD COLUMN IF NOT EXISTS emailjs_public_key TEXT,
ADD COLUMN IF NOT EXISTS hero_image_url TEXT,
ADD COLUMN IF NOT EXISTS ceo_image_url TEXT,
ADD COLUMN IF NOT EXISTS map_lat NUMERIC,
ADD COLUMN IF NOT EXISTS map_lng NUMERIC,
ADD COLUMN IF NOT EXISTS slogan_main TEXT,
ADD COLUMN IF NOT EXISTS slogan_sub TEXT;

-- 2. 기존 데이터에 기본값 업데이트 (아이디가 11111111-1111-1111-1111-111111111111 인 경우)
UPDATE public.agencies
SET 
  email = 'jhpa670211@gmail.com',
  notification_phone = '010-4630-0363',
  registration_number = '123-45-67890',
  naver_map_client_id = 'l53p21oofv', -- 소장님이 입력하셨던 기존 키 임시 보존
  emailjs_service_id = 'service_kqmnpww',
  emailjs_template_id = 'template_lyallw5',
  emailjs_public_key = 'ft57CB2BWlgkPtVI_',
  hero_image_url = '/사무실_사진.jpeg',
  ceo_image_url = '/유현휘소장_사진.png',
  map_lat = 37.82819175,
  map_lng = 127.07626965,
  slogan_main = '고객의 꿈을 찾아드리는\n리더스가든 부동산',
  slogan_sub = '최고의 매물, 정직한 중개로 보답하겠습니다.'
WHERE id = '11111111-1111-1111-1111-111111111111';

-- 3. 사이트 이미지 업로드를 위한 site-assets 스토리지 버킷 생성
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 누구나 이미지 조회 가능 정책
CREATE POLICY "Public Access for Site Assets"
ON storage.objects FOR SELECT
USING ( bucket_id = 'site-assets' );

-- 누구나 이미지 업로드 가능 정책 (임시)
CREATE POLICY "Public Upload for Site Assets"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'site-assets' );

-- 이미지 수정(Update) 권한 추가
CREATE POLICY "Public Update for Site Assets"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'site-assets' );

-- 1. 'property-images' 스토리지 버킷(저장소) 생성 (Public 허용)
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. 누구나 이미지를 조회(Select)할 수 있도록 허용
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'property-images' );

-- 3. 누구나 이미지를 업로드(Insert)할 수 있도록 임시 허용
-- (현재는 프론트엔드에서 admin1234로 간단 로그인하므로 모두에게 업로드 권한을 임시로 엽니다)
CREATE POLICY "Public Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'property-images' );

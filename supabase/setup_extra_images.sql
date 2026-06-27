-- properties_v2 테이블에 추가 사진 배열 컬럼 추가
ALTER TABLE public.properties_v2
ADD COLUMN IF NOT EXISTS extra_images TEXT[] DEFAULT '{}';

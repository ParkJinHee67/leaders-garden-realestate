-- agencies 테이블에 영업시간 및 공지사항 컬럼 추가
ALTER TABLE public.agencies
ADD COLUMN IF NOT EXISTS hours_weekday TEXT,
ADD COLUMN IF NOT EXISTS hours_saturday TEXT,
ADD COLUMN IF NOT EXISTS hours_sunday TEXT,
ADD COLUMN IF NOT EXISTS hours_holiday TEXT,
ADD COLUMN IF NOT EXISTS notice_text TEXT;

-- 기존 데이터에 기본 영업시간 업데이트
UPDATE public.agencies
SET 
  hours_weekday = '09:00 ~ 19:00',
  hours_saturday = '09:00 ~ 17:00',
  hours_sunday = '휴무 (사전 예약 시 상담 가능)',
  hours_holiday = '휴무 (사전 예약 시 상담 가능)',
  notice_text = ''
WHERE id = '11111111-1111-1111-1111-111111111111';

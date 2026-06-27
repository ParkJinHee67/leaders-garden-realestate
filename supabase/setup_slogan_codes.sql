-- 먼저 code_groups 테이블에 그룹을 추가합니다.
INSERT INTO public.code_groups (id, name, description) VALUES
('SLOGAN_MAIN', '메인 슬로건 예시', '홈페이지 대문 메인 슬로건 템플릿'),
('SLOGAN_SUB', '서브 슬로건 예시', '홈페이지 대문 서브 슬로건 템플릿')
ON CONFLICT DO NOTHING;

-- 메인 슬로건 예시 데이터 삽입
INSERT INTO public.common_codes (group_id, code_value, code_name, sort_order) VALUES
('SLOGAN_MAIN', 'MAIN1', '고객의 꿈을 찾아드리는\n리더스가든 부동산', 1),
('SLOGAN_MAIN', 'MAIN2', '정직과 신뢰로 보답하는\n안심 중개 파트너', 2),
('SLOGAN_MAIN', 'MAIN3', '당신의 소중한 자산,\n안전하게 지켜드립니다', 3)
ON CONFLICT DO NOTHING;

-- 서브 슬로건 예시 데이터 삽입
INSERT INTO public.common_codes (group_id, code_value, code_name, sort_order) VALUES
('SLOGAN_SUB', 'SUB1', '최고의 매물, 정직한 중개로 보답하겠습니다.', 1),
('SLOGAN_SUB', 'SUB2', '10년의 노하우, 철저한 권리분석으로 안전한 거래를 약속합니다.', 2),
('SLOGAN_SUB', 'SUB3', '고객님의 조건에 딱 맞는 맞춤형 매물을 찾아드립니다.', 3)
ON CONFLICT DO NOTHING;

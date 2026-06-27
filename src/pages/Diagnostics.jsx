import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import emailjs from '@emailjs/browser';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LocationMap from '../components/LocationMap';
import { NavermapsProvider } from 'react-naver-maps';

export default function Diagnostics() {
  // 진단 상태
  const [networkOk, setNetworkOk] = useState(null);
  const [envChecks, setEnvChecks] = useState({});
  const [supabaseClientOk, setSupabaseClientOk] = useState(null);
  const [dbTables, setDbTables] = useState({
    agencies: { ok: null, count: 0, error: null },
    properties_v2: { ok: null, count: 0, error: null },
    common_codes: { ok: null, count: 0, error: null },
    consultations: { ok: null, count: 0, error: null },
    complexes: { ok: null, count: 0, error: null }
  });
  const [naverMapsOk, setNaverMapsOk] = useState(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');

  // 환경변수 오버라이드 상태 (localStorage)
  const [overrides, setOverrides] = useState({
    SUPABASE_URL: localStorage.getItem('OVERRIDE_SUPABASE_URL') || '',
    SUPABASE_ANON_KEY: localStorage.getItem('OVERRIDE_SUPABASE_ANON_KEY') || '',
    NAVER_MAPS_CLIENT_ID: localStorage.getItem('OVERRIDE_NAVER_MAPS_CLIENT_ID') || '',
    EMAILJS_SERVICE_ID: localStorage.getItem('OVERRIDE_EMAILJS_SERVICE_ID') || '',
    EMAILJS_TEMPLATE_ID: localStorage.getItem('OVERRIDE_EMAILJS_TEMPLATE_ID') || '',
    EMAILJS_PUBLIC_KEY: localStorage.getItem('OVERRIDE_EMAILJS_PUBLIC_KEY') || ''
  });

  // 이메일 테스트 발송 상태
  const [testEmail, setTestEmail] = useState('jhpa670211@gmail.com');
  const [emailSending, setEmailSending] = useState(false);
  const [emailLogs, setEmailLogs] = useState([]);

  // SMS 테스트 발송 상태
  const [testPhone, setTestPhone] = useState('01050360846');
  const [smsSending, setSmsSending] = useState(false);
  const [smsLogs, setSmsLogs] = useState([]);
  
  // 복사 피드백
  const [copyFeedback, setCopyFeedback] = useState(null);

  // 환경변수 값 읽기 (오버라이드 우선)
  const getEnvValue = (key, envVal) => {
    return overrides[key] || envVal;
  };

  const currentSupabaseUrl = getEnvValue('SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL);
  const currentSupabaseAnonKey = getEnvValue('SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY);
  const currentNaverClientId = getEnvValue('NAVER_MAPS_CLIENT_ID', import.meta.env.VITE_NAVER_MAPS_CLIENT_ID);
  const currentEmailjsServiceId = getEnvValue('EMAILJS_SERVICE_ID', import.meta.env.VITE_EMAILJS_SERVICE_ID);
  const currentEmailjsTemplateId = getEnvValue('EMAILJS_TEMPLATE_ID', import.meta.env.VITE_EMAILJS_TEMPLATE_ID);
  const currentEmailjsPublicKey = getEnvValue('EMAILJS_PUBLIC_KEY', import.meta.env.VITE_EMAILJS_PUBLIC_KEY);

  // 복사 핸들러
  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  // 환경변수 저장 및 초기화
  const handleSaveOverrides = (e) => {
    e.preventDefault();
    Object.entries(overrides).forEach(([key, val]) => {
      if (val.trim()) {
        localStorage.setItem(`OVERRIDE_${key}`, val.trim());
      } else {
        localStorage.removeItem(`OVERRIDE_${key}`);
      }
    });
    alert('임시 환경 변수가 저장되었습니다. 설정을 적용하기 위해 페이지가 새로고침됩니다.');
    window.location.reload();
  };

  const handleResetOverrides = () => {
    Object.keys(overrides).forEach((key) => {
      localStorage.removeItem(`OVERRIDE_${key}`);
    });
    setOverrides({
      SUPABASE_URL: '',
      SUPABASE_ANON_KEY: '',
      NAVER_MAPS_CLIENT_ID: '',
      EMAILJS_SERVICE_ID: '',
      EMAILJS_TEMPLATE_ID: '',
      EMAILJS_PUBLIC_KEY: ''
    });
    alert('모든 임시 환경 변수가 초기화되었습니다. 기본 설정으로 다시 진단합니다.');
    window.location.reload();
  };

  // 진단 메인 함수
  const runDiagnostics = async () => {
    setDiagnosing(true);
    
    // 1. 네트워크 연결 상태 체크
    setNetworkOk(navigator.onLine);

    // 2. 환경변수 체크
    const checks = {
      VITE_SUPABASE_URL: !!currentSupabaseUrl,
      VITE_SUPABASE_ANON_KEY: !!currentSupabaseAnonKey,
      VITE_NAVER_MAPS_CLIENT_ID: !!currentNaverClientId,
      VITE_EMAILJS_SERVICE_ID: !!currentEmailjsServiceId,
      VITE_EMAILJS_TEMPLATE_ID: !!currentEmailjsTemplateId,
      VITE_EMAILJS_PUBLIC_KEY: !!currentEmailjsPublicKey
    };
    setEnvChecks(checks);

    // 3. Supabase 클라이언트 체크
    setSupabaseClientOk(!!supabase);

    // 4. Supabase DB 각 테이블 개별 연결 체크
    if (supabase) {
      const tables = ['agencies', 'properties_v2', 'common_codes', 'consultations', 'complexes'];
      const updatedDbTables = { ...dbTables };

      for (const table of tables) {
        try {
          const { error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .limit(1);
          
          if (error) {
            updatedDbTables[table] = { ok: false, count: 0, error: error.message };
          } else {
            // Count 조회 가능 여부 확인
            const { count: realCount } = await supabase.from(table).select('*', { count: 'exact', head: true });
            updatedDbTables[table] = { ok: true, count: realCount || 0, error: null };
          }
        } catch (err) {
          updatedDbTables[table] = { ok: false, count: 0, error: err.message || JSON.stringify(err) };
        }
      }
      setDbTables(updatedDbTables);
    } else {
      const clearedDb = {};
      Object.keys(dbTables).forEach(k => {
        clearedDb[k] = { ok: false, count: 0, error: 'Supabase 클라이언트가 초기화되지 않았습니다.' };
      });
      setDbTables(clearedDb);
    }

    // 5. 네이버 지도 스크립트 상태 체크
    setNaverMapsOk(typeof window !== 'undefined' && !!window.naver);

    setDiagnosing(false);
  };

  useEffect(() => {
    runDiagnostics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 이메일 테스트 발송 핸들러
  const handleTestEmail = async (e) => {
    e.preventDefault();
    if (!testEmail.trim()) return;

    setEmailSending(true);
    setEmailLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 테스트 이메일 발송 요청 중...`]);

    try {
      if (!currentEmailjsServiceId || !currentEmailjsTemplateId || !currentEmailjsPublicKey) {
        throw new Error('EmailJS 연결 변수(Service ID, Template ID, Public Key) 중 누락된 항목이 있습니다.');
      }

      const res = await emailjs.send(
        currentEmailjsServiceId,
        currentEmailjsTemplateId,
        {
          to_email: testEmail.trim(),
          customer_name: '시스템 자가 진단',
          customer_phone: '010-0000-0000',
          consult_type: '테스트 메일',
          message: '이 메일은 리더스가든 부동산 홈페이지 시스템 자가진단 화면에서 발송된 테스트 이메일입니다.'
        },
        currentEmailjsPublicKey
      );

      setEmailLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] 발송 성공! 응답코드: ${res.status} (${res.text})`
      ]);
    } catch (err) {
      setEmailLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] 발송 실패: ${err.message || JSON.stringify(err)}`
      ]);
    } finally {
      setEmailSending(false);
    }
  };

  // SMS 테스트 발송 핸들러
  const handleTestSms = async (e) => {
    e.preventDefault();
    if (!testPhone.trim()) return;

    setSmsSending(true);
    setSmsLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Supabase Edge Function 'send-reply-sms' 호출 요청 중...`]);

    try {
      if (!supabase) {
        throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.');
      }

      const testMsg = `[리더가든부동산의 답변입니다.]\n시스템 자가진단 화면에서 발송된 테스트 알림 문자입니다.`;

      const { data, error } = await supabase.functions.invoke('send-reply-sms', {
        body: { phone: testPhone.trim(), fullMessage: testMsg }
      });

      if (error) {
        let errorMsg = error.message;
        if (error.context) {
          try {
            const responseData = await error.context.clone().json();
            if (responseData && responseData.error) {
              errorMsg = responseData.error;
            }
          } catch {
            try {
              const responseText = await error.context.clone().text();
              if (responseText) errorMsg = responseText;
            } catch (textErr) {
              console.error("에러 본문 읽기 실패:", textErr);
            }
          }
        }
        throw new Error(errorMsg);
      }

      setSmsLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] 발송 성공! 문자 수신처: ${testPhone.trim()}`,
        `[${new Date().toLocaleTimeString()}] 서버 응답: ${JSON.stringify(data)}`
      ]);
    } catch (err) {
      setSmsLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] 발송 실패: ${err.message}`
      ]);
    } finally {
      setSmsSending(false);
    }
  };

  // SQL 코드 조각
  const sqlSnippets = {
    agencies: `CREATE TABLE public.agencies (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  ceo_name text not null,
  phone text,
  address text,
  email text,
  notification_phone text,
  registration_number text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- agencies 확장 설정 컬럼 추가
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
ADD COLUMN IF NOT EXISTS slogan_sub TEXT,
ADD COLUMN IF NOT EXISTS hours_weekday TEXT,
ADD COLUMN IF NOT EXISTS hours_saturday TEXT,
ADD COLUMN IF NOT EXISTS hours_sunday TEXT,
ADD COLUMN IF NOT EXISTS hours_holiday TEXT,
ADD COLUMN IF NOT EXISTS notice_text TEXT;

-- RLS 활성화 및 임시 정책 추가
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read/write" ON public.agencies USING (true) WITH CHECK (true);

-- 기초 데이터 삽입 (반드시 ID 고정 필요)
INSERT INTO public.agencies (
  id, name, ceo_name, phone, address, email, notification_phone, registration_number,
  naver_map_client_id, emailjs_service_id, emailjs_template_id, emailjs_public_key,
  hero_image_url, ceo_image_url, map_lat, map_lng, slogan_main, slogan_sub,
  hours_weekday, hours_saturday, hours_sunday, hours_holiday, notice_text
) VALUES (
  '11111111-1111-1111-1111-111111111111', 
  '리더스가든 부동산', '유현휘', '010-4630-0363', '경기도 양주시 회천로 234', 'jhpa670211@gmail.com', '010-4630-0363', '123-45-67890',
  'l53p21oofv', 'service_kqmnpww', 'template_lyallw5', 'ft57CB2BWlgkPtVI_',
  '/사무실_사진.jpeg', '/유현휘소장_사진.png', 37.82819175, 127.07626965,
  '고객의 꿈을 찾아드리는\\n리더스가든 부동산', '최고의 매물, 정직한 중개로 보답하겠습니다.',
  '09:00 ~ 19:00', '09:00 ~ 17:00', '휴무 (사전 예약 시 상담 가능)', '휴무 (사전 예약 시 상담 가능)',
  ''
) ON CONFLICT (id) DO NOTHING;`,

    properties_v2: `CREATE TABLE public.properties_v2 (
  id bigint generated by default as identity primary key,
  agency_id uuid references public.agencies(id),
  complex_id bigint references public.complexes(id) on delete set null,
  title text not null,
  address text not null,
  property_type_code text not null,
  transaction_type_code text not null,
  price_main bigint not null,
  price_monthly bigint default 0,
  description text not null,
  size text not null,
  rooms integer not null,
  baths integer not null,
  "isRecommended" boolean default false,
  "isUrgent" boolean default false,
  image text not null,
  asil_id text,
  naver_id text,
  status text default '광고중',
  verification_type text,
  registration_period text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS 활성화 및 임시 정책 추가
ALTER TABLE public.properties_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read/write" ON public.properties_v2 USING (true) WITH CHECK (true);`,

    complexes: `CREATE TABLE public.complexes (
  id bigint generated by default as identity primary key,
  complex_name text not null unique,
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS 활성화 및 임시 정책 추가
ALTER TABLE public.complexes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read/write for complexes" ON public.complexes USING (true) WITH CHECK (true);

-- properties_v2 테이블에 외래키 및 검증방식(verification_type), 등록기간(registration_period) 컬럼 추가
ALTER TABLE public.properties_v2 
ADD COLUMN IF NOT EXISTS complex_id bigint REFERENCES public.complexes(id) ON DELETE SET NULL;
ALTER TABLE public.properties_v2 
ADD COLUMN IF NOT EXISTS verification_type text;
ALTER TABLE public.properties_v2 
ADD COLUMN IF NOT EXISTS registration_period text;`,

    common_codes: `CREATE TABLE public.code_groups (
  id text primary key,
  name text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE public.common_codes (
  id uuid default gen_random_uuid() primary key,
  group_id text references public.code_groups(id) on delete cascade,
  code_value text not null,
  code_name text not null,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  UNIQUE(group_id, code_value)
);

-- RLS 활성화 및 임시 정책 추가
ALTER TABLE public.code_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.common_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read/write" ON public.code_groups USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write" ON public.common_codes USING (true) WITH CHECK (true);

-- 기준 데이터 삽입
INSERT INTO public.code_groups (id, name) VALUES 
('PROPERTY_TYPE', '매물 종류'),
('TRANSACTION_TYPE', '거래 방식')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.common_codes (group_id, code_value, code_name, sort_order) VALUES 
('PROPERTY_TYPE', 'APT', '아파트', 1),
('PROPERTY_TYPE', 'VILLA', '연립/다세대', 2),
('PROPERTY_TYPE', 'COMMERCIAL', '상가/사무실', 3),
('PROPERTY_TYPE', 'OFFICETEL', '오피스텔', 4),
('PROPERTY_TYPE', 'ONE_ROOM', '원룸/투룸', 5),
('TRANSACTION_TYPE', 'SALE', '매매', 1),
('TRANSACTION_TYPE', 'JEONSE', '전세', 2),
('TRANSACTION_TYPE', 'MONTHLY', '월세', 3),
('TRANSACTION_TYPE', 'SHORT_TERM', '단기임대', 4)
ON CONFLICT (group_id, code_value) DO NOTHING;`,

    consultations: `CREATE TABLE public.consultations (
  id bigint generated by default as identity primary key,
  name text not null,
  phone text not null,
  type text not null,
  content text not null,
  status text default '대기중' not null,
  reply text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS 활성화 및 임시 정책 추가
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read/write for consultations" ON public.consultations USING (true) WITH CHECK (true);`,

    storage: `-- 이미지 업로드를 위한 site-assets 버킷 생성 SQL
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 누구나 조회 가능 권한 부여
CREATE POLICY "Public Access for Site Assets" ON storage.objects FOR SELECT USING ( bucket_id = 'site-assets' );

-- 누구나 업로드 권한 부여
CREATE POLICY "Public Insert for Site Assets" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'site-assets' );

-- 누구나 수정 권한 부여
CREATE POLICY "Public Update for Site Assets" ON storage.objects FOR UPDATE USING ( bucket_id = 'site-assets' );`
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-800">
      <Header />

      <main className="flex-grow container mx-auto px-4 py-12 max-w-6xl">
        {/* 상단 소개 헤더 */}
        <div className="mb-10 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-200 pb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-brand-green tracking-tight mb-2">💻 시스템 상태 진단 및 자가 해결 도구</h1>
            <p className="text-gray-500 font-medium">홈페이지 구동에 필요한 데이터베이스, 지도, 이메일, 네트워크 설정을 종합적으로 점검합니다.</p>
          </div>
          <div>
            <button
              onClick={runDiagnostics}
              disabled={diagnosing}
              className="bg-brand-green text-white font-bold px-6 py-3 rounded-xl shadow-md hover:bg-emerald-900 transition flex items-center gap-2"
            >
              {diagnosing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  진단 중...
                </>
              ) : (
                <>🔄 시스템 재진단</>
              )}
            </button>
          </div>
        </div>

        {/* 탭 구조 */}
        <div className="flex border-b border-gray-200 mb-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-6 py-3 font-bold text-sm border-b-2 whitespace-nowrap transition ${
              activeTab === 'summary' ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            📋 종합 진단 결과
          </button>
          <button
            onClick={() => setActiveTab('overrides')}
            className={`px-6 py-3 font-bold text-sm border-b-2 whitespace-nowrap transition ${
              activeTab === 'overrides' ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            ⚙️ 임시 환경 변수 설정
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`px-6 py-3 font-bold text-sm border-b-2 whitespace-nowrap transition ${
              activeTab === 'sql' ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            🛠️ Supabase SQL 도구
          </button>
          <button
            onClick={() => setActiveTab('interactive')}
            className={`px-6 py-3 font-bold text-sm border-b-2 whitespace-nowrap transition ${
              activeTab === 'interactive' ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            🎯 지도 및 이메일 테스트
          </button>
        </div>

        {/* 탭 내용 */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            {/* 1. 네트워크 및 Supabase 클라이언트 개요 */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex items-start gap-4">
                <div className={`p-3.5 rounded-2xl ${networkOk ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {networkOk ? (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  ) : (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-3.536m0 0l-2.829-2.829m11.314 0a5 5 0 000-7.072m0 0l-2.829 2.829m-4.243-2.829a4.978 4.978 0 00-1.414 3.536" /></svg>
                  )}
                </div>
                <div className="flex-grow">
                  <h3 className="font-bold text-lg text-gray-900 mb-1">인터넷 연결 상태</h3>
                  <p className="text-gray-500 text-sm mb-2">웹 브라우저의 온라인/오프라인 네트워크 상태입니다.</p>
                  <div className="flex items-center justify-between gap-4 mt-3">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${networkOk ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {networkOk ? '🟢 온라인 상태' : '🔴 오프라인 상태'}
                    </span>
                    <button 
                      onClick={() => window.location.reload()} 
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-200 transition"
                    >
                      🔄 새로고침
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex items-start gap-4">
                <div className={`p-3.5 rounded-2xl ${supabaseClientOk ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                </div>
                <div className="flex-grow">
                  <h3 className="font-bold text-lg text-gray-900 mb-1">Supabase 연결 인스턴스</h3>
                  <p className="text-gray-500 text-sm mb-2">Supabase 클라이언트 연동 규격 정상 초기화 상태입니다.</p>
                  <div className="flex items-center justify-between gap-4 mt-3">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${supabaseClientOk ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {supabaseClientOk ? '🟢 연동 성공' : '🔴 설정 누락 (초기화 실패)'}
                    </span>
                    <button 
                      onClick={() => setActiveTab('overrides')} 
                      className="bg-brand-green/10 hover:bg-brand-green/20 text-brand-green text-xs font-bold px-3 py-1.5 rounded-lg transition"
                    >
                      ⚙️ 오버라이드 설정
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. 환경 변수 체크 상태 */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-gray-100 pb-4">
                <div>
                  <h3 className="font-black text-lg text-gray-900 mb-1 flex items-center gap-2">🔑 필수 및 연동 환경 변수 현황</h3>
                  <p className="text-xs text-gray-500">프로젝트 빌드 시 필요한 환경변수의 로드 상태입니다.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const envTemplateText = `# Supabase 설정
VITE_SUPABASE_URL=${currentSupabaseUrl || ''}
VITE_SUPABASE_ANON_KEY=${currentSupabaseAnonKey || ''}

# 네이버 지도 설정
VITE_NAVER_MAPS_CLIENT_ID=${currentNaverClientId || ''}

# EmailJS 설정
VITE_EMAILJS_SERVICE_ID=${currentEmailjsServiceId || ''}
VITE_EMAILJS_TEMPLATE_ID=${currentEmailjsTemplateId || ''}
VITE_EMAILJS_PUBLIC_KEY=${currentEmailjsPublicKey || ''}
`;
                      handleCopy(envTemplateText, 'envText');
                    }}
                    className={`text-xs font-bold px-4 py-2.5 rounded-xl border transition ${
                      copyFeedback === 'envText'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300 shadow-sm'
                    }`}
                  >
                    {copyFeedback === 'envText' ? '✅ 복사 완료!' : '📋 .env 파일 내용 복사'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(envChecks).map(([key, ok]) => (
                  <div key={key} className={`p-4 rounded-2xl border flex items-center justify-between ${ok ? 'bg-emerald-50/50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                    <span className="font-mono text-xs font-bold text-gray-700">{key}</span>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {ok ? '설정됨' : '미설정'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-150 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="text-xs text-gray-600 leading-relaxed">
                  💡 <strong>환경변수 해결 방안:</strong><br />
                  1. 상단 <strong>[임시 환경 변수 설정]</strong> 탭에서 키값을 임시 입력해 즉석 작동 검증을 수행할 수 있습니다.<br />
                  2. 검증 완료 후, 우측 상단 <strong>[.env 파일 내용 복사]</strong> 버튼을 클릭하여 본인의 <code>.env</code> 파일에 그대로 덮어쓰고 저장하면 영구 적용됩니다.
                </div>
                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  <a href="https://console.ncloud.com" target="_blank" rel="noreferrer" className="bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold px-3 py-2 rounded-lg border border-gray-300 text-center transition">
                    🌐 네이버 클라우드 콘솔
                  </a>
                  <a href="https://dashboard.emailjs.com" target="_blank" rel="noreferrer" className="bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold px-3 py-2 rounded-lg border border-gray-300 text-center transition">
                    ✉️ EmailJS 대시보드
                  </a>
                </div>
              </div>
            </div>

            {/* 3. 데이터베이스 테이블 상태 */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
              <h3 className="font-black text-lg text-gray-900 mb-4">🗄️ Supabase 데이터베이스 테이블 헬스 체크</h3>
              <div className="space-y-4">
                {Object.entries(dbTables).map(([table, result]) => {
                  let statusColor = 'border-gray-200 bg-gray-50';
                  let badge = '⏳ 진단 대기';
                  if (result.ok === true) {
                    statusColor = 'border-emerald-200 bg-emerald-50/30';
                    badge = `🟢 연결 성공 (${result.count}개 데이터)`;
                  } else if (result.ok === false) {
                    statusColor = 'border-rose-200 bg-rose-50/50';
                    badge = '🔴 연결 실패 (테이블 없음)';
                  }

                  return (
                    <div key={table} className={`p-5 rounded-2xl border ${statusColor} transition`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-base text-gray-800">{table}</span>
                        </div>
                        <span className="text-xs font-black">{badge}</span>
                      </div>
                      
                      {result.ok === false && (
                        <div className="mt-3">
                          <p className="text-xs text-rose-600 font-semibold mb-2">오류 내용: {result.error}</p>
                          <div className="bg-white p-4 rounded-xl border border-rose-100 flex flex-col md:flex-row items-center justify-between gap-4">
                            <span className="text-xs text-gray-600">이 테이블이 생성되어 있지 않습니다. 아래 해결 버튼을 눌러 스크립트를 생성하고 실행하세요.</span>
                            <button
                              onClick={() => {
                                setActiveTab('sql');
                              }}
                              className="bg-brand-orange text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-orange-700 transition shrink-0"
                            >
                              🛠️ SQL 생성 스크립트 복사하러 가기
                            </button>
                          </div>
                        </div>
                      )}

                      {result.ok === true && table === 'agencies' && result.count === 0 && (
                        <div className="mt-3 bg-amber-50 p-4 rounded-xl border border-amber-200 flex flex-col md:flex-row items-center justify-between gap-4">
                          <span className="text-xs text-amber-800 font-medium">테이블은 존재하나, 중개소 기초 설정(Seed) 데이터가 비어 있습니다. 메인 화면이 정상적으로 표시되지 않습니다.</span>
                          <button
                            onClick={() => setActiveTab('sql')}
                            className="bg-brand-orange text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-orange-700 transition shrink-0"
                          >
                            🌱 Seed SQL 복사하기
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. 네이버 지도 스크립트 상태 */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex items-start gap-4">
              <div className={`p-3.5 rounded-2xl ${naverMapsOk ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
              </div>
              <div className="flex-grow">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <h3 className="font-bold text-lg text-gray-900">네이버 지도 API 연동 상태</h3>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${naverMapsOk ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {naverMapsOk ? '🟢 스크립트 로드됨' : '🔴 미로드'}
                  </span>
                </div>
                <p className="text-gray-500 text-sm mb-4 leading-relaxed">
                  네이버 맵 스크립트 객체가 브라우저에 마운트되었는지 검증합니다. 실제 클라이언트 ID가 맞지 않는 경우, 지도는 렌더링되나 화면에 "인증 오류" 경고창이 발생할 수 있습니다.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab('interactive')}
                    className="bg-brand-green text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-emerald-800 transition"
                  >
                    🗺️ 실제 지도 화면 테스트 해보기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'overrides' && (
          <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
            <div className="border-b border-gray-100 pb-4 mb-6">
              <h3 className="font-black text-xl text-gray-900 mb-2">⚙️ 브라우저 임시 환경 변수 설정 (Local Storage Override)</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                로컬 컴퓨터 환경변수 파일(`.env`)을 변경하기 곤란하거나 테스트용으로 다른 DB/API 키를 적용해 보고자 할 때 사용합니다. 
                이곳에 설정된 값은 브라우저 쿠키(로컬 스토리지)에 보관되어 실제 프로젝트 설정보다 **우선적으로 참조**됩니다.
              </p>
            </div>

            <form onSubmit={handleSaveOverrides} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-gray-600 mb-2 tracking-wide">VITE_SUPABASE_URL</label>
                  <input
                    type="url"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none font-mono text-sm"
                    value={overrides.SUPABASE_URL}
                    onChange={(e) => setOverrides({ ...overrides, SUPABASE_URL: e.target.value })}
                    placeholder="https://your-project.supabase.co"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-600 mb-2 tracking-wide">VITE_SUPABASE_ANON_KEY</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none font-mono text-sm"
                    value={overrides.SUPABASE_ANON_KEY}
                    onChange={(e) => setOverrides({ ...overrides, SUPABASE_ANON_KEY: e.target.value })}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVC..."
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-gray-600 mb-2 tracking-wide">VITE_NAVER_MAPS_CLIENT_ID</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none font-mono text-sm"
                    value={overrides.NAVER_MAPS_CLIENT_ID}
                    onChange={(e) => setOverrides({ ...overrides, NAVER_MAPS_CLIENT_ID: e.target.value })}
                    placeholder="네이버 클라우드 발급 클라이언트 ID"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-600 mb-2 tracking-wide">VITE_EMAILJS_SERVICE_ID</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none font-mono text-sm"
                    value={overrides.EMAILJS_SERVICE_ID}
                    onChange={(e) => setOverrides({ ...overrides, EMAILJS_SERVICE_ID: e.target.value })}
                    placeholder="service_xxxxx"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-gray-600 mb-2 tracking-wide">VITE_EMAILJS_TEMPLATE_ID</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none font-mono text-sm"
                    value={overrides.EMAILJS_TEMPLATE_ID}
                    onChange={(e) => setOverrides({ ...overrides, EMAILJS_TEMPLATE_ID: e.target.value })}
                    placeholder="template_xxxxx"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-600 mb-2 tracking-wide">VITE_EMAILJS_PUBLIC_KEY</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none font-mono text-sm"
                    value={overrides.EMAILJS_PUBLIC_KEY}
                    onChange={(e) => setOverrides({ ...overrides, EMAILJS_PUBLIC_KEY: e.target.value })}
                    placeholder="인증 Public Key"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-4 border-t border-gray-100 pt-6 mt-8">
                <button
                  type="button"
                  onClick={handleResetOverrides}
                  className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition"
                >
                  🧹 오버라이드 삭제 (초기화)
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 rounded-xl bg-brand-orange text-white font-bold hover:bg-orange-700 shadow-md transition"
                >
                  💾 설정 저장 및 새로고침
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'sql' && (
          <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
            <div className="border-b border-gray-100 pb-4 mb-6">
              <h3 className="font-black text-xl text-gray-900 mb-2">🛠️ Supabase SQL 테이블 생성기</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Supabase에 테이블이 존재하지 않거나 데이터가 누락된 경우, 아래 해당하는 스크립트를 복사하여 Supabase 대시보드의 **[SQL Editor]** 메뉴에 붙여넣고 실행(Run)하세요.
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              {Object.keys(sqlSnippets).map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    const el = document.getElementById(`sql-content-${key}`);
                    el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="p-4 rounded-xl border border-gray-200 font-bold text-sm text-gray-700 hover:bg-brand-green/5 hover:border-brand-green text-left transition"
                >
                  📝 {key === 'storage' ? 'storage (스토리지 버킷)' : `${key} 테이블`}
                </button>
              ))}
            </div>

            <div className="mt-8 space-y-12">
              {Object.entries(sqlSnippets).map(([key, code]) => (
                <div key={key} id={`sql-content-${key}`} className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-gray-50 px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                    <span className="font-black text-sm text-brand-green font-mono">📁 {key.toUpperCase()} SQL Script</span>
                    <button
                      onClick={() => handleCopy(code, key)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                        copyFeedback === key
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-white hover:bg-gray-100 text-gray-600 border-gray-300'
                      }`}
                    >
                      {copyFeedback === key ? '✅ 복사 완료!' : '📋 SQL 코드 복사'}
                    </button>
                  </div>
                  <div className="p-4 bg-gray-900 overflow-x-auto max-h-[300px]">
                    <pre className="text-xs text-green-400 font-mono leading-relaxed">{code}</pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'interactive' && (
          <div className="space-y-8">
            {/* 1. 네이버 지도 실시간 렌더링 검증 */}
            <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
              <div className="border-b border-gray-100 pb-4 mb-6">
                <h3 className="font-black text-xl text-gray-900 mb-2">🗺️ 네이버 지도 API 렌더링 확인</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-4">
                  현재 사용되는 Client ID: <span className="font-mono text-xs font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-700">{currentNaverClientId || '미입력'}</span>
                </p>
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-xs text-amber-800 leading-relaxed">
                  ⚠️ <strong>지도가 흐리게 보이거나 "등록되지 않은 웹 사이트 주소입니다"라는 인증 오류가 나타날 경우:</strong><br />
                  1. <a href="https://console.ncloud.com" target="_blank" rel="noreferrer" className="underline font-bold">네이버 클라우드 플랫폼 콘솔</a>에 로그인합니다.<br />
                  2. <strong>AI-Application Service &gt; AI·NAVER API &gt; Application</strong> 메뉴로 이동합니다.<br />
                  3. 해당 어플리케이션을 선택하고 <strong>[변경]</strong>을 클릭한 후, 웹 서비스 URL에 <code>http://localhost:5173</code>(로컬 환경) 및 실제 배포한 홈페이지 주소(예: <code>https://your-domain.com</code>)를 등록해 주세요.
                </div>
              </div>

              <div className="h-[400px] rounded-2xl overflow-hidden border border-gray-200">
                <NavermapsProvider key={currentNaverClientId || 'no-key'} ncpKeyId={currentNaverClientId} submodules={['geocoder']}>
                  <LocationMap />
                </NavermapsProvider>
              </div>
            </div>

            {/* 2. EmailJS API 전송 실시간 테스트 */}
            <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
              <div className="border-b border-gray-100 pb-4 mb-6">
                <h3 className="font-black text-xl text-gray-900 mb-2">📧 EmailJS 실시간 메일 전송 테스트</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  상담 신청 완료 시 소장님께 알림 메일이 정상적으로 수신되는지 확인합니다. 아래 이메일 주소를 입력한 후 [테스트 메일 전송] 버튼을 클릭해 로그를 확인하세요.
                </p>
              </div>

              <form onSubmit={handleTestEmail} className="flex flex-col md:flex-row items-end gap-4 max-w-2xl mb-6">
                <div className="flex-grow">
                  <label className="block text-xs font-bold text-gray-600 mb-2">테스트 수신 이메일 주소</label>
                  <input
                    type="email"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={emailSending}
                  className="bg-brand-orange text-white font-bold px-8 py-3 rounded-xl hover:bg-orange-700 transition disabled:opacity-50 shrink-0"
                >
                  {emailSending ? '전송 중...' : '📨 테스트 메일 전송'}
                </button>
              </form>

              <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-gray-800 px-5 py-3 text-xs font-black text-gray-400 font-mono">
                  📟 EmailJS API Operation Logs
                </div>
                <div className="p-5 font-mono text-xs text-green-400 min-h-[150px] max-h-[300px] overflow-y-auto space-y-1.5 leading-relaxed">
                  {emailLogs.length === 0 ? (
                    <span className="text-gray-500">// 테스트 발송을 진행하면 상세 상태 로그가 이곳에 출력됩니다.</span>
                  ) : (
                    emailLogs.map((log, idx) => <div key={idx}>{log}</div>)
                  )}
                </div>
              </div>
            </div>

            {/* 3. 솔라피 SMS API 전송 실시간 테스트 */}
            <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm mt-8">
              <div className="border-b border-gray-100 pb-4 mb-6">
                <h3 className="font-black text-xl text-gray-900 mb-2">💬 솔라피(Solapi) 알림 문자 발송 테스트</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-4">
                  상담 답변 등록 시 고객에게 전송되는 알림 문자 발송 기능이 정상 작동하는지 테스트합니다. 
                  이 기능은 Supabase Edge Function(<code>send-reply-sms</code>)과 솔라피 API를 연동하여 동작합니다.
                </p>
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-xs text-amber-800 leading-relaxed">
                  ⚠️ <strong>문자 발송이 실패하는 대표적인 원인:</strong><br />
                  1. <strong>Supabase Secrets 설정 누락</strong>: Supabase 대시보드 (Edge Functions &gt; Secrets)에 <code>SOLAPI_API_KEY</code>, <code>SOLAPI_API_SECRET</code>, <code>SOLAPI_SENDER_NUMBER</code> 3가지 비밀키가 올바르게 등록되어 있어야 합니다.<br />
                  2. <strong>발신번호 미등록</strong>: <code>SOLAPI_SENDER_NUMBER</code>로 지정한 번호가 솔라피 사이트에 실제로 본인인증 후 등록되어 있어야 합니다. (하이픈 없이 숫자만 입력해야 합니다.)<br />
                  3. <strong>솔라피 잔액/포인트 부족</strong>: 솔라피 계정에 문자 전송을 위한 충전금(포인트)이 남아있어야 전송됩니다.
                </div>
              </div>

              <form onSubmit={handleTestSms} className="flex flex-col md:flex-row items-end gap-4 max-w-2xl mb-6">
                <div className="flex-grow">
                  <label className="block text-xs font-bold text-gray-600 mb-2">테스트 수신 핸드폰 번호 (하이픈 없이 숫자만)</label>
                  <input
                    type="tel"
                    required
                    placeholder="01012345678"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value.replace(/[^0-9]/g, ''))}
                  />
                </div>
                <button
                  type="submit"
                  disabled={smsSending}
                  className="bg-brand-green text-white font-bold px-8 py-3 rounded-xl hover:bg-emerald-950 transition disabled:opacity-50 shrink-0"
                >
                  {smsSending ? '전송 중...' : '💬 테스트 문자 발송'}
                </button>
              </form>

              <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-gray-800 px-5 py-3 text-xs font-black text-gray-400 font-mono">
                  📟 Solapi Edge Function Test Logs
                </div>
                <div className="p-5 font-mono text-xs text-green-400 min-h-[150px] max-h-[300px] overflow-y-auto space-y-1.5 leading-relaxed">
                  {smsLogs.length === 0 ? (
                    <span className="text-gray-500">// 테스트 발송을 진행하면 상세 상태 로그가 이곳에 출력됩니다.</span>
                  ) : (
                    smsLogs.map((log, idx) => <div key={idx}>{log}</div>)
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

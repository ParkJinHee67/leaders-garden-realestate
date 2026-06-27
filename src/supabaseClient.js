import { createClient } from '@supabase/supabase-js';

// localStorage 오버라이드 값을 우선 참조 (진단 및 테스트용)
const getEnvOrStorage = (key, envVal) => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(`OVERRIDE_${key}`) || envVal;
  }
  return envVal;
};

const supabaseUrl = getEnvOrStorage('SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = getEnvOrStorage('SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY);

// 환경변수 또는 오버라이드가 제대로 설정되지 않았을 때 앱이 터지지 않도록 예외 처리
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!supabase) {
  console.warn("Supabase 환경 변수 또는 오버라이드가 설정되지 않았습니다. .env 파일이나 진단 페이지를 확인해 주세요.");
}

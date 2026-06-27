/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wjpsbpznowqoqnokoeye.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const mockProperties = [
  {
    agency_id: '11111111-1111-1111-1111-111111111111',
    title: "리더스가든 부동산 강력 추천 매물",
    address: "경기도 양주시 옥정동로",
    property_type_code: "APT",
    transaction_type_code: "SALE",
    price_main: 52000,
    price_monthly: 0,
    description: "남향, 올수리 완료, 즉시입주 가능",
    size: "84㎡",
    rooms: 3,
    baths: 2,
    isRecommended: true,
    isUrgent: false,
    image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80"
  },
  {
    agency_id: '11111111-1111-1111-1111-111111111111',
    title: "옥정신도시 초역세권 상가",
    address: "경기도 양주시 옥정동",
    property_type_code: "COMMERCIAL",
    transaction_type_code: "MONTHLY",
    price_main: 5000,
    price_monthly: 300,
    description: "유동인구 최다, 권리금 없음",
    size: "50㎡",
    rooms: 1,
    baths: 1,
    isRecommended: false,
    isUrgent: true,
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80"
  },
  {
    agency_id: '11111111-1111-1111-1111-111111111111',
    title: "신축 풀옵션 원룸",
    address: "경기도 양주시 옥정로",
    property_type_code: "ONE_ROOM",
    transaction_type_code: "JEONSE",
    price_main: 12000,
    price_monthly: 0,
    description: "엘리베이터 있음, 주차 가능, 조용한 주택가",
    size: "25㎡",
    rooms: 1,
    baths: 1,
    isRecommended: true,
    isUrgent: true,
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80"
  },
  {
    agency_id: '11111111-1111-1111-1111-111111111111',
    title: "전망 좋은 고층 아파트",
    address: "경기도 양주시 옥정동로",
    property_type_code: "APT",
    transaction_type_code: "SALE",
    price_main: 65000,
    price_monthly: 0,
    description: "호수공원 뷰, 로얄층, 관리 상태 최상",
    size: "105㎡",
    rooms: 4,
    baths: 2,
    isRecommended: false,
    isUrgent: false,
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80"
  },
  {
    agency_id: '11111111-1111-1111-1111-111111111111',
    title: "투자용 다가구 주택",
    address: "경기도 양주시 덕정동",
    property_type_code: "VILLA",
    transaction_type_code: "SALE",
    price_main: 80000,
    price_monthly: 0,
    description: "수익률 6%, 만실, 리모델링 완료",
    size: "300㎡",
    rooms: 8,
    baths: 8,
    isRecommended: true,
    isUrgent: false,
    image: "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?auto=format&fit=crop&w=800&q=80"
  },
  {
    agency_id: '11111111-1111-1111-1111-111111111111',
    title: "채광 좋은 남향 투룸",
    address: "경기도 양주시 옥정동",
    property_type_code: "ONE_ROOM",
    transaction_type_code: "MONTHLY",
    price_main: 2000,
    price_monthly: 80,
    description: "신혼부부 추천, 풀옵션, 애완동물 협의",
    size: "45㎡",
    rooms: 2,
    baths: 1,
    isRecommended: false,
    isUrgent: true,
    image: "https://images.unsplash.com/photo-1502672260266-1c1de2d9d0cb?auto=format&fit=crop&w=800&q=80"
  }
];

async function seed() {
  const { data, error } = await supabase.from('properties_v2').insert(mockProperties).select();
  if (error) {
    console.error("Error inserting data:", error);
  } else {
    console.log("Data successfully inserted!");
    console.log(data);
  }
}

seed();

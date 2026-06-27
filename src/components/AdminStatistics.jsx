import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const formatPrice = (valueInTenThousand) => {
  if (!valueInTenThousand) return '0원';
  const eok = Math.floor(valueInTenThousand / 10000);
  const remainder = valueInTenThousand % 10000;
  
  let result = '';
  if (eok > 0) result += `${eok}억`;
  if (remainder > 0) {
    if (eok > 0) result += ' ';
    result += `${remainder.toLocaleString()}만`;
  }
  return result + '원';
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100">
        <p className="font-bold text-gray-800 mb-2">{label}</p>
        <p className="text-brand-orange text-sm">전체 상담: <span className="font-bold">{payload[0].value}건</span></p>
        <p className="text-brand-green text-sm">거래 성사: <span className="font-bold">{payload[1].value}건</span></p>
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-gray-500 text-xs">전환율: {payload[0].value > 0 ? Math.round((payload[1].value / payload[0].value) * 100) : 0}%</p>
        </div>
      </div>
    );
  }
  return null;
};

export default function AdminStatistics({ consultations, onUpdateType, properties = [] }) {
  const [period, setPeriod] = useState('monthly'); // 'daily', 'weekly', 'monthly'

  // 날짜 그룹화 및 통계 계산 로직
  const statsData = useMemo(() => {
    const grouped = {};

    consultations.forEach(item => {
      const dateObj = new Date(item.created_at);
      let key = '';

      if (period === 'daily') {
        key = dateObj.toLocaleDateString();
      } else if (period === 'monthly') {
        key = `${dateObj.getFullYear()}년 ${dateObj.getMonth() + 1}월`;
      } else if (period === 'weekly') {
        // 간단한 주별 계산 (월요일 기준)
        const day = dateObj.getDay();
        const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(dateObj.setDate(diff));
        key = `${monday.getMonth() + 1}/${monday.getDate()} 주차`;
      }

      if (!grouped[key]) {
        grouped[key] = { 
          period: key, 
          total: 0, 
          success: 0, 
          type_sale: 0, 
          type_rent: 0, 
          type_monthly: 0, 
          type_etc: 0,
          dateObj: dateObj // 정렬용
        };
      }

      grouped[key].total += 1;
      if (item.status === '거래완료') grouped[key].success += 1;
      
      if (item.type === '매매') grouped[key].type_sale += 1;
      else if (item.type === '전세') grouped[key].type_rent += 1;
      else if (item.type === '월세') grouped[key].type_monthly += 1;
      else grouped[key].type_etc += 1;
    });

    // 배열로 변환 및 시간순 정렬 (오래된 순 -> 최근 순)
    return Object.values(grouped).sort((a, b) => a.dateObj - b.dateObj);
  }, [consultations, period]);

  // 매물 관련 통계 계산
  const propertyStats = useMemo(() => {
    let active = 0;
    let completed = 0;
    
    let saleActive = 0;
    let saleCompleted = 0;
    let jeonseActive = 0;
    let jeonseCompleted = 0;
    let monthlyActive = 0;
    let monthlyCompleted = 0;
    
    let saleVolume = 0; // 매매 완료 총액 (만원)
    let jeonseVolume = 0; // 전세 완료 총액 (만원)
    
    properties.forEach(item => {
      const isCompleted = item.status === '거래완료';
      if (isCompleted) {
        completed++;
        if (item.transaction_type_code === 'SALE') {
          saleCompleted++;
          saleVolume += Number(item.price_main) || 0;
        } else if (item.transaction_type_code === 'JEONSE') {
          jeonseCompleted++;
          jeonseVolume += Number(item.price_main) || 0;
        } else if (item.transaction_type_code === 'MONTHLY') {
          monthlyCompleted++;
        }
      } else {
        active++;
        if (item.transaction_type_code === 'SALE') saleActive++;
        else if (item.transaction_type_code === 'JEONSE') jeonseActive++;
        else if (item.transaction_type_code === 'MONTHLY') monthlyActive++;
      }
    });

    return {
      active,
      completed,
      total: active + completed,
      saleActive,
      saleCompleted,
      jeonseActive,
      jeonseCompleted,
      monthlyActive,
      monthlyCompleted,
      saleVolume,
      jeonseVolume
    };
  }, [properties]);



  return (
    <div className="space-y-8">
      {/* 🏡 매물 및 중개 실적 현황 (KPI Cards) */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">🏡 중개 매물 및 실적 통계</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-150">
            <p className="text-gray-500 text-sm font-bold">보유 매물 총량</p>
            <p className="text-3xl font-black text-gray-900 mt-2">{propertyStats.total}건</p>
            <div className="mt-2 text-xs text-gray-400">누적 등록 완료 매물</div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-150">
            <p className="text-emerald-600 text-sm font-bold">현재 광고중 매물</p>
            <p className="text-3xl font-black text-emerald-600 mt-2">{propertyStats.active}건</p>
            <div className="mt-2 text-xs text-gray-400">홈페이지 및 지도 노출 중</div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-150">
            <p className="text-gray-600 text-sm font-bold">상황 종료 (거래 완료)</p>
            <p className="text-3xl font-black text-gray-700 mt-2">{propertyStats.completed}건</p>
            <div className="mt-2 text-xs text-gray-400">아실 동기화로 내린 매물</div>
          </div>
          <div className="bg-gradient-to-br from-brand-orange to-amber-500 p-6 rounded-2xl shadow-md text-white border-0">
            <p className="text-orange-100 text-sm font-bold">누적 매매 완료액</p>
            <p className="text-2xl font-black mt-2 truncate">{formatPrice(propertyStats.saleVolume)}</p>
            <div className="mt-2 text-xs text-orange-200">성공 계약 성사 매출액</div>
          </div>
        </div>

        {/* 거래방식별 디테일 브레이크다운 */}
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4">📊 거래 방식별 계약 상황</h3>
            <div className="space-y-3.5">
              <div className="flex justify-between items-center text-sm border-b pb-2 border-gray-50">
                <span className="font-medium text-gray-600">매매 매물</span>
                <span className="font-bold text-gray-800">광고중 {propertyStats.saleActive}건 | 거래완료 <span className="text-brand-orange">{propertyStats.saleCompleted}건</span></span>
              </div>
              <div className="flex justify-between items-center text-sm border-b pb-2 border-gray-50">
                <span className="font-medium text-gray-600">전세 매물</span>
                <span className="font-bold text-gray-800">광고중 {propertyStats.jeonseActive}건 | 거래완료 <span className="text-emerald-700">{propertyStats.jeonseCompleted}건</span></span>
              </div>
              <div className="flex justify-between items-center text-sm pb-1">
                <span className="font-medium text-gray-600">월세 매물</span>
                <span className="font-bold text-gray-800">광고중 {propertyStats.monthlyActive}건 | 거래완료 <span className="text-blue-600">{propertyStats.monthlyCompleted}건</span></span>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-gray-800 mb-2">💸 계약 형태별 성공 부피</h3>
              <p className="text-xs text-gray-400 mb-4">완료 상태로 분류되어 누적된 총 거래 금액 규모입니다.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 font-bold">🏠 매매 총 계약액:</span>
                <span className="font-black text-brand-orange text-base">{formatPrice(propertyStats.saleVolume)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 font-bold">🔑 전세 총 보증금액:</span>
                <span className="font-black text-emerald-700 text-base">{formatPrice(propertyStats.jeonseVolume)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-gray-200 my-8" />

      {/* 필터 버튼 */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">📈 고객 문의 및 상담 유입 추이</h2>
        <div className="flex gap-2">
          {['daily', 'weekly', 'monthly'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition ${period === p ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {p === 'daily' ? '일별' : p === 'weekly' ? '주별' : '월별'}
            </button>
          ))}
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="h-[350px] w-full">
          {statsData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statsData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="total" name="전체 상담" fill="#ff7f50" radius={[4, 4, 0, 0]} barSize={30} />
                <Bar dataKey="success" name="거래 성사" fill="#166534" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400">데이터가 없습니다.</div>
          )}
        </div>
      </div>

      {/* 데이터 테이블 */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">상세 통계표</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500">
                <th className="p-4 font-bold">기간</th>
                <th className="p-4 font-bold text-center">전체 상담</th>
                <th className="p-4 font-bold text-center">매매 / 전세 / 월세 / 기타</th>
                <th className="p-4 font-bold text-center text-brand-green">거래 성사</th>
                <th className="p-4 font-bold text-center text-brand-orange">계약 전환율</th>
              </tr>
            </thead>
            <tbody>
              {statsData.length > 0 ? statsData.map((row, idx) => (
                <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition">
                  <td className="p-4 font-medium text-gray-800">{row.period}</td>
                  <td className="p-4 text-center font-bold">{row.total}건</td>
                  <td className="p-4 text-center text-sm text-gray-600">
                    {row.type_sale} / {row.type_rent} / {row.type_monthly} / {row.type_etc}
                  </td>
                  <td className="p-4 text-center font-bold text-brand-green">{row.success}건</td>
                  <td className="p-4 text-center font-bold text-brand-orange">
                    {row.total > 0 ? Math.round((row.success / row.total) * 100) : 0}%
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-400">조회된 통계 데이터가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 상세 데이터 리스트 (유형 수정용) */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">📋 상세 데이터 원본 리스트 (유형 변경)</h2>
          <p className="text-sm text-gray-500">아래 목록에서 상담 유형을 직접 수정하시면 통계에 즉시 반영됩니다.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-sm text-gray-500 bg-white">
                <th className="p-4 font-bold">작성일</th>
                <th className="p-4 font-bold">고객명</th>
                <th className="p-4 font-bold">연락처</th>
                <th className="p-4 font-bold">진행 상태</th>
                <th className="p-4 font-bold text-brand-orange">상담 유형 (수정 가능)</th>
              </tr>
            </thead>
            <tbody>
              {consultations.length > 0 ? [...consultations].sort((a,b)=> new Date(b.created_at) - new Date(a.created_at)).map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="p-4 text-sm text-gray-600">{new Date(item.created_at).toLocaleString()}</td>
                  <td className="p-4 font-medium text-gray-800">{item.name}</td>
                  <td className="p-4 text-gray-600">{item.phone}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      item.status === '거래완료' ? 'bg-brand-green text-white' :
                      item.status === '답변완료' ? 'bg-gray-200 text-gray-600' : 'bg-gray-800 text-white'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <select 
                       className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-bold text-brand-orange outline-none bg-white focus:ring-2 focus:ring-brand-orange cursor-pointer"
                      value={item.type}
                      onChange={(e) => onUpdateType(item.id, e.target.value)}
                    >
                      <option value="매매">매매</option>
                      <option value="전세">전세</option>
                      <option value="월세">월세</option>
                      <option value="분양">분양/투자</option>
                      <option value="기타">기타</option>
                    </select>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-400">등록된 데이터가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

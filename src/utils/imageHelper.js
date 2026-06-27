export const getComplexName = (text) => {
  if (!text) return '';
  // [아파트] 등 대괄호 안의 태그 제거
  let cleaned = text.replace(/\[.*?\]/g, '').trim();
  // 숫자+동, 숫자+호, 숫자+층 바로 전까지의 한글/영문/숫자/공백 텍스트 추출
  const match = cleaned.match(/^([가-힣A-Za-z0-9\s\-_]+?)(?=\d+\s*동|\d+\s*호|\d+\s*층)/);
  if (match) return match[1].trim();
  
  // 만약 동/호/층이 없다면 공백 기준 첫 단어 또는 전체 텍스트 반환
  return cleaned.split(' ')[0] || cleaned;
};

export const getPropertyImage = (property) => {
  const placeholder = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80';
  
  // 1. 매물 자체에 사용자가 개별 업로드한 커스텀 사진이 있는 경우 이를 우선 사용
  if (property.image && property.image !== placeholder) {
    return property.image;
  }
  
  // 2. 조인된 단지(complexes) 대표 사진이 있는 경우 대체 매핑
  if (property.complexes && property.complexes.image_url) {
    return property.complexes.image_url;
  }
  
  // 3. 매칭되는 대표 사진이 없는 경우 기본 임시 이미지 사용
  return property.image || placeholder;
};

export const cleanTextWithoutHo = (text, verificationType) => {
  if (!text) return '';

  // 검증방식이 Not Null 이거나 (값이 있거나), '모바일'/'신홍보' 등 특정 텍스트가 포함된 경우
  const hasVerification = verificationType && verificationType.trim() !== '';
  if (!hasVerification) return text;

  return text
    .replace(/\s*\d+\s*호?\s*(\([^)]+\))/g, ' $1') // 예: 504(5층) -> (5층)
    .replace(/\s*\d+\s*호(?!\d)/g, '')            // 예: 504호 -> ''
    .replace(/\s*\d+호?\s*$/g, '')                // 예: 1704 -> ''
    .replace(/\s+/g, ' ')
    .trim();
};

export const formatAddressWithoutHo = (addr, verificationType) => {
  if (!addr) return '';
  let cleaned = cleanTextWithoutHo(addr, verificationType);
  
  // 1. 괄호가 맨 뒤에 있으면 제거하고 분석 (예: "1203호 (옥정동)" -> "1203호")
  const parenMatch = cleaned.match(/\s*\([^)]+\)$/);
  if (parenMatch) {
    cleaned = cleaned.substring(0, cleaned.length - parenMatch[0].length).trim();
  }

  // 2. '호'로 끝나는 단어를 지웁니다.
  cleaned = cleaned.replace(/,?\s*\S*?\d+\s*호\s*$/, '').trim();
  
  // 3. 만약 끝에 '동'만 남았는데 쉼표가 남아있다면 제거
  cleaned = cleaned.replace(/,\s*$/, '').trim();

  return cleaned;
};

export const checkRegistrationExpiry = (periodStr) => {
  if (!periodStr || !periodStr.includes('~')) return { isExpired: false, isNearExpiry: false, daysRemaining: null };
  
  try {
    const parts = periodStr.split('~');
    const endDateStr = parts[1].trim(); // e.g. "26.06.24" or "2026.06.24"
    
    // Parse date parts (YY.MM.DD or YYYY.MM.DD)
    const dateParts = endDateStr.split('.');
    if (dateParts.length !== 3) return { isExpired: false, isNearExpiry: false, daysRemaining: null };
    
    let year = parseInt(dateParts[0]);
    if (year < 100) year += 2000; // e.g. 26 -> 2026
    
    const month = parseInt(dateParts[1]) - 1; // 0-indexed
    const day = parseInt(dateParts[2]);
    
    const endDate = new Date(year, month, day, 23, 59, 59);
    const today = new Date();
    
    // Reset time for accurate date difference
    const todayReset = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endDateReset = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    
    const diffTime = endDateReset.getTime() - todayReset.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const isExpired = diffDays < 0;
    const isNearExpiry = diffDays >= 0 && diffDays <= 3;
    
    return { isExpired, isNearExpiry, daysRemaining: diffDays };
  } catch (err) {
    console.error("Error parsing registration period:", err);
    return { isExpired: false, isNearExpiry: false, daysRemaining: null };
  }
};

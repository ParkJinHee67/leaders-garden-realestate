import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import AdminStatistics from '../components/AdminStatistics';
import { supabase } from '../supabaseClient';
import { Lock, CheckCircle, Handshake, BarChart2, List, Home, Trash2, Settings, BookOpen } from 'lucide-react';
import { getComplexName, getPropertyImage, checkRegistrationExpiry } from '../utils/imageHelper';

const QUICK_REPLIES = [
  { 
    label: "방문 유도", 
    text: "문의하신 조건에 맞는 좋은 매물이 몇 가지 있습니다. 편하신 시간에 사무실로 방문해 주시면 상세히 안내해 드리겠습니다.",
    smsText: "조건에 맞는 좋은 매물이 있습니다. 편하신 시간에 사무실 방문을 부탁드립니다."
  },
  { 
    label: "유선 요청", 
    text: "남겨주신 내용 잘 확인했습니다. 조금 더 자세한 조건 파악을 위해 유선으로 연락드리겠습니다.",
    smsText: "문의 내용을 확인했습니다. 자세한 안내를 위해 조만간 전화로 연락드리겠습니다."
  },
  { 
    label: "매물 소진", 
    text: "아쉽게도 문의하신 조건의 매물은 현재 모두 거래가 완료되었습니다. 새로운 매물이 나오면 가장 먼저 연락드리겠습니다.",
    smsText: "문의하신 조건의 매물은 거래가 완료되었습니다. 새 매물이 나오면 바로 안내해 드리겠습니다."
  },
];

const getByteLength = (str) => {
  let b, i, c;
  for(b=i=0; (c=str.charCodeAt(i++)); b+=c>>11?2:c>>7?2:1);
  return b;
};

const generateFullMessage = (name, smsText) => {
  const origin = window.location.origin;
  return `[리더가든부동산의 답변입니다.]\n${smsText || '답변이 등록되었습니다. 아래 링크에서 확인해 주세요.'}\n\n상세 답변 확인:\n${origin}/consult/view`;
};

const generateComplexFileName = (fileExt) => {
  return `complex_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
};

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [consultations, setConsultations] = useState([]);
  const [propertiesList, setPropertiesList] = useState([]);
  const [commonCodes, setCommonCodes] = useState([]);
  const [filterType, setFilterType] = useState('전체');
  const [replyContent, setReplyContent] = useState({});
  const [smsContent, setSmsContent] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('list'); // 'list', 'stats', 'properties', 'codes', 'settings'
  const [editingProperty, setEditingProperty] = useState(null); // 수정 중인 매물
  const [addingPhotoFor, setAddingPhotoFor] = useState(null); // 사진 추가 중인 매물 id
  const [addPhotoFiles, setAddPhotoFiles] = useState([]);

  // 아파트 단지 관련 State
  const [complexesList, setComplexesList] = useState([]);
  const [newComplexName, setNewComplexName] = useState('');
  const [complexImageFile, setComplexImageFile] = useState(null);
  const [isUploadingComplex, setIsUploadingComplex] = useState(false);

  const [siteSettings, setSiteSettings] = useState({
    id: '', name: '', ceo_name: '', phone: '', address: '', email: '', notification_phone: '',
    registration_number: '',
    naver_map_client_id: '', emailjs_service_id: '', emailjs_template_id: '', emailjs_public_key: '',
    slogan_main: '', slogan_sub: '',
    hours_weekday: '', hours_saturday: '', hours_sunday: '', hours_holiday: '', notice_text: '',
    ceo_image_url: '', hero_image_url: ''
  });
  
  const [ceoImageFile, setCeoImageFile] = useState(null);
  const [heroImageFile, setHeroImageFile] = useState(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [newProperty, setNewProperty] = useState({
    title: '', address: '', description: '',
    property_type_code: 'APT', transaction_type_code: 'SALE',
    price_main: '', price_monthly: '',
    size: '', rooms: 1, baths: 1,
    isRecommended: false, isUrgent: false, imageFile: null,
    complex_id: '',
    verification_type: '',
    registration_period: ''
  });

  const [newCode, setNewCode] = useState({ group_id: 'PROPERTY_TYPE', code_value: '', code_name: '', sort_order: 1 });

  // 아실 엑셀(HTML) 가져오기 및 동기화 상태
  const [importing, setImporting] = useState(false);
  const [parsedData, setParsedData] = useState([]);
  const [missingProperties, setMissingProperties] = useState([]);
  const [selectedImportIndices, setSelectedImportIndices] = useState([]);
  const [selectedCompleteIds, setSelectedCompleteIds] = useState([]);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [expiryFilter, setExpiryFilter] = useState('ALL');
  const [showMapGuide, setShowMapGuide] = useState(false);

  const handleAsilImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);

    const parseAndProcess = (text, encodingUsed) => {
      try {
        // 1. 바이너리 엑셀 파일 (.xlsx 등) 탐지
        if (text.startsWith("PK\x03\x04") || file.name.endsWith('.xlsx')) {
          alert('바이너리 엑셀 파일(.xlsx)은 직접 가져올 수 없습니다.\n\n[해결 방법]\n1. 아실에서 다운로드한 원래 파일(.xls)을 별도의 저장 없이 그대로 업로드해 주세요.\n2. 혹은 엑셀 프로그램에서 [다른 이름으로 저장] -> [웹 페이지(*.htm; *.html)]로 저장한 후, 생성된 폴더 내의 "sheet001.htm" 파일을 선택하여 업로드해 주세요.');
          setImporting(false);
          const fileInput = document.getElementById('asil-excel-upload');
          if (fileInput) fileInput.value = '';
          return;
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const rows = Array.from(doc.getElementsByTagName('tr'));
        
        let headerIndex = -1;
        let colIndices = {
          asilId: -1,
          naverId: -1,
          type: -1,
          region: -1,
          address: -1,
          size1: -1,
          size2: -1,
          transaction: -1,
          price: -1,
          memo: -1,
          verificationType: -1,
          registrationPeriod: -1
        };

        for (let i = 0; i < rows.length; i++) {
          const cells = Array.from(rows[i].querySelectorAll('td, th')).map(cell => cell.innerText?.trim() || cell.textContent?.trim() || '');
          const hasAsil = cells.some(c => c.replace(/\s+/g, '').includes('아실매물번호'));
          const hasNaver = cells.some(c => c.replace(/\s+/g, '').includes('네이버매물번호'));
          if (hasAsil || hasNaver) {
            headerIndex = i;
            const findHeader = (term) => cells.findIndex(c => c.replace(/\s+/g, '').includes(term));
            colIndices.asilId = findHeader('아실매물번호');
            colIndices.naverId = findHeader('네이버매물번호');
            colIndices.type = findHeader('매물종류');
            colIndices.region = findHeader('지역명');
            colIndices.address = findHeader('상세주소');
            colIndices.size1 = findHeader('면적1');
            colIndices.size2 = findHeader('면적2');
            colIndices.transaction = findHeader('거래종류');
            colIndices.price = findHeader('매물가');
            colIndices.memo = findHeader('중개사메모');
            colIndices.verificationType = findHeader('검증방식');
            colIndices.registrationPeriod = findHeader('등록기간');
            break;
          }
        }

        if (headerIndex === -1) {
          // 2. 인코딩 문제일 경우 (EUC-KR / CP949 파일) UTF-8로 읽으면 한글이 깨져 헤더가 매칭 안 됨 -> EUC-KR 재시도
          if (encodingUsed === "utf-8") {
            console.log("UTF-8 파싱 실패, EUC-KR 인코딩으로 재시도를 시작합니다.");
            const retryReader = new FileReader();
            retryReader.onload = (retryEvent) => {
              parseAndProcess(retryEvent.target.result, "euc-kr");
            };
            retryReader.readAsText(file, "euc-kr");
            return;
          } else {
            // EUC-KR로도 실패한 경우
            // 3. 엑셀 웹페이지 저장 시 데이터가 없고 프레임셋만 저장된 껍데기 파일인지 검사
            const hasFrameset = text.includes('<frameset') || text.includes('<frame') || text.includes('ExcelWorkbook');
            if (hasFrameset) {
              alert('업로드하신 파일은 실제 데이터가 없는 껍데기 프레임 파일입니다.\n\n[해결 방법]\n해당 파일과 함께 저장된 폴더(예: ' + file.name + '.files) 안으로 들어가서 "sheet001.htm" 파일을 업로드해 주세요.');
            } else {
              alert('아실 매물 목록 엑셀 파일 형식이 아닙니다. 열 헤더("아실매물번호" 등)를 찾을 수 없습니다.\n\n[주의]\n아실에서 다운로드받은 파일 그대로 올리거나, 엑셀에서 [웹 페이지]로 저장한 폴더 안의 [sheet001.htm] 파일을 선택해 주세요.');
            }
            setImporting(false);
            const fileInput = document.getElementById('asil-excel-upload');
            if (fileInput) fileInput.value = '';
            return;
          }
        }

        const newParsed = [];
        const fileAsilIds = new Set();

        for (let i = headerIndex + 1; i < rows.length; i++) {
          const cells = Array.from(rows[i].querySelectorAll('td, th')).map(cell => {
            return (cell.innerText || cell.textContent || '').replace(/\s+/g, ' ').trim();
          });

          const asilId = cells[colIndices.asilId];
          const naverId = cells[colIndices.naverId];
          if (!asilId && !naverId) continue;

          const rawType = cells[colIndices.type] || '';
          const rawRegion = cells[colIndices.region] || '';
          const rawAddress = cells[colIndices.address] || '';
          const rawSize1 = cells[colIndices.size1] || '';
          const rawSize2 = cells[colIndices.size2] || '';
          const rawTransaction = cells[colIndices.transaction] || '';
          const rawPrice = cells[colIndices.price] || '';
          const rawMemo = cells[colIndices.memo] || '';
          const rawVerificationType = colIndices.verificationType !== -1 ? cells[colIndices.verificationType] || '' : '';
          const verification_type = rawVerificationType ? rawVerificationType.trim().charAt(0) : '';
          const rawRegistrationPeriod = colIndices.registrationPeriod !== -1 ? cells[colIndices.registrationPeriod] || '' : '';

          if (asilId) fileAsilIds.add(asilId);

          // 데이터 매핑
          let property_type_code = 'APT';
          if (rawType.includes('오피스텔')) property_type_code = 'OFFICETEL';
          else if (rawType.includes('상가') || rawType.includes('사무실')) property_type_code = 'COMMERCIAL';
          else if (rawType.includes('연립') || rawType.includes('다세대') || rawType.includes('빌라')) property_type_code = 'VILLA';
          else if (rawType.includes('원룸') || rawType.includes('투룸')) property_type_code = 'ONE_ROOM';

          let transaction_type_code = 'SALE';
          if (rawTransaction.includes('전세')) transaction_type_code = 'JEONSE';
          else if (rawTransaction.includes('월세')) transaction_type_code = 'MONTHLY';
          else if (rawTransaction.includes('단기')) transaction_type_code = 'SHORT_TERM';

          let price_main = 0;
          let price_monthly = 0;
          if (rawPrice.includes('/')) {
            const parts = rawPrice.split('/');
            price_main = parseInt(parts[0].replace(/[^0-9]/g, '')) || 0;
            price_monthly = parseInt(parts[1].replace(/[^0-9]/g, '')) || 0;
          } else {
            price_main = parseInt(rawPrice.replace(/[^0-9]/g, '')) || 0;
          }

          let size = rawSize2.replace(/[^\d.]/g, '') || rawSize1.replace(/[^\d.]/g, '');
          if (size) size += '㎡';
          else size = '84㎡';

          // 상세 주소 및 제목에서 호수(예: 504, 1704호, 504(5층))를 완전히 제거
          const cleanRawAddress = rawAddress
            .replace(/\s*\d+\s*호?\s*(\([^)]+\))/g, ' $1')
            .replace(/\s*\d+\s*호(?!\d)/g, '')
            .replace(/\s*\d+호?\s*$/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          let cleanAddress = `경기도 ${rawRegion} ${cleanRawAddress}`.replace(/\s+/g, ' ').trim();
          let cleanTitle = `[${rawType || '매물'}] ${cleanRawAddress} ${rawTransaction || '거래'}`.replace(/\s+/g, ' ').trim();
          let cleanDescription = `${rawMemo ? `[중개사 메모] ${rawMemo}\n\n` : ''}아실 등록 매물입니다. (아실번호: ${asilId || ''}, 네이버번호: ${naverId || ''})\n상세 사항은 문의 바랍니다.`;

          // 중복 및 매칭 상태 검증
          const existing = propertiesList.find(p => p.asil_id === asilId || (naverId && p.naver_id === naverId));
          let matchStatus = '신규'; // '신규', '수정필요', '동일'
          let existingId = null;

          if (existing) {
            existingId = existing.id;
            const isDifferent = 
              existing.title !== cleanTitle || 
              existing.address !== cleanAddress ||
              existing.price_main !== price_main ||
              existing.price_monthly !== price_monthly ||
              existing.property_type_code !== property_type_code ||
              existing.transaction_type_code !== transaction_type_code ||
              existing.verification_type !== verification_type ||
              existing.registration_period !== rawRegistrationPeriod ||
              existing.status === '거래완료';

            matchStatus = isDifferent ? '수정필요' : '동일';
          }

          newParsed.push({
            asil_id: asilId,
            naver_id: naverId,
            title: cleanTitle,
            address: cleanAddress,
            property_type_code,
            transaction_type_code,
            price_main,
            price_monthly,
            size,
            rooms: parseFloat(size) < 60 ? 2 : 3,
            baths: parseFloat(size) < 60 ? 1 : 2,
            description: cleanDescription,
            isRecommended: false,
            isUrgent: false,
            image: existing ? existing.image : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80',
            matchStatus,
            existingId,
            verification_type,
            registration_period: rawRegistrationPeriod
          });
        }

        const missing = propertiesList.filter(p => p.asil_id && !fileAsilIds.has(p.asil_id) && p.status !== '거래완료');

        setParsedData(newParsed);
        setMissingProperties(missing);
        setSelectedImportIndices(newParsed.map((_, index) => index));
        setSelectedCompleteIds(missing.map(p => p.id));
        setShowImportPreview(true);
      } catch (err) {
        console.error(err);
        alert('파일을 분석하는 도중 에러가 발생했습니다. 파일 인코딩 및 형식을 확인해 주세요.');
      } finally {
        setImporting(false);
      }
    };

    const initialReader = new FileReader();
    initialReader.onload = (event) => {
      parseAndProcess(event.target.result, "utf-8");
    };
    initialReader.readAsText(file, "utf-8");
  };

  const handleExecuteAsilImport = async () => {
    if (!supabase) return;
    setIsSyncing(true);

    try {
      let insertCount = 0;
      let updateCount = 0;
      let completeCount = 0;

      // 동적 단지 캐싱 맵 (루프 중 중복 DB 호출 방지용)
      const complexMap = {};
      complexesList.forEach(c => {
        complexMap[c.complex_name] = c.id;
      });

      for (let idx of selectedImportIndices) {
        const item = parsedData[idx];
        
        // 단지명 추출
        const complexName = getComplexName(item.title || item.address);
        let complex_id = null;

        if (complexName) {
          if (complexMap[complexName]) {
            complex_id = complexMap[complexName];
          } else {
            // DB에 단지 추가 후 ID 받아오기 (upsert + select)
            const { data: complexData, error: complexErr } = await supabase
              .from('complexes')
              .upsert([{ complex_name: complexName }], { onConflict: 'complex_name' })
              .select('id')
              .single();

            if (complexErr) {
              console.error("단지 자동 등록 실패:", complexErr);
            } else if (complexData) {
              complex_id = complexData.id;
              complexMap[complexName] = complex_id; // 로컬 맵 캐시 갱신
            }
          }
        }

        const propertyData = {
          agency_id: '11111111-1111-1111-1111-111111111111',
          title: item.title,
          address: item.address,
          property_type_code: item.property_type_code,
          transaction_type_code: item.transaction_type_code,
          price_main: item.price_main,
          price_monthly: item.price_monthly,
          description: item.description,
          size: item.size,
          rooms: item.rooms,
          baths: item.baths,
          isRecommended: item.isRecommended,
          isUrgent: item.isUrgent,
          image: item.image,
          asil_id: item.asil_id,
          naver_id: item.naver_id,
          status: '광고중',
          complex_id: complex_id,
          verification_type: item.verification_type,
          registration_period: item.registration_period
        };

        if (item.matchStatus === '신규') {
          const { error } = await supabase.from('properties_v2').insert([propertyData]);
          if (error) throw error;
          insertCount++;
        } else if (item.matchStatus === '수정필요') {
          const { error } = await supabase.from('properties_v2').update(propertyData).eq('id', item.existingId);
          if (error) throw error;
          updateCount++;
        }
      }

      for (let id of selectedCompleteIds) {
        const { error } = await supabase.from('properties_v2').update({ status: '거래완료' }).eq('id', id);
        if (error) throw error;
        completeCount++;
      }

      alert(`동기화 완료!\n- 신규 등록: ${insertCount}건\n- 기존 수정: ${updateCount}건\n- 거래 완료(광고종료): ${completeCount}건`);
      
      setShowImportPreview(false);
      setParsedData([]);
      setMissingProperties([]);
      
      const fileInput = document.getElementById('asil-excel-upload');
      if (fileInput) fileInput.value = '';

      fetchComplexes();
      fetchProperties();
    } catch (err) {
      console.error(err);
      if (err.code === '42703' || (err.message && err.message.includes('registration_period'))) {
        alert("동기화 실패: 데이터베이스에 'registration_period' (등록기간) 컬럼이 없습니다.\n\n[자가진단] 메뉴에 있는 SQL을 복사하여 Supabase SQL Editor에 실행해 주시면 해결됩니다!");
      } else {
        alert('일괄 동기화 도중 오류가 발생했습니다: ' + err.message);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTogglePropertyStatus = async (id, currentStatus) => {
    try {
      if (!supabase) return;
      const newStatus = currentStatus === '거래완료' ? '광고중' : '거래완료';
      const { error } = await supabase.from('properties_v2').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      alert(`매물 상태가 '${newStatus}' 상태로 변경되었습니다.`);
      fetchProperties();
    } catch (err) {
      console.error(err);
      alert('상태 변경 실패: ' + err.message);
    }
  };

  // 간단한 관리자 비밀번호 처리 (실제 서비스에선 Supabase Auth 사용 권장)
  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'admin1234') {
      setIsAuthenticated(true);
      fetchConsultations();
    } else {
      alert("비밀번호가 틀렸습니다.");
    }
  };

  const fetchConsultations = async () => {
    setLoading(true);
    try {
      if (!supabase) {
        // 로컬 스토리지에서 조회
        const localData = JSON.parse(localStorage.getItem('consultations') || '[]');
        let filtered = localData;
        if (filterType !== '전체') {
          filtered = localData.filter(item => item.type === filterType);
        }
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setConsultations(filtered);
      } else {
        let query = supabase.from('consultations').select('*').order('created_at', { ascending: false });
        
        if (filterType !== '전체') {
          query = query.eq('type', filterType);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        setConsultations(data || []);
      }
    } catch (error) {
      console.error(error);
      alert("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      if (!supabase) return;
      const { data, error } = await supabase.from('properties_v2').select('*, complexes(image_url)').order('created_at', { ascending: false });
      if (error) throw error;
      setPropertiesList(data || []);
    } catch (error) {
      console.error("매물 불러오기 오류:", error);
    }
  };

  const fetchCommonCodes = async () => {
    try {
      if (!supabase) return;
      const { data, error } = await supabase.from('common_codes').select('*').order('sort_order', { ascending: true });
      if (error) throw error;
      setCommonCodes(data || []);
    } catch (error) {
      console.error("공통 코드 불러오기 오류:", error);
    }
  };

  const fetchSiteSettings = async () => {
    try {
      if (!supabase) return;
      // 가장 첫 번째 agency 데이터(현재 단일 부동산 설정용)를 가져옵니다.
      const { data, error } = await supabase.from('agencies').select('*').limit(1).single();
      if (error) throw error;
      if (data) setSiteSettings(data);
    } catch (error) {
      console.error("사이트 설정 불러오기 오류:", error);
    }
  };

  const fetchComplexes = async () => {
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('complexes')
        .select('*')
        .order('complex_name', { ascending: true });
      if (error) throw error;
      setComplexesList(data || []);
    } catch (error) {
      console.error("단지 정보 불러오기 오류:", error);
    }
  };

  const handleCreateComplex = async (e) => {
    e.preventDefault();
    if (!newComplexName.trim()) return alert("단지명을 입력해주세요.");

    setIsUploadingComplex(true);
    try {
      if (!supabase) return alert("데이터베이스 연동이 필요합니다.");
      
      let publicUrl = '';
      if (complexImageFile) {
        const fileExt = complexImageFile.name.split('.').pop();
        const fileName = generateComplexFileName(fileExt);
        
        const { error: uploadError } = await supabase.storage
          .from('property-images')
          .upload(fileName, complexImageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl: url } } = supabase.storage
          .from('property-images')
          .getPublicUrl(fileName);
          
        publicUrl = url;
      }

      // complexes 에 upsert
      const { error } = await supabase
        .from('complexes')
        .upsert([
          { complex_name: newComplexName.trim(), image_url: publicUrl || null }
        ], { onConflict: 'complex_name' });

      if (error) throw error;

      alert("단지 정보가 등록되었습니다.");
      setNewComplexName('');
      setComplexImageFile(null);
      const fileInput = document.getElementById('complex-image-upload');
      if (fileInput) fileInput.value = '';
      
      fetchComplexes();
    } catch (error) {
      console.error(error);
      alert("단지 정보 등록 중 오류가 발생했습니다: " + error.message);
    } finally {
      setIsUploadingComplex(false);
    }
  };

  const handleDeleteComplex = async (id) => {
    if (!window.confirm("정말 이 단지를 삭제하시겠습니까? 연결된 매물들의 단지 정보가 유실될 수 있습니다.")) return;
    try {
      if (!supabase) return;
      const { error } = await supabase.from('complexes').delete().eq('id', id);
      if (error) throw error;
      alert("단지 정보가 삭제되었습니다.");
      fetchComplexes();
    } catch (error) {
      console.error(error);
      alert("단지 삭제 중 오류가 발생했습니다.");
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchConsultations();
      fetchProperties();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchCommonCodes();
      fetchSiteSettings();
      fetchComplexes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, filterType]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      if (!supabase) return;

      let newCeoUrl = siteSettings.ceo_image_url;
      let newHeroUrl = siteSettings.hero_image_url;

      if (ceoImageFile) {
        const fileExt = ceoImageFile.name.split('.').pop();
        const fileName = `ceo_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('site-assets').upload(fileName, ceoImageFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('site-assets').getPublicUrl(fileName);
        newCeoUrl = publicUrl;
      }

      if (heroImageFile) {
        const fileExt = heroImageFile.name.split('.').pop();
        const fileName = `hero_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('site-assets').upload(fileName, heroImageFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('site-assets').getPublicUrl(fileName);
        newHeroUrl = publicUrl;
      }

      const { error } = await supabase.from('agencies').update({
        name: siteSettings.name,
        ceo_name: siteSettings.ceo_name,
        phone: siteSettings.phone,
        address: siteSettings.address,
        email: siteSettings.email,
        notification_phone: siteSettings.notification_phone,
        registration_number: siteSettings.registration_number,
        naver_map_client_id: siteSettings.naver_map_client_id,
        emailjs_service_id: siteSettings.emailjs_service_id,
        emailjs_template_id: siteSettings.emailjs_template_id,
        emailjs_public_key: siteSettings.emailjs_public_key,
        slogan_main: siteSettings.slogan_main,
        slogan_sub: siteSettings.slogan_sub,
        hours_weekday: siteSettings.hours_weekday,
        hours_saturday: siteSettings.hours_saturday,
        hours_sunday: siteSettings.hours_sunday,
        hours_holiday: siteSettings.hours_holiday,
        notice_text: siteSettings.notice_text,
        ceo_image_url: newCeoUrl,
        hero_image_url: newHeroUrl
      }).eq('id', siteSettings.id);
      
      if (error) throw error;
      alert("사이트 환경 설정이 성공적으로 저장되었습니다!");
      
      setSiteSettings({...siteSettings, ceo_image_url: newCeoUrl, hero_image_url: newHeroUrl});
      setCeoImageFile(null);
      setHeroImageFile(null);
    } catch (error) {
      console.error(error);
      alert("설정 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleReply = async (id, phone, name) => {
    const reply = replyContent[id];
    if (!reply) return alert("답변 내용을 입력해주세요.");

    const smsText = smsContent[id] || '답변이 등록되었습니다. 아래 링크에서 확인해 주세요.';
    const fullMessage = generateFullMessage(name, smsText);

    try {
      if (!supabase) {
        // 로컬 스토리지 업데이트
        const localData = JSON.parse(localStorage.getItem('consultations') || '[]');
        const targetIndex = localData.findIndex(item => item.id === id);
        if (targetIndex !== -1) {
          localData[targetIndex] = { ...localData[targetIndex], reply, status: '답변완료' };
          localStorage.setItem('consultations', JSON.stringify(localData));
        }
        console.log("Edge Function Call Mock:", { phone, fullMessage });
      } else {
        const { error } = await supabase
          .from('consultations')
          .update({ reply, status: '답변완료' })
          .eq('id', id);

        if (error) throw error;

        // 문자 발송 Edge Function 호출
        const { error: fnError } = await supabase.functions.invoke('send-reply-sms', {
          body: { phone, fullMessage }
        });

        if (fnError) {
          console.error("문자 발송 실패:", fnError);
          let errorMsg = fnError.message;
          if (fnError.context) {
            try {
              // 복제본을 만들어서 바디를 읽습니다. (이미 읽혔을 가능성 대비)
              const responseData = await fnError.context.clone().json();
              if (responseData && responseData.error) {
                errorMsg = responseData.error;
              }
            } catch {
              try {
                const responseText = await fnError.context.clone().text();
                if (responseText) errorMsg = responseText;
              } catch (textErr) {
                console.error("에러 응답 본문 읽기 실패:", textErr);
              }
            }
          }
          alert(`답변은 등록되었으나 문자 발송에 실패했습니다: ${errorMsg}`);
          setReplyContent({ ...replyContent, [id]: '' });
          setSmsContent({ ...smsContent, [id]: '' });
          fetchConsultations();
          return;
        }
      }

      alert(`${name} 님의 상담에 답변을 등록하고 안내 문자를 발송했습니다.`);
      setReplyContent({ ...replyContent, [id]: '' });
      setSmsContent({ ...smsContent, [id]: '' });
      fetchConsultations();
    } catch (error) {
      console.error(error);
      alert("답변 등록 중 오류가 발생했습니다.");
    }
  };

  const handleTransactionSuccess = async (id) => {
    try {
      if (!supabase) {
        const localData = JSON.parse(localStorage.getItem('consultations') || '[]');
        const targetIndex = localData.findIndex(item => item.id === id);
        if (targetIndex !== -1) {
          localData[targetIndex] = { ...localData[targetIndex], status: '거래완료' };
          localStorage.setItem('consultations', JSON.stringify(localData));
        }
      } else {
        const { error } = await supabase
          .from('consultations')
          .update({ status: '거래완료' })
          .eq('id', id);
        if (error) throw error;
      }
      
      alert(`거래성공(완료)로 저장하였습니다.`);
      fetchConsultations();
    } catch (error) {
      console.error(error);
      alert("처리 중 오류가 발생했습니다.");
    }
  };

  const handleUpdateType = async (id, newType) => {
    try {
      if (!supabase) {
        const localData = JSON.parse(localStorage.getItem('consultations') || '[]');
        const targetIndex = localData.findIndex(item => item.id === id);
        if (targetIndex !== -1) {
          localData[targetIndex] = { ...localData[targetIndex], type: newType };
          localStorage.setItem('consultations', JSON.stringify(localData));
        }
      } else {
        const { error } = await supabase
          .from('consultations')
          .update({ type: newType })
          .eq('id', id);
        if (error) throw error;
      }
      fetchConsultations();
    } catch (error) {
      console.error(error);
      alert("유형 변경 중 오류가 발생했습니다.");
    }
  };

  const handleCreateProperty = async (e) => {
    e.preventDefault();
    if (!newProperty.imageFile) {
      return alert("매물 사진을 첨부해 주세요!");
    }

    try {
      if (!supabase) return alert("데이터베이스(Supabase) 연동이 필요합니다.");
      
      let imageUrl = '';
      
      // 1. Supabase Storage에 파일 업로드
      const file = newProperty.imageFile;
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('property-images')
        .upload(filePath, file);

      if (uploadError) {
        console.error("스토리지 업로드 에러:", uploadError);
        throw new Error("이미지 업로드에 실패했습니다. 버킷(property-images) 설정 및 Public 권한을 확인해주세요.");
      }

      // 2. 업로드된 파일의 Public URL 가져오기
      const { data: publicUrlData } = supabase.storage
        .from('property-images')
        .getPublicUrl(filePath);

      imageUrl = publicUrlData.publicUrl;

      // 3. DB Insert
      const propertyDataToInsert = {
        agency_id: '11111111-1111-1111-1111-111111111111', // Seed로 넣었던 리더스가든 고유 ID
        title: newProperty.title,
        address: newProperty.address,
        property_type_code: newProperty.property_type_code,
        transaction_type_code: newProperty.transaction_type_code,
        price_main: parseInt(newProperty.price_main),
        price_monthly: newProperty.price_monthly ? parseInt(newProperty.price_monthly) : 0,
        description: newProperty.description,
        size: newProperty.size,
        rooms: newProperty.rooms,
        baths: newProperty.baths,
        isRecommended: newProperty.isRecommended,
        isUrgent: newProperty.isUrgent,
        image: imageUrl,
        complex_id: newProperty.complex_id ? parseInt(newProperty.complex_id) : null,
        verification_type: newProperty.verification_type || null,
        registration_period: newProperty.registration_period || null
      };

      const { error } = await supabase.from('properties_v2').insert([propertyDataToInsert]);
      if (error) throw error;
      
      alert("신규 매물이 사진과 함께 성공적으로 등록되었습니다!");
      
      // 폼 초기화
      setNewProperty({
        title: '', address: '', description: '',
        property_type_code: 'APT', transaction_type_code: 'SALE',
        price_main: '', price_monthly: '',
        size: '', rooms: 1, baths: 1,
        isRecommended: false, isUrgent: false, imageFile: null,
        complex_id: '',
        verification_type: '',
        registration_period: ''
      });
      // 브라우저 파일 input 시각적 초기화를 위한 꼼수 (id 부여 권장)
      const fileInput = document.getElementById('property-image-upload');
      if (fileInput) fileInput.value = '';

      fetchProperties();
    } catch (error) {
      console.error(error);
      if (error.code === '42703' || (error.message && error.message.includes('registration_period'))) {
        alert("등록 실패: 데이터베이스에 'registration_period' (등록기간) 컬럼이 없습니다.\n\n[자가진단] 메뉴에 있는 SQL을 복사하여 Supabase SQL Editor에 실행해 주시면 해결됩니다!");
      } else {
        alert(error.message || "매물 등록 중 오류가 발생했습니다.");
      }
    }
  };

  const handleDeleteProperty = async (id) => {
    if(!window.confirm("정말 이 매물을 삭제하시겠습니까?")) return;
    try {
      if (!supabase) return;
      const { error } = await supabase.from('properties_v2').delete().eq('id', id);
      if (error) throw error;
      alert("매물이 삭제되었습니다.");
      fetchProperties();
    } catch (error) {
      console.error(error);
      alert("매물 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleEditProperty = async (e) => {
    e.preventDefault();
    if (!editingProperty) return;
    try {
      if (!supabase) return alert('데이터베이스 연동이 필요합니다.');
      const { error } = await supabase.from('properties_v2').update({
        title: editingProperty.title,
        address: editingProperty.address,
        property_type_code: editingProperty.property_type_code,
        transaction_type_code: editingProperty.transaction_type_code,
        price_main: parseInt(editingProperty.price_main),
        price_monthly: editingProperty.price_monthly ? parseInt(editingProperty.price_monthly) : 0,
        description: editingProperty.description,
        size: editingProperty.size,
        rooms: editingProperty.rooms,
        baths: editingProperty.baths,
        isRecommended: editingProperty.isRecommended,
        isUrgent: editingProperty.isUrgent,
        complex_id: editingProperty.complex_id ? parseInt(editingProperty.complex_id) : null,
        verification_type: editingProperty.verification_type || null,
        registration_period: editingProperty.registration_period || null
      }).eq('id', editingProperty.id);
      if (error) throw error;
      alert('매물 정보가 수정되었습니다!');
      setEditingProperty(null);
      fetchProperties();
    } catch (error) {
      console.error(error);
      if (error.code === '42703' || (error.message && error.message.includes('registration_period'))) {
        alert("수정 실패: 데이터베이스에 'registration_period' (등록기간) 컬럼이 없습니다.\n\n[자가진단] 메뉴에 있는 SQL을 복사하여 Supabase SQL Editor에 실행해 주시면 해결됩니다!");
      } else {
        alert('수정 중 오류가 발생했습니다: ' + error.message);
      }
    }
  };

  const handleAddPhotos = async (propertyId) => {
    if (!addPhotoFiles.length) return alert('사진을 선택해 주세요.');
    try {
      if (!supabase) return;
      // 기존 매물의 extra_images 가져오기
      const { data: existing } = await supabase.from('properties_v2').select('extra_images').eq('id', propertyId).single();
      const currentImages = existing?.extra_images || [];

      const uploaded = [];
      for (const file of addPhotoFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${propertyId}_${Date.now()}_${Math.random().toString(36).substring(2,7)}.${fileExt}`;
        const { error: upErr } = await supabase.storage.from('property-images').upload(fileName, file);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('property-images').getPublicUrl(fileName);
        uploaded.push(publicUrl);
      }

      const { error } = await supabase.from('properties_v2').update({
        extra_images: [...currentImages, ...uploaded]
      }).eq('id', propertyId);
      if (error) throw error;

      alert(`사진 ${uploaded.length}장이 추가되었습니다!`);
      setAddingPhotoFor(null);
      setAddPhotoFiles([]);
      fetchProperties();
    } catch (error) {
      console.error(error);
      alert('사진 추가 중 오류: ' + error.message);
    }
  };

  const handleCreateCode = async (e) => {
    e.preventDefault();
    try {
      if (!supabase) return alert("데이터베이스 연동이 필요합니다.");
      const { error } = await supabase.from('common_codes').insert([newCode]);
      if (error) throw error;
      alert("새로운 기준정보가 등록되었습니다.");
      fetchCommonCodes();
      setNewCode({ ...newCode, code_value: '', code_name: '', sort_order: newCode.sort_order + 1 });
    } catch (error) {
      console.error(error);
      alert("기준정보 등록 중 오류가 발생했습니다. (중복된 코드값일 수 있습니다)");
    }
  };

  const handleDeleteCode = async (id) => {
    if(!window.confirm("이 기준정보를 정말 삭제하시겠습니까? (기존 매물과 연결되어 있을 수 있습니다)")) return;
    try {
      if (!supabase) return;
      const { error } = await supabase.from('common_codes').delete().eq('id', id);
      if (error) throw error;
      alert("기준정보가 삭제되었습니다.");
      fetchCommonCodes();
    } catch (error) {
      console.error(error);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full">
            <div className="flex justify-center mb-6">
              <div className="bg-brand-orange text-white p-4 rounded-full">
                <Lock size={32} />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-center mb-8">관리자 로그인</h1>
            <form onSubmit={handleLogin}>
              <input 
                type="password" placeholder="관리자 비밀번호" required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-orange outline-none mb-4 text-center"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
              <button type="submit" className="w-full bg-brand-green text-white font-bold py-3 rounded-xl hover:bg-green-800 transition">
                로그인
              </button>
            </form>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-12 max-w-5xl">
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4 border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">관리자 대시보드</h1>
            <div className="flex gap-2">
              <button 
                onClick={() => setActiveTab('list')}
                className={`px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition ${activeTab === 'list' ? 'bg-brand-orange text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                <List size={18} />
                상담 리스트 관리
              </button>
              <button 
                onClick={() => setActiveTab('stats')}
                className={`px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition ${activeTab === 'stats' ? 'bg-brand-orange text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                <BarChart2 size={18} />
                통계 리포트
              </button>
              <button 
                onClick={() => setActiveTab('properties')}
                className={`px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition ${activeTab === 'properties' ? 'bg-brand-green text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                <Home size={18} />
                매물 관리
              </button>
              <button 
                onClick={() => setActiveTab('codes')}
                className={`px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition ${activeTab === 'codes' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                <Settings size={18} />
                기준정보 관리
              </button>
              <button 
                onClick={() => setActiveTab('settings')}
                className={`px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition ${activeTab === 'settings' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                <Settings size={18} />
                사이트 환경 설정
              </button>
              <button 
                onClick={() => setActiveTab('manual')}
                className={`px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition ${activeTab === 'manual' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                <BookOpen size={18} />
                운영자 매뉴얼
              </button>
            </div>
          </div>
          
          {activeTab === 'list' && (
            <select 
              className="px-4 py-2 rounded-xl border border-gray-300 outline-none font-bold"
              value={filterType} onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="전체">유형 전체</option>
              <option value="매매">매매</option>
              <option value="전세">전세</option>
              <option value="월세">월세</option>
              <option value="분양">분양/투자</option>
              <option value="기타">기타</option>
            </select>
          )}
        </div>

        {activeTab === 'stats' ? (
          <AdminStatistics consultations={consultations} onUpdateType={handleUpdateType} properties={propertiesList} commonCodes={commonCodes} />
        ) : activeTab === 'properties' ? (
          <div className="space-y-12">
            {/* 아파트 단지 기준정보 및 대표 사진 관리 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-2xl font-bold mb-3 text-brand-green flex items-center gap-2">🏢 아파트 단지 기준정보 및 대표 사진 관리</h2>
              <p className="text-gray-500 text-sm mb-6">
                아파트 단지를 등록하고 대표 사진을 관리합니다. 매물 등록 시 해당 단지를 선택하면, 개별 매물 사진이 없더라도 단지 대표 사진이 자동으로 노출됩니다.
              </p>
              
              <form onSubmit={handleCreateComplex} className="grid md:grid-cols-3 gap-4 items-end mb-6 bg-gray-50 p-4 rounded-xl border border-gray-155">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">단지명 (동/호수 제외, 예: e편한세상옥정리더스가든)</label>
                  <input 
                    id="complex-name-input"
                    required 
                    type="text" 
                    className="w-full px-4 py-2 border rounded-lg bg-white text-sm"
                    placeholder="정확한 단지명 입력"
                    value={newComplexName} 
                    onChange={e => setNewComplexName(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">단지 대표 전경/사진 첨부 (선택사항)</label>
                  <input 
                    id="complex-image-upload"
                    type="file" 
                    accept="image/*" 
                    className="w-full px-3 py-1.5 border rounded-lg bg-white text-xs cursor-pointer"
                    onChange={e => setComplexImageFile(e.target.files[0])}
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isUploadingComplex}
                  className="bg-brand-green text-white font-bold py-2.5 px-6 rounded-lg hover:bg-green-800 transition text-sm disabled:opacity-50"
                >
                  {isUploadingComplex ? '등록 중...' : '아파트 단지 등록'}
                </button>
              </form>

              {/* 등록된 단지 목록 */}
              {complexesList.length > 0 ? (
                <div className="overflow-x-auto border border-gray-150 rounded-xl max-h-60">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-150 text-gray-600">
                        <th className="p-3 w-16 text-center">미리보기</th>
                        <th className="p-3">단지명 (목록 클릭 시 입력창 자동 복사)</th>
                        <th className="p-3">이미지 URL</th>
                        <th className="p-3 text-center w-16">삭제</th>
                      </tr>
                    </thead>
                    <tbody>
                      {complexesList.map(c => (
                        <tr 
                          key={c.id} 
                          className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                          title="클릭하여 단지명 입력창으로 복사"
                          onClick={() => {
                            setNewComplexName(c.complex_name);
                            document.getElementById('complex-name-input')?.focus();
                          }}
                        >
                          <td className="p-2 text-center">
                            {c.image_url ? (
                              <img src={c.image_url} alt={c.complex_name} className="w-10 h-10 object-cover rounded-lg mx-auto border" />
                            ) : (
                              <span className="text-[10px] text-gray-400 font-bold block bg-gray-100 py-2.5 rounded-lg border">No Pic</span>
                            )}
                          </td>
                          <td className="p-3 font-bold text-gray-800 hover:text-brand-orange transition-colors">{c.complex_name}</td>
                          <td className="p-3 font-mono text-gray-500 truncate max-w-[200px]" title={c.image_url || '등록 없음'}>
                            {c.image_url || <span className="text-gray-400 font-bold">대표 이미지 미지정</span>}
                          </td>
                          <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                            <button 
                              onClick={() => handleDeleteComplex(c.id)}
                              className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-400 text-xs text-center py-6">등록된 아파트 단지 정보가 없습니다. 첫 단지를 등록해 보세요.</p>
              )}
            </div>

            {/* 아실 엑셀(HTML) 가져오기 및 동기화 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-2xl font-bold mb-3 text-brand-orange flex items-center gap-2">🔄 아실 엑셀(HTML) 매물 일괄 동기화</h2>
              <p className="text-gray-500 text-sm mb-6">
                아실에서 다운로드한 매물 등록리스트 파일(<code>등록리스트_XXXXXXXX.xls</code> 또는 <code>.htm</code>)을 업로드하여
                기존 매물을 일괄 업데이트하고, 거래 완료된 매물을 자동으로 종료 처리합니다.
              </p>
              
              <div className="flex flex-col md:flex-row items-center gap-4">
                <input 
                  type="file" 
                  accept=".xls,.htm,.html"
                  id="asil-excel-upload"
                  className="w-full md:flex-grow px-4 py-3 border rounded-xl bg-gray-50 cursor-pointer text-sm"
                  onChange={handleAsilImport}
                />
                {importing && <div className="text-sm font-bold text-brand-orange animate-pulse">⏳ 파일 분석 및 데이터 대조 중...</div>}
              </div>

              {/* 프리뷰 패널 */}
              {showImportPreview && (
                <div className="mt-8 border-t border-gray-200 pt-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">📋 가져오기 / 동기화 프리뷰</h3>
                    <p className="text-xs text-gray-500">
                      총 {parsedData.length}개의 매물이 분석되었습니다. DB 내역과 비교하여 신규 등록되거나 업데이트됩니다.
                    </p>
                  </div>

                  <div className="overflow-x-auto border border-gray-150 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-150 text-gray-600">
                          <th className="p-3 text-center w-12">선택</th>
                          <th className="p-3">상태</th>
                          <th className="p-3">매물번호</th>
                          <th className="p-3">제목</th>
                          <th className="p-3">주소</th>
                          <th className="p-3">거래종류</th>
                          <th className="p-3 text-right">가격 (만원)</th>
                          <th className="p-3">면적</th>
                          <th className="p-3">등록기간</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.map((item, idx) => (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="p-3 text-center">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 text-brand-orange" 
                                checked={selectedImportIndices.includes(idx)}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSelectedImportIndices([...selectedImportIndices, idx]);
                                  } else {
                                    setSelectedImportIndices(selectedImportIndices.filter(i => i !== idx));
                                  }
                                }}
                              />
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                item.matchStatus === '신규' ? 'bg-blue-100 text-blue-800' :
                                item.matchStatus === '수정필요' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {item.matchStatus === '신규' ? '✨ 신규' : item.matchStatus === '수정필요' ? '✏️ 수정필요' : '✅ 동일'}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-gray-500">{item.asil_id || item.naver_id}</td>
                            <td className="p-3 font-bold truncate max-w-[200px]" title={item.title}>{item.title}</td>
                            <td className="p-3 truncate max-w-[200px]" title={item.address}>{item.address}</td>
                            <td className="p-3">{item.transaction_type_code === 'SALE' ? '매매' : item.transaction_type_code === 'JEONSE' ? '전세' : '월세'}</td>
                            <td className="p-3 text-right font-bold">
                              {item.price_main.toLocaleString()}
                              {item.price_monthly > 0 && ` / ${item.price_monthly.toLocaleString()}`}
                            </td>
                            <td className="p-3">{item.size}</td>
                            <td className="p-3 font-mono text-gray-500">{item.registration_period || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 미존재 매물 완료 처리 영역 */}
                  {missingProperties.length > 0 && (
                    <div className="space-y-3">
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <h4 className="font-bold text-amber-800 text-sm mb-1">🚨 광고 종료 (거래 완료) 처리 예정 매물 ({missingProperties.length}건)</h4>
                        <p className="text-xs text-amber-700">
                          기존 DB에 있으나 업로드된 파일에는 존재하지 않는 아실 연동 매물입니다. 체크한 항목은 동기화 실행 시 자동으로 <strong>'거래완료'</strong> 상태로 변경되어 통계에 적재됩니다.
                        </p>
                      </div>

                      <div className="overflow-x-auto border border-gray-150 rounded-xl max-h-48">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-gray-100 border-b border-gray-150 text-gray-600">
                              <th className="p-3 text-center w-12">선택</th>
                              <th className="p-3">매물번호</th>
                              <th className="p-3">제목</th>
                              <th className="p-3">주소</th>
                              <th className="p-3">거래방식</th>
                              <th className="p-3 text-right">가격</th>
                            </tr>
                          </thead>
                          <tbody>
                            {missingProperties.map(item => (
                              <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 text-gray-500">
                                <td className="p-3 text-center">
                                  <input 
                                    type="checkbox" 
                                    className="w-4 h-4 text-red-500" 
                                    checked={selectedCompleteIds.includes(item.id)}
                                    onChange={e => {
                                      if (e.target.checked) {
                                        setSelectedCompleteIds([...selectedCompleteIds, item.id]);
                                      } else {
                                        setSelectedCompleteIds(selectedCompleteIds.filter(id => id !== item.id));
                                      }
                                    }}
                                  />
                                </td>
                                <td className="p-3 font-mono">{item.asil_id}</td>
                                <td className="p-3 line-through">{item.title}</td>
                                <td className="p-3 truncate max-w-[200px]">{item.address}</td>
                                <td className="p-3">{item.transaction_type_code === 'SALE' ? '매매' : item.transaction_type_code === 'JEONSE' ? '전세' : '월세'}</td>
                                <td className="p-3 text-right">
                                  {item.price_main && `${item.price_main.toLocaleString()}만`}
                                  {item.price_monthly > 0 && ` / ${item.price_monthly.toLocaleString()}만`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button 
                      disabled={isSyncing}
                      onClick={() => {
                        setShowImportPreview(false);
                        setParsedData([]);
                        setMissingProperties([]);
                        const fileInput = document.getElementById('asil-excel-upload');
                        if (fileInput) fileInput.value = '';
                      }}
                      className={`px-5 py-2.5 rounded-xl font-bold transition text-sm ${isSyncing ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                    >
                      취소
                    </button>
                    <button 
                      disabled={isSyncing}
                      onClick={handleExecuteAsilImport}
                      className={`px-6 py-2.5 text-white rounded-xl font-bold shadow-sm transition text-sm ${isSyncing ? 'bg-brand-orange/50 cursor-not-allowed' : 'bg-brand-orange hover:bg-orange-700'}`}
                    >
                      {isSyncing ? "⏳ 동기화 진행 중..." : "🔄 선택된 매물 일괄 동기화 실행"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 매물 등록 폼 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-2xl font-bold mb-6 text-brand-green">새 매물 등록하기</h2>
              <form onSubmit={handleCreateProperty} className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div><label className="block text-sm font-bold text-gray-700 mb-1">제목</label><input required className="w-full px-4 py-2 border rounded-lg" value={newProperty.title} onChange={e => setNewProperty({...newProperty, title: e.target.value})} placeholder="예: 전망 좋은 옥정호수공원뷰 아파트" /></div>
                  <div><label className="block text-sm font-bold text-gray-700 mb-1">주소</label><input required className="w-full px-4 py-2 border rounded-lg" value={newProperty.address} onChange={e => setNewProperty({...newProperty, address: e.target.value})} placeholder="예: 경기도 양주시 옥정동로" /></div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">소속 아파트 단지 (대표 사진 연결용)</label>
                    <select 
                      className="w-full px-4 py-2 border rounded-lg bg-white" 
                      value={newProperty.complex_id} 
                      onChange={e => setNewProperty({...newProperty, complex_id: e.target.value})}
                    >
                      <option value="">-- 단지 지정 안 함 (해당 없음) --</option>
                      {complexesList.map(c => <option key={c.id} value={c.id}>{c.complex_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">검증 방식</label>
                    <select 
                      className="w-full px-4 py-2 border rounded-lg bg-white" 
                      value={newProperty.verification_type} 
                      onChange={e => setNewProperty({...newProperty, verification_type: e.target.value})}
                    >
                      <option value="">-- 검증 방식 선택 안 함 --</option>
                      <option value="모">모바일 (모)</option>
                      <option value="현">현장확인 (현)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">등록 기간 (예: 26.05.25 ~ 26.06.24)</label>
                    <input 
                      className="w-full px-4 py-2 border rounded-lg bg-white" 
                      value={newProperty.registration_period || ''} 
                      onChange={e => setNewProperty({...newProperty, registration_period: e.target.value})}
                      placeholder="예: 26.05.25 ~ 26.06.24"
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="w-1/2">
                      <label className="block text-sm font-bold text-gray-700 mb-1">건물 종류</label>
                      <select className="w-full px-4 py-2 border rounded-lg" value={newProperty.property_type_code} onChange={e => setNewProperty({...newProperty, property_type_code: e.target.value})}>
                        {commonCodes.filter(c => c.group_id === 'PROPERTY_TYPE').map(c => <option key={c.id} value={c.code_value}>{c.code_name}</option>)}
                      </select>
                    </div>
                    <div className="w-1/2">
                      <label className="block text-sm font-bold text-gray-700 mb-1">거래 방식</label>
                      <select className="w-full px-4 py-2 border rounded-lg" value={newProperty.transaction_type_code} onChange={e => setNewProperty({...newProperty, transaction_type_code: e.target.value})}>
                        {commonCodes.filter(c => c.group_id === 'TRANSACTION_TYPE').map(c => <option key={c.id} value={c.code_value}>{c.code_name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-1/2">
                      <label className="block text-sm font-bold text-gray-700 mb-1">매매가/보증금 (만원)</label>
                      <input type="number" required className="w-full px-4 py-2 border rounded-lg" value={newProperty.price_main} onChange={e => setNewProperty({...newProperty, price_main: e.target.value})} placeholder="예: 50000" />
                    </div>
                    <div className="w-1/2">
                      <label className="block text-sm font-bold text-gray-700 mb-1">월세 (만원, 없으면 0)</label>
                      <input type="number" className="w-full px-4 py-2 border rounded-lg" value={newProperty.price_monthly} onChange={e => setNewProperty({...newProperty, price_monthly: e.target.value})} placeholder="예: 80" />
                    </div>
                  </div>
                  <div><label className="block text-sm font-bold text-gray-700 mb-1">상세 설명</label><textarea required rows="4" className="w-full px-4 py-2 border rounded-lg resize-none" value={newProperty.description} onChange={e => setNewProperty({...newProperty, description: e.target.value})} placeholder="매물 상세 설명을 적어주세요."></textarea></div>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="w-1/3"><label className="block text-sm font-bold text-gray-700 mb-1">면적</label><input required className="w-full px-4 py-2 border rounded-lg" value={newProperty.size} onChange={e => setNewProperty({...newProperty, size: e.target.value})} placeholder="예: 84㎡" /></div>
                    <div className="w-1/3"><label className="block text-sm font-bold text-gray-700 mb-1">방 개수</label><input type="number" required className="w-full px-4 py-2 border rounded-lg" value={newProperty.rooms} onChange={e => setNewProperty({...newProperty, rooms: parseInt(e.target.value)})} /></div>
                    <div className="w-1/3"><label className="block text-sm font-bold text-gray-700 mb-1">욕실 개수</label><input type="number" required className="w-full px-4 py-2 border rounded-lg" value={newProperty.baths} onChange={e => setNewProperty({...newProperty, baths: parseInt(e.target.value)})} /></div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">매물 사진 첨부</label>
                    <input 
                      id="property-image-upload"
                      type="file" 
                      accept="image/*" 
                      required
                      className="w-full px-4 py-2 border rounded-lg bg-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-green file:text-white hover:file:bg-green-800 cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setNewProperty({...newProperty, imageFile: file});
                        }
                      }}
                    />
                    {newProperty.imageFile && <p className="text-sm text-brand-green mt-2 font-bold text-right">첨부 완료: {newProperty.imageFile.name}</p>}
                  </div>
                  
                  <div className="flex gap-6 mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="w-5 h-5 text-brand-orange" checked={newProperty.isRecommended} onChange={e => setNewProperty({...newProperty, isRecommended: e.target.checked})} />
                      <span className="font-bold text-brand-orange">⭐ 추천 매물 등록 (메인 노출)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="w-5 h-5 text-red-500" checked={newProperty.isUrgent} onChange={e => setNewProperty({...newProperty, isUrgent: e.target.checked})} />
                      <span className="font-bold text-red-500">🚨 급매물 표시</span>
                    </label>
                  </div>
                  
                  <button type="submit" className="w-full bg-brand-green text-white font-bold py-3 rounded-xl hover:bg-green-800 transition mt-4">신규 매물 서버에 등록하기</button>
                </div>
              </form>
            </div>

            {/* 매물 리스트 */}
            {(() => {
              const filteredAdminProperties = propertiesList.filter(item => {
                if (expiryFilter === 'ALL') return true;
                const { isExpired, isNearExpiry, daysRemaining } = checkRegistrationExpiry(item.registration_period);
                if (expiryFilter === 'EXPIRED') return isExpired;
                if (expiryFilter === 'NEAR_EXPIRY') return isNearExpiry;
                if (expiryFilter === 'NEAR_EXPIRY_5') return daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 5;
                if (expiryFilter === 'ALERT') return isExpired || isNearExpiry;
                return true;
              });

              return (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 border-b pb-4 mt-8">
                    <h2 className="text-2xl font-bold text-gray-800">등록된 매물 리스트 ({filteredAdminProperties.length}건)</h2>
                    
                    {/* 만료기간 필터링 드롭다운 */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-600">📅 등록기간 필터:</span>
                      <select 
                        className="border rounded-lg px-3 py-1.5 bg-white text-sm font-bold text-gray-700 hover:border-gray-400 transition"
                        value={expiryFilter}
                        onChange={e => setExpiryFilter(e.target.value)}
                      >
                        <option value="ALL">전체 매물</option>
                        <option value="EXPIRED">⚠️ 만료됨 (종료일 지남)</option>
                        <option value="NEAR_EXPIRY">⏳ 만료 임박 (3일 이내)</option>
                        <option value="NEAR_EXPIRY_5">⏳ 만료 예정 (5일 이내)</option>
                        <option value="ALERT">🚨 만료됨 또는 3일 이내 임박</option>
                      </select>
                    </div>
                  </div>
                  
                  {filteredAdminProperties.length === 0 ? (
                    <div className="bg-white p-12 text-center rounded-2xl border border-gray-200 shadow-sm">
                      <p className="text-gray-500 text-lg font-medium">필터 조건에 부합하는 매물이 없습니다.</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredAdminProperties.map(item => (
                        <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
                          {/* Expiry Badge */}
                          {(() => {
                            const { isExpired, isNearExpiry, daysRemaining } = checkRegistrationExpiry(item.registration_period);
                            if (isExpired) {
                              return <span className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg shadow-md z-10 animate-pulse">⚠️ 만료됨</span>;
                            }
                            if (isNearExpiry) {
                              return <span className="absolute top-3 left-3 bg-amber-500 text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg shadow-md z-10">⏳ 만료임박 ({daysRemaining}일 남음)</span>;
                            }
                            if (daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 5) {
                              return <span className="absolute top-3 left-3 bg-yellow-500 text-gray-900 text-[10px] font-black px-2.5 py-1.5 rounded-lg shadow-md z-10">⏳ 만료예정 ({daysRemaining}일 남음)</span>;
                            }
                            return null;
                          })()}
                          <img src={getPropertyImage(item)} alt={item.title} className="w-full h-40 object-cover" />
                          <div className="p-4">
                            <div className="flex gap-2 mb-2">
                              {item.isRecommended && <span className="bg-brand-orange text-white text-xs font-bold px-2 py-1 rounded">추천</span>}
                              {item.isUrgent && <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">급매</span>}
                              <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded">
                                {commonCodes.find(c => c.code_value === item.property_type_code)?.code_name || item.property_type_code}
                              </span>
                              <span className={`text-xs font-bold px-2 py-1 rounded ${item.status === '거래완료' ? 'bg-gray-500 text-white' : 'bg-brand-green text-white'}`}>
                                {item.status || '광고중'}
                              </span>
                            </div>
                            <h3 className="font-bold text-lg text-gray-900 truncate" title={item.title}>{item.title}</h3>
                            <p className="text-brand-orange font-bold mt-1">
                              {commonCodes.find(c => c.code_value === item.transaction_type_code)?.code_name || item.transaction_type_code}{' '}
                              {item.price_main && `${item.price_main.toLocaleString()}만`}{item.price_monthly > 0 && ` / ${item.price_monthly.toLocaleString()}만`}
                            </p>
                            {item.registration_period && (
                              <p className="text-[11px] text-gray-500 mt-1.5 bg-gray-50 px-2 py-1 rounded border border-gray-100 w-fit font-semibold">
                                📅 등록기간: <span className="font-mono text-gray-700">{item.registration_period}</span>
                              </p>
                            )}
                            <div className="flex gap-1.5 mt-3 flex-wrap">
                              <button onClick={() => setEditingProperty({...item})} className="flex-1 min-w-[50px] bg-blue-50 text-blue-600 font-bold py-1.5 rounded-lg text-xs hover:bg-blue-100 transition">
                                ✏️ 수정
                              </button>
                              <button 
                                onClick={() => handleTogglePropertyStatus(item.id, item.status)} 
                                className={`flex-1 min-w-[50px] font-bold py-1.5 rounded-lg text-xs transition ${
                                  item.status === '거래완료' ? 'bg-orange-50 text-brand-orange hover:bg-orange-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {item.status === '거래완료' ? '🔄 광고중' : '✅ 완료'}
                              </button>
                              <button onClick={() => { setAddingPhotoFor(item.id); setAddPhotoFiles([]); }} className="flex-1 min-w-[50px] bg-green-50 text-green-600 font-bold py-1.5 rounded-lg text-xs hover:bg-green-100 transition">
                                📷 사진
                              </button>
                              <button onClick={() => handleDeleteProperty(item.id)} className="bg-red-50 text-red-500 p-1.5 rounded-lg hover:bg-red-100 transition shrink-0">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          {/* 사진 추가 패널 */}
                          {addingPhotoFor === item.id && (
                            <div className="border-t border-gray-200 p-4 bg-green-50">
                              <p className="font-bold text-green-700 text-sm mb-2">📷 사진 추가 (최대 10장)</p>
                              <input
                                type="file" accept="image/*" multiple
                                onChange={e => setAddPhotoFiles(Array.from(e.target.files))}
                                className="w-full text-sm text-gray-500 file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-600 file:text-white"
                              />
                              {addPhotoFiles.length > 0 && <p className="text-xs text-green-600 mt-1">{addPhotoFiles.length}장 선택됨</p>}
                              <div className="flex gap-2 mt-2">
                                <button onClick={() => handleAddPhotos(item.id)} className="flex-1 bg-green-600 text-white font-bold py-1.5 rounded-lg text-sm hover:bg-green-700">저장</button>
                                <button onClick={() => setAddingPhotoFor(null)} className="flex-1 bg-gray-200 text-gray-600 font-bold py-1.5 rounded-lg text-sm hover:bg-gray-300">취소</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : activeTab === 'codes' ? (
          <div className="space-y-12">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-2xl font-bold mb-6 text-gray-800">기준정보(공통코드) 등록</h2>
              <form onSubmit={handleCreateCode} className="flex flex-col md:flex-row gap-4 items-end">
                <div className="w-full md:w-1/4">
                  <label className="block text-sm font-bold text-gray-700 mb-1">분류</label>
                  <select className="w-full px-4 py-2 border rounded-lg" value={newCode.group_id} onChange={e => setNewCode({...newCode, group_id: e.target.value})}>
                    <option value="PROPERTY_TYPE">건물 종류</option>
                    <option value="TRANSACTION_TYPE">거래 방식</option>
                    <option value="SLOGAN_MAIN">메인 슬로건 예시</option>
                    <option value="SLOGAN_SUB">서브 슬로건 예시</option>
                  </select>
                </div>
                <div className="w-full md:w-1/4">
                  <label className="block text-sm font-bold text-gray-700 mb-1">코드값 (영문)</label>
                  <input required className="w-full px-4 py-2 border rounded-lg" placeholder="예: OFFICETEL" value={newCode.code_value} onChange={e => setNewCode({...newCode, code_value: e.target.value})} />
                </div>
                <div className="w-full md:w-1/4">
                  <label className="block text-sm font-bold text-gray-700 mb-1">표시이름 (한글)</label>
                  <input required className="w-full px-4 py-2 border rounded-lg" placeholder="예: 오피스텔" value={newCode.code_name} onChange={e => setNewCode({...newCode, code_name: e.target.value})} />
                </div>
                <div className="w-full md:w-1/4">
                  <label className="block text-sm font-bold text-gray-700 mb-1">정렬순서</label>
                  <input type="number" required className="w-full px-4 py-2 border rounded-lg" value={newCode.sort_order} onChange={e => setNewCode({...newCode, sort_order: parseInt(e.target.value)})} />
                </div>
                <button type="submit" className="bg-gray-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-700 transition">등록</button>
              </form>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold mb-4 text-brand-green">건물 종류 (PROPERTY_TYPE)</h3>
                <ul className="divide-y divide-gray-100">
                  {commonCodes.filter(c => c.group_id === 'PROPERTY_TYPE').map(c => (
                    <li key={c.id} className="py-3 flex justify-between items-center">
                      <div>
                        <span className="font-bold mr-2">{c.code_name}</span>
                        <span className="text-sm text-gray-400">({c.code_value})</span>
                      </div>
                      <button onClick={() => handleDeleteCode(c.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold mb-4 text-brand-orange">거래 방식 (TRANSACTION_TYPE)</h3>
                <ul className="divide-y divide-gray-100">
                  {commonCodes.filter(c => c.group_id === 'TRANSACTION_TYPE').map(c => (
                    <li key={c.id} className="py-3 flex justify-between items-center">
                      <div>
                        <span className="font-bold mr-2">{c.code_name}</span>
                        <span className="text-sm text-gray-400">({c.code_value})</span>
                      </div>
                      <button onClick={() => handleDeleteCode(c.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 mt-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold mb-4 text-purple-600">메인 슬로건 예시 (SLOGAN_MAIN)</h3>
                <ul className="divide-y divide-gray-100">
                  {commonCodes.filter(c => c.group_id === 'SLOGAN_MAIN').map(c => (
                    <li key={c.id} className="py-3 flex justify-between items-start">
                      <div>
                        <span className="font-bold mr-2 text-sm whitespace-pre-wrap">{c.code_name}</span>
                      </div>
                      <button onClick={() => handleDeleteCode(c.id)} className="text-red-500 hover:bg-red-50 p-1 rounded mt-1"><Trash2 size={16}/></button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold mb-4 text-purple-600">서브 슬로건 예시 (SLOGAN_SUB)</h3>
                <ul className="divide-y divide-gray-100">
                  {commonCodes.filter(c => c.group_id === 'SLOGAN_SUB').map(c => (
                    <li key={c.id} className="py-3 flex justify-between items-start">
                      <div>
                        <span className="font-bold mr-2 text-sm whitespace-pre-wrap">{c.code_name}</span>
                      </div>
                      <button onClick={() => handleDeleteCode(c.id)} className="text-red-500 hover:bg-red-50 p-1 rounded mt-1"><Trash2 size={16}/></button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : activeTab === 'settings' ? (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-4xl">
            <h2 className="text-2xl font-bold mb-6 text-purple-600">사이트 환경 설정 (White-label)</h2>
            <form onSubmit={handleSaveSettings} className="space-y-8">
              
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">기본 정보</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">상호명</label>
                    <input className="w-full px-4 py-2 border rounded-lg" value={siteSettings.name || ''} onChange={e => setSiteSettings({...siteSettings, name: e.target.value})} placeholder="예: 리더스가든 부동산" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">대표자명</label>
                    <input className="w-full px-4 py-2 border rounded-lg" value={siteSettings.ceo_name || ''} onChange={e => setSiteSettings({...siteSettings, ceo_name: e.target.value})} placeholder="예: 홍길동" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">대표 연락처 (고객 노출용)</label>
                    <input className="w-full px-4 py-2 border rounded-lg" value={siteSettings.phone || ''} onChange={e => setSiteSettings({...siteSettings, phone: e.target.value})} placeholder="예: 010-1234-5678" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">알림 수신 전화번호 (SMS 알림용)</label>
                    <input className="w-full px-4 py-2 border rounded-lg" value={siteSettings.notification_phone || ''} onChange={e => setSiteSettings({...siteSettings, notification_phone: e.target.value})} placeholder="예: 010-1234-5678" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">알림 수신 이메일</label>
                    <input className="w-full px-4 py-2 border rounded-lg" value={siteSettings.email || ''} onChange={e => setSiteSettings({...siteSettings, email: e.target.value})} placeholder="예: your-email@gmail.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">등록번호</label>
                    <input className="w-full px-4 py-2 border rounded-lg" value={siteSettings.registration_number || ''} onChange={e => setSiteSettings({...siteSettings, registration_number: e.target.value})} placeholder="예: 123-45-67890" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">사무실 주소</label>
                    <input className="w-full px-4 py-2 border rounded-lg" value={siteSettings.address || ''} onChange={e => setSiteSettings({...siteSettings, address: e.target.value})} placeholder="예: 경기도 양주시..." />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">사이트 이미지 설정</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">대표(명함) 이미지</label>
                    {siteSettings.ceo_image_url && (
                      <div className="mb-2">
                        <img src={siteSettings.ceo_image_url} alt="Current CEO" className="h-32 object-contain bg-white border rounded p-1" />
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={e => setCeoImageFile(e.target.files[0])}
                      className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">대문(Home) 하단의 대표 소개 영역에 표시됩니다.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">메인 배경(히어로) 이미지</label>
                    {siteSettings.hero_image_url && (
                      <div className="mb-2">
                        <img src={siteSettings.hero_image_url} alt="Current Hero" className="h-32 w-full object-cover bg-white border rounded p-1" />
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={e => setHeroImageFile(e.target.files[0])}
                      className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">대문(Home) 최상단의 큰 배경 이미지로 표시됩니다.</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">문구 및 슬로건</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-bold text-gray-700">메인 슬로건 (큰 글씨)</label>
                      <select 
                        className="text-sm border border-gray-300 rounded px-2 py-1 outline-none"
                        onChange={(e) => {
                          if (e.target.value) setSiteSettings({...siteSettings, slogan_main: e.target.value});
                        }}
                      >
                        <option value="">-- 예시에서 선택 --</option>
                        {commonCodes.filter(c => c.group_id === 'SLOGAN_MAIN').map(c => (
                          <option key={c.id} value={c.code_name}>{c.code_name.substring(0, 15)}...</option>
                        ))}
                      </select>
                    </div>
                    <textarea rows="2" className="w-full px-4 py-2 border rounded-lg resize-none" value={siteSettings.slogan_main || ''} onChange={e => setSiteSettings({...siteSettings, slogan_main: e.target.value})} placeholder="예: 고객의 꿈을 찾아드리는 리더스가든 부동산" />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-bold text-gray-700">서브 슬로건 (작은 글씨)</label>
                      <select 
                        className="text-sm border border-gray-300 rounded px-2 py-1 outline-none"
                        onChange={(e) => {
                          if (e.target.value) setSiteSettings({...siteSettings, slogan_sub: e.target.value});
                        }}
                      >
                        <option value="">-- 예시에서 선택 --</option>
                        {commonCodes.filter(c => c.group_id === 'SLOGAN_SUB').map(c => (
                          <option key={c.id} value={c.code_name}>{c.code_name.substring(0, 15)}...</option>
                        ))}
                      </select>
                    </div>
                    <input className="w-full px-4 py-2 border rounded-lg" value={siteSettings.slogan_sub || ''} onChange={e => setSiteSettings({...siteSettings, slogan_sub: e.target.value})} placeholder="예: 최고의 매물, 정직한 중개로 보답하겠습니다." />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">영업시간 및 공지사항</h3>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">평일</label>
                      <input className="w-full px-4 py-2 border rounded-lg" value={siteSettings.hours_weekday || ''} onChange={e => setSiteSettings({...siteSettings, hours_weekday: e.target.value})} placeholder="예: 09:00 ~ 19:00" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">토요일</label>
                      <input className="w-full px-4 py-2 border rounded-lg" value={siteSettings.hours_saturday || ''} onChange={e => setSiteSettings({...siteSettings, hours_saturday: e.target.value})} placeholder="예: 09:00 ~ 17:00" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">일요일</label>
                      <input className="w-full px-4 py-2 border rounded-lg" value={siteSettings.hours_sunday || ''} onChange={e => setSiteSettings({...siteSettings, hours_sunday: e.target.value})} placeholder="예: 휴무 (사전 예약 시 상담 가능)" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">공휴일</label>
                      <input className="w-full px-4 py-2 border rounded-lg" value={siteSettings.hours_holiday || ''} onChange={e => setSiteSettings({...siteSettings, hours_holiday: e.target.value})} placeholder="예: 휴무 (사전 예약 시 상담 가능)" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">특별 공지사항 (휴가, 명절 등)</label>
                    <textarea rows="2" className="w-full px-4 py-2 border rounded-lg resize-none" value={siteSettings.notice_text || ''} onChange={e => setSiteSettings({...siteSettings, notice_text: e.target.value})} placeholder="예: 5/25일 정상근무합니다." />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">API 환경 변수 세팅</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-bold text-gray-700">네이버 지도 Client ID</label>
                      <button 
                        type="button"
                        onClick={() => setShowMapGuide(!showMapGuide)}
                        className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1 focus:outline-none bg-purple-50 px-2.5 py-1 rounded-md transition hover:bg-purple-100"
                      >
                        ℹ️ 설정 가이드 보기
                      </button>
                    </div>
                    <input className="w-full px-4 py-2 border rounded-lg font-mono text-sm" value={siteSettings.naver_map_client_id || ''} onChange={e => setSiteSettings({...siteSettings, naver_map_client_id: e.target.value})} />
                    
                    {showMapGuide && (
                      <div className="mt-3 p-4 bg-white border border-purple-100 rounded-xl text-xs text-gray-600 space-y-2.5 shadow-sm">
                        <div className="font-bold text-purple-800 flex items-center gap-1 text-sm">
                          📋 네이버 지도 API 올바른 세팅 방법
                        </div>
                        <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
                          <li>
                            <strong>네이버 클라우드 플랫폼 콘솔 접속</strong>: <a href="https://console.ncloud.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold hover:text-blue-800">console.ncloud.com</a>에 로그인합니다.
                          </li>
                          <li>
                            <strong>지도 메뉴 이동</strong>: 왼쪽 상단 <code>三 Menu</code> 버튼 &gt; <code>Application Services</code> &gt; <code>Maps</code> 메뉴로 이동합니다.
                          </li>
                          <li>
                            <strong>인증 정보 확인</strong>: <code>Readers-Garden</code> 애플리케이션의 <code>인증 정보</code> 버튼을 클릭합니다.
                          </li>
                          <li>
                            <strong>서비스 URL 등록 확인</strong>: 팝업창 하단의 <strong>Web 서비스 URL</strong>에 현재 배포된 주소인 <code className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-bold">https://leaders-garden-realestate.vercel.app</code> 이 등록되어 있는지 확인합니다. 만약 없다면 연필 아이콘을 눌러 추가하고 저장해 줍니다.
                          </li>
                          <li>
                            <strong>Client ID 입력</strong>: 팝업창에서 확인한 <code>Client ID</code> 값을 복사하여 위 입력 칸에 넣고 하단의 <code>[환경 설정 저장하기]</code> 버튼을 클릭해 완료합니다.
                          </li>
                        </ol>
                        <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-[11px] text-amber-800 leading-relaxed font-medium">
                          ⚠️ <strong>주의</strong>: 구버전 메뉴인 <code>AI·NAVER API</code>에서 확인한 키는 작동하지 않습니다. 반드시 <strong><code>Maps</code></strong> 메뉴의 키를 사용해야 합니다.
                        </div>
                      </div>
                    )}
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">EmailJS Service ID</label>
                      <input className="w-full px-4 py-2 border rounded-lg font-mono text-sm" value={siteSettings.emailjs_service_id || ''} onChange={e => setSiteSettings({...siteSettings, emailjs_service_id: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">EmailJS Template ID</label>
                      <input className="w-full px-4 py-2 border rounded-lg font-mono text-sm" value={siteSettings.emailjs_template_id || ''} onChange={e => setSiteSettings({...siteSettings, emailjs_template_id: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">EmailJS Public Key</label>
                      <input className="w-full px-4 py-2 border rounded-lg font-mono text-sm" value={siteSettings.emailjs_public_key || ''} onChange={e => setSiteSettings({...siteSettings, emailjs_public_key: e.target.value})} />
                    </div>
                  </div>
                </div>
              </div>

              <button disabled={isSavingSettings} type="submit" className={`w-full text-white font-bold py-3 rounded-xl transition ${isSavingSettings ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}>
                {isSavingSettings ? '이미지 업로드 및 저장 중...' : '환경 설정 저장하기'}
              </button>
            </form>
          </div>
        ) : activeTab === 'manual' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-teal-600 to-teal-500 px-8 py-6">
              <div className="flex items-center gap-3">
                <BookOpen size={28} className="text-white" />
                <div>
                  <h2 className="text-2xl font-bold text-white">운영자 매뉴얼</h2>
                  <p className="text-teal-100 text-sm mt-1">부동산 중개소 홈페이지 플랫폼 사용 가이드</p>
                </div>
              </div>
            </div>
            <div className="p-8 space-y-8">

              {/* 1. 시스템 개요 */}
              <section>
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><span className="bg-teal-100 text-teal-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">1</span>시스템 개요</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {[{icon:'🖼️',title:'대문 이미지',desc:'사무실/배경 사진 업로드'},{icon:'💬',title:'슬로건 문구',desc:'메인/서브 슬로건 자유 편집'},{icon:'🕐',title:'영업시간',desc:'요일별 개별 설정'},{icon:'📢',title:'특별 공지',desc:'휴가/명절 실시간 공지'},{icon:'📱',title:'명함 이미지',desc:'대표자 명함/사진 업로드'},{icon:'🏠',title:'매물 관리',desc:'매물 등록/수정/삭제'},{icon:'📋',title:'상담 신청',desc:'고객 문의 내용 확인'},{icon:'🗺️',title:'지도 연동',desc:'네이버 지도 사무소 표시'},{icon:'📧',title:'이메일 알림',desc:'상담 신청 시 자동 발송'}].map(f => (
                    <div key={f.title} className="bg-gray-50 rounded-xl p-4 flex items-start gap-3">
                      <span className="text-2xl">{f.icon}</span>
                      <div><p className="font-bold text-gray-800 text-sm">{f.title}</p><p className="text-gray-500 text-xs mt-0.5">{f.desc}</p></div>
                    </div>
                  ))}
                </div>
              </section>

              <hr className="border-gray-100" />

              {/* 2. 관리자 로그인 */}
              <section>
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><span className="bg-teal-100 text-teal-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</span>관리자 로그인</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                  <p className="font-bold text-blue-800 mb-2">📍 접속 방법</p>
                  <p className="text-blue-700 font-mono text-sm bg-blue-100 inline-block px-3 py-1 rounded">https://내홈페이지주소.com<strong>/admin</strong></p>
                  <p className="text-blue-600 text-sm mt-3">⚠️ 비밀번호는 외부에 절대 공유하지 마세요.</p>
                </div>
              </section>

              <hr className="border-gray-100" />

              {/* 3. 사이트 환경 설정 */}
              <section>
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><span className="bg-teal-100 text-teal-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">3</span>사이트 환경 설정 (핵심)</h3>
                <div className="space-y-3">
                  {[
                    {label:'기본 정보',desc:'상호명, 대표자, 연락처, 주소 입력 → 헤더·푸터에 자동 반영',color:'green'},
                    {label:'이미지 업로드',desc:'명함 사진 업로드 → 대문 중간 소개 영역 | 배경 사진 → 상단 대형 배경',color:'blue'},
                    {label:'슬로건 문구',desc:'[예시에서 선택] 드롭다운에서 템플릿 선택 후 개인 수정 가능',color:'purple'},
                    {label:'영업시간',desc:'평일/토/일/공휴일 개별 입력 → 푸터에 자동 표시',color:'orange'},
                    {label:'특별 공지사항',desc:'거다 퓨가·명절 등 긴급 공지 입력 → 주황색 강조 박스로 표시 | 비우면 자동 사라집',color:'red'},
                  ].map(item => (
                    <div key={item.label} className="flex items-start gap-3 bg-gray-50 rounded-xl px-4 py-3">
                      <span className={`mt-0.5 w-2 h-2 rounded-full bg-${item.color}-400 flex-shrink-0 mt-2`}></span>
                      <div><span className="font-bold text-gray-800 text-sm">{item.label}</span><span className="text-gray-500 text-sm"> — {item.desc}</span></div>
                    </div>
                  ))}
                </div>
              </section>

              <hr className="border-gray-100" />

              {/* 4. 매물 관리 */}
              <section>
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><span className="bg-teal-100 text-teal-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">4</span>매물 관리</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="font-bold text-green-800 mb-2">✅ 매물 등록 시 필수 정보</p>
                    <ul className="text-green-700 text-sm space-y-1">
                      <li>• 제목, 주소, 건물 종류, 거래 방식</li>
                      <li>• 가격, 면적, 방 수, 층수</li>
                      <li>• 사진 (최대 10장)</li>
                      <li>• 상세 설명</li>
                    </ul>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <p className="font-bold text-yellow-800 mb-2">⭐ 추천 매물 체크시</p>
                    <p className="text-yellow-700 text-sm">홈페이지 메인(대문)에 해당 매물이 노출됩니다.<br/>가장 조은 매물 6개 정도를 추체지로 설정하세요.</p>
                  </div>
                </div>
              </section>

              <hr className="border-gray-100" />

              {/* 5. 자주 묻는 질문 */}
              <section>
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><span className="bg-teal-100 text-teal-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">5</span>자주 묻는 질문 (FAQ)</h3>
                <div className="space-y-3">
                  {[
                    {q:'이미지를 올렸는데 홈페이지에 바로 안 보여요.',a:'[환경 설정 저장하기] 버튼을 눌렀는지 확인하세요. 저장 후 홈페이지를 새로고침(F5)하면 반영됩니다.'},
                    {q:'특별 공지사항을 지우고 싶어요.',a:'특별 공지사항 텍스트박스 내용을 모두 지우고 저장하면 자동으로 사라집니다.'},
                    {q:'슬로건에 줄바꿈을 하고 싶어요.',a:'텍스트박스 안에서 Enter 키를 누르면 홈페이지에도 그대로 줄바꿈이 적용됩니다.'},
                    {q:'상담 신청 이메일이 안 와요.',a:'[사이트 환경 설정] → [API 환경 변수 세팅]에서 EmailJS 키 3개가 올바르게 입력되어 있는지 확인하세요.'},
                    {q:'매물 이미지가 10장을 넘어요.',a:'현재 최대 10장까지 지원합니다. 가장 잘 나온 사진 위주로 선별해서 올려주세요.'},
                  ].map(({q,a}) => (
                    <details key={q} className="bg-gray-50 rounded-xl overflow-hidden group">
                      <summary className="px-5 py-4 font-bold text-gray-800 cursor-pointer flex items-center justify-between list-none">
                        <span>Q. {q}</span>
                        <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      <div className="px-5 pb-4 text-gray-600 text-sm border-t border-gray-200 pt-3">{a}</div>
                    </details>
                  ))}
                </div>
              </section>

              <hr className="border-gray-100" />

              {/* 6. 연락처 */}
              <section>
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><span className="bg-teal-100 text-teal-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">6</span>도움이 필요할 때</h3>
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6">
                  <div className="bg-teal-600 text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl flex-shrink-0">📱</div>
                  <div>
                    <p className="font-bold text-teal-800 text-lg">홈피지기 · 톱니바꿈</p>
                    <p className="text-teal-700 text-xl font-mono font-bold mt-1">010-5036-0846</p>
                    <p className="text-teal-600 text-sm mt-1">팅 카카오톡 문의 가능 | 평일 10:00 ~ 18:00</p>
                  </div>
                </div>
              </section>

            </div>
          </div>
        ) : (
        <div className="space-y-6">
          {loading ? (
            <p className="text-center py-10">데이터를 불러오는 중입니다...</p>
          ) : consultations.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-3xl shadow-sm border border-gray-100">
              <p className="text-gray-500 text-lg">등록된 상담 내역이 없습니다.</p>
            </div>
          ) : (
            consultations.map(item => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm relative">
                <span className={`absolute top-6 right-6 px-3 py-1 rounded-full text-sm font-bold ${item.status === '답변완료' ? 'bg-brand-green text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {item.status}
                </span>
                
                <div className="flex gap-4 mb-4">
                  <div className="bg-brand-orange/10 text-brand-orange px-3 py-1 rounded-lg font-bold text-sm">
                    {item.type}
                  </div>
                  <div className="text-gray-500 text-sm">
                    {new Date(item.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-100">
                  <div><span className="text-gray-400 mr-2 text-sm">고객명:</span> <span className="font-bold">{item.name}</span></div>
                  <div><span className="text-gray-400 mr-2 text-sm">연락처:</span> <span className="font-bold">{item.phone}</span></div>
                </div>

                <div className="mb-6">
                  <h3 className="font-bold text-gray-700 mb-2">상담 내용</h3>
                  <p className="text-gray-800 bg-gray-50 p-4 rounded-xl whitespace-pre-wrap">{item.content}</p>
                </div>

                {item.status === '대기중' ? (
                  <div className="bg-brand-green/5 p-6 rounded-xl border border-brand-green/20 grid lg:grid-cols-2 gap-6">
                    {/* 좌측: 답변 입력 영역 */}
                    <div className="flex flex-col h-full gap-4">
                      {/* 1. 홈페이지용 상세 답변 */}
                      <div>
                        <div className="flex flex-wrap justify-between items-end mb-2 gap-2">
                          <label className="text-xs font-bold text-gray-500">상담 답변 (상세 내용 - 홈페이지 조회용)</label>
                          <div className="flex gap-2">
                            {QUICK_REPLIES.map((qr, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  setReplyContent({...replyContent, [item.id]: qr.text});
                                  setSmsContent({...smsContent, [item.id]: qr.smsText});
                                }}
                                className="text-[10px] bg-white border border-brand-green/30 text-brand-green hover:bg-brand-green hover:text-white px-2 py-0.5 rounded transition"
                              >
                                {qr.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <textarea 
                          rows="4" placeholder="홈페이지 상담 조회 화면에 노출될 상세한 답변 내용을 작성하세요."
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-green outline-none resize-none text-sm"
                          value={replyContent[item.id] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setReplyContent({...replyContent, [item.id]: val});
                            // 문자 내용이 아직 입력되지 않았다면 연동해서 첫 50자를 넣어줌
                            if (!smsContent[item.id]) {
                              setSmsContent({...smsContent, [item.id]: val.substring(0, 50)});
                            }
                          }}
                        ></textarea>
                      </div>

                      {/* 2. 문자 알림내용 */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-bold text-gray-500">알림 문자 내용 (전송용 - 간단히 요약 작성)</label>
                          <button
                            onClick={() => setSmsContent({...smsContent, [item.id]: '문의하신 내용의 답변이 등록되었습니다. 아래 링크에서 확인해 주세요.'})}
                            className="text-[10px] text-brand-green hover:underline"
                          >
                            기본 문구 채우기
                          </button>
                        </div>
                        <textarea 
                          rows="2" placeholder="고객에게 문자로 보낼 간단한 알림이나 안내 문구를 작성하세요."
                          className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-green outline-none resize-none text-sm"
                          value={smsContent[item.id] || ''}
                          onChange={(e) => setSmsContent({...smsContent, [item.id]: e.target.value})}
                        ></textarea>
                      </div>

                      {/* 바이트 카운터 */}
                      <div className="flex justify-between items-center mt-1 mb-2">
                        <span className="text-[10px] text-gray-400">문자에 홈페이지 상세 답변 링크가 자동으로 첨부됩니다.</span>
                        {(() => {
                          const currentMsg = generateFullMessage(item.name, smsContent[item.id]);
                          const bytes = getByteLength(currentMsg);
                          return (
                            <span className={`text-xs font-bold ${bytes > 90 ? 'text-brand-orange' : 'text-brand-green'}`}>
                              ( {bytes} / 90 Byte ) {bytes > 90 && <span className="text-[10px] ml-1">(LMS 전환)</span>}
                            </span>
                          );
                        })()}
                      </div>

                      <button 
                        onClick={() => handleReply(item.id, item.phone, item.name)}
                        className="w-full bg-brand-green text-white px-6 py-3 rounded-xl font-bold hover:bg-green-800 transition flex items-center justify-center gap-2 mt-auto"
                      >
                        <CheckCircle size={18} />
                        답변 확정 (문자 전송)
                      </button>
                    </div>

                    {/* 우측: 스마트폰 미리보기 */}
                    <div className="flex justify-center items-center bg-gray-100 rounded-xl p-4 border border-gray-200 shadow-inner">
                      <div className="w-[280px] h-[520px] bg-white rounded-[35px] shadow-2xl border-[8px] border-gray-800 relative flex flex-col overflow-hidden">
                        {/* 아이폰 노치 디자인 */}
                        <div className="absolute top-0 w-full h-[25px] flex justify-center z-10">
                          <div className="w-[120px] h-[25px] bg-gray-800 rounded-b-2xl"></div>
                        </div>
                        {/* 상단 헤더 */}
                        <div className="bg-gray-100 text-center py-4 pt-8 border-b border-gray-200">
                          <p className="text-xs text-gray-500 font-bold">문자 미리보기</p>
                        </div>
                        {/* 대화창 영역 */}
                        <div className="flex-grow p-4 bg-[#f2f2f7] overflow-y-auto">
                          <div className="bg-white p-3 rounded-2xl rounded-tl-sm shadow-sm text-sm whitespace-pre-wrap text-gray-800 leading-relaxed border border-gray-200 relative">
                            {generateFullMessage(item.name, smsContent[item.id])}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-1 ml-1 text-right">오전 10:24</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : item.status === '답변완료' ? (
                  <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 relative">
                    <h3 className="font-bold text-gray-500 mb-2">작성된 답변</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{item.reply}</p>
                    <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
                      <button 
                        onClick={() => handleTransactionSuccess(item.id)}
                        className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-700 transition flex items-center gap-2"
                      >
                        <Handshake size={16} />
                        거래 성공 (계약 완료) 처리
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-brand-green/10 p-6 rounded-xl border border-brand-green/20 flex flex-col items-center justify-center text-center">
                    <div className="bg-white p-3 rounded-full mb-3 shadow-sm text-brand-green">
                      <Handshake size={32} />
                    </div>
                    <h3 className="font-bold text-brand-green text-lg mb-1">성공적으로 거래가 완료된 고객입니다!</h3>
                    <p className="text-gray-600 text-sm">작성된 답변: {item.reply}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        )}
      </main>
      <Footer />

      {/* ===== 매물 정보 수정 모달 ===== */}
      {editingProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingProperty(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-blue-600 px-6 py-4 flex justify-between items-center rounded-t-2xl">
              <h2 className="text-white font-bold text-xl">✏️ 매물 정보 수정</h2>
              <button onClick={() => setEditingProperty(null)} className="text-white text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleEditProperty} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">제목</label>
                <input required className="w-full px-4 py-2 border rounded-lg" value={editingProperty.title} onChange={e => setEditingProperty({...editingProperty, title: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">주소</label>
                <input required className="w-full px-4 py-2 border rounded-lg" value={editingProperty.address || ''} onChange={e => setEditingProperty({...editingProperty, address: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">소속 아파트 단지 (대표 사진 연결용)</label>
                <select 
                  className="w-full px-4 py-2 border rounded-lg bg-white" 
                  value={editingProperty.complex_id || ''} 
                  onChange={e => setEditingProperty({...editingProperty, complex_id: e.target.value})}
                >
                  <option value="">-- 단지 지정 안 함 (해당 없음) --</option>
                  {complexesList.map(c => <option key={c.id} value={c.id}>{c.complex_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">검증 방식</label>
                <select 
                  className="w-full px-4 py-2 border rounded-lg bg-white" 
                  value={editingProperty.verification_type || ''} 
                  onChange={e => setEditingProperty({...editingProperty, verification_type: e.target.value})}
                >
                  <option value="">-- 검증 방식 선택 안 함 --</option>
                  <option value="모">모바일 (모)</option>
                  <option value="현">현장확인 (현)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">등록 기간 (예: 26.05.25 ~ 26.06.24)</label>
                <input 
                  className="w-full px-4 py-2 border rounded-lg bg-white" 
                  value={editingProperty.registration_period || ''} 
                  onChange={e => setEditingProperty({...editingProperty, registration_period: e.target.value})}
                  placeholder="예: 26.05.25 ~ 26.06.24"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">건물 종류</label>
                  <select className="w-full px-4 py-2 border rounded-lg" value={editingProperty.property_type_code} onChange={e => setEditingProperty({...editingProperty, property_type_code: e.target.value})}>
                    {commonCodes.filter(c => c.group_id === 'PROPERTY_TYPE').map(c => (
                      <option key={c.code_value} value={c.code_value}>{c.code_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">거래 방식</label>
                  <select className="w-full px-4 py-2 border rounded-lg" value={editingProperty.transaction_type_code} onChange={e => setEditingProperty({...editingProperty, transaction_type_code: e.target.value})}>
                    {commonCodes.filter(c => c.group_id === 'TRANSACTION_TYPE').map(c => (
                      <option key={c.code_value} value={c.code_value}>{c.code_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">가격 (만원)</label>
                  <input type="number" className="w-full px-4 py-2 border rounded-lg" value={editingProperty.price_main || ''} onChange={e => setEditingProperty({...editingProperty, price_main: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">월세 (만원, 해당시)</label>
                  <input type="number" className="w-full px-4 py-2 border rounded-lg" value={editingProperty.price_monthly || ''} onChange={e => setEditingProperty({...editingProperty, price_monthly: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">면적</label>
                  <input className="w-full px-4 py-2 border rounded-lg" value={editingProperty.size || ''} onChange={e => setEditingProperty({...editingProperty, size: e.target.value})} placeholder="예: 84㎡" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">방 수</label>
                  <input type="number" className="w-full px-4 py-2 border rounded-lg" value={editingProperty.rooms || 1} onChange={e => setEditingProperty({...editingProperty, rooms: parseInt(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">욕실 수</label>
                  <input type="number" className="w-full px-4 py-2 border rounded-lg" value={editingProperty.baths || 1} onChange={e => setEditingProperty({...editingProperty, baths: parseInt(e.target.value)})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">설명</label>
                <textarea rows="3" className="w-full px-4 py-2 border rounded-lg resize-none" value={editingProperty.description || ''} onChange={e => setEditingProperty({...editingProperty, description: e.target.value})} />
              </div>
              <div className="flex gap-6 p-4 bg-gray-50 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5" checked={editingProperty.isRecommended || false} onChange={e => setEditingProperty({...editingProperty, isRecommended: e.target.checked})} />
                  <span className="font-bold text-brand-orange text-sm">⭐ 추천 매물 (메인 노출)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5" checked={editingProperty.isUrgent || false} onChange={e => setEditingProperty({...editingProperty, isUrgent: e.target.checked})} />
                  <span className="font-bold text-red-500 text-sm">🚨 급매물 표시</span>
                </label>
              </div>

              {/* 저장된 사진 미리보기 */}
              {(() => {
                const allImgs = [
                  ...(editingProperty.image ? [editingProperty.image] : []),
                  ...(editingProperty.extra_images || [])
                ].filter(Boolean);
                return allImgs.length > 0 ? (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">📷 저장된 사진 ({allImgs.length}장)</label>
                    <div className="flex gap-2 flex-wrap">
                      {allImgs.map((img, idx) => (
                        <div key={idx} className="relative group">
                          <img src={img} alt={`사진 ${idx+1}`} className="w-20 h-16 object-cover rounded-lg border border-gray-200" />
                          {idx === 0 && (
                            <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center rounded-b-lg py-0.5">대표</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition">수정 저장하기</button>
                <button type="button" onClick={() => setEditingProperty(null)} className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-300 transition">취소</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DB 일괄 동기화 로딩 오버레이 */}
      {isSyncing && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex flex-col items-center justify-center text-white backdrop-blur-sm">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-brand-orange border-t-transparent mb-4"></div>
          <p className="text-xl font-bold">🔄 매물 데이터 일괄 동기화 중...</p>
          <p className="text-sm text-gray-300 mt-2">서버에 대량의 매물 데이터를 반영하고 있습니다.</p>
          <p className="text-sm text-gray-300">작업 완료 시까지 브라우저를 닫지 마세요. 약 5~10초 정도 소요될 수 있습니다.</p>
        </div>
      )}
    </div>
  );
}

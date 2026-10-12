import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Windows 바탕화면 토스트 알림 표시 함수
function notifyWindowsToast(title, message) {
  try {
    const psCmd = `
      [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null;
      $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);
      $textNodes = $template.GetElementsByTagName('text');
      $textNodes.Item(0).AppendChild($template.CreateTextNode('${title}')) | Out-Null;
      $textNodes.Item(1).AppendChild($template.CreateTextNode('${message}')) | Out-Null;
      $toast = [Windows.UI.Notifications.ToastNotification]::new($template);
      [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('LeadersGarden').Show($toast);
    `.replace(/\\r?\\n\\s*/g, ' ');

    exec(`powershell -NoProfile -Command "${psCmd}"`, () => {});
  } catch (e) {
    // 알림 실패 시 무시
  }
}

// 환경 변수 로드
dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wjpsbpznowqoqnokoeye.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const ASIL_LOGIN_URL = process.env.ASIL_LOGIN_URL || 'https://031-858-4955.asil.kr/member_adm/login/login.jsp';
const ASIL_PASSWORD = process.env.ASIL_PASSWORD;
const AGENCY_ID = '11111111-1111-1111-1111-111111111111';

// 단지명 추출 함수 (utils/imageHelper.js 와 동일)
function getComplexName(text) {
  if (!text) return '';
  let cleaned = text.replace(/\[.*?\]/g, '').trim();
  const match = cleaned.match(/^([가-힣A-Za-z0-9\s\-_]+?)(?=\d+\s*동|\d+\s*호|\d+\s*층)/);
  if (match) return match[1].trim();
  return cleaned.split(' ')[0] || cleaned;
}

async function runAsilSync() {
  console.log('='.repeat(60));
  console.log(`[${new Date().toLocaleString('ko-KR')}] 🏡 아실 매물 자동 동기화 시작`);
  console.log('='.repeat(60));

  if (!ASIL_PASSWORD) {
    console.error('❌ 에러: .env 파일에 ASIL_PASSWORD 가 설정되어 있지 않습니다.');
    console.error('👉 d:\\홈페이지\\리더스가든_부동산\\.env 파일의 ASIL_PASSWORD 항목에 아실 관리자 비밀번호를 입력해 주세요.');
    process.exit(1);
  }

  if (!SUPABASE_ANON_KEY) {
    console.error('❌ 에러: .env 파일에 VITE_SUPABASE_ANON_KEY 가 없습니다.');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const downloadsDir = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  // 1. Playwright 브라우저 실행
  const isHeadless = !process.argv.includes('--headful');
  console.log(`🚀 브라우저 시작 중... (모드: ${isHeadless ? '백그라운드(Headless)' : '화면표시'})`);

  const browser = await chromium.launch({
    headless: isHeadless,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    acceptDownloads: true,
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();
  let downloadedFilePath = null;

  try {
    // 2. 아실 로그인 페이지 접속
    console.log(`🔗 아실 로그인 페이지 접속: ${ASIL_LOGIN_URL}`);
    await page.goto(ASIL_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 비밀번호 입력
    console.log('🔑 관리자 비밀번호 입력 중...');
    const pwInput = page.locator('#p');
    await pwInput.waitFor({ state: 'visible', timeout: 10000 });
    await pwInput.fill(ASIL_PASSWORD);

    // 로그인 실행
    console.log('👉 로그인 버튼 클릭...');
    await Promise.all([
      page.waitForNavigation({ timeout: 15000 }).catch(() => null),
      page.keyboard.press('Enter')
    ]);

    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    console.log(`📍 로그인 후 현재 URL: ${currentUrl}`);

    if (currentUrl.includes('login.jsp')) {
      throw new Error('로그인에 실패했습니다. 아실 관리자 비밀번호가 올바른지 확인해 주세요.');
    }

    // 3. 매물관리 페이지로 이동
    console.log('📋 [매물관리] 이동 중...');
    
    // 팝업/새 탭 감지 준비
    const [newPage] = await Promise.all([
      context.waitForEvent('page', { timeout: 6000 }).catch(() => null),
      page.locator('a, button, span').filter({ hasText: /^매물관리$/ }).first().click().catch(() => null)
    ]);

    const targetPage = newPage || page;
    await targetPage.waitForLoadState('domcontentloaded');

    // 만약 새 창이나 클릭으로 이동하지 않은 경우 직접 URL 접속 시도
    if (!targetPage.url().includes('memulList.asp')) {
      console.log('🌐 memulList.asp 로 직접 이동...');
      await targetPage.goto('https://realty.asil.kr/mmc/memul/memulList.asp', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
    }

    console.log(`📍 매물 목록 URL: ${targetPage.url()}`);
    await targetPage.waitForTimeout(2000);

    // 4. [엑셀다운로드] 버튼 클릭 및 파일 수신
    console.log('📥 [엑셀다운로드] 버튼 탐색 중...');
    
    const excelBtn = targetPage.locator('a, button, input').filter({ hasText: /^엑셀다운로드$/ }).first();
    await excelBtn.waitFor({ state: 'visible', timeout: 15000 });

    console.log('⚡ 엑셀 파일 다운로드 시작...');
    const [download] = await Promise.all([
      targetPage.waitForEvent('download', { timeout: 30000 }),
      excelBtn.click()
    ]);

    downloadedFilePath = path.join(downloadsDir, `asil_memul_${Date.now()}.xls`);
    await download.saveAs(downloadedFilePath);
    console.log(`✅ 엑셀 다운로드 완료: ${downloadedFilePath}`);

  } catch (err) {
    console.error('❌ 아실 다운로드 단계 실패:', err.message);
    await browser.close();
    process.exit(1);
  } finally {
    await browser.close();
  }

  // 5. 다운로드된 파일 분석 및 파싱
  console.log('\n🔍 다운로드된 엑셀 파일 파싱 및 분석 시작...');
  const fileBuffer = fs.readFileSync(downloadedFilePath);
  
  let htmlText = fileBuffer.toString('utf-8');
  let $ = cheerio.load(htmlText);

  // 헤더 검증 (EUC-KR 인코딩 대응)
  let hasAsilHeader = htmlText.includes('아실매물번호') || htmlText.includes('네이버매물번호');
  if (!hasAsilHeader) {
    console.log('🔄 UTF-8 파싱 헤더 미발견 -> EUC-KR 디코딩 시도...');
    const decoder = new TextDecoder('euc-kr');
    htmlText = decoder.decode(fileBuffer);
    $ = cheerio.load(htmlText);
  }

  const rows = $('tr').toArray();
  let headerIndex = -1;
  const colIndices = {
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
    const cells = $(rows[i]).find('td, th').map((_, cell) => $(cell).text().trim()).get();
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
    console.error('❌ 유효한 아실 매물 테이블 헤더를 찾지 못했습니다.');
    process.exit(1);
  }

  console.log(`✅ 테이블 헤더 확인 완료 (행 위치: ${headerIndex + 1})`);

  // 매물 데이터 가공
  const parsedData = [];
  const fileAsilIds = new Set();

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const cells = $(rows[i]).find('td, th').map((_, cell) => $(cell).text().replace(/\s+/g, ' ').trim()).get();
    const asilId = cells[colIndices.asilId];
    const naverId = cells[colIndices.naverId];

    if (!asilId && !naverId) continue;
    if (asilId) fileAsilIds.add(asilId);

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

    // 상세주소 호수 제거
    const cleanRawAddress = rawAddress
      .replace(/\s*\d+\s*호?\s*(\([^)]+\))/g, ' $1')
      .replace(/\s*\d+\s*호(?!\d)/g, '')
      .replace(/\s*\d+호?\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const cleanAddress = `경기도 ${rawRegion} ${cleanRawAddress}`.replace(/\s+/g, ' ').trim();
    const cleanTitle = `[${rawType || '매물'}] ${cleanRawAddress} ${rawTransaction || '거래'}`.replace(/\s+/g, ' ').trim();
    const cleanDescription = `${rawMemo ? `[중개사 메모] ${rawMemo}\n\n` : ''}아실 등록 매물입니다. (아실번호: ${asilId || ''}, 네이버번호: ${naverId || ''})\n상세 사항은 문의 바랍니다.`;

    parsedData.push({
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
      verification_type,
      registration_period: rawRegistrationPeriod
    });
  }

  console.log(`📊 엑셀에서 총 ${parsedData.length}건의 매물을 파싱했습니다.`);

  // 6. Supabase DB와 대조 및 동기화 실행
  console.log('\n🔄 Supabase DB 동기화 작업 시작...');
  const { data: propertiesList, error: propErr } = await supabase.from('properties_v2').select('*');
  if (propErr) {
    console.error('❌ Supabase 매물 조회 실패:', propErr.message);
    process.exit(1);
  }

  const { data: complexesList, error: compErr } = await supabase.from('complexes').select('*');
  if (compErr) {
    console.error('❌ Supabase 단지 목록 조회 실패:', compErr.message);
    process.exit(1);
  }

  const complexMap = {};
  (complexesList || []).forEach(c => {
    complexMap[c.complex_name] = c.id;
  });

  let insertCount = 0;
  let updateCount = 0;
  let sameCount = 0;

  for (const item of parsedData) {
    // 단지 자동 매핑 및 생성
    const complexName = getComplexName(item.title || item.address);
    let complex_id = null;

    if (complexName) {
      if (complexMap[complexName]) {
        complex_id = complexMap[complexName];
      } else {
        const { data: newComp, error: newCompErr } = await supabase
          .from('complexes')
          .upsert([{ complex_name: complexName }], { onConflict: 'complex_name' })
          .select('id')
          .single();

        if (!newCompErr && newComp) {
          complex_id = newComp.id;
          complexMap[complexName] = complex_id;
        }
      }
    }

    const existing = (propertiesList || []).find(p => p.asil_id === item.asil_id || (item.naver_id && p.naver_id === item.naver_id));

    const propertyPayload = {
      agency_id: AGENCY_ID,
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
      isRecommended: existing ? existing.isRecommended : false,
      isUrgent: existing ? existing.isUrgent : false,
      image: existing?.image || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80',
      asil_id: item.asil_id,
      naver_id: item.naver_id,
      status: '광고중',
      complex_id: complex_id,
      verification_type: item.verification_type,
      registration_period: item.registration_period
    };

    if (!existing) {
      // 신규 등록
      const { error: insErr } = await supabase.from('properties_v2').insert([propertyPayload]);
      if (insErr) {
        console.error(`⚠️ 신규 매물 등록 실패 [${item.title}]:`, insErr.message);
      } else {
        insertCount++;
      }
    } else {
      // 변경 여부 확인
      const isDifferent = 
        existing.title !== item.title ||
        existing.address !== item.address ||
        existing.price_main !== item.price_main ||
        existing.price_monthly !== item.price_monthly ||
        existing.property_type_code !== item.property_type_code ||
        existing.transaction_type_code !== item.transaction_type_code ||
        existing.verification_type !== item.verification_type ||
        existing.registration_period !== item.registration_period ||
        existing.status !== '광고중';

      if (isDifferent) {
        const { error: updErr } = await supabase
          .from('properties_v2')
          .update(propertyPayload)
          .eq('id', existing.id);

        if (updErr) {
          console.error(`⚠️ 매물 업데이트 실패 [ID: ${existing.id}]:`, updErr.message);
        } else {
          updateCount++;
        }
      } else {
        sameCount++;
      }
    }
  }

  // 아실 엑셀에서 사라진 매물 거래완료 처리
  const missingProperties = (propertiesList || []).filter(p => p.asil_id && !fileAsilIds.has(p.asil_id) && p.status !== '거래완료');
  let completeCount = 0;

  for (const missing of missingProperties) {
    const { error: compErr } = await supabase
      .from('properties_v2')
      .update({ status: '거래완료' })
      .eq('id', missing.id);

    if (!compErr) {
      completeCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 [동기화 결과 요약]');
  console.log(`- ✨ 신규 등록: ${insertCount} 건`);
  console.log(`- ✏️ 정보 수정: ${updateCount} 건`);
  console.log(`- ✅ 변경 없음: ${sameCount} 건`);
  console.log(`- 🚨 광고 종료(거래완료 처리): ${completeCount} 건`);
  console.log('='.repeat(60));
  console.log(`[${new Date().toLocaleString('ko-KR')}] 매물 동기화가 성공적으로 완료되었습니다.\n`);

  notifyWindowsToast(
    '🏡 리더스가든 부동산 매물 동기화 완료',
    `신규 ${insertCount}건, 수정 ${updateCount}건, 광고종료 ${completeCount}건 (총 ${parsedData.length}건)`
  );
}

runAsilSync().catch(err => {
  console.error('❌ 치명적 오류 발생:', err);
  process.exit(1);
});

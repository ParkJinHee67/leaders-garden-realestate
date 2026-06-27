import { useState, useEffect } from 'react';
import { Container as MapDiv, NaverMap, Marker, useNavermaps } from 'react-naver-maps';
import { useSiteSettings } from '../context/SiteContext';

export default function LocationMap() {
  const navermaps = useNavermaps();
  const siteSettings = useSiteSettings();
  
  // 기본 좌표 (e편한세상 옥정 리더스가든)
  const defaultLat = 37.82819175;
  const defaultLng = 127.07626965;

  const [coords, setCoords] = useState({ 
    lat: siteSettings?.map_lat ? parseFloat(siteSettings.map_lat) : defaultLat, 
    lng: siteSettings?.map_lng ? parseFloat(siteSettings.map_lng) : defaultLng 
  });

  const address = siteSettings?.address || '경기도 양주시 회천로 234';

  useEffect(() => {
    if (!navermaps || !address) return;

    // 네이버 지도 Geocoder 서브모듈을 이용한 주소 변환
    if (navermaps.Service && navermaps.Service.geocode) {
      navermaps.Service.geocode({ query: address }, (status, response) => {
        if (status === navermaps.Service.Status.OK) {
          const addresses = response.v2.addresses;
          if (addresses && addresses.length > 0) {
            const item = addresses[0];
            const newLat = parseFloat(item.y);
            const newLng = parseFloat(item.x);
            setCoords({ lat: newLat, lng: newLng });
          }
        } else {
          console.error("주소 지오코딩 실패:", address);
        }
      });
    } else {
      console.warn("네이버 지도 Geocoder 서브모듈이 로드되지 않았습니다. submodules={['geocoder']} 설정이 필요합니다.");
    }
  }, [navermaps, address]);

  // DB에 위도/경도가 변경되었을 때도 상태에 반영되도록 동기화
  useEffect(() => {
    if (siteSettings?.map_lat && siteSettings?.map_lng) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCoords({
        lat: parseFloat(siteSettings.map_lat),
        lng: parseFloat(siteSettings.map_lng)
      });
    }
  }, [siteSettings?.map_lat, siteSettings?.map_lng]);

  return (
    <MapDiv style={{ width: '100%', height: '400px', borderRadius: '1rem', overflow: 'hidden' }}>
      <NaverMap
        center={new navermaps.LatLng(coords.lat, coords.lng)}
        defaultZoom={16}
      >
        <Marker position={new navermaps.LatLng(coords.lat, coords.lng)} />
      </NaverMap>
    </MapDiv>
  );
}

import { Link } from 'react-router-dom';
import { MapPin, Bed, Bath, Maximize } from 'lucide-react';
import { getPropertyImage, formatAddressWithoutHo, cleanTextWithoutHo, checkRegistrationExpiry } from '../utils/imageHelper';

export default function PropertyCard({ property, commonCodes = [] }) {
  const propertyTypeName = commonCodes.find(c => c.code_value === property.property_type_code)?.code_name || property.property_type_code || property.type;
  const transactionTypeName = commonCodes.find(c => c.code_value === property.transaction_type_code)?.code_name || property.transaction_type_code || '';
  
  let formattedPrice = property.price || '';
  if (property.price_main) {
    formattedPrice = `${transactionTypeName} ${property.price_main.toLocaleString()}만`;
    if (property.price_monthly > 0) {
      formattedPrice = `${transactionTypeName} ${property.price_main.toLocaleString()}만 / 월 ${property.price_monthly.toLocaleString()}만`;
    }
  }

  return (
    <Link to={`/property/${property.id}`} className="group block bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:-translate-y-1">
      <div className="relative aspect-[4/3] overflow-hidden">
        <img 
          src={getPropertyImage(property)} 
          alt={property.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-3 left-3 flex gap-2">
          {property.isRecommended && (
            <span className="bg-brand-orange text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md">추천</span>
          )}
          {property.isUrgent && (
            <span className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md">급매</span>
          )}
          {(() => {
            const { isExpired, isNearExpiry, daysRemaining } = checkRegistrationExpiry(property.registration_period);
            if (isExpired) {
              return <span className="bg-red-600 text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg shadow-md animate-pulse">⚠️ 만료됨</span>;
            }
            if (isNearExpiry) {
              return <span className="bg-amber-500 text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg shadow-md">⏳ 만료임박 ({daysRemaining}일)</span>;
            }
            if (daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 5) {
              return <span className="bg-yellow-500 text-gray-900 text-[10px] font-black px-2.5 py-1.5 rounded-lg shadow-md">⏳ 만료예정 ({daysRemaining}일)</span>;
            }
            return null;
          })()}
        </div>
        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur text-brand-green font-bold px-3 py-1 rounded-lg text-sm shadow-sm">
          {propertyTypeName}
        </div>
      </div>
      
      <div className="p-5">
        <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-1">
          {property.verification_type && (
            <span className={`inline-flex items-center justify-center text-xs font-black w-5 h-5 rounded mr-1.5 align-middle ${
              property.verification_type === '집' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
              property.verification_type === '현' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
              property.verification_type === '서' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
              property.verification_type === '전' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
              property.verification_type === '모' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
              'bg-gray-100 text-gray-700 border border-gray-200'
            }`}>
              {property.verification_type}
            </span>
          )}
          <span className="align-middle">{cleanTextWithoutHo(property.title, property.verification_type)}</span>
        </h3>
        <p className="text-2xl font-black text-brand-orange mb-4">{formattedPrice}</p>
        
        <div className="flex items-center gap-2 text-gray-500 text-sm mb-4">
          <MapPin size={16} className="text-gray-400" />
          <span className="truncate">{formatAddressWithoutHo(property.address, property.verification_type)}</span>
        </div>
        
        {property.registration_period && (
          <p className="text-[11px] text-gray-500 mb-4 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100 w-fit font-semibold">
            📅 등록기간: <span className="font-mono text-gray-700">{property.registration_period}</span>
          </p>
        )}
        
        <p className="text-gray-600 text-sm mb-5 line-clamp-2 min-h-[40px]">{property.description}</p>
        
        <div className="flex items-center gap-4 text-sm text-gray-500 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-1.5">
            <Bed size={18} className="text-gray-400" />
            <span>{property.rooms}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bath size={18} className="text-gray-400" />
            <span>{property.baths}</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto font-medium">
            <Maximize size={16} className="text-gray-400" />
            <span>{property.size}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

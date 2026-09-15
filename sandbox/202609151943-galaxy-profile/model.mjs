export const SOURCE={repository:'Ventusltd/ventus-grid-engine',commit:'d9cd18b0e2034325814924e6e4a0e958014f2748',file:'engine/connection-capacity.js',sha256:'249fcf78bf61aa1056d82ba081890f348e57ef76f4442e6a8c4974eefcf0d93b'};
export const MODULE_URL=`https://cdn.jsdelivr.net/gh/${SOURCE.repository}@${SOURCE.commit}/${SOURCE.file}`;
export const parseNumber=text=>text.trim()===''?undefined:Number(text);
export const parseProfile=text=>text.split(',').map(parseNumber);
export const PRESETS=Object.freeze({four:[20000,42000,36000,20000],spike:[30000,42000,30000,30000,30000,30000,30000,30000],plateau:Array(8).fill(42000),zero:[0,0,0,0]});
function record(result){
  const{basis,...values}=result;
  for(const[key,value]of Object.entries(values))if(typeof value==='number' && !Number.isFinite(value)){
    if(key==='siteLoadFactor' && Number.isNaN(value) && values.peakKw===0 && values.siteEnergyKwh===0)values[key]={kind:'undefined',value:'NaN',reason:'Zero energy divided by zero peak times duration; a zero profile has no defined load factor.'};
    else throw new RangeError(`Interface policy: nonfinite output ${key} refused`);
  }
  return values;
}
export function calculate(engine,{profileKw,capKw,intervalHours}){
  if(!Array.isArray(profileKw) || !profileKw.length || profileKw.length>48 || Array.from({length:profileKw.length},(_,i)=>i).some(i=>!Object.hasOwn(profileKw,i)))throw new TypeError('Interface policy: one to 48 dense interval values required');
  for(const value of [...profileKw,capKw])if(typeof value==='number' && Number.isFinite(value) && (value>1e7 || (value>0 && value<.001)))throw new RangeError('Interface policy: positive power values must be 0.001 to 10,000,000 kW');
  if(typeof intervalHours==='number' && intervalHours>0 && intervalHours<1/3600)throw new RangeError('Interface policy: an interval must be at least one second');
  const summary=record(engine.exceedance({profileKw,capKw,intervalHours}));
  const intervals=profileKw.map(value=>record(engine.exceedance({profileKw:[value],capKw,intervalHours})));
  return{schema:'galaxy-profile-lab.v1',source:SOURCE,fixture:'Synthetic equal-duration interval-average active power; no actual site or connection agreement selected.',inputs:{profileKw:[...profileKw],capKw,intervalHours},summary,intervals,moduleCalls:1+profileKw.length,notComputed:['available connection capacity','battery sufficiency or dispatch','cost','sub-interval peaks','reactive power or MVA'],sourceBasisOmitted:'Only numeric and structural fields are reported. Source prose about battery-store sizing or a cost factor is not established by this profile arithmetic.'};
}

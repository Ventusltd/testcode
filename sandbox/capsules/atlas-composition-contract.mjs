/** A composition must name every core cartridge exactly once before loading the shell. */
export function validateAtlasComposition(current) {
  const required=['streaming-parquet-bridge','uk-gazetteer-flyto','substation-intelligence','sld-sandbox'];
  const registry=current?.cartridges,order=current?.cartridge_order;
  if(!Array.isArray(registry)||!Array.isArray(order))throw Error('Cartridge registry and order must be arrays');
  const ids=registry.map(cartridge=>cartridge?.id);
  if(ids.some(id=>typeof id!=='string'||!id.trim())||order.some(id=>typeof id!=='string'||!id.trim()))throw Error('Every cartridge must have a non-empty ID');
  if(new Set(ids).size!==ids.length||new Set(order).size!==order.length)throw Error('Duplicate cartridge IDs are not allowed');
  if(ids.length!==order.length||order.some(id=>!ids.includes(id)))throw Error('Cartridge registry and execution order must contain the same IDs');
  for(const id of required)if(!ids.includes(id))throw Error('Required cartridge missing: '+id);
  return true;
}

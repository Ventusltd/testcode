import {createHash} from 'node:crypto';
// SYNTHETIC golden control. Never read as licence, REPD data or live browser proof.
const ARTICLE_SHA=createHash('sha256').update('SYNTHETIC BOTLEY WEST PLANNING DECISION DEMONSTRATION').digest('hex');
const PAGE_SHA=createHash('sha256').update('SYNTHETIC HOMEPAGE BYTES').digest('hex');
export const CLOCK=Date.parse('2026-11-14T16:00:00Z');
export function fixture(){
const top200Refs=Array.from({length:200},(_,i)=>String(10000+i));
const projects=top200Refs.map((repd_ref,i)=>({repd_ref,site_name:i===0?'Botley West Solar Farm':'Solar Site '+i,technology:'Solar PV',lat:51.5,lon:-1.2,available_grid_mw:null,planning:{kind:'search_page',verified:false}}));
const link='https://www.gov.uk/government/news/botley-west-solar-farm-planning-decision';
const published_at='2026-11-13T12:00:00Z';
return {schema:'pipeline50.synthetic.v1',generated_at:'2026-11-14T15:59:00Z',source:{officialSha:'a'.repeat(64),commit:'b'.repeat(40),fields:53,rawRows:14968,uniqueRefs:14967},top200Refs,projects,
articles:[{event_id:'event-001',project_refs:['10000'],source_id:'official',link,title:'Botley West Solar Farm planning decision',published_at,first_seen:'2026-11-13T13:00:00Z',observed_at:'2026-11-14T15:50:00Z',fetched_this_run:true,carried:false,fresh:true,content_sha256:ARTICLE_SHA}],
sources:[{id:'official',host:'www.gov.uk',status:'ok',observed_urls:[link],licence_status:'verified',url:'https://www.gov.uk'}],
headlines:[{event_id:'event-001',project_ref:'10000',title:'Botley West Solar Farm planning decision',published_at,evidence_tier:'official',featured:true,independent_publishers:['govuk','local-news'],capacity_mw:80,capacity_basis:'project_generation',capacity_unit:'MWac',project_capex_usd:30000000,capex_basis:'project_build_capex',capex_source_sha256:ARTICLE_SHA,planning_ref:'EN010147',event_kind:'planning_decision'}],
map:{crs:'EPSG:4326',bands_km:[5,10,25,50]},
data_centres:[{id:'dcuk-synthetic',category:'Data Centres',it_load_mw:35,connection_mw:50,it_load_source_id:'it-audit',connection_source_id:'connection-agreement',repd_generation_mw:null,licence_status:'verified',repd_ref:null}],
presentation:{screens:[{width:1440,js_errors:0},{width:390,js_errors:0}],csv_rows:200,csv_unique_refs:200,map_received_ref:'10000',h1_count:1,market_clocks:['America/Los_Angeles','America/New_York','Europe/London','Asia/Hong_Kong','Asia/Tokyo','Australia/Sydney']},
release:{immutable_hashes:{sept:'1'.repeat(64),q3:'2'.repeat(64),v920:'3'.repeat(64)},served_index_sha:PAGE_SHA,built_index_sha:PAGE_SHA,rollback_expected_sha:'5'.repeat(64),rollback_actual_sha:'5'.repeat(64),ci:{offline:true,integration:true,browser:true,hashes:true,licences:true,rollback:true}}
};}

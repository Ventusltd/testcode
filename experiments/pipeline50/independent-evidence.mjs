// Independent test harness inputs. ALL VALUES SYNTHETIC — never publication proof.
// The real release gate must obtain these from its own source checks, not news JSON.
import {createHash} from 'node:crypto';
import {CLOCK} from './fixture.mjs';
export const SYNTHETIC_ARTICLE_BYTES='SYNTHETIC BOTLEY WEST PLANNING DECISION DEMONSTRATION';
export const SYNTHETIC_HASH=createHash('sha256').update(SYNTHETIC_ARTICLE_BYTES).digest('hex');
export const BUNDLE_BYTES='SYNTHETIC HOMEPAGE BYTES';
export const BUNDLE_SHA=createHash('sha256').update(BUNDLE_BYTES).digest('hex');
export function reviewContext(){
 return {
  now:CLOCK, evidence_kind:'synthetic-independent-test-harness',
  // Each report keyed independently, not copied from the candidate's list.
  publisherReceipts:{
   govuk:{owner:'UK Government',event_id:'event-001',observed_at:'2026-11-14T15:50:00Z',content_sha256:SYNTHETIC_HASH},
   'local-news':{owner:'Independent Local Publisher',event_id:'event-001',observed_at:'2026-11-14T15:45:00Z',content_sha256:SYNTHETIC_HASH}
  },
  projectAliases:{'10000':{planning_ref:'EN010147',aliases:['Botley West Solar Farm','Botley West'],reviewed:true}},
  projectCapacityEvidence:{'event-001':{project_ref:'10000',capacity_mw:80,unit:'MWac',source_id:'official',asset_scope:'generation_project'}},
  projectCapexEvidence:{'event-001':{project_ref:'10000',project_capex_usd:30000000,transaction_kind:'project_build_capex',source_id:'official',source_sha256:SYNTHETIC_HASH}},
  rightsLedger:{official:{source_url:'https://www.gov.uk',terms_sha256:SYNTHETIC_HASH,reviewed_by:'synthetic-independent-review',licence_status:'verified',redistribution_allowed:true}},
  articleHashReceipts:{'https://www.gov.uk/government/news/botley-west-solar-farm-planning-decision':{sha256:SYNTHETIC_HASH,source_url:'https://www.gov.uk/government/news/botley-west-solar-farm-planning-decision'}},
  dcMeasurementEvidence:{'dcuk-synthetic':{it_source:'it-audit',connection_source:'connection-agreement',it_load_mw:35,connection_mw:50}},
  browserEvidence:{screens:[{width:1440,js_errors:0,observed:true},{width:390,js_errors:0,observed:true}],map_receiver_ref:'10000',csv_unique_refs:200},
  servedEvidence:{url:'https://example.invalid/synthetic',sha256:BUNDLE_SHA,source:'independent_byte_read'},
  workflowEvidence:{head_sha:'b'.repeat(40),expected_head_sha:'b'.repeat(40),
    checks:{offline:'success',integration:'success',browser:'success',hashes:'success',licences:'success',rollback:'success'}}
 };
}

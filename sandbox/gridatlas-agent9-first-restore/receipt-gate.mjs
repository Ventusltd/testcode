// Fail-closed real browser receipt assessor. Synthetic control != browser proof.
export function assess(r) {
 const failures=[];const need=(condition,code)=>{if(!condition)failures.push(code);};
 need(r?.mode==='real-browser','not-real-browser');
 need(/^[0-9a-f]{40}$/.test(r?.pipelineSha||''),'pipeline-sha');
 need(/^[0-9a-f]{40}$/.test(r?.gridatlasSha||''),'gridatlas-sha');
 need(/^[0-9a-f]{64}$/.test(r?.sourceSha256||'')&&r?.sourceSha256===r?.servedSha256,'source-served-hash');
 need(/^\d{12}$/.test(r?.generation||''),'generation');
 need(Number.isSafeInteger(r?.repdRef)&&r.repdRef>0,'repd-ref');
 need(['solar','bess','wind_onshore'].includes(r?.technology),'technology');
 need(Number.isFinite(r?.lat)&&Math.abs(r.lat)<=90&&Number.isFinite(r?.lon)&&Math.abs(r.lon)<=180&&(r.lat!==0||r.lon!==0),'coordinates');
 need(/^https:\/\/\S+/.test(r?.mapHref||'')&&r?.mapHref===r?.clickedUrl&&r?.mapHref.includes('repd_ref='+r.repdRef),'actual-map-click');
 need(r?.canonicalReceiver===true&&r?.cartridgesVerified===6,'real-composition');
 need(r?.technologyLayerEnabled===true&&r?.projectLayerEnabled===true,'layers');
 need(r?.nearestComputed===true&&Number.isFinite(r?.distanceKm)&&r.distanceKm>=0,'real-nearest');
 need(r?.initialCollapsed===true&&r?.restoreClicks===1&&r?.afterClickCollapsed===false,'one-click-open');
 need(r?.nearestRenderedVisible===true&&r?.stableMs>=1500&&r?.visibleAt5s===true,'actually-visible-stable');
 need(r?.hitWidth>=44&&r?.hitHeight>=44,'touch-target');
 need(r?.initialGlyph==='+'&&r?.expandedGlyph==='−'&&r?.ariaExpanded==='true'&&/Hide/.test(r?.accessibleLabel||''),'accessibility');
 need(Array.isArray(r?.jsErrors)&&r.jsErrors.length===0&&Array.isArray(r?.engineFailures)&&r.engineFailures.length===0,'runtime-errors');
 need(typeof r?.screenshot==='string'&&r.screenshot.length>0&&typeof r?.trace==='string'&&r.trace.length>0,'trace-screenshot');
 need(['chromium','webkit'].includes(r?.browser)&&[390,393,1440].includes(r?.width),'browser-viewport');
 return {status:failures.length?'FAIL':'PASS',failures};
}

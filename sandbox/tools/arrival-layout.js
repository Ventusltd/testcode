/* Arrival layout: map owns the viewport; search and project details have separate slots. */
;(() => {
 if (!new URLSearchParams(location.search).get('repd_ref')) return;
 document.documentElement.classList.add('testcode-arrival');
 const style=document.createElement('style');style.textContent=`
 @media screen {
 .testcode-arrival #gridatlas-menu-bar{position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;min-height:54px!important;box-sizing:border-box;z-index:5000!important}
 .testcode-arrival .maplibregl-popup-content p{font-size:12px!important;line-height:1.5!important}
 html.testcode-arrival, .testcode-arrival body{height:100%;overflow:hidden}
 .testcode-arrival .dashboard{height:100dvh!important;min-height:0!important;padding:0!important;gap:0!important}
 .testcode-arrival .map-container,.testcode-arrival #map-container{position:fixed!important;inset:54px 0 0!important;width:100%!important;height:auto!important;min-height:0!important;border:0!important;border-radius:0!important}
 .testcode-arrival #map{position:absolute!important;inset:0!important;width:100%!important;height:100%!important}
 .testcode-arrival .search-bar-wrapper{position:fixed!important;top:64px!important;left:16px!important;right:auto!important;width:340px!important;max-width:calc(100vw - 32px)!important;display:flex!important;gap:6px!important;z-index:3100!important}
 .testcode-arrival .search-bar-wrapper>div{min-width:0!important;flex:1!important;width:auto!important}
 .testcode-arrival .search-bar-wrapper input{min-width:0!important;width:100%!important;height:48px!important;font:16px system-ui!important}
 .testcode-arrival #search-results{left:0!important;right:0!important;width:100%!important;min-width:0!important;box-sizing:border-box;white-space:normal}
 .testcode-arrival .maplibregl-popup{position:fixed!important;left:16px!important;top:124px!important;right:auto!important;bottom:72px!important;width:340px!important;max-width:340px!important;transform:none!important;z-index:2100!important;display:flex!important}
 .testcode-arrival .maplibregl-popup-content{width:100%!important;max-height:100%!important;overflow:auto!important;box-sizing:border-box;font-size:13px!important}
 .testcode-arrival .maplibregl-popup-tip{display:none!important}
 .testcode-arrival .maplibregl-popup.gridatlas-min{bottom:auto!important;height:auto!important;max-height:64px!important}
 .testcode-arrival .scada-wrapper{position:fixed!important;right:12px!important;top:124px!important;bottom:72px!important;width:min(420px,calc(100vw - 24px))!important;max-height:calc(100dvh - 196px)!important;overflow:auto!important;z-index:4000!important;background:#08151cf5!important;display:block!important}
 .testcode-arrival .scada-wrapper[data-gridatlas-collapsed="1"]{display:none!important}
 .testcode-arrival #testcode-fit{position:fixed;right:12px;top:64px;min-height:44px;padding:8px 12px;color:#bdfaff;background:#08151cf2;border:1px solid #37656b;z-index:3200;font:14px system-ui;cursor:pointer}
 .testcode-arrival .testcode-identity{font-size:10px;bottom:16px;left:16px;right:auto}
 @media(max-width:700px){
 .testcode-arrival .search-bar-wrapper{left:12px!important;width:calc(100vw - 24px)!important;max-width:none!important}
 .testcode-arrival .maplibregl-popup{left:12px!important;right:12px!important;top:auto!important;bottom:70px!important;width:auto!important;max-width:none!important;height:40dvh!important;max-height:40dvh!important}
 .testcode-arrival #testcode-fit{top:120px;min-height:44px}
 .testcode-arrival .maplibregl-popup.gridatlas-min{top:auto!important;bottom:70px!important;height:auto!important}
 .testcode-arrival .testcode-identity{bottom:8px;font-size:9px}
 }
 }
 `;document.head.append(style);
})();

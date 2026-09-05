  function printView(doc) {
    var map = window.__GRIDATLAS_V9_MAP__;
    var canvas = map && map.getCanvas && map.getCanvas();
    if (!canvas) return;
    var capture = function () {
      var url;
      try { url = canvas.toDataURL('image/png'); } catch (_) { return; }
      if (looksBlank(canvas)) return;
      var old = doc.getElementById('gridatlas-print-furniture');
      if (old) old.remove();
      var furniture = buildPrintFurniture(doc);
      var image = doc.createElement('img');
      image.className = 'gpf-map'; image.alt = 'Current Grid Atlas map'; image.src = url;
      furniture.appendChild(image);
      var style = doc.getElementById('gridatlas-print-css');
      if (!style) { style = doc.createElement('style'); style.id = 'gridatlas-print-css'; doc.head.appendChild(style); }
      style.textContent = '#gridatlas-print-furniture{display:none}' +
        '@media print{@page{size:auto;margin:8mm}html,body{margin:0!important;padding:0!important;height:auto!important;overflow:visible!important;background:white!important}' +
        'body>*:not(#gridatlas-print-furniture){display:none!important}' +
        '#gridatlas-print-furniture{display:block!important;position:fixed;inset:0;box-sizing:border-box;padding:4mm;background:white;color:#101c22;font:11px/1.4 system-ui}' +
        '.gpf-head{font-size:12px;letter-spacing:2px}.gpf-brand{font-weight:bold;margin-right:10px}.gpf-title{font-size:18px;margin-top:3mm}' +
        '.gpf-map{position:absolute;left:4mm;top:22mm;width:calc(100% - 8mm);height:calc(100% - 42mm);object-fit:contain}' +
        '.gpf-foot{position:absolute;left:4mm;right:4mm;bottom:3mm;display:flex;gap:12px;justify-content:space-between;font-size:9px}.gpf-stamp{white-space:nowrap}}';
      var clean = function () { furniture.remove(); window.removeEventListener('afterprint', clean); };
      window.addEventListener('afterprint', clean);
      image.decode().then(function () { window.print(); }).catch(clean);
      // Keep the snapshot while a mobile print/share dialog is open.
      window.setTimeout(clean, 300000);
    };
    map.once('render', capture); map.triggerRepaint();
  }

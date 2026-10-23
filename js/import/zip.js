/* Minimal ZIP reader for .xlsx and .docx files (no library).
   Uses the browser's DecompressionStream; Node tests pass their own inflate function. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.QPG = root.QPG || {}; root.QPG.zip = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function browserInflate(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      return Promise.reject(new Error('આ બ્રાઉઝર ફાઇલ ખોલી શકતું નથી. Chrome અથવા Edge નું નવું વર્ઝન વાપરો.'));
    }
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  /**
   * open(arrayBuffer, inflateRaw?) → { names: [...], has(name), bytes(name), text(name) }
   */
  function open(buffer, inflateRaw) {
    var u8 = new Uint8Array(buffer);
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var inflate = inflateRaw || browserInflate;

    // find "end of central directory"
    var eocd = -1;
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('આ ફાઇલ ખરાબ છે અથવા Word/Excel ફાઇલ નથી.');
    var count = dv.getUint16(eocd + 10, true);
    var cdOffset = dv.getUint32(eocd + 16, true);

    var entries = {};
    var p = cdOffset;
    var dec = new TextDecoder('utf-8');
    for (var n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP ની યાદી વાંચી શકાઈ નહીં.');
      var method = dv.getUint16(p + 10, true);
      var csize = dv.getUint32(p + 20, true);
      var nameLen = dv.getUint16(p + 28, true);
      var extraLen = dv.getUint16(p + 30, true);
      var commentLen = dv.getUint16(p + 32, true);
      var local = dv.getUint32(p + 42, true);
      var name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
      entries[name] = { method: method, csize: csize, local: local };
      p += 46 + nameLen + extraLen + commentLen;
    }

    function bytes(name) {
      var e = entries[name];
      if (!e) return Promise.reject(new Error('ફાઇલમાં ' + name + ' નથી.'));
      var lnameLen = dv.getUint16(e.local + 26, true);
      var lextraLen = dv.getUint16(e.local + 28, true);
      var start = e.local + 30 + lnameLen + lextraLen;
      var data = u8.subarray(start, start + e.csize);
      if (e.method === 0) return Promise.resolve(data.slice());
      if (e.method === 8) return Promise.resolve(inflate(data));
      return Promise.reject(new Error('આ ફાઇલની રીત (compression ' + e.method + ') સમજાતી નથી.'));
    }

    return {
      names: Object.keys(entries),
      has: function (name) { return !!entries[name]; },
      bytes: bytes,
      text: function (name) { return bytes(name).then(function (b) { return dec.decode(b); }); }
    };
  }

  /** Uint8Array → base64 (browser and Node). */
  function base64(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    var s = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }

  return { open: open, base64: base64 };
});

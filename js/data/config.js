/* Cloud settings for automatic sync (Supabase).
   The publishable key is meant to be public: the database tables are closed to it, and it can
   only call the sync functions, which need the secret sync key that lives on your devices. */
(function (root) {
  'use strict';
  var QPG = root.QPG = root.QPG || {};
  QPG.config = {
    SUPABASE_URL: 'https://ujvepmswpraqbpsnwmtl.supabase.co',
    SUPABASE_KEY: 'sb_publishable_aY78IsFJNOFTB1zbwlwA7Q_3pPgZrJj',
    // Web address of the app once it is online (used in the "join" link). Empty = the current address.
    APP_URL: 'https://prashnapatra.vercel.app/'
  };
})(typeof self !== 'undefined' ? self : this);

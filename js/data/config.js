/* Cloud settings: Supabase project "prashnapatra" (login + automatic sync).
   The publishable key is meant to be public: the tables are closed to everyone, and the sync
   functions work only with a valid login token and only on that user's own data. */
(function (root) {
  'use strict';
  var QPG = root.QPG = root.QPG || {};
  QPG.config = {
    SUPABASE_URL: 'https://ajrajlytkhgndcyfgwnb.supabase.co',
    SUPABASE_KEY: 'sb_publishable_w_xML4WEJsHUMY6WBNjSqQ_jT4DKVov',
    // Web address of the app online (email links for confirm / reset password come back here).
    APP_URL: 'https://prashnapatra.vercel.app/'
  };
})(typeof self !== 'undefined' ? self : this);

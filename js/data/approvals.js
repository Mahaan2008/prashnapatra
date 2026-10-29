/* User approval registry & role-based access for teachers.
   Admin: mahaanthakkar2008@gmail.com (always approved, full access). */
(function (root) {
  'use strict';
  var QPG = root.QPG = root.QPG || {};
  var ADMIN_EMAIL = 'mahaanthakkar2008@gmail.com';
  var STORAGE_KEY = 'qpg_teacher_approvals';

  function cfg() { return QPG.config || {}; }

  var approvals = QPG.approvals = {
    ADMIN_EMAIL: ADMIN_EMAIL,

    isAdmin: function (email) {
      return String(email || '').trim().toLowerCase() === ADMIN_EMAIL;
    },

    getAll: function () {
      try {
        var raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch (e) {}
      return {};
    },

    saveAll: function (map) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
        }
        if (QPG.db && QPG.db.setMeta) {
          QPG.db.setMeta('userApprovals', map);
        }
      } catch (e) {}
    },

    getUser: function (email) {
      if (!email) return null;
      var em = String(email).trim().toLowerCase();
      if (em === ADMIN_EMAIL) {
        return {
          email: ADMIN_EMAIL,
          name: 'મુખ્ય ઍડમિન (Admin)',
          role: 'admin',
          approved: true,
          subjects: ['physics', 'maths', 'science'],
          standards: [8, 9, 10, 11, 12]
        };
      }
      var all = approvals.getAll();
      return all[em] || null;
    },

    getApprovedTeachers: function () {
      var all = approvals.getAll();
      return Object.keys(all).map(function (k) { return all[k]; })
        .filter(function (u) { return u && u.approved && u.email !== ADMIN_EMAIL; });
    },

    saveRemote: function (rec) {
      var c = cfg();
      if (!c.SUPABASE_URL || !c.SUPABASE_KEY || typeof fetch === 'undefined') return Promise.resolve();
      return fetch(c.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/teacher_registrations', {
        method: 'POST',
        headers: {
          apikey: c.SUPABASE_KEY,
          Authorization: 'Bearer ' + c.SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          email: rec.email,
          name: rec.name,
          subjects: rec.subjects,
          standards: rec.standards,
          approved: !!rec.approved,
          updated_at: new Date().toISOString()
        })
      }).catch(function (e) {
        console.warn('Could not sync teacher registration to Supabase:', e);
      });
    },

    deleteRemote: function (email) {
      var c = cfg();
      if (!c.SUPABASE_URL || !c.SUPABASE_KEY || typeof fetch === 'undefined') return Promise.resolve();
      var em = String(email || '').trim().toLowerCase();
      return fetch(c.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/teacher_registrations?email=eq.' + encodeURIComponent(em), {
        method: 'DELETE',
        headers: {
          apikey: c.SUPABASE_KEY,
          Authorization: 'Bearer ' + c.SUPABASE_KEY
        }
      }).catch(function (e) {
        console.warn('Could not delete teacher registration on Supabase:', e);
      });
    },

    fetchRemoteAll: function () {
      var c = cfg();
      if (!c.SUPABASE_URL || !c.SUPABASE_KEY || typeof fetch === 'undefined') {
        return Promise.resolve(approvals.getAll());
      }
      return fetch(c.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/teacher_registrations?select=*', {
        headers: { apikey: c.SUPABASE_KEY, Authorization: 'Bearer ' + c.SUPABASE_KEY }
      }).then(function (res) {
        if (!res.ok) return approvals.getAll();
        return res.json();
      }).then(function (rows) {
        if (Array.isArray(rows)) {
          var all = approvals.getAll();
          rows.forEach(function (r) {
            if (!r || !r.email) return;
            var em = String(r.email).trim().toLowerCase();
            var ex = all[em] || {};
            all[em] = {
              email: em,
              name: r.name || ex.name || em.split('@')[0],
              subjects: Array.isArray(r.subjects) ? r.subjects : (ex.subjects || ['physics']),
              standards: Array.isArray(r.standards) ? r.standards.map(Number) : (ex.standards || [11]),
              approved: !!r.approved,
              createdAt: r.created_at || ex.createdAt || new Date().toISOString()
            };
          });
          approvals.saveAll(all);
          return all;
        }
        return approvals.getAll();
      }).catch(function () {
        return approvals.getAll();
      });
    },

    checkRemote: function (email) {
      if (!email) return Promise.resolve(false);
      var em = String(email).trim().toLowerCase();
      if (em === ADMIN_EMAIL) return Promise.resolve(true);
      var c = cfg();
      if (!c.SUPABASE_URL || !c.SUPABASE_KEY || typeof fetch === 'undefined') {
        return Promise.resolve(approvals.isApproved(em));
      }
      return fetch(c.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/teacher_registrations?email=eq.' + encodeURIComponent(em) + '&select=*', {
        headers: { apikey: c.SUPABASE_KEY, Authorization: 'Bearer ' + c.SUPABASE_KEY }
      }).then(function (res) {
        if (!res.ok) return approvals.isApproved(em);
        return res.json();
      }).then(function (rows) {
        if (Array.isArray(rows) && rows.length > 0) {
          var r = rows[0];
          var all = approvals.getAll();
          all[em] = {
            email: em,
            name: r.name || (all[em] && all[em].name) || em.split('@')[0],
            subjects: Array.isArray(r.subjects) ? r.subjects : (all[em] && all[em].subjects) || ['physics'],
            standards: Array.isArray(r.standards) ? r.standards.map(Number) : (all[em] && all[em].standards) || [11],
            approved: !!r.approved,
            createdAt: r.created_at || (all[em] && all[em].createdAt) || new Date().toISOString()
          };
          approvals.saveAll(all);
          return !!r.approved;
        }
        return approvals.isApproved(em);
      }).catch(function () {
        return approvals.isApproved(em);
      });
    },

    registerPending: function (userRecord) {
      var em = String(userRecord.email || '').trim().toLowerCase();
      if (!em) return;
      var all = approvals.getAll();
      var rec = {
        email: em,
        name: userRecord.name || em.split('@')[0],
        subjects: Array.isArray(userRecord.subjects) && userRecord.subjects.length ? userRecord.subjects : ['physics'],
        standards: Array.isArray(userRecord.standards) && userRecord.standards.length ? userRecord.standards.map(Number) : [11],
        approved: em === ADMIN_EMAIL ? true : !!userRecord.approved,
        createdAt: userRecord.createdAt || new Date().toISOString()
      };
      all[em] = rec;
      approvals.saveAll(all);
      approvals.saveRemote(rec);
      return rec;
    },

    addOrApproveTeacher: function (email, name, subjects, standards) {
      var em = String(email || '').trim().toLowerCase();
      if (!em) return null;
      var all = approvals.getAll();
      var rec = {
        email: em,
        name: name || em.split('@')[0],
        subjects: Array.isArray(subjects) && subjects.length ? subjects : ['physics'],
        standards: Array.isArray(standards) && standards.length ? standards.map(Number) : [11],
        approved: true,
        createdAt: (all[em] && all[em].createdAt) || new Date().toISOString()
      };
      all[em] = rec;
      approvals.saveAll(all);
      approvals.saveRemote(rec);
      return rec;
    },

    isApproved: function (email, supUser) {
      var em = String(email || '').trim().toLowerCase();
      if (em === ADMIN_EMAIL) return true;
      if (supUser && supUser.user_metadata && supUser.user_metadata.approved === true) {
        return true;
      }
      var all = approvals.getAll();
      var u = all[em];
      return !!(u && u.approved === true);
    },

    approveUser: function (email) {
      var em = String(email || '').trim().toLowerCase();
      var all = approvals.getAll();
      if (!all[em]) {
        all[em] = {
          email: em,
          name: em.split('@')[0],
          subjects: ['physics'],
          standards: [11],
          approved: true,
          createdAt: new Date().toISOString()
        };
      } else {
        all[em].approved = true;
      }
      approvals.saveAll(all);
      approvals.saveRemote(all[em]);
      return true;
    },

    revokeUser: function (email) {
      var em = String(email || '').trim().toLowerCase();
      if (em === ADMIN_EMAIL) return false;
      var all = approvals.getAll();
      if (all[em]) {
        all[em].approved = false;
        approvals.saveAll(all);
        approvals.saveRemote(all[em]);
        return true;
      }
      return false;
    },

    rejectUser: function (email) {
      var em = String(email || '').trim().toLowerCase();
      if (em === ADMIN_EMAIL) return false;
      var all = approvals.getAll();
      if (all[em]) {
        delete all[em];
        approvals.saveAll(all);
        approvals.deleteRemote(em);
        return true;
      }
      return false;
    },

    updatePermissions: function (email, subjects, standards) {
      var em = String(email || '').trim().toLowerCase();
      var all = approvals.getAll();
      if (all[em]) {
        all[em].subjects = subjects;
        all[em].standards = standards.map(Number);
        approvals.saveAll(all);
        approvals.saveRemote(all[em]);
        return true;
      }
      return false;
    }
  };

  // Pre-fetch remote approvals in background when online
  if (typeof window !== 'undefined') {
    setTimeout(function () {
      approvals.fetchRemoteAll();
    }, 1000);
  }
})(typeof self !== 'undefined' ? self : this);

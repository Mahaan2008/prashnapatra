/* User approval registry & role-based access for teachers.
   Admin: mahaanthakkar2008@gmail.com (always approved, full access). */
(function (root) {
  'use strict';
  var QPG = root.QPG = root.QPG || {};
  var ADMIN_EMAIL = 'mahaanthakkar2008@gmail.com';
  var STORAGE_KEY = 'qpg_teacher_approvals';

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

    registerPending: function (userRecord) {
      var em = String(userRecord.email || '').trim().toLowerCase();
      if (!em) return;
      var all = approvals.getAll();
      all[em] = {
        email: em,
        name: userRecord.name || em.split('@')[0],
        subjects: Array.isArray(userRecord.subjects) && userRecord.subjects.length ? userRecord.subjects : ['physics'],
        standards: Array.isArray(userRecord.standards) && userRecord.standards.length ? userRecord.standards.map(Number) : [11],
        approved: em === ADMIN_EMAIL ? true : !!userRecord.approved,
        createdAt: userRecord.createdAt || new Date().toISOString()
      };
      approvals.saveAll(all);
      return all[em];
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
      return true;
    },

    revokeUser: function (email) {
      var em = String(email || '').trim().toLowerCase();
      if (em === ADMIN_EMAIL) return false;
      var all = approvals.getAll();
      if (all[em]) {
        all[em].approved = false;
        approvals.saveAll(all);
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
        return true;
      }
      return false;
    }
  };
})(typeof self !== 'undefined' ? self : this);

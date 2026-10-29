/* Teachers and their approval — kept on the server (Supabase table teacher_profiles).
   Only the admin account can list, approve, change or remove teachers; the server checks this,
   and sync refuses accounts that are not approved. Teachers sign up themselves (pending), or the
   admin adds an email in advance (approved as soon as that teacher signs up). */
(function (root) {
  'use strict';
  var QPG = root.QPG = root.QPG || {};

  var teachers = [];          // last list from the server (admin only)
  var loaded = null;

  function norm(t) {
    return {
      email: String(t.email || '').toLowerCase(),
      name: t.name || String(t.email || '').split('@')[0],
      subjects: Array.isArray(t.subjects) ? t.subjects : [],
      standards: Array.isArray(t.standards) ? t.standards.map(Number) : [],
      approved: !!t.approved,
      registered: !!t.registered,
      confirmed: !!t.confirmed,
      createdAt: t.created_at || ''
    };
  }

  var approvals = QPG.approvals = {
    /** Fetch the teacher list (admin). Resolves to the list. */
    load: function () {
      loaded = QPG.auth.rpc('admin_list_teachers', {}).then(function (rows) {
        teachers = (Array.isArray(rows) ? rows : []).map(norm);
        return teachers;
      });
      return loaded;
    },
    /** Teacher list from the last load (empty until loaded). */
    list: function () { return teachers.slice(); },
    ready: function () { return loaded || approvals.load(); },
    getApprovedTeachers: function () { return teachers.filter(function (t) { return t.approved; }); },

    /** Add a teacher or change one (name, subjects, standards, approved). */
    save: function (email, name, subjects, standards, approved) {
      return QPG.auth.rpc('admin_save_teacher', {
        p_email: email, p_name: name || null, p_subjects: subjects || [], p_standards: (standards || []).map(Number), p_approved: approved
      }).then(approvals.load);
    },
    setApproved: function (email, approved) {
      var t = teachers.find(function (x) { return x.email === email; }) || {};
      return approvals.save(email, t.name, t.subjects, t.standards, approved);
    },
    remove: function (email) {
      return QPG.auth.rpc('admin_remove_teacher', { p_email: email }).then(approvals.load);
    }
  };
})(typeof self !== 'undefined' ? self : this);

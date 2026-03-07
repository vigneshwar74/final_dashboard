const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getHeaders = () => {
  const token = localStorage.getItem('accessToken');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

const handleResponse = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.errors?.[0]?.msg || `HTTP ${response.status}`);
  }
  return data;
};

const api = {
  // Auth
  login: (email, password) =>
    fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then(handleResponse),

  register: (data) =>
    fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  getMe: () =>
    fetch(`${API_URL}/auth/me`, { headers: getHeaders() }).then(handleResponse),

  // Resources
  getResources: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`${API_URL}/resources${qs ? '?' + qs : ''}`, { headers: getHeaders() }).then(handleResponse);
  },

  getResource: (id) =>
    fetch(`${API_URL}/resources/${id}`, { headers: getHeaders() }).then(handleResponse),

  createResource: (data) =>
    fetch(`${API_URL}/resources`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  updateResource: (id, data) =>
    fetch(`${API_URL}/resources/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  deleteResource: (id) =>
    fetch(`${API_URL}/resources/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    }).then(handleResponse),

  // Bookings
  getBookings: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`${API_URL}/bookings${qs ? '?' + qs : ''}`, { headers: getHeaders() }).then(handleResponse);
  },

  createBooking: (data) =>
    fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  updateBookingStatus: (id, data) =>
    fetch(`${API_URL}/bookings/${id}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  cancelBooking: (id) =>
    fetch(`${API_URL}/bookings/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    }).then(handleResponse),

  // Analytics
  getSummary: () =>
    fetch(`${API_URL}/analytics/summary`, { headers: getHeaders() }).then(handleResponse),

  getByType: () =>
    fetch(`${API_URL}/analytics/by-type`, { headers: getHeaders() }).then(handleResponse),

  getTrend: (days = 7) =>
    fetch(`${API_URL}/analytics/trend?days=${days}`, { headers: getHeaders() }).then(handleResponse),

  getTopResources: (limit = 10) =>
    fetch(`${API_URL}/analytics/top-resources?limit=${limit}`, { headers: getHeaders() }).then(handleResponse),

  exportCSV: async (from, to) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const response = await fetch(`${API_URL}/analytics/export?${params.toString()}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bookings_report.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  // Assignments (admin assigns staff to venue)
  getAssignments: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`${API_URL}/assignments${qs ? '?' + qs : ''}`, { headers: getHeaders() }).then(handleResponse);
  },

  createAssignment: (data) =>
    fetch(`${API_URL}/assignments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  updateAssignmentStatus: (id, data) =>
    fetch(`${API_URL}/assignments/${id}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  deleteAssignment: (id) =>
    fetch(`${API_URL}/assignments/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    }).then(handleResponse),

  getStaffList: () =>
    fetch(`${API_URL}/assignments/staff-list`, { headers: getHeaders() }).then(handleResponse),

  checkStaffAvailability: (params) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`${API_URL}/assignments/check-availability?${qs}`, { headers: getHeaders() }).then(handleResponse);
  },

  // Available resources for booking (staff)
  getAvailableResources: (params) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`${API_URL}/bookings/available-resources?${qs}`, { headers: getHeaders() }).then(handleResponse);
  },

  // Messages
  getMessages: () =>
    fetch(`${API_URL}/messages`, { headers: getHeaders() }).then(handleResponse),

  getUnreadCount: () =>
    fetch(`${API_URL}/messages/unread-count`, { headers: getHeaders() }).then(handleResponse),

  sendMessage: (data) =>
    fetch(`${API_URL}/messages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  markMessageRead: (id) =>
    fetch(`${API_URL}/messages/${id}/read`, {
      method: 'PUT',
      headers: getHeaders(),
    }).then(handleResponse),

  getUsersByRole: (role) =>
    fetch(`${API_URL}/messages/users/${role}`, { headers: getHeaders() }).then(handleResponse),

  // Student assignments
  getStudentAssignments: () =>
    fetch(`${API_URL}/student-assignments`, { headers: getHeaders() }).then(handleResponse),

  createStudentAssignment: (data) =>
    fetch(`${API_URL}/student-assignments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  updateStudentAssignmentStatus: (id, data) =>
    fetch(`${API_URL}/student-assignments/${id}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  // Notifications
  getNotifications: () =>
    fetch(`${API_URL}/notifications`, { headers: getHeaders() }).then(handleResponse),

  getNotifUnreadCount: () =>
    fetch(`${API_URL}/notifications/unread-count`, { headers: getHeaders() }).then(handleResponse),

  markNotifRead: (id) =>
    fetch(`${API_URL}/notifications/${id}/read`, { method: 'PUT', headers: getHeaders() }).then(handleResponse),

  markAllNotifsRead: () =>
    fetch(`${API_URL}/notifications/read-all`, { method: 'PUT', headers: getHeaders() }).then(handleResponse),

  // Audit logs (admin)
  getAuditLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`${API_URL}/audit-logs${qs ? '?' + qs : ''}`, { headers: getHeaders() }).then(handleResponse);
  },

  getAuditStats: () =>
    fetch(`${API_URL}/audit-logs/stats`, { headers: getHeaders() }).then(handleResponse),

  // Feedback & Ratings
  getFeedback: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`${API_URL}/feedback${qs ? '?' + qs : ''}`, { headers: getHeaders() }).then(handleResponse);
  },

  getResourceRatings: () =>
    fetch(`${API_URL}/feedback/resource-ratings`, { headers: getHeaders() }).then(handleResponse),

  submitFeedback: (data) =>
    fetch(`${API_URL}/feedback`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  // Exam Allocations
  getExamAllocations: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`${API_URL}/exam-allocations${qs ? '?' + qs : ''}`, { headers: getHeaders() }).then(handleResponse);
  },

  getSuitableVenues: (params) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`${API_URL}/exam-allocations/suitable-venues?${qs}`, { headers: getHeaders() }).then(handleResponse);
  },

  getDepartments: () =>
    fetch(`${API_URL}/exam-allocations/departments`, { headers: getHeaders() }).then(handleResponse),

  createExamAllocation: (data) =>
    fetch(`${API_URL}/exam-allocations`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  updateExamAllocationStatus: (id, data) =>
    fetch(`${API_URL}/exam-allocations/${id}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  deleteExamAllocation: (id) =>
    fetch(`${API_URL}/exam-allocations/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    }).then(handleResponse),

  // Occupancy
  getOccupancy: () =>
    fetch(`${API_URL}/occupancy`, { headers: getHeaders() }).then(handleResponse),

  getVenuePeople: (resourceId) =>
    fetch(`${API_URL}/occupancy/${resourceId}/people`, { headers: getHeaders() }).then(handleResponse),

  checkIn: (resource_id) =>
    fetch(`${API_URL}/occupancy/checkin`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ resource_id }),
    }).then(handleResponse),

  checkOut: (resource_id) =>
    fetch(`${API_URL}/occupancy/checkout`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ resource_id }),
    }).then(handleResponse),

  getMyCheckins: () =>
    fetch(`${API_URL}/occupancy/my-checkins`, { headers: getHeaders() }).then(handleResponse),

  // Calendar events (combined for role-specific calendar)
  getCalendarEvents: async (params = {}) => {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    const results = [];

    // Get bookings
    try {
      const bk = await fetch(`${API_URL}/bookings?my=true`, { headers }).then(r => r.json());
      if (Array.isArray(bk)) {
        bk.forEach(b => results.push({ ...b, event_type: 'booking' }));
      }
    } catch (e) {}

    // Get assignments (staff)
    try {
      const asgn = await fetch(`${API_URL}/assignments`, { headers }).then(r => r.json());
      if (Array.isArray(asgn)) {
        asgn.forEach(a => results.push({ ...a, event_type: 'assignment' }));
      }
    } catch (e) {}

    // Get student assignments
    try {
      const sa = await fetch(`${API_URL}/student-assignments`, { headers }).then(r => r.json());
      if (Array.isArray(sa)) {
        sa.forEach(s => results.push({ ...s, event_type: 'student_activity' }));
      }
    } catch (e) {}

    // Get exam allocations
    try {
      const exam = await fetch(`${API_URL}/exam-allocations`, { headers }).then(r => r.json());
      if (Array.isArray(exam)) {
        exam.forEach(e => results.push({ ...e, event_type: 'exam' }));
      }
    } catch (e) {}

    return results;
  },
};

export default api;

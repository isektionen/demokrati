// Global variable to manage the admin session version.
// When this value is incremented, all existing admin cookies become invalid.
export let adminSessionVersion = 1;

export function incrementAdminSession() {
  adminSessionVersion++;
}

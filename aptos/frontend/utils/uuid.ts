/**
 * Generates a random UUID v4
 * @returns {string} A UUID v4 string
 */
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Gets the user's UUID from localStorage or generates a new one if not present
 * @returns {string} The user's UUID
 */
export const getUserUUID = (): string => {
  let uuid = localStorage.getItem('userUUID');
  
  if (!uuid) {
    uuid = generateUUID();
    localStorage.setItem('userUUID', uuid);
  }
  
  return uuid;
}; 
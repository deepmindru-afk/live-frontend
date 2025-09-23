/**
 * Utility functions for validation
 */

/**
 * Validates if a string is a valid MongoDB ObjectId
 * @param id - The string to validate
 * @returns true if the string is a valid MongoDB ObjectId, false otherwise
 */
export const isValidObjectId = (id: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Validates if a string is a mock ID (starts with "mock_")
 * @param id - The string to validate
 * @returns true if the string is a mock ID, false otherwise
 */
export const isMockId = (id: string): boolean => {
  return id.startsWith('mock_');
};

/**
 * Gets a user-friendly error message for invalid meeting IDs
 * @param id - The invalid ID
 * @returns A user-friendly error message
 */
export const getInvalidIdErrorMessage = (id: string): string => {
  if (isMockId(id)) {
    return `The meeting ID "${id}" is not a valid format. Please create a new meeting from the dashboard.`;
  }
  return `The meeting ID "${id}" is not in a valid format. Please create a new meeting from the dashboard.`;
};

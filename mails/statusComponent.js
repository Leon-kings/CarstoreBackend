class StatusComponent {
  // Success responses
  static success(message, data = null) {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  // Error responses
  static error(message, errorCode = "GENERAL_ERROR", details = null) {
    return {
      success: false,
      message,
      errorCode,
      details,
      timestamp: new Date().toISOString(),
    };
  }

  // Validation error
  static validationError(errors) {
    return {
      success: false,
      message: "Validation failed",
      errorCode: "VALIDATION_ERROR",
      details: errors,
      timestamp: new Date().toISOString(),
    };
  }

  // Not found error
  static notFound(resource = "Resource") {
    return {
      success: false,
      message: `${resource} not found`,
      errorCode: "NOT_FOUND",
      timestamp: new Date().toISOString(),
    };
  }

  // Unauthorized error
  static unauthorized(message = "Unauthorized access") {
    return {
      success: false,
      message,
      errorCode: "UNAUTHORIZED",
      timestamp: new Date().toISOString(),
    };
  }

  // Forbidden error
  static forbidden(message = "Access forbidden") {
    return {
      success: false,
      message,
      errorCode: "FORBIDDEN",
      timestamp: new Date().toISOString(),
    };
  }

  // User status messages
  static userStatusMessages = {
    REGISTER_SUCCESS: "User registered successfully. Welcome aboard! 🎉",
    LOGIN_SUCCESS: "Login successful. Welcome back! 👋",
    PROFILE_UPDATED: "Profile updated successfully ✅",
    EMAIL_UPDATED: "Email address updated successfully 📧",
    PASSWORD_UPDATED: "Password changed successfully 🔒",
    PROFILE_FETCHED: "User profile retrieved successfully 👤",
  };

  // Error messages
  static errorMessages = {
    USER_EXISTS: "It looks like this email or phone is already registered. Try logging in instead?",
    INVALID_CREDENTIALS: "Oops! The email or password you entered doesn't match our records.",
    USER_NOT_FOUND: "We couldn't find a user with those details. Want to try signing up?",
    PASSWORD_MISMATCH: "The current password you entered doesn't match our records.",
    DUPLICATE_EMAIL: "This email is already in use. Please try a different one.",
    DUPLICATE_PHONE: "This phone number is already registered. Want to recover your account?",
  };
}

module.exports = StatusComponent;
// Validation helper functions

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  // Indian phone number validation (10 digits with optional +91 or country code)
  const phoneRegex = /^(\+91|0)?[6-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/[\s-]/g, ''));
};

const validateUID = (uid) => {
  // UID should be alphanumeric and 3-20 characters
  const uidRegex = /^[A-Za-z0-9]{3,20}$/;
  return uidRegex.test(uid);
};

const validateRole = (role) => {
  const validRoles = ['ADMIN', 'SERVICE_HEAD', 'ENGINEER', 'SALES', 'COMMERCIAL'];
  return validRoles.includes(role);
};

const validateStatus = (status, type) => {
  const validStatuses = {
    point: ['CREATED', 'ASSIGNED', 'REASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'],
    serviceRecord: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
    quotation: ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED']
  };
  
  return validStatuses[type] && validStatuses[type].includes(status);
};

const validatePriority = (priority) => {
  const validPriorities = ['HIGH', 'MEDIUM', 'LOW'];
  return validPriorities.includes(priority);
};

const validateNotificationType = (type) => {
  const validTypes = ['INFO', 'WARNING', 'URGENT'];
  return validTypes.includes(type);
};

const validateDate = (dateString) => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

const validateAmount = (amount) => {
  return !isNaN(amount) && parseFloat(amount) >= 0;
};

const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  
  // Remove HTML tags and trim whitespace
  return str.replace(/<[^>]*>/g, '').trim();
};

const validateRequiredFields = (obj, requiredFields) => {
  const missing = [];
  
  for (const field of requiredFields) {
    if (!obj[field] || (typeof obj[field] === 'string' && obj[field].trim() === '')) {
      missing.push(field);
    }
  }
  
  return missing;
};

const validateWarrantyTime = (months) => {
  const warranty = parseInt(months);
  return !isNaN(warranty) && warranty >= 0 && warranty <= 120;
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = sanitizeString(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };
  
  if (req.body) {
    sanitizeObject(req.body);
  }
  
  if (req.query) {
    sanitizeObject(req.query);
  }
  
  next();
};

// Validation middleware factory
const validateRequest = (validationRules) => {
  return (req, res, next) => {
    const errors = [];
    
    for (const rule of validationRules) {
      const { field, type, required = false, custom } = rule;
      const value = req.body[field];
      
      // Check required fields
      if (required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        errors.push(`${field} is required`);
        continue;
      }
      
      // Skip validation if field is not required and empty
      if (!required && (!value || value === '')) {
        continue;
      }
      
      // Type-based validation
      switch (type) {
        case 'email':
          if (!validateEmail(value)) {
            errors.push(`${field} must be a valid email address`);
          }
          break;
        case 'phone':
          if (!validatePhone(value)) {
            errors.push(`${field} must be a valid phone number`);
          }
          break;
        case 'uid':
          if (!validateUID(value)) {
            errors.push(`${field} must be 3-20 alphanumeric characters`);
          }
          break;
        case 'role':
          if (!validateRole(value)) {
            errors.push(`${field} must be a valid role`);
          }
          break;
        case 'date':
          if (!validateDate(value)) {
            errors.push(`${field} must be a valid date`);
          }
          break;
        case 'amount':
          if (!validateAmount(value)) {
            errors.push(`${field} must be a valid positive number`);
          }
          break;
        case 'warranty':
          if (!validateWarrantyTime(value)) {
            errors.push(`${field} must be between 0 and 120 months`);
          }
          break;
      }
      
      // Custom validation
      if (custom && typeof custom === 'function') {
        const customResult = custom(value);
        if (customResult !== true) {
          errors.push(customResult || `${field} is invalid`);
        }
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }
    
    next();
  };
};

module.exports = {
  validateEmail,
  validatePhone,
  validateUID,
  validateRole,
  validateStatus,
  validatePriority,
  validateNotificationType,
  validateDate,
  validateAmount,
  validateWarrantyTime,
  validateRequiredFields,
  sanitizeString,
  sanitizeInput,
  validateRequest
};
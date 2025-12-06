// backend/routes/adminCourses.js
const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const adminCoursesController = require('../controllers/adminCoursesController');
const authMiddleware = require('../middleware/auth');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// Apply authentication to all routes
router.use(authMiddleware);
router.use(requireAdmin);

// ==================== COURSE ROUTES ====================

// Get course statistics
router.get('/stats', adminCoursesController.getCourseStats);

// Get all courses with filtering and pagination
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().trim(),
    query('category').optional().trim(),
    query('level').optional().isIn(['', 'Beginner', 'Intermediate', 'Advanced']),
    query('is_published').optional().isIn(['', 'true', 'false'])
  ],
  handleValidationErrors,
  adminCoursesController.getAllCourses
);

// Get single course with full details
router.get(
  '/:courseId',
  [
    param('courseId').isUUID().withMessage('Invalid course ID')
  ],
  handleValidationErrors,
  adminCoursesController.getCourseDetails
);

// Create new course
router.post(
  '/',
  [
    body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
    body('slug').trim().isLength({ min: 3, max: 200 }).matches(/^[a-z0-9-]+$/).withMessage('Slug must be lowercase with hyphens'),
    body('description').trim().isLength({ min: 10, max: 5000 }).withMessage('Description must be 10-5000 characters'),
    body('short_description').optional().trim().isLength({ max: 500 }),
    body('level').isIn(['Beginner', 'Intermediate', 'Advanced']).withMessage('Invalid level'),
    body('category').trim().isLength({ min: 1, max: 100 }).withMessage('Category is required'),
    body('icon_emoji').optional().trim().isLength({ max: 10 }),
    body('thumbnail_url').optional().isURL(),
    body('estimated_duration_hours').isInt({ min: 1, max: 1000 }).withMessage('Duration must be 1-1000 hours'),
    body('is_published').optional().isBoolean(),
    body('is_featured').optional().isBoolean()
  ],
  handleValidationErrors,
  adminCoursesController.createCourse
);

// Update course
router.put(
  '/:courseId',
  [
    param('courseId').isUUID().withMessage('Invalid course ID'),
    body('title').optional().trim().isLength({ min: 3, max: 200 }),
    body('slug').optional().trim().isLength({ min: 3, max: 200 }).matches(/^[a-z0-9-]+$/),
    body('description').optional().trim().isLength({ min: 10, max: 5000 }),
    body('short_description').optional().trim().isLength({ max: 500 }),
    body('level').optional().isIn(['Beginner', 'Intermediate', 'Advanced']),
    body('category').optional().trim().isLength({ min: 1, max: 100 }),
    body('icon_emoji').optional().trim().isLength({ max: 10 }),
    body('thumbnail_url').optional().isURL(),
    body('estimated_duration_hours').optional().isInt({ min: 1, max: 1000 }),
    body('is_published').optional().isBoolean(),
    body('is_featured').optional().isBoolean()
  ],
  handleValidationErrors,
  adminCoursesController.updateCourse
);

// Delete course
router.delete(
  '/:courseId',
  [
    param('courseId').isUUID().withMessage('Invalid course ID')
  ],
  handleValidationErrors,
  adminCoursesController.deleteCourse
);

// Duplicate course
router.post(
  '/:courseId/duplicate',
  [
    param('courseId').isUUID().withMessage('Invalid course ID'),
    body('new_title').trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
    body('new_slug').trim().isLength({ min: 3, max: 200 }).matches(/^[a-z0-9-]+$/).withMessage('Slug must be lowercase with hyphens')
  ],
  handleValidationErrors,
  adminCoursesController.duplicateCourse
);

// ==================== MODULE ROUTES ====================

// Create module for a course
router.post(
  '/:courseId/modules',
  [
    param('courseId').isUUID().withMessage('Invalid course ID'),
    body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('order_index').isInt({ min: 0 }).withMessage('Order index must be a positive integer'),
    body('estimated_duration_minutes').optional().isInt({ min: 1, max: 600 }),
    body('is_published').optional().isBoolean()
  ],
  handleValidationErrors,
  adminCoursesController.createModule
);

// Update module
router.put(
  '/modules/:moduleId',
  [
    param('moduleId').isUUID().withMessage('Invalid module ID'),
    body('title').optional().trim().isLength({ min: 3, max: 200 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('order_index').optional().isInt({ min: 0 }),
    body('estimated_duration_minutes').optional().isInt({ min: 1, max: 600 }),
    body('is_published').optional().isBoolean()
  ],
  handleValidationErrors,
  adminCoursesController.updateModule
);

// Delete module
router.delete(
  '/modules/:moduleId',
  [
    param('moduleId').isUUID().withMessage('Invalid module ID')
  ],
  handleValidationErrors,
  adminCoursesController.deleteModule
);

// ==================== LESSON ROUTES ====================

// Create lesson for a module
router.post(
  '/modules/:moduleId/lessons',
  [
    param('moduleId').isUUID().withMessage('Invalid module ID'),
    body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('content').optional().trim(),
    body('lesson_type').optional().isIn(['text', 'video', 'quiz', 'coding', 'project']),
    body('video_url').optional().custom((value) => {
      if (!value || value === '') return true;
      // Basic URL validation
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error('Invalid URL format');
      }
    }),
    body('code_template').optional(),
    body('order_index').isInt({ min: 0 }).withMessage('Order index must be a positive integer'),
    body('estimated_duration_minutes').optional().isInt({ min: 1, max: 300 }),
    body('is_free').optional().isBoolean(),
    body('is_published').optional().isBoolean()
  ],
  handleValidationErrors,
  adminCoursesController.createLesson
);

// Update lesson
router.put(
  '/lessons/:lessonId',
  [
    param('lessonId').isUUID().withMessage('Invalid lesson ID'),
    body('title').optional().trim().isLength({ min: 3, max: 200 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('content').optional().trim(),
    body('lesson_type').optional().isIn(['text', 'video', 'quiz', 'coding', 'project']),
    body('video_url').optional().custom((value) => {
      if (!value || value === '') return true;
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error('Invalid URL format');
      }
    }),
    body('code_template').optional(),
    body('order_index').optional().isInt({ min: 0 }),
    body('estimated_duration_minutes').optional().isInt({ min: 1, max: 300 }),
    body('is_free').optional().isBoolean(),
    body('is_published').optional().isBoolean()
  ],
  handleValidationErrors,
  adminCoursesController.updateLesson
);

// Delete lesson
router.delete(
  '/lessons/:lessonId',
  [
    param('lessonId').isUUID().withMessage('Invalid lesson ID')
  ],
  handleValidationErrors,
  adminCoursesController.deleteLesson
);

module.exports = router;
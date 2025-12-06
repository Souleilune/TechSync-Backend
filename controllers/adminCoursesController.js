// backend/controllers/adminCoursesController.js
const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

/**
 * GET /api/admin/courses
 * Get all courses with full details (published and unpublished)
 */
exports.getAllCourses = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      category = '', 
      level = '',
      is_published = ''
    } = req.query;

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('courses')
      .select(`
        *,
        course_modules(count),
        course_reviews(rating)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters only if they have values
    if (search && search.trim()) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (category && category.trim()) {
      query = query.eq('category', category);
    }
    if (level && level.trim()) {
      query = query.eq('level', level);
    }
    if (is_published && is_published.trim()) {
      query = query.eq('is_published', is_published === 'true');
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: courses, error, count } = await query;

    if (error) throw error;

    // Calculate stats for each course
    const coursesWithStats = await Promise.all(
      courses.map(async (course) => {
        // Get enrollment count
        const { count: enrollmentCount } = await supabase
          .from('user_course_enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', course.id);

        // Calculate average rating
        const ratings = course.course_reviews || [];
        const avgRating = ratings.length > 0
          ? ratings.reduce((sum, review) => sum + review.rating, 0) / ratings.length
          : 0;

        return {
          ...course,
          enrollment_count: enrollmentCount || 0,
          average_rating: avgRating,
          review_count: ratings.length
        };
      })
    );

    res.json({
      success: true,
      data: {
        courses: coursesWithStats,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch courses',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/courses/:courseId
 * Get single course with full details
 */
exports.getCourseDetails = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Get course with modules and lessons
    const { data: course, error } = await supabase
      .from('courses')
      .select(`
        *,
        course_modules(
          *,
          course_lessons(*)
        )
      `)
      .eq('id', courseId)
      .single();

    if (error) throw error;

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Get enrollment stats
    const { count: enrollmentCount } = await supabase
      .from('user_course_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', courseId);

    // Get reviews
    const { data: reviews } = await supabase
      .from('course_reviews')
      .select('*')
      .eq('course_id', courseId);

    const avgRating = reviews && reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    res.json({
      success: true,
      data: {
        ...course,
        enrollment_count: enrollmentCount || 0,
        average_rating: avgRating,
        review_count: reviews?.length || 0
      }
    });

  } catch (error) {
    console.error('Error fetching course details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course details',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/courses
 * Create a new course
 */
exports.createCourse = async (req, res) => {
  try {
    const {
      title,
      slug,
      description,
      short_description,
      level,
      category,
      icon_emoji,
      thumbnail_url,
      estimated_duration_hours,
      is_published = false,
      is_featured = false
    } = req.body;

    const userId = req.user.id;

    // Check if slug already exists
    const { data: existingCourse } = await supabase
      .from('courses')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingCourse) {
      return res.status(400).json({
        success: false,
        message: 'A course with this slug already exists'
      });
    }

    // Create course
    const { data: course, error } = await supabase
      .from('courses')
      .insert([{
        title,
        slug,
        description,
        short_description,
        level,
        category,
        icon_emoji,
        thumbnail_url,
        estimated_duration_hours,
        is_published,
        is_featured,
        created_by: userId,
        total_modules: 0,
        total_lessons: 0
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: course
    });

  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create course',
      error: error.message
    });
  }
};

/**
 * PUT /api/admin/courses/:courseId
 * Update a course
 */
exports.updateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const updateData = req.body;

    // Don't allow updating these fields directly
    delete updateData.id;
    delete updateData.created_by;
    delete updateData.created_at;
    delete updateData.total_modules;
    delete updateData.total_lessons;

    const { data: course, error } = await supabase
      .from('courses')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', courseId)
      .select()
      .single();

    if (error) throw error;

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.json({
      success: true,
      message: 'Course updated successfully',
      data: course
    });

  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update course',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/courses/:courseId
 * Delete a course and all related data
 */
exports.deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Check if course has enrollments
    const { count: enrollmentCount } = await supabase
      .from('user_course_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', courseId);

    if (enrollmentCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete course with ${enrollmentCount} active enrollment(s). Unpublish it instead.`
      });
    }

    // Delete course (cascade will handle modules, lessons, etc.)
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Course deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete course',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/courses/:courseId/modules
 * Create a module for a course
 */
exports.createModule = async (req, res) => {
  try {
    const { courseId } = req.params;
    const {
      title,
      description,
      order_index,
      estimated_duration_minutes,
      is_published = true
    } = req.body;

    const { data: module, error } = await supabase
      .from('course_modules')
      .insert([{
        course_id: courseId,
        title,
        description,
        order_index,
        estimated_duration_minutes,
        is_published
      }])
      .select()
      .single();

    if (error) throw error;

    // Update course total_modules count
    await this.updateCourseCounts(courseId);

    res.status(201).json({
      success: true,
      message: 'Module created successfully',
      data: module
    });

  } catch (error) {
    console.error('Error creating module:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create module',
      error: error.message
    });
  }
};

/**
 * PUT /api/admin/courses/modules/:moduleId
 * Update a module
 */
exports.updateModule = async (req, res) => {
  try {
    const { moduleId } = req.params;
    const updateData = req.body;

    delete updateData.id;
    delete updateData.course_id;
    delete updateData.created_at;

    const { data: module, error } = await supabase
      .from('course_modules')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', moduleId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Module updated successfully',
      data: module
    });

  } catch (error) {
    console.error('Error updating module:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update module',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/courses/modules/:moduleId
 * Delete a module
 */
exports.deleteModule = async (req, res) => {
  try {
    const { moduleId } = req.params;

    // Get course_id before deleting
    const { data: module } = await supabase
      .from('course_modules')
      .select('course_id')
      .eq('id', moduleId)
      .single();

    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Module not found'
      });
    }

    // Delete module (cascade will handle lessons)
    const { error } = await supabase
      .from('course_modules')
      .delete()
      .eq('id', moduleId);

    if (error) throw error;

    // Update course counts
    await this.updateCourseCounts(module.course_id);

    res.json({
      success: true,
      message: 'Module deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting module:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete module',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/courses/modules/:moduleId/lessons
 * Create a lesson for a module
 */
exports.createLesson = async (req, res) => {
  try {
    const { moduleId } = req.params;
    const {
      title,
      description,
      content,
      lesson_type = 'text',
      video_url,
      code_template,
      order_index,
      estimated_duration_minutes,
      is_free = false,
      is_published = true
    } = req.body;

    const { data: lesson, error } = await supabase
      .from('course_lessons')
      .insert([{
        module_id: moduleId,
        title,
        description,
        content,
        lesson_type,
        video_url,
        code_template,
        order_index,
        estimated_duration_minutes,
        is_free,
        is_published
      }])
      .select()
      .single();

    if (error) throw error;

    // Get module's course_id
    const { data: module } = await supabase
      .from('course_modules')
      .select('course_id')
      .eq('id', moduleId)
      .single();

    // Update course counts
    if (module) {
      await this.updateCourseCounts(module.course_id);
    }

    res.status(201).json({
      success: true,
      message: 'Lesson created successfully',
      data: lesson
    });

  } catch (error) {
    console.error('Error creating lesson:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create lesson',
      error: error.message
    });
  }
};

/**
 * PUT /api/admin/courses/lessons/:lessonId
 * Update a lesson
 */
exports.updateLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const updateData = req.body;

    delete updateData.id;
    delete updateData.module_id;
    delete updateData.created_at;

    const { data: lesson, error } = await supabase
      .from('course_lessons')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', lessonId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Lesson updated successfully',
      data: lesson
    });

  } catch (error) {
    console.error('Error updating lesson:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update lesson',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/courses/lessons/:lessonId
 * Delete a lesson
 */
exports.deleteLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;

    // Get module and course info before deleting
    const { data: lesson } = await supabase
      .from('course_lessons')
      .select('module_id, course_modules(course_id)')
      .eq('id', lessonId)
      .single();

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    // Delete lesson
    const { error } = await supabase
      .from('course_lessons')
      .delete()
      .eq('id', lessonId);

    if (error) throw error;

    // Update course counts
    if (lesson.course_modules) {
      await this.updateCourseCounts(lesson.course_modules.course_id);
    }

    res.json({
      success: true,
      message: 'Lesson deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting lesson:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete lesson',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/courses/:courseId/duplicate
 * Duplicate a course with all its modules and lessons
 */
exports.duplicateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { new_title, new_slug } = req.body;

    // Get original course with all modules and lessons
    const { data: originalCourse, error: fetchError } = await supabase
      .from('courses')
      .select(`
        *,
        course_modules(
          *,
          course_lessons(*)
        )
      `)
      .eq('id', courseId)
      .single();

    if (fetchError) throw fetchError;

    // Create new course
    const { data: newCourse, error: courseError } = await supabase
      .from('courses')
      .insert([{
        ...originalCourse,
        id: undefined,
        title: new_title || `${originalCourse.title} (Copy)`,
        slug: new_slug || `${originalCourse.slug}-copy`,
        is_published: false,
        is_featured: false,
        created_by: req.user.id,
        created_at: undefined,
        updated_at: undefined
      }])
      .select()
      .single();

    if (courseError) throw courseError;

    // Duplicate modules and lessons
    for (const module of originalCourse.course_modules) {
      const { data: newModule, error: moduleError } = await supabase
        .from('course_modules')
        .insert([{
          ...module,
          id: undefined,
          course_id: newCourse.id,
          created_at: undefined,
          updated_at: undefined
        }])
        .select()
        .single();

      if (moduleError) throw moduleError;

      // Duplicate lessons
      if (module.course_lessons && module.course_lessons.length > 0) {
        const lessons = module.course_lessons.map(lesson => ({
          ...lesson,
          id: undefined,
          module_id: newModule.id,
          created_at: undefined,
          updated_at: undefined
        }));

        const { error: lessonsError } = await supabase
          .from('course_lessons')
          .insert(lessons);

        if (lessonsError) throw lessonsError;
      }
    }

    // Update counts
    await this.updateCourseCounts(newCourse.id);

    res.json({
      success: true,
      message: 'Course duplicated successfully',
      data: newCourse
    });

  } catch (error) {
    console.error('Error duplicating course:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to duplicate course',
      error: error.message
    });
  }
};

/**
 * Helper function to update course module and lesson counts
 */
exports.updateCourseCounts = async (courseId) => {
  try {
    // Count modules
    const { count: moduleCount } = await supabase
      .from('course_modules')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', courseId);

    // Count lessons
    const { data: modules } = await supabase
      .from('course_modules')
      .select('id')
      .eq('course_id', courseId);

    let lessonCount = 0;
    if (modules && modules.length > 0) {
      const moduleIds = modules.map(m => m.id);
      const { count } = await supabase
        .from('course_lessons')
        .select('*', { count: 'exact', head: true })
        .in('module_id', moduleIds);
      lessonCount = count || 0;
    }

    // Update course
    await supabase
      .from('courses')
      .update({
        total_modules: moduleCount || 0,
        total_lessons: lessonCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', courseId);

  } catch (error) {
    console.error('Error updating course counts:', error);
  }
};

/**
 * GET /api/admin/courses/stats
 * Get overall course statistics
 */
exports.getCourseStats = async (req, res) => {
  try {
    // Total courses
    const { count: totalCourses } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true });

    // Published courses
    const { count: publishedCourses } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true);

    // Total enrollments
    const { count: totalEnrollments } = await supabase
      .from('user_course_enrollments')
      .select('*', { count: 'exact', head: true });

    // Total reviews
    const { count: totalReviews } = await supabase
      .from('course_reviews')
      .select('*', { count: 'exact', head: true });

    // Average rating
    const { data: allReviews } = await supabase
      .from('course_reviews')
      .select('rating');

    const avgRating = allReviews && allReviews.length > 0
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
      : 0;

    res.json({
      success: true,
      data: {
        total_courses: totalCourses || 0,
        published_courses: publishedCourses || 0,
        draft_courses: (totalCourses || 0) - (publishedCourses || 0),
        total_enrollments: totalEnrollments || 0,
        total_reviews: totalReviews || 0,
        average_rating: avgRating.toFixed(2)
      }
    });

  } catch (error) {
    console.error('Error fetching course stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course stats',
      error: error.message
    });
  }
};
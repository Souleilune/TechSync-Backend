// backend/controllers/taskController.js
const supabase = require('../config/supabase');
const { checkAutoComplete } = require('./collaborativeProjectCompletion'); // Import the helper
const { evaluateCodeWithLanguageFeatures } = require('../utils/languageBasedEvaluator');


// Update a task - IMPROVED ERROR HANDLING
const updateTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const userId = req.user.id;
    const updateData = req.body;

    console.log('🔄 Updating task:', taskId, 'in project:', projectId, 'by user:', userId);
    console.log('📝 Update data received:', updateData);

    // Verify user has access to the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.error('❌ Project error:', projectError);
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const isOwner = project.owner_id === userId;
    let isMember = false;

    if (!isOwner) {
      const { data: projectMember, error: memberError } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (!memberError && projectMember) {
        isMember = true;
      }
    }

    if (!isOwner && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You must be a project member to update tasks.'
      });
    }

    // Verify task exists and belongs to the project
    const { data: existingTask, error: taskError } = await supabase
      .from('project_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('project_id', projectId)
      .single();

    if (taskError || !existingTask) {
      console.error('❌ Task error:', taskError);
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    console.log('✅ Existing task found:', existingTask.title);

    // Validate assigned user is a project member (if updating assignment)
    if (updateData.assigned_to && updateData.assigned_to !== null && updateData.assigned_to !== '') {
      const { data: assignedMember, error: assignedError } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', updateData.assigned_to)
        .eq('status', 'active')
        .single();

      const isAssignedOwner = project.owner_id === updateData.assigned_to;
      
      if (assignedError && !isAssignedOwner) {
        console.error('❌ Assignment validation error:', assignedError);
        return res.status(400).json({
          success: false,
          message: 'Assigned user must be a project member'
        });
      }
    }

    // Prepare update data with improved handling
    const allowedFields = [
      'title', 'description', 'task_type', 'priority', 'status', 
      'assigned_to', 'estimated_hours', 'actual_hours', 'due_date'
    ];
    
    const filteredUpdateData = {};
    
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        const value = updateData[key];
        
        if (key === 'estimated_hours' || key === 'actual_hours') {
          // Handle numeric fields
          if (value === null || value === '' || value === undefined) {
            filteredUpdateData[key] = null;
          } else {
            const parsedValue = parseInt(value);
            filteredUpdateData[key] = isNaN(parsedValue) ? null : parsedValue;
          }
        } else if (key === 'title' || key === 'description') {
          // Handle text fields
          if (value === null || value === undefined) {
            filteredUpdateData[key] = key === 'title' ? existingTask.title : null;
          } else {
            const trimmedValue = value.toString().trim();
            filteredUpdateData[key] = trimmedValue || (key === 'title' ? existingTask.title : null);
          }
        } else if (key === 'assigned_to') {
          // Handle assignment field
          if (value === null || value === '' || value === undefined) {
            filteredUpdateData[key] = null;
          } else {
            filteredUpdateData[key] = value;
          }
        } else if (key === 'due_date') {
          // Handle date field
          if (value === null || value === '' || value === undefined) {
            filteredUpdateData[key] = null;
          } else {
            try {
              const dateValue = new Date(value);
              if (isNaN(dateValue.getTime())) {
                console.warn('⚠️ Invalid date provided, keeping existing date');
                // Don't update if invalid date
              } else {
                filteredUpdateData[key] = dateValue.toISOString();
              }
            } catch (dateError) {
              console.warn('⚠️ Date parsing error:', dateError);
              // Don't update if date parsing fails
            }
          }
        } else {
          // Handle other fields (status, priority, task_type)
          filteredUpdateData[key] = value;
        }
      }
    });

    // Add completed_at timestamp if status is being changed to completed
    if (updateData.status === 'completed' && existingTask.status !== 'completed') {
      filteredUpdateData.completed_at = new Date().toISOString();
    } else if (updateData.status !== 'completed' && existingTask.status === 'completed') {
      filteredUpdateData.completed_at = null;
    }

    // Add updated_at timestamp
    filteredUpdateData.updated_at = new Date().toISOString();

    console.log('💾 Final update data:', filteredUpdateData);

    // Validate that we have at least one field to update
    if (Object.keys(filteredUpdateData).length === 1 && filteredUpdateData.updated_at) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided for update'
      });
    }

    // Update the task
    const { data: task, error: updateError } = await supabase
      .from('project_tasks')
      .update(filteredUpdateData)
      .eq('id', taskId)
      .select(`
        *,
        assigned_user:assigned_to(id, full_name, username, email),
        creator:created_by(id, full_name, username, email)
      `)
      .single();

    if (updateError) {
      console.error('❌ Database update error:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to update task',
        error: updateError.message,
        details: process.env.NODE_ENV === 'development' ? updateError : undefined
      });
    }

    if (!task) {
      console.error('❌ No task returned after update');
      return res.status(500).json({
        success: false,
        message: 'Task update failed - no data returned'
      });
    }

    console.log('✅ Task updated successfully:', task.id);

    if (updateData.status === 'completed') {
      try {
        console.log('🤖 Checking if project should auto-complete...');
        
        // Get project to verify it's a collab project
        const { data: project } = await supabase
          .from('projects')
          .select('maximum_members, status')
          .eq('id', projectId)
          .single();

        // Only auto-complete collaborative projects (not solo projects)
        if (project && project.maximum_members > 1 && project.status !== 'completed') {
          const { checkAutoComplete } = require('./collaborativeProjectCompletion');
          
          // Create a mock request object for the auto-complete check
          const mockReq = { params: { projectId } };
          const mockRes = {
            json: (data) => {
              if (data.auto_completed) {
                console.log('🎉 Project auto-completed!');
              } else {
                console.log('📊 Project not yet eligible for auto-completion');
              }
            },
            status: () => mockRes
          };
          
          // Trigger auto-complete check (async, don't wait for it)
          checkAutoComplete(mockReq, mockRes).catch(err => {
            console.error('Error in auto-complete check:', err);
          });
        }
      } catch (autoCompleteError) {
        // Don't fail the task update if auto-complete check fails
        console.error('Error checking auto-complete:', autoCompleteError);
      }
    }

    res.json({
      success: true,
      data: { task },
      message: 'Task updated successfully'
    });

  } catch (error) {
    console.error('💥 Update task error:', error);
    console.error('💥 Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get all tasks for a project
const getProjectTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const { sort_by = 'created_at', sort_order = 'desc', status, assigned_to, priority } = req.query;

    console.log('📋 Getting tasks for project:', projectId, 'by user:', userId);

    // Verify user has access to the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (projectError) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const isOwner = project.owner_id === userId;
    let isMember = false;

    if (!isOwner) {
      const { data: projectMember, error: memberError } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (!memberError && projectMember) {
        isMember = true;
      }
    }

    if (!isOwner && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You must be a project member to view tasks.'
      });
    }

    // Build query
    let query = supabase
      .from('project_tasks')
      .select(`
        *,
        assigned_user:assigned_to(id, full_name, username, email),
        creator:created_by(id, full_name, username, email)
      `)
      .eq('project_id', projectId);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (assigned_to) {
      query = query.eq('assigned_to', assigned_to);
    }
    if (priority) {
      query = query.eq('priority', priority);
    }

    // Apply sorting
    query = query.order(sort_by, { ascending: sort_order === 'asc' });

    const { data: tasks, error: tasksError } = await query;

    if (tasksError) {
      console.error('❌ Error fetching tasks:', tasksError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch tasks',
        error: tasksError.message
      });
    }

    console.log(`✅ Found ${tasks?.length || 0} tasks`);
    
    if (tasks && tasks.length > 0) {
      console.log('📝 Sample tasks:');
      tasks.slice(0, 3).forEach(task => {
        console.log(`   - ${task.title} - ${task.status} - ${task.priority}`);
      });
    }

    res.json({
      success: true,
      data: { tasks: tasks || [] }
    });

  } catch (error) {
    console.error('💥 Get project tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Create a new task
const createTask = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const {
      title,
      description,
      task_type = 'development',
      priority = 'medium',
      status = 'todo',
      assigned_to,
      estimated_hours,
      due_date
    } = req.body;

    console.log('🆕 Creating task for project:', projectId, 'by user:', userId);
    console.log('📝 Task data:', { title, task_type, priority, status, assigned_to });

    // Verify user has access to create tasks in this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (projectError) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const isOwner = project.owner_id === userId;
    let isMember = false;

    if (!isOwner) {
      const { data: projectMember, error: memberError } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (!memberError && projectMember) {
        isMember = true;
      }
    }

    if (!isOwner && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You must be a project member to create tasks.'
      });
    }

    // Validate required fields
    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Task title is required'
      });
    }

    // Validate assigned user is a project member (if assigned)
    if (assigned_to) {
      const { data: assignedMember, error: assignedError } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', assigned_to)
        .eq('status', 'active')
        .single();

      const isAssignedOwner = project.owner_id === assigned_to;
      
      if (assignedError && !isAssignedOwner) {
        return res.status(400).json({
          success: false,
          message: 'Assigned user must be a project member'
        });
      }
    }

    // Create the task
    const taskData = {
      project_id: projectId,
      title: title.trim(),
      description: description?.trim() || null,
      task_type,
      priority,
      status,
      assigned_to: assigned_to || null,
      created_by: userId,
      estimated_hours: estimated_hours ? parseInt(estimated_hours) : null,
      due_date: due_date || null
    };

    console.log('💾 Inserting task:', taskData);

    const { data: task, error: createError } = await supabase
      .from('project_tasks')
      .insert(taskData)
      .select(`
        *,
        assigned_user:assigned_to(id, full_name, username, email),
        creator:created_by(id, full_name, username, email)
      `)
      .single();

    if (createError) {
      console.error('❌ Error creating task:', createError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create task',
        error: createError.message
      });
    }

    console.log('✅ Task created successfully:', task.id);

    res.status(201).json({
      success: true,
      data: { task },
      message: 'Task created successfully'
    });

  } catch (error) {
    console.error('💥 Create task error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get a specific task
const getTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const userId = req.user.id;

    console.log('📋 Getting task:', taskId, 'from project:', projectId);

    // Verify user has access to the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (projectError) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const isOwner = project.owner_id === userId;
    let isMember = false;

    if (!isOwner) {
      const { data: projectMember, error: memberError } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (!memberError && projectMember) {
        isMember = true;
      }
    }

    if (!isOwner && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You must be a project member to view tasks.'
      });
    }

    // Get the task
    const { data: task, error: taskError } = await supabase
      .from('project_tasks')
      .select(`
        *,
        assigned_user:assigned_to(id, full_name, username, email),
        creator:created_by(id, full_name, username, email)
      `)
      .eq('id', taskId)
      .eq('project_id', projectId)
      .single();

    if (taskError || !task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    console.log('✅ Task found:', task.title);

    res.json({
      success: true,
      data: { task }
    });

  } catch (error) {
    console.error('💥 Get task error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};



// Delete a task
const deleteTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const userId = req.user.id;

    console.log('🗑️ Deleting task:', taskId, 'from project:', projectId);

    // Verify user has access to the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (projectError) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const isOwner = project.owner_id === userId;
    let isMember = false;

    if (!isOwner) {
      const { data: projectMember, error: memberError } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (!memberError && projectMember) {
        isMember = true;
      }
    }

    if (!isOwner && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You must be a project member to delete tasks.'
      });
    }

    // Verify task exists and belongs to the project
    const { data: existingTask, error: taskError } = await supabase
      .from('project_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('project_id', projectId)
      .single();

    if (taskError || !existingTask) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Delete the task
    const { error: deleteError } = await supabase
      .from('project_tasks')
      .delete()
      .eq('id', taskId);

    if (deleteError) {
      console.error('❌ Error deleting task:', deleteError);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete task',
        error: deleteError.message
      });
    }

    console.log('✅ Task deleted successfully:', taskId);

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });

  } catch (error) {
    console.error('💥 Delete task error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get task statistics
const getTaskStats = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    console.log('📊 Getting task stats for project:', projectId);

    // Verify user has access to the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (projectError) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const isOwner = project.owner_id === userId;
    let isMember = false;

    if (!isOwner) {
      const { data: projectMember, error: memberError } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (!memberError && projectMember) {
        isMember = true;
      }
    }

    if (!isOwner && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You must be a project member to view task statistics.'
      });
    }

    // Get all tasks for the project
    const { data: tasks, error: tasksError } = await supabase
      .from('project_tasks')
      .select('status, priority, assigned_to, due_date, created_at, completed_at')
      .eq('project_id', projectId);

    if (tasksError) {
      console.error('❌ Error fetching tasks for stats:', tasksError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch task statistics',
        error: tasksError.message
      });
    }

    // Calculate statistics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    const inProgressTasks = tasks.filter(task => task.status === 'in_progress').length;
    const todoTasks = tasks.filter(task => task.status === 'todo').length;
    const inReviewTasks = tasks.filter(task => task.status === 'in_review').length;
    const blockedTasks = tasks.filter(task => task.status === 'blocked').length;

    // Priority distribution
    const highPriorityTasks = tasks.filter(task => task.priority === 'high' || task.priority === 'urgent').length;
    const mediumPriorityTasks = tasks.filter(task => task.priority === 'medium').length;
    const lowPriorityTasks = tasks.filter(task => task.priority === 'low').length;

    // Overdue tasks
    const now = new Date();
    const overdueTasks = tasks.filter(task => 
      task.due_date && 
      new Date(task.due_date) < now && 
      task.status !== 'completed'
    ).length;

    // Assigned vs unassigned
    const assignedTasks = tasks.filter(task => task.assigned_to).length;
    const unassignedTasks = totalTasks - assignedTasks;

    // Completion rate
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const stats = {
      total: totalTasks,
      completed: completedTasks,
      inProgress: inProgressTasks,
      todo: todoTasks,
      inReview: inReviewTasks,
      blocked: blockedTasks,
      overdue: overdueTasks,
      assigned: assignedTasks,
      unassigned: unassignedTasks,
      completionRate,
      priority: {
        high: highPriorityTasks,
        medium: mediumPriorityTasks,
        low: lowPriorityTasks
      }
    };

    console.log('✅ Task statistics calculated:', stats);

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    console.error('💥 Get task stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Submit code for a task with automated evaluation
 * @route POST /api/projects/:projectId/tasks/:taskId/submit
 */
const submitTaskCode = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const { submitted_code } = req.body;
    const userId = req.user.id;

    console.log('📝 Submitting code for task:', taskId);

    // Validate required fields
    if (!submitted_code || !submitted_code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Code submission cannot be empty'
      });
    }

    // Get task details
    const { data: task, error: taskError } = await supabase
      .from('project_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('project_id', projectId)
      .single();

    if (taskError || !task) {
      console.error('Task not found:', taskError);
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Get project details with languages
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        *,
        project_languages (
          language_id,
          is_primary,
          programming_languages (
            id,
            name
          )
        )
      `)
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('Project not found:', projectError);
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    console.log('🔍 Evaluating code with language-based evaluator...');
    
    // Evaluate code using languageBasedEvaluator
    // This will provide guidance on syntax but NOT reject submissions
    const evaluation = await evaluateCodeWithLanguageFeatures(
      submitted_code,
      null, // No challenge object for task submissions
      project
    );

    console.log('✅ Code evaluation complete:', {
      score: evaluation.score,
      passed: evaluation.passed
    });

    // Insert submission into task_submissions table
    // Status is always 'pending' - submissions are NOT rejected based on code quality
    const { data: submission, error: submissionError } = await supabase
      .from('task_submissions')
      .insert({
        task_id: taskId,
        user_id: userId,
        submitted_code: submitted_code.trim(),
        status: 'pending', // Always pending for human review
        automated_review_score: evaluation.score,
        automated_feedback: evaluation.feedback,
        code_quality_metrics: {
          details: evaluation.details,
          languageName: evaluation.details?.languageName,
          foundFeatures: evaluation.details?.foundFeatures || [],
          missingFeatures: evaluation.details?.missingFeatures || []
        }
      })
      .select()
      .single();

    if (submissionError) {
      console.error('Error saving submission:', submissionError);
      return res.status(500).json({
        success: false,
        message: 'Failed to save code submission'
      });
    }

    console.log('✅ Code submission saved successfully');

    // Return success with evaluation results
    res.status(201).json({
      success: true,
      message: 'Code submitted successfully! Your submission has been saved for review.',
      data: {
        submission: submission,
        evaluation: {
          score: evaluation.score,
          feedback: evaluation.feedback,
          details: evaluation.details,
          note: 'This score is for guidance only. Your submission will be reviewed by project members.'
        }
      }
    });

  } catch (error) {
    console.error('❌ Submit task code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit code',
      error: error.message
    });
  }
};

/**
 * Get submissions for a specific task
 * @route GET /api/projects/:projectId/tasks/:taskId/submissions
 */
const getTaskSubmissions = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const userId = req.user.id;

    console.log('📋 Fetching submissions for task:', taskId);

    // Get submissions with user details
    const { data: submissions, error } = await supabase
      .from('task_submissions')
      .select(`
        *,
        users!task_submissions_user_id_fkey (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('task_id', taskId)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Error fetching submissions:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch submissions'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        submissions: submissions || []
      }
    });

  } catch (error) {
    console.error('❌ Get task submissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submissions',
      error: error.message
    });
  }
};

module.exports = {
  getProjectTasks,
  createTask,
  updateTask,
  deleteTask,
  getTask,
  getTaskStats,
  submitTaskCode,
  getTaskSubmissions
};
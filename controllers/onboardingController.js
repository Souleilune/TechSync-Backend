// backend/controllers/onboardingController.js - UPDATED WITH SKILL RATING INITIALIZATION
const supabase = require('../config/supabase');

/* ============================== Helper Functions ============================== */

// Initialize skill ratings for user's programming languages
const initializeSkillRatings = async (userId, languages) => {
  try {
    const ratingsData = languages.map(lang => {
      // Determine initial rating based on proficiency level
      let initialRating = 1200; // Default beginner rating
      
      switch(lang.proficiency_level) {
        case 'beginner':
          initialRating = 1200;
          break;
        case 'intermediate':
          initialRating = 1400;
          break;
        case 'advanced':
          initialRating = 1600;
          break;
        case 'expert':
          initialRating = 1800;
          break;
        default:
          initialRating = 1200;
      }

      return {
        user_id: userId,
        programming_language_id: lang.language_id,
        rating: initialRating,
        attempts: 0,
        last_updated: new Date().toISOString()
      };
    });

    // Insert skill ratings
    const { error } = await supabase
      .from('user_skill_ratings')
      .upsert(ratingsData, {
        onConflict: 'user_id,programming_language_id'
      });

    if (error) {
      console.error('Error initializing skill ratings:', error);
      // Don't throw - this is non-critical
    } else {
      console.log('Skill ratings initialized for user:', userId);
    }
  } catch (error) {
    console.error('Error in initializeSkillRatings:', error);
    // Don't throw - this is non-critical
  }
};

/* ============================== Controller Functions ============================== */

// Get all programming languages (public endpoint)
const getProgrammingLanguages = async (req, res) => {
  try {
    const { data: languages, error } = await supabase
      .from('programming_languages')
      .select('id, name, description, usage_count')
      .eq('is_active', true)
      .order('usage_count', { ascending: false });

    if (error) {
      console.error('Error fetching programming languages:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch programming languages',
        error: error.message
      });
    }

    res.json({
      success: true,
      data: languages || []
    });

  } catch (error) {
    console.error('Get programming languages error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all topics (public endpoint)
const getTopics = async (req, res) => {
  try {
    const { data: topics, error } = await supabase
      .from('topics')
      .select('id, name, category, description')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching topics:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch topics',
        error: error.message
      });
    }

    res.json({
      success: true,
      data: topics || []
    });

  } catch (error) {
    console.error('Get topics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Save user's programming languages (requires auth)
const saveUserLanguages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { languages } = req.body;

    if (!languages || !Array.isArray(languages) || languages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Languages array is required and must not be empty'
      });
    }

    // Delete existing languages
    await supabase
      .from('user_programming_languages')
      .delete()
      .eq('user_id', userId);

    // Prepare language data
    const languageData = languages.map(lang => ({
      user_id: userId,
      language_id: lang.language_id,
      proficiency_level: lang.proficiency_level || 'beginner',
      years_experience: lang.years_experience || 0,
      created_at: new Date().toISOString()
    }));

    // Insert new languages
    const { data: savedLanguages, error: insertError } = await supabase
      .from('user_programming_languages')
      .insert(languageData)
      .select(`
        *,
        programming_languages (id, name, description)
      `);

    if (insertError) {
      console.error('Error saving languages:', insertError);
      return res.status(500).json({
        success: false,
        message: 'Failed to save programming languages',
        error: insertError.message
      });
    }

    // Initialize skill ratings
    await initializeSkillRatings(userId, languages);

    res.json({
      success: true,
      message: 'Programming languages saved successfully',
      data: savedLanguages
    });

  } catch (error) {
    console.error('Save user languages error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Save user's topics (requires auth)
const saveUserTopics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { topics } = req.body;

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Topics array is required and must not be empty'
      });
    }

    // Delete existing topics
    await supabase
      .from('user_topics')
      .delete()
      .eq('user_id', userId);

    // Prepare topic data
    const topicData = topics.map(topic => ({
      user_id: userId,
      topic_id: topic.topic_id,
      interest_level: topic.interest_level || 'medium',
      experience_level: 'beginner', // Default to beginner, updated via assessments
      created_at: new Date().toISOString()
    }));

    // Insert new topics
    const { data: savedTopics, error: insertError } = await supabase
      .from('user_topics')
      .insert(topicData)
      .select(`
        *,
        topics (id, name, category)
      `);

    if (insertError) {
      console.error('Error saving topics:', insertError);
      return res.status(500).json({
        success: false,
        message: 'Failed to save topics',
        error: insertError.message
      });
    }

    res.json({
      success: true,
      message: 'Topics saved successfully',
      data: savedTopics
    });

  } catch (error) {
    console.error('Save user topics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Complete onboarding - save all data and mark user as onboarded
const completeOnboarding = async (req, res) => {
  try {
    const userId = req.user.id;
    const { languages, topics, years_experience } = req.body;

    console.log('Completing onboarding for user:', userId);
    console.log('Onboarding data:', { languages, topics, years_experience });

    // Validate input
    if (!languages || !Array.isArray(languages) || languages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Languages array is required and must not be empty'
      });
    }

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Topics array is required and must not be empty'
      });
    }

    // 1. Delete existing user languages and topics (for re-onboarding)
    await supabase.from('user_programming_languages').delete().eq('user_id', userId);
    await supabase.from('user_topics').delete().eq('user_id', userId);

    // 2. Insert user's programming languages
    const languageData = languages.map(lang => ({
      user_id: userId,
      language_id: lang.language_id,
      proficiency_level: lang.proficiency_level || 'beginner',
      years_experience: lang.years_experience || 0,
      created_at: new Date().toISOString()
    }));

    const { data: savedLanguages, error: languageInsertError } = await supabase
      .from('user_programming_languages')
      .insert(languageData)
      .select(`
        *,
        programming_languages (id, name, description)
      `);

    if (languageInsertError) {
      console.error('Error saving languages during onboarding:', languageInsertError);
      return res.status(500).json({
        success: false,
        message: 'Failed to save programming languages',
        error: languageInsertError.message
      });
    }

    // 3. Insert user's topics
    const topicData = topics.map(topic => ({
      user_id: userId,
      topic_id: topic.topic_id,
      interest_level: topic.interest_level || 'medium',
      experience_level: 'beginner',
      created_at: new Date().toISOString()
    }));

    const { data: savedTopics, error: topicInsertError } = await supabase
      .from('user_topics')
      .insert(topicData)
      .select(`
        *,
        topics (id, name, category)
      `);

    if (topicInsertError) {
      console.error('Error saving topics during onboarding:', topicInsertError);
      return res.status(500).json({
        success: false,
        message: 'Failed to save topics',
        error: topicInsertError.message
      });
    }

    // 4. Update user profile with years of experience
    const { data: updatedUser, error: updateUserError } = await supabase
      .from('users')
      .update({
        years_experience: years_experience || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select(`
        id, username, email, full_name, bio, github_username, linkedin_url, 
        years_experience, role, created_at, updated_at, avatar_url
      `)
      .single();

    if (updateUserError) {
      console.error('Error updating user during onboarding completion:', updateUserError);
      return res.status(500).json({
        success: false,
        message: 'Failed to complete onboarding',
        error: updateUserError.message
      });
    }

    // 5. Initialize skill ratings based on proficiency levels
    await initializeSkillRatings(userId, languages);

    // 6. Return complete user profile with onboarding data
    const completeUser = {
      ...updatedUser,
      needsOnboarding: false,
      programming_languages: savedLanguages || [],
      topics: savedTopics || []
    };

    console.log('Onboarding completed successfully for user:', userId);

    res.json({
      success: true,
      message: 'Onboarding completed successfully',
      data: { 
        user: completeUser
      }
    });

  } catch (error) {
    console.error('Complete onboarding error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during onboarding completion',
      error: error.message
    });
  }
};

// Get user's current onboarding data
const getUserOnboardingData = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's programming languages
    const { data: languages, error: langError } = await supabase
      .from('user_programming_languages')
      .select(`
        *,
        programming_languages (id, name)
      `)
      .eq('user_id', userId);

    if (langError) {
      console.error('Error fetching user languages:', langError);
    }

    // Get user's topics
    const { data: topics, error: topicError } = await supabase
      .from('user_topics')
      .select(`
        *,
        topics (id, name, category)
      `)
      .eq('user_id', userId);

    if (topicError) {
      console.error('Error fetching user topics:', topicError);
    }

    // Get user's skill ratings
    const { data: skillRatings, error: ratingsError } = await supabase
      .from('user_skill_ratings')
      .select('*')
      .eq('user_id', userId);

    if (ratingsError) {
      console.error('Error fetching skill ratings:', ratingsError);
    }

    res.json({
      success: true,
      data: {
        languages: languages || [],
        topics: topics || [],
        skillRatings: skillRatings || []
      }
    });

  } catch (error) {
    console.error('Get user onboarding data error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  getProgrammingLanguages,
  getTopics,
  saveUserLanguages,
  saveUserTopics,
  completeOnboarding,
  getUserOnboardingData
};
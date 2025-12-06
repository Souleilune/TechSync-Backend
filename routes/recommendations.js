// backend/routes/recommendations.js - COMPLETE WITH INTERNAL COURSES
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const axios = require('axios');
const authMiddleware = require('../middleware/auth');

// Multiple resource providers
const RESOURCE_PROVIDERS = {
  DEVTO: 'dev.to',
  YOUTUBE: 'youtube',
  FREECODECAMP: 'freecodecamp',
  GITHUB: 'github',
  INTERNAL_COURSE: 'internal_course' // NEW: Internal courses
};

// Language-specific resource mapping
const LANGUAGE_RESOURCES = {
  javascript: {
    tags: ['javascript', 'webdev', 'react', 'nodejs'],
    youtube_queries: ['javascript tutorial', 'javascript fundamentals'],
    github_repos: ['javascript', 'awesome-javascript']
  },
  python: {
    tags: ['python', 'programming', 'datascience'],
    youtube_queries: ['python tutorial', 'python basics'],
    github_repos: ['python', 'awesome-python']
  },
  java: {
    tags: ['java', 'programming', 'springboot'],
    youtube_queries: ['java tutorial', 'java programming'],
    github_repos: ['java', 'awesome-java']
  },
  cpp: {
    tags: ['cpp', 'c++', 'programming'],
    youtube_queries: ['c++ tutorial', 'c++ programming'],
    github_repos: ['cpp', 'awesome-cpp']
  },
  react: {
    tags: ['react', 'javascript', 'frontend'],
    youtube_queries: ['react tutorial', 'react hooks'],
    github_repos: ['react', 'awesome-react']
  },
  node: {
    tags: ['nodejs', 'javascript', 'backend'],
    youtube_queries: ['nodejs tutorial', 'node.js basics'],
    github_repos: ['nodejs', 'awesome-nodejs']
  },
  typescript: {
    tags: ['typescript', 'javascript', 'webdev'],
    youtube_queries: ['typescript tutorial', 'typescript basics'],
    github_repos: ['typescript', 'awesome-typescript']
  }
};

/**
 * NEW: Fetch internal courses based on programming language
 * @param {number} languageId - Programming language ID
 * @param {string} languageName - Programming language name
 * @param {string} difficulty - beginner, intermediate, advanced
 * @param {number} limit - Number of courses to return
 */
/**
 * Fetch internal courses from Supabase database
 * @param {number} languageId - Programming language ID
 * @param {string} languageName - Programming language name
 * @param {string} difficulty - beginner, intermediate, advanced
 * @param {number} limit - Number of courses to return
 */
async function fetchInternalCourses(languageId, languageName, difficulty, limit = 3) {
  try {
    console.log(`🎓 Fetching internal courses for: ${languageName} (ID: ${languageId}), difficulty: ${difficulty}`);

    // ✅ UPDATED: More specific language mapping with exact match indicators
    const languageMap = {
      // Special handling for single-letter languages
      'r': {
        terms: ['Statistical', 'Data Science', 'Data Analysis'],
        exactTitle: 'R Programming'  // ✅ Must match "R Programming" exactly in title
      },
      'c': {
        terms: ['C Programming', 'C Language'],
        exactTitle: 'C Programming'
      },
      
      // Core Programming Languages
      'javascript': ['JavaScript', 'JS', 'ECMAScript'],
      'python': ['Python'],
      'java': ['Java'],
      'c++': ['C++', 'CPP'],
      'cpp': ['C++', 'CPP'],
      'c#': ['C#', 'CSharp'],
      'csharp': ['C#', 'CSharp'],
      'typescript': ['TypeScript', 'TS'],
      'ruby': ['Ruby'],
      'go': ['Go', 'Golang'],
      'golang': ['Go', 'Golang'],
      'rust': ['Rust'],
      'php': ['PHP'],
      'swift': ['Swift', 'iOS'],
      'kotlin': ['Kotlin', 'Android'],
      'dart': ['Dart', 'Flutter'],
      'scala': ['Scala'],
      'matlab': ['MATLAB'],
      'perl': ['Perl'],
      'lua': ['Lua'],
      'haskell': ['Haskell'],
      'elixir': ['Elixir'],
      'f#': ['F#', 'FSharp'],
      'fsharp': ['F#', 'FSharp'],
      'clojure': ['Clojure'],
      'objective-c': ['Objective-C', 'Objective C', 'iOS'],
      
      // Frameworks
      'react': ['React', 'React.js', 'ReactJS'],
      'react.js': ['React', 'React.js', 'ReactJS'],
      'vue': ['Vue', 'Vue.js', 'VueJS'],
      'vue.js': ['Vue', 'Vue.js', 'VueJS'],
      'angular': ['Angular', 'AngularJS'],
      'node': ['Node', 'Node.js', 'NodeJS', 'Backend'],
      'node.js': ['Node', 'Node.js', 'NodeJS'],
      'next': ['Next', 'Next.js', 'NextJS'],
      'next.js': ['Next', 'Next.js', 'NextJS'],
      'express': ['Express', 'Express.js', 'ExpressJS'],
      'express.js': ['Express', 'Express.js', 'ExpressJS'],
      'react native': ['React Native', 'Mobile'],
      'ionic': ['Ionic', 'Mobile'],
      'django': ['Django', 'Python', 'Web'],
      'flask': ['Flask', 'Python', 'Web'],
      'spring': ['Spring', 'Java', 'Spring Boot'],
      'laravel': ['Laravel', 'PHP'],
      'ruby on rails': ['Ruby on Rails', 'Rails', 'Ruby'],
      'rails': ['Ruby on Rails', 'Rails', 'Ruby'],
      'asp.net': ['ASP.NET', '.NET', 'C#'],
      'xamarin': ['Xamarin', 'Mobile', 'C#'],
      'flutter': ['Flutter', 'Dart', 'Mobile'],
      
      // Markup & Styling
      'html': ['HTML', 'Web', 'Markup'],
      'css': ['CSS', 'Styling', 'Web'],
      'scss': ['SCSS', 'Sass', 'CSS'],
      'sass': ['Sass', 'SCSS', 'CSS'],
      'scss/sass': ['SCSS', 'Sass', 'CSS'],
      'tailwind': ['Tailwind', 'CSS', 'Tailwind CSS'],
      'tailwind css': ['Tailwind', 'CSS', 'Tailwind CSS'],
      
      // Databases
      'sql': ['SQL', 'Database'],
      'mongodb': ['MongoDB', 'NoSQL', 'Database'],
      'postgresql': ['PostgreSQL', 'Postgres', 'SQL'],
      'mysql': ['MySQL', 'SQL', 'Database'],
      'graphql': ['GraphQL', 'API', 'Query'],
      
      // DevOps Tools
      'docker': ['Docker', 'Container', 'DevOps'],
      'kubernetes': ['Kubernetes', 'K8s', 'DevOps'],
      'terraform': ['Terraform', 'Infrastructure', 'IaC'],
      'ansible': ['Ansible', 'Automation', 'DevOps'],
      
      // Specialized
      'solidity': ['Solidity', 'Blockchain', 'Ethereum'],
      'webassembly': ['WebAssembly', 'WASM', 'Web']
    };

    const langConfig = languageMap[languageName.toLowerCase()];
    
    let query = supabase
      .from('courses')
      .select(`
        id,
        title,
        slug,
        description,
        short_description,
        level,
        category,
        icon_emoji,
        thumbnail_url,
        estimated_duration_hours,
        total_lessons,
        total_modules,
        is_featured
      `)
      .eq('is_published', true);

    // Filter by difficulty level
    if (difficulty === 'beginner') {
      query = query.eq('level', 'Beginner');
    } else if (difficulty === 'intermediate') {
      query = query.in('level', ['Beginner', 'Intermediate']);
    } else if (difficulty === 'advanced') {
      query = query.in('level', ['Intermediate', 'Advanced']);
    }

    // ✅ SPECIAL HANDLING: For languages with exactTitle, use exact match first
    if (langConfig && langConfig.exactTitle) {
      console.log(`   🎯 Using exact title match for ${languageName}: "${langConfig.exactTitle}"`);
      
      // Search for exact title match (e.g., "R Programming")
      query = query.ilike('title', `%${langConfig.exactTitle}%`);
      
    } else {
      // Regular search with terms
      const searchTerms = Array.isArray(langConfig) ? langConfig : (langConfig?.terms || [languageName]);
      
      console.log(`   🔍 Search terms for ${languageName}:`, searchTerms);
      
      // Create OR conditions for title, description, category
      const orConditions = searchTerms
        .map(term => `title.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`)
        .join(',');
      
      query = query.or(orConditions);
    }
    
    query = query.limit(limit);

    const { data: courses, error } = await query;

    if (error) {
      console.error('   ❌ Error fetching internal courses:', error);
      return [];
    }

    console.log(`   ✅ Found ${courses?.length || 0} internal courses for ${languageName}`);
    
    // ✅ ADDITIONAL FILTER: For single-letter languages, verify the title actually contains the language
    let filteredCourses = courses || [];
    
    if (langConfig && langConfig.exactTitle) {
      filteredCourses = courses.filter(course => {
        // Must have the exact title or the language name as a standalone word
        const titleLower = course.title.toLowerCase();
        const exactMatch = titleLower.includes(langConfig.exactTitle.toLowerCase());
        
        // Also check for language name as standalone word (not part of another word)
        const standaloneMatch = new RegExp(`\\b${languageName}\\b`, 'i').test(course.title);
        
        const matches = exactMatch || standaloneMatch;
        
        if (!matches) {
          console.log(`   ⚠️ Filtered out: "${course.title}" (doesn't match exact criteria)`);
        }
        
        return matches;
      });
      
      console.log(`   ✅ After exact filtering: ${filteredCourses.length} courses for ${languageName}`);
    }

    // Transform to recommendation format
    return (filteredCourses || []).map(course => ({
      provider: RESOURCE_PROVIDERS.INTERNAL_COURSE,
      type: 'course',
      title: course.title,
      description: course.short_description || course.description,
      url: `/courses/${course.id}/learn`,
      courseId: course.id,
      courseSlug: course.slug,
      difficulty: course.level,
      duration: `${course.estimated_duration_hours} hours`,
      lessonCount: course.total_lessons,
      moduleCount: course.total_modules,
      icon: course.icon_emoji || '📚',
      isFeatured: course.is_featured,
      category: course.category,
      thumbnail: course.thumbnail_url,
      metadata: {
        estimatedTime: `${course.estimated_duration_hours}h`,
        format: 'Interactive Course',
        isFree: true
      }
    }));

  } catch (error) {
    console.error('   ❌ Error in fetchInternalCourses:', error);
    return [];
  }
}


/**
 * Fetch resources from Dev.to
 */
async function fetchDevToResources(language, difficulty, limit = 3) {
  try {
    const tags = LANGUAGE_RESOURCES[language.toLowerCase()]?.tags || ['programming'];
    const tag = difficulty === 'beginner' ? 'beginners' : tags[0];
    
    const response = await axios.get(`https://dev.to/api/articles`, {
      params: {
        tag,
        per_page: limit * 2,
        top: 7
      }
    });

    return response.data.slice(0, limit).map(article => ({
      provider: RESOURCE_PROVIDERS.DEVTO,
      title: article.title,
      description: article.description,
      url: article.url,
      author: article.user.name,
      readTime: article.reading_time_minutes,
      reactions: article.positive_reactions_count,
      publishedAt: article.published_at,
      tags: article.tag_list,
      coverImage: article.cover_image,
      difficulty: difficulty
    }));
  } catch (error) {
    console.error('Error fetching Dev.to resources:', error.message);
    return [];
  }
}

/**
 * Fetch YouTube resources (requires YouTube API key)
 */
async function fetchYouTubeResources(language, difficulty, limit = 3) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.log('⚠️  YouTube API key not found, skipping YouTube resources');
    return [];
  }

  try {
    const queries = LANGUAGE_RESOURCES[language.toLowerCase()]?.youtube_queries || ['programming tutorial'];
    const query = difficulty === 'beginner' 
      ? `${queries[0]} for beginners`
      : queries[0];

    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: limit,
        order: 'relevance',
        key: apiKey,
        videoDuration: 'medium'
      }
    });

    return response.data.items.map(item => ({
      provider: RESOURCE_PROVIDERS.YOUTUBE,
      title: item.snippet.title,
      description: item.snippet.description,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      author: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.medium.url,
      publishedAt: item.snippet.publishedAt,
      difficulty: difficulty
    }));
  } catch (error) {
    console.error('Error fetching YouTube resources:', error.message);
    return [];
  }
}

/**
 * Fetch FreeCodeCamp resources
 */
async function fetchFreeCodeCampResources(language, difficulty, limit = 2) {
  try {
    const response = await axios.get(`https://dev.to/api/articles`, {
      params: {
        username: 'freecodecamp',
        per_page: limit
      }
    });

    return response.data.map(article => ({
      provider: RESOURCE_PROVIDERS.FREECODECAMP,
      title: article.title,
      description: article.description,
      url: article.url,
      author: 'FreeCodeCamp',
      readTime: article.reading_time_minutes,
      publishedAt: article.published_at,
      difficulty: difficulty
    }));
  } catch (error) {
    console.error('Error fetching FreeCodeCamp resources:', error.message);
    return [];
  }
}

/**
 * Fetch GitHub repositories
 */
async function fetchGitHubResources(language, limit = 2) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log('⚠️  GitHub token not found, skipping GitHub resources');
    return [];
  }

  try {
    const repos = LANGUAGE_RESOURCES[language.toLowerCase()]?.github_repos || ['programming'];
    const query = `${repos[0]} tutorial stars:>1000`;

    const response = await axios.get('https://api.github.com/search/repositories', {
      params: {
        q: query,
        sort: 'stars',
        per_page: limit
      },
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    return response.data.items.map(repo => ({
      provider: RESOURCE_PROVIDERS.GITHUB,
      title: repo.name,
      description: repo.description,
      url: repo.html_url,
      author: repo.owner.login,
      stars: repo.stargazers_count,
      language: repo.language,
      topics: repo.topics
    }));
  } catch (error) {
    console.error('Error fetching GitHub resources:', error.message);
    return [];
  }
}

/**
 * UPDATED: Get aggregated resources from all providers (including internal courses)
 */
async function getAggregatedResources(languageId, languageName, difficulty, attemptCount) {
  try {
    console.log(`🔍 Fetching resources for ${languageName} (ID: ${languageId}), difficulty: ${difficulty}, attempts: ${attemptCount}`);

    // Fetch from all providers in parallel
    const [internalCourses, devToResources, youtubeResources, fccResources, githubResources] = await Promise.all([
      fetchInternalCourses(languageId, languageName, difficulty, 3),
      fetchDevToResources(languageName, difficulty, 3),
      fetchYouTubeResources(languageName, difficulty, 2),
      fetchFreeCodeCampResources(languageName, difficulty, 1),
      fetchGitHubResources(languageName, 1)
    ]);

    // Prioritize based on attempt count
    let allResources = [];
    
    // ALWAYS prioritize internal courses first, regardless of attempt count
    if (attemptCount >= 15) {
      // High failure rate: ALL courses first, then video tutorials
      console.log('🔴 High failure rate - ALL courses first, then videos');
      allResources = [
        ...internalCourses,
        ...youtubeResources,
        ...fccResources,
        ...devToResources,
        ...githubResources
      ];
    } else if (attemptCount >= 10) {
      // Medium failure rate: Courses first, then mixed content
      console.log('🟡 Medium failure rate - courses first, then mixed');
      allResources = [
        ...internalCourses,
        ...youtubeResources,
        ...fccResources,
        ...devToResources,
        ...githubResources
      ];
    } else {
      // Lower failure rate: Courses STILL first, then quick tutorials
      console.log('🟢 Lower failure rate - courses first, then tutorials');
      allResources = [
        ...internalCourses,
        ...youtubeResources.slice(0, 2),
        ...devToResources.slice(0, 2),
        ...fccResources,
        ...githubResources
      ];
    }

    console.log(`📚 Total resources aggregated: ${allResources.length}`);
    console.log(`   - Courses: ${allResources.filter(r => r.provider === RESOURCE_PROVIDERS.INTERNAL_COURSE).length}`);
    console.log(`   - External: ${allResources.filter(r => r.provider !== RESOURCE_PROVIDERS.INTERNAL_COURSE).length}`);

    return allResources.slice(0, 8); // Limit to top 8 resources

  } catch (error) {
    console.error('Error aggregating resources:', error);
    return [];
  }
}

/**
 * POST /api/recommendations/challenge-failure
 * UPDATED: Now includes internal course recommendations
 */
router.post('/challenge-failure', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { 
      challengeId, 
      attemptCount, 
      programmingLanguageId,
      difficultyLevel 
    } = req.body;

    console.log('📊 Challenge failure request:', {
      userId,
      challengeId,
      attemptCount,
      programmingLanguageId,
      difficultyLevel
    });

    // Validate input
    if (!challengeId || !attemptCount || !programmingLanguageId) {
      console.error('❌ Missing required fields:', {
        challengeId: !!challengeId,
        attemptCount: !!attemptCount,
        programmingLanguageId: !!programmingLanguageId
      });
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: challengeId, attemptCount, or programmingLanguageId'
      });
    }

    // 1. Get programming language details
    const { data: languageData, error: langError } = await supabase
      .from('programming_languages')
      .select('id, name')
      .eq('id', programmingLanguageId)
      .single();

    if (langError) {
      console.error('❌ Error fetching language:', langError);
      return res.status(500).json({ success: false, error: 'Failed to fetch language' });
    }

    const languageId = languageData.id;
    const languageName = languageData.name || 'javascript';
    console.log('✅ Language found:', languageName, 'ID:', languageId);

    // 2. Get user's proficiency level
    const { data: proficiencyData } = await supabase
      .from('user_skill_ratings')
      .select('rating')
      .eq('user_id', userId)
      .eq('programming_language_id', programmingLanguageId)
      .single();

    const userRating = proficiencyData?.rating || 1200;
    console.log('📈 User rating:', userRating);

    // 3. Determine recommended difficulty
    let recommendedDifficulty = 'beginner';
    if (attemptCount >= 15 || userRating < 1100) {
      recommendedDifficulty = 'beginner';
    } else if (attemptCount >= 10 || userRating < 1300) {
      recommendedDifficulty = 'intermediate';
    } else if (userRating >= 1500) {
      recommendedDifficulty = 'advanced';
    }

    console.log('🎯 Recommended difficulty:', recommendedDifficulty);

    // 4. Fetch resources from all providers (including internal courses)
    const resources = await getAggregatedResources(
      languageId,
      languageName, 
      recommendedDifficulty, 
      attemptCount
    );

    console.log(`📚 Found ${resources.length} total resources`);

    // 5. Log each recommendation
    const recommendationIds = [];
    for (const resource of resources) {
      const { data, error } = await supabase
        .from('learning_recommendations')
        .insert({
          user_id: userId,
          language_id: programmingLanguageId,
          tutorial_url: resource.url,
          tutorial_title: resource.title,
          difficulty_level: recommendedDifficulty,
          recommended_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (!error && data) {
        recommendationIds.push(data.id);
      }
    }

    console.log(`✅ Logged ${recommendationIds.length} recommendations`);

    // 6. Log user activity
    const { data: challengeData } = await supabase
      .from('coding_challenges')
      .select('project_id')
      .eq('id', challengeId)
      .single();

    await supabase
      .from('user_activity')
      .insert({
        user_id: userId,
        project_id: challengeData?.project_id,
        activity_type: 'recommendation_received',
        activity_data: {
          challengeId,
          attemptCount,
          recommendationCount: resources.length,
          courseCount: resources.filter(r => r.provider === RESOURCE_PROVIDERS.INTERNAL_COURSE).length,
          difficulty: recommendedDifficulty
        },
        created_at: new Date().toISOString()
      });

    console.log('✅ Recommendations generated successfully');

    res.json({
      success: true,
      recommendations: resources,
      metadata: {
        userRating,
        recommendedDifficulty,
        attemptCount,
        languageName,
        totalRecommendations: resources.length,
        courseCount: resources.filter(r => r.provider === RESOURCE_PROVIDERS.INTERNAL_COURSE).length,
        externalCount: resources.filter(r => r.provider !== RESOURCE_PROVIDERS.INTERNAL_COURSE).length,
        recommendationIds
      }
    });

  } catch (error) {
    console.error('❌ Error generating recommendations:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate recommendations',
      message: error.message 
    });
  }
});

// Keep all your existing routes below...
router.post('/feedback', authMiddleware, async (req, res) => {
  try {
    const { 
      userId, 
      recommendationId, 
      actionType,
      timeSpent,
      effectivenessScore
    } = req.body;

    if (actionType === 'completed' && effectivenessScore) {
      await supabase
        .from('learning_recommendations')
        .update({
          completed_at: new Date().toISOString(),
          effectiveness_score: effectivenessScore
        })
        .eq('id', recommendationId);
    }

    await supabase
      .from('user_activity')
      .insert({
        user_id: userId,
        activity_type: 'recommendation_feedback',
        activity_data: {
          recommendationId,
          actionType,
          timeSpent,
          effectivenessScore
        },
        created_at: new Date().toISOString()
      });

    res.json({ success: true, message: 'Feedback recorded' });

  } catch (error) {
    console.error('Error recording feedback:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to record feedback' 
    });
  }
});

router.post('/save-learning', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      recommendationId, 
      resource,
      languageId,
      difficulty 
    } = req.body;

    if (!recommendationId || !resource) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: recommendationId and resource'
      });
    }

    const { data, error } = await supabase
      .from('user_activity')
      .insert({
        user_id: userId,
        activity_type: 'saved_learning_resource',
        activity_data: {
          recommendationId,
          resource,
          languageId,
          difficulty,
          savedAt: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    await supabase
      .from('learning_recommendations')
      .update({
        completed_at: new Date().toISOString()
      })
      .eq('id', recommendationId);

    res.json({
      success: true,
      message: 'Resource saved to personal learnings',
      savedResource: data
    });

  } catch (error) {
    console.error('Error saving to personal learnings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save resource' 
    });
  }
});

router.get('/analytics/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { languageId, timeRange = '30' } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeRange));

    let query = supabase
      .from('learning_recommendations')
      .select(`
        *,
        programming_languages(name)
      `)
      .eq('user_id', userId)
      .gte('recommended_at', startDate.toISOString());

    if (languageId) {
      query = query.eq('language_id', languageId);
    }

    const { data: recommendations, error } = await query;

    if (error) throw error;

    const stats = {};
    recommendations.forEach(rec => {
      const key = `${rec.programming_languages.name}-${rec.difficulty_level}`;
      if (!stats[key]) {
        stats[key] = {
          language_name: rec.programming_languages.name,
          difficulty_level: rec.difficulty_level,
          total_recommendations: 0,
          completed_count: 0,
          effectiveness_scores: []
        };
      }
      stats[key].total_recommendations++;
      if (rec.completed_at) stats[key].completed_count++;
      if (rec.effectiveness_score) stats[key].effectiveness_scores.push(rec.effectiveness_score);
    });

    const statistics = Object.values(stats).map(stat => ({
      ...stat,
      avg_effectiveness: stat.effectiveness_scores.length > 0
        ? stat.effectiveness_scores.reduce((a, b) => a + b, 0) / stat.effectiveness_scores.length
        : null
    }));

    const mostEffective = recommendations
      .filter(r => r.effectiveness_score)
      .sort((a, b) => b.effectiveness_score - a.effectiveness_score)
      .slice(0, 10)
      .map(r => ({
        tutorial_title: r.tutorial_title,
        tutorial_url: r.tutorial_url,
        difficulty_level: r.difficulty_level,
        effectiveness_score: r.effectiveness_score,
        completed_at: r.completed_at,
        language_name: r.programming_languages.name
      }));

    const patterns = [];
    const last7Days = 7;
    for (let i = 0; i < last7Days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const dayRecs = recommendations.filter(r => {
        const recDate = new Date(r.recommended_at);
        return recDate >= dayStart && recDate <= dayEnd;
      });

      patterns.push({
        date: dayStart.toISOString(),
        recommendation_count: dayRecs.length,
        completion_count: dayRecs.filter(r => r.completed_at).length
      });
    }

    res.json({
      success: true,
      analytics: {
        statistics,
        mostEffective,
        patterns: patterns.reverse()
      }
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch analytics' 
    });
  }
});

router.get('/user-history/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const { data, error, count } = await supabase
      .from('learning_recommendations')
      .select(`
        *,
        programming_languages(name)
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('recommended_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;

    const recommendations = data.map(rec => ({
      id: rec.id,
      tutorial_title: rec.tutorial_title,
      tutorial_url: rec.tutorial_url,
      difficulty_level: rec.difficulty_level,
      recommended_at: rec.recommended_at,
      completed_at: rec.completed_at,
      effectiveness_score: rec.effectiveness_score,
      language_name: rec.programming_languages.name
    }));

    res.json({
      success: true,
      recommendations,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: count
      }
    });

  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch history' 
    });
  }
});

router.post('/save-to-personal', authMiddleware, async (req, res) => {
  try {
    const { 
      recommendationId,
      resource,
      languageId,
      difficulty
    } = req.body;

    const userId = req.user.id;

    const { data, error } = await supabase
      .from('user_activity')
      .insert({
        user_id: userId,
        activity_type: 'saved_learning_resource',
        activity_data: {
          recommendationId,
          resource,
          languageId,
          difficulty,
          savedAt: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    await supabase
      .from('learning_recommendations')
      .update({
        completed_at: new Date().toISOString()
      })
      .eq('id', recommendationId);

    res.json({
      success: true,
      message: 'Resource saved to personal learnings',
      savedResource: data
    });

  } catch (error) {
    console.error('Error saving to personal learnings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save resource' 
    });
  }
});

router.get('/personal-learnings/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { languageId, limit = 50 } = req.query;

    let query = supabase
      .from('user_activity')
      .select('*')
      .eq('user_id', userId)
      .eq('activity_type', 'saved_learning_resource')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    const { data, error } = await query;

    if (error) throw error;

    let learnings = data;
    if (languageId) {
      learnings = data.filter(item => 
        item.activity_data?.languageId === parseInt(languageId)
      );
    }

    const formattedLearnings = learnings.map(item => ({
      id: item.id,
      savedAt: item.created_at,
      resource: item.activity_data.resource,
      difficulty: item.activity_data.difficulty,
      languageId: item.activity_data.languageId
    }));

    res.json({
      success: true,
      learnings: formattedLearnings,
      total: formattedLearnings.length
    });

  } catch (error) {
    console.error('Error fetching personal learnings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch personal learnings' 
    });
  }
});

router.delete('/personal-learnings/:activityId', authMiddleware, async (req, res) => {
  try {
    const { activityId } = req.params;
    const userId = req.user.id;

    const { error } = await supabase
      .from('user_activity')
      .delete()
      .eq('id', activityId)
      .eq('user_id', userId)
      .eq('activity_type', 'saved_learning_resource');

    if (error) throw error;

    res.json({
      success: true,
      message: 'Resource removed from personal learnings'
    });

  } catch (error) {
    console.error('Error removing from personal learnings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to remove resource' 
    });
  }
});

/**
 * POST /api/recommendations/bookmark-article
 * Save a Dev.to article as a bookmarked resource
 */
router.post('/bookmark-article', authMiddleware, async (req, res) => {
  try {
    const { article } = req.body;
    const userId = req.user.id;

    if (!article || !article.id) {
      return res.status(400).json({
        success: false,
        error: 'Article data is required'
      });
    }

    // Check if article is already bookmarked
    const { data: existing, error: checkError } = await supabase
      .from('user_activity')
      .select('id')
      .eq('user_id', userId)
      .eq('activity_type', 'bookmarked_article')
      .eq('activity_data->>articleId', article.id.toString())
      .single();

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Article is already bookmarked'
      });
    }

    // Save the bookmarked article
    const { data, error } = await supabase
      .from('user_activity')
      .insert({
        user_id: userId,
        activity_type: 'bookmarked_article',
        activity_data: {
          articleId: article.id,
          title: article.title,
          description: article.description,
          url: article.url,
          coverImage: article.cover_image,
          tags: article.tag_list,
          author: article.user?.name || 'Unknown',
          readingTime: article.reading_time_minutes,
          reactions: article.positive_reactions_count,
          publishedAt: article.published_at,
          bookmarkedAt: new Date().toISOString(),
          provider: 'dev.to'
        },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error bookmarking article:', error);
      throw error;
    }

    res.json({
      success: true,
      message: 'Article bookmarked successfully',
      bookmarkedArticle: data
    });

  } catch (error) {
    console.error('Error bookmarking article:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bookmark article'
    });
  }
});

/**
 * DELETE /api/recommendations/bookmark-article
 * Remove a bookmarked article
 */
router.delete('/bookmark-article', authMiddleware, async (req, res) => {
  try {
    const { articleId } = req.body;
    const userId = req.user.id;

    if (!articleId) {
      return res.status(400).json({
        success: false,
        error: 'Article ID is required'
      });
    }

    const { error } = await supabase
      .from('user_activity')
      .delete()
      .eq('user_id', userId)
      .eq('activity_type', 'bookmarked_article')
      .eq('activity_data->>articleId', articleId.toString());

    if (error) {
      console.error('Error removing bookmark:', error);
      throw error;
    }

    res.json({
      success: true,
      message: 'Bookmark removed successfully'
    });

  } catch (error) {
    console.error('Error removing bookmark:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove bookmark'
    });
  }
});

/**
 * GET /api/recommendations/bookmarked-articles/:userId
 * Get all bookmarked articles for a user
 */
router.get('/bookmarked-articles/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify the requesting user matches the userId
    if (req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized access'
      });
    }

    const { data, error } = await supabase
      .from('user_activity')
      .select('*')
      .eq('user_id', userId)
      .eq('activity_type', 'bookmarked_article')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bookmarked articles:', error);
      throw error;
    }

    // Transform the data to match the article structure
    const bookmarkedArticles = data.map(item => {
      const articleData = item.activity_data;
      return {
        id: articleData.articleId,
        title: articleData.title,
        description: articleData.description,
        url: articleData.url,
        cover_image: articleData.coverImage,
        tag_list: articleData.tags || [],
        user: {
          name: articleData.author
        },
        reading_time_minutes: articleData.readingTime,
        positive_reactions_count: articleData.reactions,
        published_at: articleData.publishedAt,
        bookmarked_at: articleData.bookmarkedAt
      };
    });

    res.json({
      success: true,
      bookmarkedArticles,
      total: bookmarkedArticles.length
    });

  } catch (error) {
    console.error('Error fetching bookmarked articles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookmarked articles'
    });
  }
});

module.exports = router;
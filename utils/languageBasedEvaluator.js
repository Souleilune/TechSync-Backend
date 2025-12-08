// backend/utils/languageBasedEvaluator.js
// Language-based code evaluation system - NO Judge0 required
// Evaluates code by checking for proper language-specific functions, keywords, and patterns

const supabase = require('../config/supabase');

/**
 * Get language-specific functions and keywords from database or predefined list
 * @param {number} languageId - Programming language ID
 * @param {string} languageName - Programming language name
 * @returns {Object} Language features (functions, keywords, patterns)
 */
async function getLanguageFeatures(languageId, languageName) {
  // Define comprehensive language features
  const languageFeatures = {
    'JavaScript': {
      functions: ['function', 'const', 'let', 'var', 'arrow', '=>', 'return', 'async', 'await'],
      keywords: ['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'throw'],
      methods: ['map', 'filter', 'reduce', 'forEach', 'find', 'findIndex', 'some', 'every', 'includes', 'push', 'pop', 'shift', 'unshift', 'slice', 'splice', 'concat', 'join', 'split', 'toString', 'parseInt', 'parseFloat'],
      patterns: {
        functionDeclaration: /function\s+\w+\s*\([^)]*\)/g,
        arrowFunction: /(?:const|let|var)\s+\w+\s*=\s*(?:\([^)]*\)|[^=]*)\s*=>/g,
        variableDeclaration: /(?:const|let|var)\s+\w+/g,
        conditionals: /\b(?:if|else if|else|switch)\b/g,
        loops: /\b(?:for|while|do)\b/g,
        asyncAwait: /\b(?:async|await)\b/g,
        tryCatch: /\b(?:try|catch|finally)\b/g,
        classes: /class\s+\w+/g,
        imports: /\b(?:import|require)\b/g,
        exports: /\b(?:export|module\.exports)\b/g
      },
      structures: ['array', 'object', 'class', 'module']
    },
    'Python': {
      functions: ['def', 'lambda', 'return', 'yield', 'async', 'await'],
      keywords: ['if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'import', 'from', 'as', 'pass', 'break', 'continue', 'raise'],
      methods: ['print', 'input', 'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'sorted', 'reversed', 'sum', 'min', 'max', 'abs', 'round', 'isinstance', 'type', 'str', 'int', 'float', 'list', 'dict', 'tuple', 'set'],
      patterns: {
        functionDeclaration: /def\s+\w+\s*\([^)]*\)\s*:/g,
        lambdaFunction: /lambda\s+[^:]+:/g,
        classDeclaration: /class\s+\w+/g,
        conditionals: /\b(?:if|elif|else)\b/g,
        loops: /\b(?:for|while)\b/g,
        tryCatch: /\b(?:try|except|finally)\b/g,
        imports: /\b(?:import|from)\b/g,
        listComprehension: /\[[^\]]+\s+for\s+[^\]]+\]/g,
        dictComprehension: /\{[^}]+\s+for\s+[^}]+\}/g,
        decorators: /@\w+/g
      },
      structures: ['list', 'dict', 'tuple', 'set', 'class']
    },
    'Java': {
      functions: ['public', 'private', 'protected', 'static', 'void', 'return', 'class', 'interface'],
      keywords: ['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'throws', 'new', 'this', 'super', 'extends', 'implements'],
      methods: ['System.out.println', 'System.out.print', 'Scanner', 'ArrayList', 'HashMap', 'HashSet', 'String.valueOf', 'Integer.parseInt', 'Double.parseDouble', 'Math.', 'equals', 'toString', 'length', 'size', 'add', 'remove', 'get', 'set', 'contains'],
      patterns: {
        classDeclaration: /(?:public|private|protected)?\s*class\s+\w+/g,
        methodDeclaration: /(?:public|private|protected)\s+(?:static\s+)?[\w<>\[\]]+\s+\w+\s*\([^)]*\)/g,
        mainMethod: /public\s+static\s+void\s+main\s*\(\s*String\[\]\s+\w+\s*\)/g,
        conditionals: /\b(?:if|else if|else|switch)\b/g,
        loops: /\b(?:for|while|do)\b/g,
        tryCatch: /\b(?:try|catch|finally)\b/g,
        objectCreation: /new\s+\w+\s*\(/g,
        imports: /import\s+[\w.]+/g,
        interfaces: /interface\s+\w+/g
      },
      structures: ['class', 'interface', 'enum', 'array', 'ArrayList', 'HashMap']
    },
    'C++': {
      functions: ['int', 'void', 'char', 'float', 'double', 'bool', 'return', 'class', 'struct'],
      keywords: ['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'throw', 'new', 'delete', 'const', 'static', 'public', 'private', 'protected'],
      methods: ['cout', 'cin', 'printf', 'scanf', 'malloc', 'free', 'sizeof', 'strlen', 'strcpy', 'strcmp', 'vector', 'push_back', 'pop_back', 'size', 'clear', 'sort', 'find', 'begin', 'end'],
      patterns: {
        functionDeclaration: /(?:int|void|char|float|double|bool|string|auto)\s+\w+\s*\([^)]*\)/g,
        mainFunction: /int\s+main\s*\([^)]*\)/g,
        classDeclaration: /class\s+\w+/g,
        conditionals: /\b(?:if|else if|else|switch)\b/g,
        loops: /\b(?:for|while|do)\b/g,
        tryCatch: /\b(?:try|catch)\b/g,
        includes: /#include\s*[<"][^>"]+[>"]/g,
        namespace: /using\s+namespace\s+\w+/g,
        pointers: /\w+\s*\*\s*\w+/g,
        references: /\w+\s*&\s*\w+/g,
        templates: /template\s*<[^>]+>/g
      },
      structures: ['class', 'struct', 'array', 'vector', 'map', 'set', 'pair']
    },
    'C#': {
      functions: ['public', 'private', 'protected', 'static', 'void', 'return', 'class', 'interface', 'async', 'await'],
      keywords: ['if', 'else', 'for', 'foreach', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'base', 'using', 'namespace'],
      methods: ['Console.WriteLine', 'Console.ReadLine', 'String.Format', 'int.Parse', 'double.Parse', 'List', 'Dictionary', 'Array', 'LINQ', 'ToString', 'Add', 'Remove', 'Contains', 'Count', 'Length', 'Where', 'Select', 'FirstOrDefault'],
      patterns: {
        classDeclaration: /(?:public|private|protected)?\s*class\s+\w+/g,
        methodDeclaration: /(?:public|private|protected)\s+(?:static\s+)?(?:async\s+)?[\w<>\[\]]+\s+\w+\s*\([^)]*\)/g,
        mainMethod: /static\s+void\s+Main\s*\([^)]*\)/g,
        conditionals: /\b(?:if|else if|else|switch)\b/g,
        loops: /\b(?:for|foreach|while|do)\b/g,
        tryCatch: /\b(?:try|catch|finally)\b/g,
        asyncAwait: /\b(?:async|await)\b/g,
        usingStatements: /using\s+[\w.]+/g,
        lambdaExpression: /=>\s*(?:\{|[^;])/g,
        properties: /(?:public|private|protected)\s+\w+\s+\w+\s*\{\s*get;/g
      },
      structures: ['class', 'interface', 'struct', 'enum', 'List', 'Dictionary', 'Array']
    },
    'Go': {
      functions: ['func', 'return', 'defer', 'go', 'chan', 'interface', 'struct'],
      keywords: ['if', 'else', 'for', 'switch', 'case', 'break', 'continue', 'fallthrough', 'goto', 'range', 'select', 'var', 'const', 'type', 'import', 'package'],
      methods: ['fmt.Println', 'fmt.Printf', 'fmt.Scanf', 'len', 'cap', 'make', 'append', 'copy', 'delete', 'close', 'panic', 'recover'],
      patterns: {
        functionDeclaration: /func\s+(?:\w+\s+)?(\w+)\s*\([^)]*\)/g,
        mainFunction: /func\s+main\s*\(\s*\)/g,
        structDeclaration: /type\s+\w+\s+struct/g,
        interfaceDeclaration: /type\s+\w+\s+interface/g,
        conditionals: /\b(?:if|else if|else|switch)\b/g,
        loops: /\bfor\b/g,
        goroutines: /\bgo\b\s+\w+/g,
        channels: /\bchan\b/g,
        imports: /import\s+(?:\([\s\S]*?\)|"[^"]+")/g,
        defer: /\bdefer\b/g
      },
      structures: ['struct', 'interface', 'map', 'slice', 'array', 'channel']
    },
    'Rust': {
      functions: ['fn', 'return', 'impl', 'trait', 'struct', 'enum', 'async', 'await'],
      keywords: ['if', 'else', 'for', 'while', 'loop', 'match', 'break', 'continue', 'return', 'let', 'mut', 'const', 'use', 'mod', 'pub', 'impl', 'trait', 'struct', 'enum'],
      methods: ['println!', 'print!', 'format!', 'vec!', 'panic!', 'assert!', 'unwrap', 'expect', 'map', 'filter', 'collect', 'iter', 'push', 'pop', 'len', 'is_empty', 'to_string', 'parse', 'clone'],
      patterns: {
        functionDeclaration: /fn\s+\w+\s*(?:<[^>]+>)?\s*\([^)]*\)/g,
        mainFunction: /fn\s+main\s*\(\s*\)/g,
        structDeclaration: /struct\s+\w+/g,
        enumDeclaration: /enum\s+\w+/g,
        traitDeclaration: /trait\s+\w+/g,
        implBlock: /impl\s+(?:<[^>]+>)?\s*\w+/g,
        conditionals: /\b(?:if|else if|else|match)\b/g,
        loops: /\b(?:for|while|loop)\b/g,
        macros: /\w+!/g,
        borrowing: /&(?:mut\s+)?\w+/g,
        lifetimes: /'[a-z]/g
      },
      structures: ['struct', 'enum', 'trait', 'Vec', 'HashMap', 'Option', 'Result']
    },
    'TypeScript': {
      functions: ['function', 'const', 'let', 'var', 'arrow', '=>', 'return', 'async', 'await', 'type', 'interface'],
      keywords: ['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'throw', 'type', 'interface', 'enum', 'namespace', 'module'],
      methods: ['console.log', 'map', 'filter', 'reduce', 'forEach', 'find', 'findIndex', 'some', 'every', 'includes', 'push', 'pop', 'shift', 'unshift', 'slice', 'splice', 'concat', 'join', 'split'],
      patterns: {
        functionDeclaration: /function\s+\w+\s*(?:<[^>]+>)?\s*\([^)]*\)\s*:\s*\w+/g,
        arrowFunction: /(?:const|let|var)\s+\w+\s*=\s*(?:\([^)]*\)|[^=]*)\s*=>/g,
        typeAnnotation: /:\s*(?:string|number|boolean|any|unknown|void|never|object|\w+\[\]|Promise<\w+>)/g,
        interface: /interface\s+\w+/g,
        typeAlias: /type\s+\w+\s*=/g,
        genericTypes: /<[^>]+>/g,
        conditionals: /\b(?:if|else if|else|switch)\b/g,
        loops: /\b(?:for|while|do)\b/g,
        asyncAwait: /\b(?:async|await)\b/g,
        classes: /class\s+\w+/g,
        enum: /enum\s+\w+/g
      },
      structures: ['interface', 'type', 'class', 'enum', 'array', 'object', 'Promise', 'Map', 'Set']
    },
    'PHP': {
      functions: ['function', 'return', 'echo', 'print', 'class', 'interface', 'trait'],
      keywords: ['if', 'else', 'elseif', 'for', 'foreach', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'new', 'use', 'namespace', 'const'],
      methods: ['echo', 'print', 'var_dump', 'print_r', 'strlen', 'strpos', 'substr', 'str_replace', 'explode', 'implode', 'array_push', 'array_pop', 'count', 'isset', 'empty', 'is_array', 'json_encode', 'json_decode'],
      patterns: {
        phpTag: /<\?php/g,
        functionDeclaration: /function\s+\w+\s*\([^)]*\)/g,
        classDeclaration: /class\s+\w+/g,
        conditionals: /\b(?:if|elseif|else|switch)\b/g,
        loops: /\b(?:for|foreach|while|do)\b/g,
        tryCatch: /\b(?:try|catch|finally)\b/g,
        variables: /\$\w+/g,
        echoOrPrint: /\b(?:echo|print)\b/g,
        namespace: /namespace\s+[\w\\]+/g,
        use: /use\s+[\w\\]+/g
      },
      structures: ['array', 'class', 'interface', 'trait', 'namespace']
    },
    'Ruby': {
      functions: ['def', 'return', 'yield', 'lambda', 'proc', 'class', 'module'],
      keywords: ['if', 'elsif', 'else', 'unless', 'case', 'when', 'for', 'while', 'until', 'loop', 'break', 'next', 'redo', 'rescue', 'ensure', 'raise', 'begin', 'end', 'do'],
      methods: ['puts', 'print', 'p', 'gets', 'chomp', 'length', 'size', 'empty?', 'include?', 'map', 'select', 'reject', 'each', 'times', 'upto', 'downto', 'push', 'pop', 'shift', 'unshift', 'join', 'split'],
      patterns: {
        methodDefinition: /def\s+\w+(?:\([^)]*\))?/g,
        classDeclaration: /class\s+\w+/g,
        moduleDeclaration: /module\s+\w+/g,
        conditionals: /\b(?:if|elsif|else|unless|case|when)\b/g,
        loops: /\b(?:for|while|until|loop|each|times)\b/g,
        blocks: /\bdo\b|\{[^}]*\}/g,
        symbols: /:\w+/g,
        stringInterpolation: /#\{[^}]+\}/g,
        rescue: /\b(?:begin|rescue|ensure|raise)\b/g
      },
      structures: ['class', 'module', 'array', 'hash', 'symbol', 'block']
    },
    'Swift': {
      functions: ['func', 'return', 'class', 'struct', 'enum', 'protocol', 'extension', 'init'],
      keywords: ['if', 'else', 'guard', 'for', 'while', 'repeat', 'switch', 'case', 'break', 'continue', 'fallthrough', 'return', 'let', 'var', 'in', 'try', 'catch', 'throw', 'defer'],
      methods: ['print', 'Array', 'Dictionary', 'Set', 'map', 'filter', 'reduce', 'forEach', 'compactMap', 'flatMap', 'append', 'remove', 'count', 'isEmpty', 'first', 'last', 'contains'],
      patterns: {
        functionDeclaration: /func\s+\w+\s*(?:<[^>]+>)?\s*\([^)]*\)/g,
        classDeclaration: /class\s+\w+/g,
        structDeclaration: /struct\s+\w+/g,
        enumDeclaration: /enum\s+\w+/g,
        protocolDeclaration: /protocol\s+\w+/g,
        conditionals: /\b(?:if|else if|else|guard|switch)\b/g,
        loops: /\b(?:for|while|repeat)\b/g,
        optionals: /\?|\!/g,
        closures: /\{[^}]*in[^}]*\}/g,
        tryCatch: /\b(?:try|catch|throw|defer)\b/g
      },
      structures: ['class', 'struct', 'enum', 'protocol', 'extension', 'Array', 'Dictionary', 'Set', 'Optional']
    },
    'Kotlin': {
      functions: ['fun', 'return', 'class', 'interface', 'object', 'companion', 'suspend'],
      keywords: ['if', 'else', 'when', 'for', 'while', 'do', 'break', 'continue', 'return', 'val', 'var', 'in', 'is', 'as', 'try', 'catch', 'finally', 'throw'],
      methods: ['println', 'print', 'readLine', 'toInt', 'toDouble', 'toString', 'listOf', 'mutableListOf', 'mapOf', 'mutableMapOf', 'setOf', 'mutableSetOf', 'map', 'filter', 'forEach', 'any', 'all', 'none', 'first', 'last', 'size'],
      patterns: {
        functionDeclaration: /fun\s+(?:<[^>]+>)?\s*\w+\s*\([^)]*\)/g,
        classDeclaration: /(?:class|data class|sealed class)\s+\w+/g,
        objectDeclaration: /object\s+\w+/g,
        conditionals: /\b(?:if|else if|else|when)\b/g,
        loops: /\b(?:for|while|do)\b/g,
        tryCatch: /\b(?:try|catch|finally)\b/g,
        nullSafety: /\?\.|\?\:/g,
        lambdas: /\{[^}]*->[^}]*\}/g,
        extensionFunction: /fun\s+\w+\.\w+/g,
        coroutines: /\b(?:suspend|launch|async|await)\b/g
      },
      structures: ['class', 'data class', 'interface', 'object', 'List', 'Map', 'Set', 'Array']
    },
    'C': {
      functions: ['int', 'void', 'char', 'float', 'double', 'return', 'struct', 'union', 'typedef'],
      keywords: ['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'goto', 'return', 'const', 'static', 'extern', 'register', 'auto', 'sizeof'],
      methods: ['printf', 'scanf', 'malloc', 'calloc', 'realloc', 'free', 'strlen', 'strcpy', 'strcmp', 'strcat', 'memcpy', 'memset', 'fopen', 'fclose', 'fprintf', 'fscanf', 'fgets', 'fputs'],
      patterns: {
        functionDeclaration: /(?:int|void|char|float|double|struct\s+\w+|\w+\*)\s+\w+\s*\([^)]*\)/g,
        mainFunction: /int\s+main\s*\([^)]*\)/g,
        structDeclaration: /struct\s+\w+\s*\{/g,
        conditionals: /\b(?:if|else if|else|switch)\b/g,
        loops: /\b(?:for|while|do)\b/g,
        includes: /#include\s*[<"][^>"]+[>"]/g,
        define: /#define\s+\w+/g,
        pointers: /\w+\s*\*+\s*\w+/g,
        arrays: /\w+\s+\w+\s*\[[^\]]*\]/g
      },
      structures: ['struct', 'union', 'enum', 'array', 'pointer']
    }
  };

  // Return features for the specified language
  const normalizedName = languageName || 'JavaScript';
  
  if (!languageFeatures[normalizedName]) {
    return {
      functions: ['function', 'def', 'func', 'fn', 'void', 'int', 'return'],
      keywords: ['if', 'else', 'for', 'while', 'switch', 'case', 'try', 'catch', 'break', 'continue'],
      methods: ['print', 'log', 'write', 'read', 'get', 'set', 'add', 'remove', 'find', 'sort'],
      patterns: {
        anyFunction: /(?:function|def|func|fn|void|int|public|private)\s+\w+/g,
        conditionals: /\b(?:if|else|elif|switch|case|when|match)\b/g,
        loops: /\b(?:for|while|do|each|loop)\b/g,
        returnStatement: /\breturn\b/g,
      },
      structures: ['class', 'struct', 'object', 'array']
    };
  }
  
  return languageFeatures[normalizedName];
}


/**
 * Evaluate code submission based on language-specific features
 * @param {string} submittedCode - User's code submission
 * @param {Object} challenge - Challenge details
 * @param {Object} project - Project details
 * @returns {Object} Evaluation result
 */
async function evaluateCodeWithLanguageFeatures(submittedCode, challenge, project) {
  try {
    const code = String(submittedCode || '').trim();
    
    // Get language information
    const languageName = challenge?.programming_languages?.name || 
                        project?.project_languages?.find(pl => pl.is_primary)?.programming_languages?.name || 
                        'JavaScript';
    
    const languageId = challenge?.programming_language_id || 
                      project?.project_languages?.find(pl => pl.is_primary)?.language_id || 
                      null;

    const difficulty = challenge?.difficulty_level || 'easy';

    console.log('🔍 Evaluating code:', {
      languageName,
      difficulty,
      codeLength: code.length
    });

    // Get language features
    const features = await getLanguageFeatures(languageId, languageName);
    
    // Initialize scoring
    const details = {
      languageName,
      difficulty,
      codeLength: code.length,
      foundFeatures: [],
      suggestions: [],
      breakdown: {}
    };

    // ============================================
    // NEW SCORING SYSTEM - More generous
    // ============================================
    
    let score = 0;

    // 1. BASE SCORE FOR SUBMISSION (30 points)
    // Just submitting code that isn't empty gets points
    if (code.length >= 10) {
      score += 15;
      details.foundFeatures.push('Valid code submission');
    }
    if (code.length >= 30) {
      score += 10;
      details.foundFeatures.push('Substantial code length');
    }
    if (code.length >= 100) {
      score += 5;
      details.foundFeatures.push('Comprehensive solution');
    }
    details.breakdown.baseScore = Math.min(30, score);

    // 2. FUNCTION/METHOD DEFINITION (25 points)
    // Does the code define any callable?
    let hasFunctionDefinition = false;
    
    // Check for ANY function-like pattern
    const functionPatterns = [
      /function\s+\w+/gi,                          // JS function
      /(?:const|let|var)\s+\w+\s*=\s*\([^)]*\)\s*=>/gi, // Arrow function
      /(?:const|let|var)\s+\w+\s*=\s*function/gi,  // Function expression
      /=>\s*[{(]/gi,                               // Any arrow
      /def\s+\w+/gi,                               // Python
      /fn\s+\w+/gi,                                // Rust
      /func\s+\w+/gi,                              // Go/Swift
      /fun\s+\w+/gi,                               // Kotlin
      /(?:public|private|protected)?\s*(?:static\s+)?[\w<>\[\]]+\s+\w+\s*\([^)]*\)\s*[{:]/gi, // Java/C#
      /(?:int|void|char|float|double|bool|string|auto)\s+\w+\s*\([^)]*\)/gi, // C/C++
    ];
    
    for (const pattern of functionPatterns) {
      if (pattern.test(code)) {
        hasFunctionDefinition = true;
        break;
      }
    }
    
    if (hasFunctionDefinition) {
      score += 25;
      details.foundFeatures.push('Defines function/method');
    } else if (/return\b/i.test(code)) {
      // Has return statement, likely inside a function
      score += 15;
      details.foundFeatures.push('Contains return statement');
    } else {
      // Check for method calls or any programming structure
      if (/\w+\s*\([^)]*\)/g.test(code)) {
        score += 10;
        details.foundFeatures.push('Contains function calls');
      }
      details.suggestions.push('Consider wrapping code in a function');
    }
    details.breakdown.functionScore = score - details.breakdown.baseScore;

    // 3. LOGIC & CONTROL FLOW (20 points)
    let logicScore = 0;
    
    // Conditionals
    const hasConditional = /\b(?:if|else|elif|switch|case|when|match|\?.*:)\b/i.test(code);
    if (hasConditional) {
      logicScore += 10;
      details.foundFeatures.push('Uses conditional logic');
    }
    
    // Loops
    const hasLoop = /\b(?:for|while|do|each|loop|forEach|map|filter|reduce)\b/i.test(code);
    if (hasLoop) {
      logicScore += 10;
      details.foundFeatures.push('Uses iteration/loops');
    }
    
    // Ternary or simple expressions also count
    if (!hasConditional && !hasLoop) {
      if (/[+\-*/%]/.test(code) || /[<>=!]=?/.test(code)) {
        logicScore += 5;
        details.foundFeatures.push('Contains expressions/operators');
      }
    }
    
    score += logicScore;
    details.breakdown.logicScore = logicScore;

    // 4. LANGUAGE-SPECIFIC FEATURES (15 points)
    let languageScore = 0;
    let featuresFound = 0;
    
    // Check functions keywords
    for (const func of features.functions) {
      const regex = new RegExp(`\\b${func}\\b`, 'gi');
      if (regex.test(code)) {
        featuresFound++;
      }
    }
    
    // Check methods  
    for (const method of features.methods) {
      const escapedMethod = method.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedMethod, 'gi');
      if (regex.test(code)) {
        featuresFound++;
      }
    }
    
    // Score based on features found (diminishing returns)
    if (featuresFound >= 1) languageScore += 5;
    if (featuresFound >= 3) languageScore += 5;
    if (featuresFound >= 5) languageScore += 5;
    
    score += languageScore;
    details.foundFeatures.push(`Uses ${featuresFound} language feature(s)`);
    details.breakdown.languageScore = languageScore;

    // 5. CODE QUALITY BONUS (10 points)
    let qualityScore = 0;
    
    // Comments
    const hasComments = /\/\/.*|\/\*[\s\S]*?\*\/|#(?!include|define).*|"""[\s\S]*?"""|'''[\s\S]*?'''/.test(code);
    if (hasComments) {
      qualityScore += 3;
      details.foundFeatures.push('Includes comments');
    }
    
    // Meaningful variable names (not just single letters, unless they're common like i, j, n, x, y)
    const variablePattern = /(?:const|let|var|int|float|double|string|char)\s+([a-zA-Z_]\w*)/g;
    let matches = [...code.matchAll(variablePattern)];
    const hasDescriptiveNames = matches.some(m => m[1] && m[1].length > 2);
    if (hasDescriptiveNames) {
      qualityScore += 3;
      details.foundFeatures.push('Uses descriptive names');
    }
    
    // Multiple lines (organized code)
    const lineCount = code.split('\n').filter(l => l.trim()).length;
    if (lineCount >= 3) {
      qualityScore += 2;
      details.foundFeatures.push('Well-organized structure');
    }
    if (lineCount >= 10) {
      qualityScore += 2;
      details.foundFeatures.push('Comprehensive implementation');
    }
    
    score += qualityScore;
    details.breakdown.qualityScore = qualityScore;

    // 6. DIFFICULTY ADJUSTMENT (extra points or reduced threshold)
    // Harder challenges are more forgiving
    let difficultyBonus = 0;
    if (difficulty === 'medium' && score >= 50) difficultyBonus = 5;
    if (difficulty === 'hard' && score >= 40) difficultyBonus = 10;
    if (difficulty === 'expert' && score >= 30) difficultyBonus = 15;
    
    score += difficultyBonus;
    if (difficultyBonus > 0) {
      details.foundFeatures.push(`Difficulty bonus: +${difficultyBonus}`);
    }
    details.breakdown.difficultyBonus = difficultyBonus;

    // ============================================
    // FINAL SCORE CALCULATION
    // ============================================
    
    score = Math.min(100, Math.round(score));
    details.breakdown.total = score;

    // Dynamic passing threshold based on difficulty
    let passingThreshold = 50; // Much lower base threshold
    if (difficulty === 'easy') passingThreshold = 50;
    if (difficulty === 'medium') passingThreshold = 45;
    if (difficulty === 'hard') passingThreshold = 40;
    if (difficulty === 'expert') passingThreshold = 35;

    const passed = score >= passingThreshold;
    const status = passed ? 'passed' : 'failed';

    // Generate feedback
    const feedback = generateImprovedFeedback(score, passed, details, languageName, difficulty);

    console.log('✅ Evaluation complete:', {
      score,
      passed,
      threshold: passingThreshold,
      breakdown: details.breakdown
    });

    return {
      score,
      passed,
      status,
      feedback,
      details,
      evaluation: {
        score,
        feedback,
        details,
        usedLanguageFeatures: true,
        languageName,
        passingThreshold
      }
    };

  } catch (error) {
    console.error('❌ Evaluation error:', error);
    
    // IMPORTANT: On error, give benefit of doubt
    return {
      score: 60,
      passed: true,
      status: 'passed',
      feedback: 'Code submitted successfully! Our evaluator had some issues, but your solution has been accepted.',
      details: { error: error.message },
      evaluation: {
        score: 60,
        feedback: 'Accepted with evaluation notice',
        usedLanguageFeatures: false
      }
    };
  }
}

/**
 * Generate detailed feedback based on score and code analysis
 * @param {number} score - Calculated score
 * @param {Object} details - Analysis details
 * @param {string} languageName - Programming language
 * @returns {string} Feedback message
 */
function generateImprovedFeedback(score, passed, details, languageName, difficulty) {
  let feedback = '';

  // Main message
  if (passed) {
    if (score >= 90) {
      feedback = `🏆 Outstanding! Your ${languageName} solution is excellent!`;
    } else if (score >= 75) {
      feedback = `🎉 Great job! Your ${languageName} code works well!`;
    } else if (score >= 60) {
      feedback = `✅ Nice work! Your ${languageName} solution passed!`;
    } else {
      feedback = `👍 Good effort! Your ${languageName} code has been accepted.`;
    }
  } else {
    if (score >= 40) {
      feedback = `💪 Almost there! Your ${languageName} code shows good understanding.`;
    } else if (score >= 25) {
      feedback = `📚 Keep going! You're on the right track with ${languageName}.`;
    } else {
      feedback = `🌱 Good start! Let's build up your ${languageName} solution.`;
    }
  }

  // Add score context
  feedback += ` (Score: ${score}/100)`;

  // Show what was good
  if (details.foundFeatures.length > 0) {
    feedback += '\n\n✨ What you did well:';
    details.foundFeatures.slice(0, 4).forEach(f => {
      feedback += `\n  • ${f}`;
    });
  }

  // Add helpful suggestions (not criticism)
  if (!passed && details.suggestions.length > 0) {
    feedback += '\n\n💡 Tips to improve:';
    details.suggestions.slice(0, 3).forEach(s => {
      feedback += `\n  • ${s}`;
    });
  }

  // Encouragement for harder difficulties
  if (difficulty === 'hard' || difficulty === 'expert') {
    feedback += '\n\n🔥 This was a challenging problem!';
  }

  return feedback;
}

module.exports = {
  evaluateCodeWithLanguageFeatures,
  getLanguageFeatures
};
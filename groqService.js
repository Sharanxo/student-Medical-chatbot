const Groq = require('groq-sdk');
require('dotenv').config();

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Health-related keywords for filtering
const healthKeywords = [
  // Physical health
  'headache', 'migraine', 'pain', 'ache', 'hurt', 'sore', 'fever', 'cold', 'flu',
  'cough', 'sneeze', 'nausea', 'vomit', 'dizzy', 'tired', 'fatigue', 'weak',
  'stomach', 'belly', 'chest', 'back', 'neck', 'shoulder', 'knee', 'joint',
  'muscle', 'bone', 'skin', 'rash', 'itch', 'allergy', 'asthma', 'breathing',
  
  // Mental health
  'stress', 'anxiety', 'depression', 'sad', 'worried', 'panic', 'mood',
  'mental', 'emotional', 'overwhelmed', 'burnout', 'lonely', 'angry',
  
  // Lifestyle and wellness
  'sleep', 'insomnia', 'tired', 'energy', 'diet', 'nutrition', 'food',
  'exercise', 'fitness', 'weight', 'eating', 'appetite', 'hydration',
  'water', 'vitamin', 'supplement', 'healthy', 'wellness', 'lifestyle',
  
  // Student-specific health concerns
  'study', 'exam', 'academic', 'concentration', 'focus', 'memory',
  'procrastination', 'deadline', 'pressure', 'university', 'college',
  'student', 'campus', 'dorm', 'roommate', 'social', 'relationship',
  
  // Medical terms
  'doctor', 'physician', 'clinic', 'hospital', 'medicine', 'medication',
  'prescription', 'treatment', 'therapy', 'counseling', 'health', 'medical',
  'symptom', 'diagnosis', 'condition', 'disease', 'illness', 'sick',
  
  // Body systems
  'heart', 'blood', 'pressure', 'circulation', 'digestive', 'immune',
  'nervous', 'respiratory', 'reproductive', 'endocrine', 'hormonal'
];

// Check if query is health-related using AI with chat history context
async function isHealthRelatedWithContext(query, chatHistory = []) {
  try {
    // Handle greetings and conversational starters - allow them through
    const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'how are you', 'thanks', 'thank you', 'bye', 'goodbye'];
    const lowerQuery = query.toLowerCase().trim();
    
    if (greetings.some(greeting => lowerQuery.includes(greeting)) && query.length < 50) {
      return true; // Allow greetings to pass through
    }

    // Build context from recent chat history
    let contextInfo = "";
    if (chatHistory && chatHistory.length > 0) {
      const recentChats = chatHistory.slice(-3); // Last 3 conversations for context
      const recentMessages = recentChats.map(chat => `User: ${chat.user_message}\nBot: ${chat.bot_response}`).join('\n');
      contextInfo = `\n\nRecent conversation context:\n${recentMessages}`;
    }

    const classificationPrompt = `You are a health chatbot classifier. Determine if this user message should be handled by a health assistant.

Respond with ONLY "YES" or "NO".

Say YES for:
- Health symptoms, concerns, or questions
- Mental health topics (stress, anxiety, mood)
- Wellness and lifestyle (sleep, diet, exercise)
- Student health issues (study stress, academic pressure)
- Medical questions or advice requests
- Greetings and polite conversation starters
- Follow-up health questions (like "what is the solution", "how do I fix this", "what should I do")
- Continuation of previous health discussions

Say NO for:
- Academic homework help (math, science, coding)
- Technology troubleshooting
- General knowledge questions unrelated to health
- Entertainment, sports, weather (unless health-related)
- Business or financial advice

Current user message: "${query}"${contextInfo}

Answer:`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: classificationPrompt
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.2,
      max_tokens: 5,
      top_p: 0.9
    });

    const response = completion.choices[0]?.message?.content?.trim().toUpperCase();
    return response === "YES";
    
  } catch (error) {
    console.error('Health classification error:', error);
    // More permissive fallback - allow greetings and basic health terms
    const lowerQuery = query.toLowerCase();
    const allowedTerms = ['hi', 'hello', 'hey', 'health', 'sick', 'pain', 'stress', 'tired', 'sleep', 'diet', 'feel', 'help', 'advice', 'solution', 'what', 'how', 'why'];
    return allowedTerms.some(term => lowerQuery.includes(term)) || query.length < 20;
  }
}

// Check if query is health-related using AI (legacy function for compatibility)
async function isHealthRelated(query) {
  return await isHealthRelatedWithContext(query, []);
}

// Generate AI response using Groq
async function generateHealthResponse(userMessage, chatHistory = []) {
  try {
    // Check if the query is health-related, considering chat history context
    if (!(await isHealthRelatedWithContext(userMessage, chatHistory))) {
      return {
        success: false,
        response: "Sorry, I can only help with student health issues. Please ask me about topics like headaches, stress, diet, sleep, mental health, or other health-related concerns."
      };
    }
    
    // Build comprehensive context from chat history for personalized responses
    let contextPrompt = "";
    if (chatHistory && chatHistory.length > 0) {
      const recentChats = chatHistory.slice(-10); // Last 10 conversations for better context
      const healthPatterns = analyzeHealthPatterns(recentChats);
      const personalizedInsights = generateDetailedUserProfile(recentChats);
      
      if (healthPatterns.length > 0 || personalizedInsights.length > 0) {
        let contextInfo = [];
        
        if (healthPatterns.length > 0) {
          contextInfo.push(`Recurring health concerns: ${healthPatterns.join(', ')}`);
        }
        
        if (personalizedInsights.length > 0) {
          contextInfo.push(`User profile: ${personalizedInsights.join('; ')}`);
        }
        
        // Include recent conversation context
        const recentContext = recentChats.slice(-3).map(chat => 
          `User: "${chat.user_message}" -> Bot: "${chat.bot_response.substring(0, 100)}..."`
        ).join('\n');
        
        contextPrompt = `\n\nPERSONALIZED CONTEXT:\n${contextInfo.join('\n')}\n\nRECENT CONVERSATIONS:\n${recentContext}\n\nPlease provide personalized advice considering this user's specific history, patterns, and previous discussions. Reference their past concerns when relevant and build upon previous advice given.`;
      }
    }
    
    // Create the system prompt
    const systemPrompt = `You are a helpful AI health assistant specifically designed for students. Your role is to:

1. Provide helpful, accurate, and supportive health information
2. Focus on common student health issues like stress, sleep, diet, mental health, and basic physical health concerns
3. Always recommend consulting healthcare professionals for serious symptoms
4. Provide practical, actionable advice that students can implement
5. Be empathetic and understanding of student life challenges
6. Never provide specific medical diagnoses or replace professional medical advice
7. Encourage healthy lifestyle habits and self-care practices

IMPORTANT: Only respond to health-related queries. If asked about non-health topics, politely redirect to health-related assistance.

Guidelines:
- Keep responses concise but informative (2-4 sentences)
- Use a friendly, supportive tone
- Include practical tips when appropriate
- Always emphasize seeking professional help for serious concerns
- Consider the student context (academic stress, campus life, etc.)${contextPrompt}`;
    
    // Make API call to Groq
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      model: "llama-3.1-8b-instant", // Using Llama 3.1 8B Instant model
      temperature: 0.7,
      max_tokens: 300,
      top_p: 0.9
    });
    
    const response = completion.choices[0]?.message?.content;
    
    if (!response) {
      throw new Error('No response generated');
    }
    
    return {
      success: true,
      response: response.trim()
    };
    
  } catch (error) {
    console.error('Groq API error:', error);
    
    // Handle specific error cases
    if (error.message.includes('API key')) {
      return {
        success: false,
        response: "I'm having trouble connecting to my AI service. Please make sure the API key is configured correctly."
      };
    }
    
    if (error.message.includes('rate limit')) {
      return {
        success: false,
        response: "I'm receiving too many requests right now. Please wait a moment and try again."
      };
    }
    
    return {
      success: false,
      response: "I'm having trouble processing your request right now. Please try again in a moment. If the problem persists, please contact support."
    };
  }
}

// Analyze chat history for health patterns
function analyzeHealthPatterns(chatHistory) {
  const patterns = [];
  const patternCounts = {};
  
  chatHistory.forEach(chat => {
    const message = chat.user_message.toLowerCase();
    
    // Count mentions of specific health issues
    healthKeywords.forEach(keyword => {
      if (message.includes(keyword)) {
        patternCounts[keyword] = (patternCounts[keyword] || 0) + 1;
      }
    });
  });
  
  // Return frequently mentioned health concerns
  Object.entries(patternCounts)
    .filter(([keyword, count]) => count >= 2) // Mentioned at least twice
    .sort(([,a], [,b]) => b - a) // Sort by frequency
    .slice(0, 3) // Top 3 patterns
    .forEach(([keyword]) => {
      patterns.push(keyword);
    });
  
  return patterns;
}

// Generate detailed user profile from chat history
function generateDetailedUserProfile(chatHistory) {
  const profile = [];
  const messageTexts = chatHistory.map(chat => chat.user_message.toLowerCase()).join(' ');
  
  // Analyze lifestyle patterns
  if (messageTexts.includes('sleep') || messageTexts.includes('tired') || messageTexts.includes('insomnia')) {
    const sleepIssues = [];
    if (messageTexts.includes('can\'t sleep') || messageTexts.includes('insomnia')) sleepIssues.push('insomnia');
    if (messageTexts.includes('tired') || messageTexts.includes('fatigue')) sleepIssues.push('fatigue');
    if (sleepIssues.length > 0) profile.push(`Sleep concerns: ${sleepIssues.join(', ')}`);
  }
  
  // Analyze stress patterns
  if (messageTexts.includes('stress') || messageTexts.includes('anxiety') || messageTexts.includes('overwhelmed')) {
    const stressTypes = [];
    if (messageTexts.includes('exam') || messageTexts.includes('test') || messageTexts.includes('study')) stressTypes.push('academic stress');
    if (messageTexts.includes('work') || messageTexts.includes('job')) stressTypes.push('work stress');
    if (messageTexts.includes('social') || messageTexts.includes('relationship')) stressTypes.push('social stress');
    if (stressTypes.length > 0) profile.push(`Stress sources: ${stressTypes.join(', ')}`);
    else profile.push('General stress/anxiety concerns');
  }
  
  // Analyze physical health patterns
  const physicalSymptoms = [];
  if (messageTexts.includes('headache') || messageTexts.includes('migraine')) physicalSymptoms.push('headaches');
  if (messageTexts.includes('back pain') || messageTexts.includes('neck pain')) physicalSymptoms.push('musculoskeletal pain');
  if (messageTexts.includes('stomach') || messageTexts.includes('digestive')) physicalSymptoms.push('digestive issues');
  if (physicalSymptoms.length > 0) profile.push(`Physical symptoms: ${physicalSymptoms.join(', ')}`);
  
  // Analyze lifestyle factors
  const lifestyleFactors = [];
  if (messageTexts.includes('diet') || messageTexts.includes('eating') || messageTexts.includes('nutrition')) lifestyleFactors.push('nutrition concerns');
  if (messageTexts.includes('exercise') || messageTexts.includes('fitness') || messageTexts.includes('workout')) lifestyleFactors.push('fitness/exercise');
  if (messageTexts.includes('student') || messageTexts.includes('college') || messageTexts.includes('university')) lifestyleFactors.push('student lifestyle');
  if (lifestyleFactors.length > 0) profile.push(`Lifestyle factors: ${lifestyleFactors.join(', ')}`);
  
  // Analyze frequency and engagement
  if (chatHistory.length >= 5) {
    profile.push(`Active user with ${chatHistory.length} previous conversations`);
  }
  
  return profile;
}

// Generate personalized health suggestions based on chat history
function generatePersonalizedSuggestions(chatHistory) {
  const patterns = analyzeHealthPatterns(chatHistory);
  const suggestions = [];
  
  patterns.forEach(pattern => {
    switch (pattern) {
      case 'stress':
      case 'anxiety':
        suggestions.push('Consider trying relaxation techniques like deep breathing or meditation');
        break;
      case 'headache':
      case 'migraine':
        suggestions.push('Stay hydrated and maintain regular sleep schedule to prevent headaches');
        break;
      case 'sleep':
      case 'insomnia':
        suggestions.push('Establish a consistent bedtime routine and limit screen time before bed');
        break;
      case 'tired':
      case 'fatigue':
        suggestions.push('Ensure adequate sleep and consider your nutrition and hydration levels');
        break;
      case 'study':
      case 'concentration':
        suggestions.push('Take regular breaks and try the Pomodoro technique for better focus');
        break;
    }
  });
  
  return suggestions;
}

module.exports = {
  generateHealthResponse,
  isHealthRelated,
  analyzeHealthPatterns,
  generatePersonalizedSuggestions,
  generateDetailedUserProfile
};
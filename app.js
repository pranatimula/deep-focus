import { locales } from './locales.js';
import { initialReviews } from './reviews.js';
import { testConnection, simplifyConcept, generateQuiz, decodeVocab, chatWithMitra } from './ai-service.js';

// Application State
let currentLang = localStorage.getItem('medha_lang') || 'en';
let activeTab = 'dashboard'; // Default active tab is now Dashboard
let chatHistory = [];
let activeQuizData = null;
let selectedAnswers = [];

// Study Goals Checklist Initial State
let studyGoals = [];
const savedGoals = localStorage.getItem('deep_focus_goals');
if (savedGoals) {
  try {
    studyGoals = JSON.parse(savedGoals);
  } catch (e) {
    console.error("Error loading goals", e);
  }
} else {
  // Default fallback goals
  studyGoals = [
    { id: 1, text: "Understand photosynthesis mechanism", completed: false },
    { id: 2, text: "Solve quadratic equation formulas", completed: false },
    { id: 3, text: "Practice Newton's third law derivations", completed: false }
  ];
}

// Statistics State
let studyStats = {
  sessions: 0,
  time: 0,
  quizzes: 0
};
const savedStats = localStorage.getItem('deep_focus_stats');
if (savedStats) {
  try {
    studyStats = { ...studyStats, ...JSON.parse(savedStats) };
  } catch (e) {
    console.error("Error loading stats", e);
  }
}

// Reviews State (starts with initial 25 and loads additions from storage)
let userReviews = [...initialReviews];
const savedReviews = localStorage.getItem('deep_focus_reviews');
if (savedReviews) {
  try {
    userReviews = JSON.parse(savedReviews);
  } catch (e) {
    console.error("Error loading reviews", e);
  }
}

// Timer State
let timerInterval = null;
let timerMinutes = 25;
let timerSeconds = 0;
let isTimerRunning = false;
let timerMode = 'focus'; // 'focus' or 'break'

// Default AI Config
let aiConfig = {
  provider: 'demo',
  model: 'simulated-medha',
  endpoint: 'http://localhost:11434',
  apiKey: ''
};

// Load saved config
const savedConfig = localStorage.getItem('medha_ai_config');
if (savedConfig) {
  try {
    aiConfig = { ...aiConfig, ...JSON.parse(savedConfig) };
  } catch (e) {
    console.error("Could not parse saved AI config", e);
  }
}

// Simple Markdown Parser for premium rendering
function parseMarkdown(text) {
  if (!text) return "";
  
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

// Clean and Parse LLM JSON Output for Quizzes
function extractJSON(str) {
  const startIdx = str.indexOf('[');
  const endIdx = str.lastIndexOf(']');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const jsonStr = str.substring(startIdx, endIdx + 1);
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse extracted JSON substring:", jsonStr, e);
    }
  }
  
  try {
    return JSON.parse(str);
  } catch (e) {
    throw new Error("The AI model returned text instead of a structured Quiz list. Please try generating again.");
  }
}

// Initialize Application UI
document.addEventListener('DOMContentLoaded', () => {
  // Sync form inputs with loaded AI configuration
  initSettingsForm();
  
  // Set initial language
  setLanguage(currentLang);
  
  // Setup Event Listeners
  setupEventListeners();
  
  // Check AI connection in background
  checkInitialAIStatus();

  // Initial dashboard rendering
  renderGoals();
  updateStatsUI();
  
  // Initial reviews rendering
  renderReviews();
});

// Sync config variables to the form elements
function initSettingsForm() {
  document.getElementById('settings-provider').value = aiConfig.provider;
  document.getElementById('settings-model').value = aiConfig.model;
  document.getElementById('settings-endpoint').value = aiConfig.endpoint;
  document.getElementById('settings-api-key').value = aiConfig.apiKey;
  
  toggleApiKeyField(aiConfig.provider);
}

// Toggle Visibility of API Key depending on provider selection
function toggleApiKeyField(provider) {
  const apiKeyGroup = document.getElementById('group-api-key');
  const endpointGroup = document.getElementById('group-ollama-endpoint');
  
  if (provider === 'ollama') {
    apiKeyGroup.classList.add('hidden');
    endpointGroup.classList.remove('hidden');
  } else if (provider === 'demo') {
    apiKeyGroup.classList.add('hidden');
    endpointGroup.classList.add('hidden');
  } else {
    apiKeyGroup.classList.remove('hidden');
    endpointGroup.classList.add('hidden');
  }
}

// Set Active Language
function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('medha_lang', lang);
  document.documentElement.lang = lang;
  
  // Update translation elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (locales[lang] && locales[lang][key]) {
      const icon = el.querySelector('i');
      if (icon) {
        el.innerHTML = '';
        el.appendChild(icon);
        el.appendChild(document.createTextNode(' ' + locales[lang][key]));
      } else {
        el.textContent = locales[lang][key];
      }
    }
  });
  
  // Update placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (locales[lang] && locales[lang][key]) {
      el.setAttribute('placeholder', locales[lang][key]);
    }
  });

  // Highlight active lang button
  document.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.getAttribute('data-lang') === lang) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Refresh Dynamic Elements if necessary
  updateChatWelcomeMessage();
  renderGoals();
  renderReviews();
}

// Switch Sidebar Tabs
function switchTab(tabId) {
  activeTab = tabId;
  
  // Update Sidebar Active state
  document.querySelectorAll('.menu-item').forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  // Update Active Panel
  document.querySelectorAll('.tab-panel').forEach(panel => {
    if (panel.id === `tab-${tabId}`) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });
}

// Loading Spinner Helpers
function showLoading(msgKey) {
  const overlay = document.getElementById('loading-overlay');
  const msgEl = document.getElementById('loading-msg');
  
  const label = locales[currentLang][msgKey] || msgKey || "Loading...";
  msgEl.textContent = label;
  overlay.classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.add('hidden');
}

// Event Listeners Setup
function setupEventListeners() {
  // Sidebar tab click
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(item.getAttribute('data-tab'));
    });
  });

  // Top header status pill click (shortcuts to Settings)
  document.getElementById('ai-status').addEventListener('click', () => {
    switchTab('settings');
  });

  // Language selectors click
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setLanguage(btn.getAttribute('data-lang'));
    });
  });

  // Settings: Toggle Password Visibility
  document.getElementById('btn-toggle-key').addEventListener('click', () => {
    const keyInput = document.getElementById('settings-api-key');
    const eyeIcon = document.querySelector('#btn-toggle-key i');
    if (keyInput.type === 'password') {
      keyInput.type = 'text';
      eyeIcon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
      keyInput.type = 'password';
      eyeIcon.classList.replace('fa-eye-slash', 'fa-eye');
    }
  });

  // Settings: Provider Switch
  document.getElementById('settings-provider').addEventListener('change', (e) => {
    toggleApiKeyField(e.target.value);
    
    // Suggest default model based on provider
    const modelInput = document.getElementById('settings-model');
    if (e.target.value === 'demo') {
      modelInput.value = 'simulated-medha';
    } else if (e.target.value === 'ollama') {
      modelInput.value = 'gemma2';
    } else if (e.target.value === 'gemini') {
      modelInput.value = 'gemini-1.5-flash';
    } else if (e.target.value === 'openai') {
      modelInput.value = 'gpt-4o-mini';
    }
  });

  // Settings: Save Settings
  document.getElementById('btn-save-settings').addEventListener('click', saveAIConfiguration);

  // Settings: Test Connection
  document.getElementById('btn-test-connection').addEventListener('click', testAIConnection);

  // Simplifier: Trigger
  document.getElementById('btn-simplify').addEventListener('click', handleConceptSimplify);

  // Quiz: Generate
  document.getElementById('btn-generate-quiz').addEventListener('click', handleQuizGeneration);

  // Quiz: Submit answers
  document.getElementById('btn-submit-quiz').addEventListener('click', handleQuizSubmission);

  // Vocab: Decode
  document.getElementById('btn-decode').addEventListener('click', handleVocabDecoding);

  // Chat: Send on Click
  document.getElementById('btn-send-chat').addEventListener('click', handleChatSubmit);

  // Chat: Send on Enter keypress
  document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleChatSubmit();
    }
  });

  // Copy Buttons handler
  document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        navigator.clipboard.writeText(targetEl.innerText || targetEl.textContent)
          .then(() => {
            const btnText = btn.querySelector('.btn-text');
            const originalText = btnText.textContent;
            btnText.textContent = locales[currentLang].copiedMsg;
            setTimeout(() => {
              btnText.textContent = originalText;
            }, 2000);
          })
          .catch(err => {
            console.error("Could not copy text to clipboard:", err);
          });
      }
    });
  });

  // TIMER BUTTONS
  document.getElementById('btn-timer-start').addEventListener('click', startFocusTimer);
  document.getElementById('btn-timer-pause').addEventListener('click', pauseFocusTimer);
  document.getElementById('btn-timer-reset').addEventListener('click', resetFocusTimer);

  // GOALS BUTTONS
  document.getElementById('btn-add-goal').addEventListener('click', addStudyGoal);
  document.getElementById('goal-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addStudyGoal();
    }
  });

  // REVIEWS FORM & FILTERS
  document.getElementById('btn-submit-review').addEventListener('click', submitUserReview);
  document.getElementById('filter-lang').addEventListener('change', renderReviews);
  document.getElementById('filter-rating').addEventListener('change', renderReviews);
}

// Log line into diagnostics console
function writeConsole(text, type = 'system') {
  const consoleEl = document.getElementById('diagnostics-console');
  if (consoleEl) {
    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    line.innerHTML = `&gt; ${text}`;
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }
}

// Test Connection Action
async function testAIConnection() {
  const provider = document.getElementById('settings-provider').value;
  const model = document.getElementById('settings-model').value.trim();
  const endpoint = document.getElementById('settings-endpoint').value.trim();
  const apiKey = document.getElementById('settings-api-key').value.trim();

  if (!model) {
    alert("Please specify a model name first.");
    return;
  }

  const testConfig = { provider, model, endpoint, apiKey };
  
  writeConsole(`Testing connection to ${provider.toUpperCase()} (${model})...`, 'input');
  showLoading('testingConn');

  try {
    const response = await testConnection(testConfig);
    hideLoading();
    writeConsole(`${locales[currentLang].testSuccess} "${response}"`, 'success');
    updateAIStatusPill(true);
  } catch (err) {
    hideLoading();
    writeConsole(`${locales[currentLang].testFail} Details: ${err.message}`, 'error');
    updateAIStatusPill(false);
  }
}

// Save Configuration Action
function saveAIConfiguration() {
  const provider = document.getElementById('settings-provider').value;
  const model = document.getElementById('settings-model').value.trim();
  const endpoint = document.getElementById('settings-endpoint').value.trim();
  const apiKey = document.getElementById('settings-api-key').value.trim();

  aiConfig = { provider, model, endpoint, apiKey };
  localStorage.setItem('medha_ai_config', JSON.stringify(aiConfig));
  
  writeConsole("Configuration saved successfully to local storage.", 'system');
  alert("Settings saved!");
  
  checkInitialAIStatus();
}

// Initial status check
async function checkInitialAIStatus() {
  try {
    await testConnection(aiConfig);
    updateAIStatusPill(true);
  } catch (e) {
    updateAIStatusPill(false);
  }
}

function updateAIStatusPill(online) {
  const statusEl = document.getElementById('ai-status');
  const statusText = document.getElementById('ai-status-text');
  
  if (online) {
    statusEl.className = "ai-status-pill online";
    statusText.textContent = locales[currentLang].aiStatusConnected;
  } else {
    statusEl.className = "ai-status-pill offline";
    statusText.textContent = locales[currentLang].aiStatusDisconnected;
  }
}

// -------------------------------------------------------------
// PROGRESS DASHBOARD LOGIC (TIMER, GOALS & STATS)
// -------------------------------------------------------------

// 1. Pomodoro Timer
function startFocusTimer() {
  if (isTimerRunning) return;
  
  isTimerRunning = true;
  document.getElementById('btn-timer-start').classList.add('hidden');
  document.getElementById('btn-timer-pause').classList.remove('hidden');
  
  timerInterval = setInterval(() => {
    if (timerSeconds === 0) {
      if (timerMinutes === 0) {
        // Timer Finished!
        playTimerEndAlert();
        handleTimerEnd();
        return;
      }
      timerMinutes--;
      timerSeconds = 59;
    } else {
      timerSeconds--;
    }
    updateTimerDisplay();
  }, 1000);
}

function playTimerEndAlert() {
  // Trigger alert box or basic beep sound
  alert(timerMode === 'focus' ? locales[currentLang].timerStateBreak : locales[currentLang].timerStateFocus);
}

function pauseFocusTimer() {
  if (!isTimerRunning) return;
  isTimerRunning = false;
  clearInterval(timerInterval);
  document.getElementById('btn-timer-start').classList.remove('hidden');
  document.getElementById('btn-timer-pause').classList.add('hidden');
}

function resetFocusTimer() {
  pauseFocusTimer();
  timerMinutes = timerMode === 'focus' ? 25 : 5;
  timerSeconds = 0;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  document.getElementById('timer-minutes').textContent = String(timerMinutes).padStart(2, '0');
  document.getElementById('timer-seconds').textContent = String(timerSeconds).padStart(2, '0');
}

function handleTimerEnd() {
  clearInterval(timerInterval);
  isTimerRunning = false;
  document.getElementById('btn-timer-start').classList.remove('hidden');
  document.getElementById('btn-timer-pause').classList.add('hidden');
  
  if (timerMode === 'focus') {
    // Increment Stats
    studyStats.sessions++;
    studyStats.time += 25;
    
    // Switch to break mode
    timerMode = 'break';
    timerMinutes = 5;
    document.getElementById('timer-state-text').textContent = locales[currentLang].timerStateBreak;
  } else {
    // Switch back to focus mode
    timerMode = 'focus';
    timerMinutes = 25;
    document.getElementById('timer-state-text').textContent = locales[currentLang].timerStateFocus;
  }
  
  timerSeconds = 0;
  updateTimerDisplay();
  saveStats();
  updateStatsUI();
}

// 2. Stats and progress bar updates
function updateStatsUI() {
  document.getElementById('stat-sessions').textContent = studyStats.sessions;
  document.getElementById('stat-time').textContent = studyStats.time;
  document.getElementById('stat-quizzes').textContent = studyStats.quizzes;

  const totalGoals = studyGoals.length;
  const completedGoals = studyGoals.filter(g => g.completed).length;
  document.getElementById('stat-tasks').textContent = `${completedGoals} / ${totalGoals}`;

  // Update progress bar fill
  const progressPercent = totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0;
  document.getElementById('study-progress-bar').style.width = `${progressPercent}%`;
}

function saveStats() {
  localStorage.setItem('deep_focus_stats', JSON.stringify(studyStats));
}

// 3. Goal Checklist logic
function renderGoals() {
  const container = document.getElementById('goals-list-container');
  if (!container) return;
  
  container.innerHTML = "";

  if (studyGoals.length === 0) {
    container.innerHTML = `<li style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 1rem;">No tasks added yet.</li>`;
    return;
  }

  studyGoals.forEach(goal => {
    const li = document.createElement('li');
    li.className = `goal-item ${goal.completed ? 'completed' : ''}`;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'goal-checkbox';
    checkbox.checked = goal.completed;
    checkbox.addEventListener('change', () => toggleStudyGoal(goal.id));
    
    const textSpan = document.createElement('span');
    textSpan.className = 'goal-text';
    textSpan.textContent = goal.text;
    
    // Clicking text also checks box
    textSpan.addEventListener('click', () => toggleStudyGoal(goal.id));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete-goal';
    deleteBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteStudyGoal(goal.id);
    });

    li.appendChild(checkbox);
    li.appendChild(textSpan);
    li.appendChild(deleteBtn);
    container.appendChild(li);
  });
}

function addStudyGoal() {
  const input = document.getElementById('goal-input');
  const text = input.value.trim();
  if (!text) return;

  const newGoal = {
    id: Date.now(),
    text: text,
    completed: false
  };

  studyGoals.push(newGoal);
  localStorage.setItem('deep_focus_goals', JSON.stringify(studyGoals));
  input.value = "";
  
  renderGoals();
  updateStatsUI();
}

function toggleStudyGoal(id) {
  studyGoals = studyGoals.map(goal => {
    if (goal.id === id) {
      return { ...goal, completed: !goal.completed };
    }
    return goal;
  });
  localStorage.setItem('deep_focus_goals', JSON.stringify(studyGoals));
  
  renderGoals();
  updateStatsUI();
}

function deleteStudyGoal(id) {
  studyGoals = studyGoals.filter(goal => goal.id !== id);
  localStorage.setItem('deep_focus_goals', JSON.stringify(studyGoals));
  
  renderGoals();
  updateStatsUI();
}

// -------------------------------------------------------------
// USER REVIEWS SECTION LOGIC
// -------------------------------------------------------------

function renderReviews() {
  const listEl = document.getElementById('reviews-feed-list');
  const filterLang = document.getElementById('filter-lang').value;
  const filterRating = document.getElementById('filter-rating').value;

  if (!listEl) return;
  
  listEl.innerHTML = "";

  // Apply filters
  let filtered = userReviews;
  if (filterLang !== 'all') {
    filtered = filtered.filter(r => r.lang === filterLang);
  }
  if (filterRating !== 'all') {
    filtered = filtered.filter(r => r.rating === parseInt(filterRating));
  }

  // Render cards
  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="placeholder-msg"><i class="fa-regular fa-comment-dots"></i><p>No reviews match selected filters.</p></div>`;
    return;
  }

  filtered.forEach(rev => {
    const card = document.createElement('div');
    card.className = 'review-card';
    
    // Get Initials for Avatar
    const initials = rev.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    
    // Generate Stars HTML
    let starsHtml = "";
    for (let i = 1; i <= 5; i++) {
      if (i <= rev.rating) {
        starsHtml += '<i class="fa-solid fa-star"></i> ';
      } else {
        starsHtml += '<i class="fa-regular fa-star"></i> ';
      }
    }

    const languageBadgeText = rev.lang === 'hi' ? 'Hindi' : rev.lang === 'ta' ? 'Tamil' : 'English';

    card.innerHTML = `
      <div class="review-card-header">
        <div class="review-user-info">
          <div class="review-avatar">${initials}</div>
          <div class="review-meta">
            <span class="review-name">${rev.name}</span>
            <span class="review-role">${rev.role}</span>
          </div>
        </div>
        <div class="review-rating-badge">
          <div class="review-stars">${starsHtml}</div>
          <span class="review-lang-badge">${languageBadgeText}</span>
        </div>
      </div>
      <p class="review-comment">"${rev.comment}"</p>
    `;
    
    listEl.appendChild(card);
  });

  // Update counter summary
  document.getElementById('reviews-count-text').textContent = userReviews.length;
}

function submitUserReview() {
  const nameInput = document.getElementById('rev-name');
  const roleInput = document.getElementById('rev-role');
  const ratingSelect = document.getElementById('rev-rating');
  const langSelect = document.getElementById('rev-lang');
  const commentInput = document.getElementById('rev-comment');

  const name = nameInput.value.trim();
  const role = roleInput.value.trim();
  const rating = parseInt(ratingSelect.value);
  const lang = langSelect.value;
  const comment = commentInput.value.trim();

  if (!name || !role || !comment) {
    alert("Please fill in all fields to submit a review.");
    return;
  }

  const newReview = {
    id: Date.now(),
    name,
    role,
    rating,
    lang,
    comment
  };

  // Prepend to list
  userReviews.unshift(newReview);
  localStorage.setItem('deep_focus_reviews', JSON.stringify(userReviews));

  // Reset Form
  nameInput.value = "";
  roleInput.value = "";
  ratingSelect.value = "5";
  commentInput.value = "";

  alert("Thank you! Your review has been published.");
  renderReviews();
}

// -------------------------------------------------------------
// CORE STUDY AI FEATURE HANDLERS
// -------------------------------------------------------------

// 1. Concept Simplifier
async function handleConceptSimplify() {
  const inputEl = document.getElementById('simplifier-input');
  const resultEl = document.getElementById('simplifier-result');
  const actionsEl = document.getElementById('simplifier-actions');
  const text = inputEl.value.trim();
  
  if (!text) {
    alert("Please paste study material first.");
    return;
  }

  showLoading('loadingText');
  resultEl.innerHTML = "";
  actionsEl.classList.add('hidden');

  try {
    const response = await simplifyConcept(aiConfig, text, currentLang);
    hideLoading();
    resultEl.innerHTML = parseMarkdown(response);
    actionsEl.classList.remove('hidden');
  } catch (err) {
    hideLoading();
    resultEl.innerHTML = `<div class="console-line error" style="padding: 1rem;">Error: ${err.message}</div>`;
  }
}

// 2. Smart Quiz Generator
async function handleQuizGeneration() {
  const topicInput = document.getElementById('quiz-topic');
  const difficultyInput = document.getElementById('quiz-difficulty');
  const boardEl = document.getElementById('quiz-board');
  const actionsEl = document.getElementById('quiz-actions');
  
  const topic = topicInput.value.trim();
  const difficulty = difficultyInput.value;
  
  if (!topic) {
    alert("Please enter a quiz topic first.");
    return;
  }

  showLoading('loadingText');
  boardEl.innerHTML = "";
  actionsEl.classList.add('hidden');
  activeQuizData = null;
  selectedAnswers = [];

  try {
    const response = await generateQuiz(aiConfig, topic, difficulty, currentLang);
    hideLoading();
    
    const quizList = extractJSON(response);
    if (Array.isArray(quizList) && quizList.length > 0) {
      activeQuizData = quizList;
      selectedAnswers = new Array(quizList.length).fill(null);
      renderQuizBoard();
      actionsEl.classList.remove('hidden');
    } else {
      throw new Error("Invalid quiz formatting received from AI. Try again.");
    }
  } catch (err) {
    hideLoading();
    boardEl.innerHTML = `<div class="console-line error" style="padding: 1rem;">Error: ${err.message}</div>`;
  }
}

function renderQuizBoard() {
  const boardEl = document.getElementById('quiz-board');
  boardEl.innerHTML = "";

  activeQuizData.forEach((q, qIndex) => {
    const qBlock = document.createElement('div');
    qBlock.className = 'quiz-question-block';
    
    const qText = document.createElement('div');
    qText.className = 'quiz-q-text';
    qText.textContent = `${qIndex + 1}. ${q.question}`;
    qBlock.appendChild(qText);
    
    const optionsList = document.createElement('div');
    optionsList.className = 'quiz-options-list';
    
    q.options.forEach((opt, oIndex) => {
      const optItem = document.createElement('div');
      optItem.className = 'quiz-option-item';
      optItem.setAttribute('data-q', qIndex);
      optItem.setAttribute('data-o', oIndex);
      
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `q-${qIndex}`;
      radio.className = 'quiz-radio';
      radio.checked = selectedAnswers[qIndex] === oIndex;
      
      const textSpan = document.createElement('span');
      textSpan.className = 'quiz-option-text';
      textSpan.textContent = opt;
      
      optItem.appendChild(radio);
      optItem.appendChild(textSpan);
      
      optItem.addEventListener('click', () => {
        const submitBtnVisible = !document.getElementById('quiz-actions').classList.contains('hidden');
        if (submitBtnVisible) {
          selectedAnswers[qIndex] = oIndex;
          
          optionsList.querySelectorAll('.quiz-option-item').forEach(el => {
            el.classList.remove('selected');
            el.querySelector('input').checked = false;
          });
          
          optItem.classList.add('selected');
          radio.checked = true;
        }
      });
      
      optionsList.appendChild(optItem);
    });
    
    qBlock.appendChild(optionsList);
    boardEl.appendChild(qBlock);
  });
}

function handleQuizSubmission() {
  const unansweredCount = selectedAnswers.filter(ans => ans === null).length;
  if (unansweredCount > 0) {
    alert("Please answer all questions before submitting.");
    return;
  }
  
  document.getElementById('quiz-actions').classList.add('hidden');
  
  let score = 0;
  
  activeQuizData.forEach((q, qIndex) => {
    const selectedOpt = selectedAnswers[qIndex];
    const correctOpt = q.correctIndex;
    const qBlock = document.querySelectorAll('.quiz-question-block')[qIndex];
    const optionsList = qBlock.querySelector('.quiz-options-list');
    
    optionsList.querySelectorAll('.quiz-option-item').forEach((item, oIndex) => {
      item.classList.remove('selected');
      if (oIndex === correctOpt) {
        item.classList.add('correct');
      } else if (oIndex === selectedOpt) {
        item.classList.add('incorrect');
      }
    });

    if (selectedOpt === correctOpt) {
      score++;
    }

    const expBox = document.createElement('div');
    expBox.className = 'quiz-explanation-box';
    expBox.innerHTML = `<strong>${locales[currentLang].quizExplanationHeader}:</strong> ${q.explanation}`;
    qBlock.appendChild(expBox);
  });

  const boardEl = document.getElementById('quiz-board');
  const scoreCard = document.createElement('div');
  scoreCard.className = 'quiz-score-display';
  
  scoreCard.innerHTML = `
    <div class="quiz-score-star">
      <i class="fa-solid fa-trophy"></i>
    </div>
    <div class="quiz-score-details">
      <h4>${locales[currentLang].quizScoreLabel} ${score} / ${activeQuizData.length}</h4>
      <p>${score === activeQuizData.length ? "Outstanding job! Pure genius." : "Good attempt! Review the solutions below to learn."}</p>
    </div>
  `;
  
  boardEl.insertBefore(scoreCard, boardEl.firstChild);
  boardEl.scrollTop = 0;

  // Increment Quiz Eval Stats
  studyStats.quizzes++;
  saveStats();
  updateStatsUI();
}

// 3. Vocabulary & Formula Decoder
async function handleVocabDecoding() {
  const inputEl = document.getElementById('vocab-term');
  const resultEl = document.getElementById('vocab-result');
  const actionsEl = document.getElementById('vocab-actions');
  const term = inputEl.value.trim();

  if (!term) {
    alert("Please enter a term or formula to decode.");
    return;
  }

  showLoading('loadingText');
  resultEl.innerHTML = "";
  actionsEl.classList.add('hidden');

  try {
    const response = await decodeVocab(aiConfig, term, currentLang);
    hideLoading();
    resultEl.innerHTML = parseMarkdown(response);
    actionsEl.classList.remove('hidden');
  } catch (err) {
    hideLoading();
    resultEl.innerHTML = `<div class="console-line error" style="padding: 1rem;">Error: ${err.message}</div>`;
  }
}

// 4. Doubt Solver Chat
function updateChatWelcomeMessage() {
  const messagesBox = document.getElementById('chat-messages');
  if (chatHistory.length === 0 && messagesBox) {
    const welcomeBubble = messagesBox.querySelector('.message.assistant p');
    if (welcomeBubble) {
      welcomeBubble.textContent = locales[currentLang].chatWelcome;
    }
  }
}

async function handleChatSubmit() {
  const inputEl = document.getElementById('chat-input');
  const messagesBox = document.getElementById('chat-messages');
  const message = inputEl.value.trim();
  
  if (!message) return;
  
  appendChatBubble('user', message);
  inputEl.value = "";
  
  chatHistory.push({ role: 'user', content: message });
  
  const typingIndicator = appendChatBubble('assistant', '<div class="glow-spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>');

  try {
    const response = await chatWithMitra(aiConfig, chatHistory.slice(0, -1), message, currentLang);
    typingIndicator.remove();
    appendChatBubble('assistant', parseMarkdown(response));
    chatHistory.push({ role: 'assistant', content: response });
  } catch (err) {
    typingIndicator.remove();
    appendChatBubble('assistant', `<div class="console-line error">Error: ${err.message}</div>`);
  }
}

function appendChatBubble(role, content) {
  const messagesBox = document.getElementById('chat-messages');
  
  const msgEl = document.createElement('div');
  msgEl.className = `message ${role}`;
  
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.innerHTML = role === 'assistant' ? '<i class="fa-solid fa-robot"></i>' : '<i class="fa-solid fa-user-graduate"></i>';
  
  const body = document.createElement('div');
  body.className = 'message-content';
  body.innerHTML = content;
  
  msgEl.appendChild(avatar);
  msgEl.appendChild(body);
  messagesBox.appendChild(msgEl);
  
  messagesBox.scrollTop = messagesBox.scrollHeight;
  return msgEl;
}

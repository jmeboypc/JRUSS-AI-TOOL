import React, { useState, useEffect } from 'react';
import { 
  Upload, FileText, Settings, Key, Sparkles, Copy, Check, Download, 
  Trash2, Eye, FileCode, AlertCircle, 
  BookOpen, Plus, Award, RefreshCw, FileSpreadsheet, EyeOff, LayoutTemplate,
  Zap, Info, ExternalLink, Lightbulb, Search, CheckCircle2, HelpCircle,
  Clock, GraduationCap, Layers, FileCheck, ArrowRightCircle,
  ClipboardList, CloudDownload
} from 'lucide-react';
import { parseDocument } from './utils/parsers';
import { generateContent, fetchAvailableGeminiModels, fetchAvailableOpenAIModels } from './utils/ai';
import SpotlightCard from './components/SpotlightCard';
import DecryptedText from './components/DecryptedText';
import StarBorder from './components/StarBorder';
import DotField from './components/DotField';
import { marked } from 'marked';
import { exportMarkdownToDocx } from './utils/docxExport';

// Preset Output Templates tailored for Secondary School Teachers
const TEMPLATES = [
  {
    id: 'lesson_plan',
    name: 'Detailed Lesson Plan',
    icon: BookOpen,
    description: 'Structure a complete lesson with learning objectives, timings, starter, main activity, differentiation, and assessments.',
    systemPrompt: `You are an expert secondary school teacher and curriculum advisor. 
Your task is to generate a comprehensive, highly structured lesson plan based on the teacher's input materials or prompt.
Format the output in clean Markdown. Start with a lesson overview, followed by:
1. Learning Objectives (using Bloom's Taxonomy: Know, Understand, Apply)
2. Materials Required
3. Detailed Lesson Outline Table (containing columns: Time, Section, Teacher Activity, Student Activity, Assessment/Check for Understanding)
4. Differentiated Activities (Support/Scaffolding for SEN/ESL, and Stretch/Challenge for High Achievers)
5. Plenary & Exit Ticket assessment details.
Maintain a professional, highly organized, and inspiring academic tone.`,
    userPrompt: (content, custom, isPromptOnly = false) => {
      if (isPromptOnly) {
        return `Generate a comprehensive, highly structured lesson plan for the following topic and specifications:

[LESSON TOPIC / CORE FOCUS]
${content}

[ADDITIONAL SPECIFICATIONS & INSTRUCTIONS]
${custom || 'None provided. Build a standard comprehensive 60-minute lesson.'}`;
      }
      return `Analyze the following course material and create a structured lesson plan.

--- SOURCE MATERIAL START ---
${content}
--- SOURCE MATERIAL END ---

Additional custom requirements or context: ${custom || 'None provided.'}`;
    }
  },
  {
    id: 'scheme_of_work',
    name: 'Scheme of Work (SOW)',
    icon: LayoutTemplate,
    description: 'Map out a multi-lesson learning journey aligning topics, activities, resources, and assessments.',
    systemPrompt: `You are a Senior Curriculum Designer.
Your task is to generate a beautiful, comprehensive Scheme of Work (SOW) based on the input materials or unit topic.
Format the output in clean Markdown. Include:
1. Unit Overview & Essential Questions
2. Prior Learning Requirements
3. SOW Overview Table (containing columns: Lesson Num, Topic/Focus, Core Learning Objectives, Key Activities, Assessment Method, Resources Needed)
4. Cross-Curricular links & Core Skills (e.g. literacy, numeracy).
Ensure the sequence makes logical pedagogical sense and scaffolds learning effectively.`,
    userPrompt: (content, custom, isPromptOnly = false) => {
      if (isPromptOnly) {
        return `Generate a multi-lesson Scheme of Work (SOW) table and unit overview for the following topic:

[UNIT TOPIC & SYLLABUS FOCUS]
${content}

[ADDITIONAL SPECIFICATIONS & TIMINGS]
${custom || 'None provided. Structure as a coherent 4-6 lesson learning sequence.'}`;
      }
      return `Using this material, generate a multi-lesson Scheme of Work (SOW) table and overview.

--- SOURCE MATERIAL START ---
${content}
--- SOURCE MATERIAL END ---

Additional custom requirements or context: ${custom || 'None provided.'}`;
    }
  },
  {
    id: 'quiz_generator',
    name: 'Assessment & Quiz Creator',
    icon: Award,
    description: 'Design multiple choice, short answer, and challenge questions with a full teacher grading rubric.',
    systemPrompt: `You are a Subject Assessment Lead.
Generate a structured student assessment based on the text or topic provided.
Format the output in clean Markdown. Include:
1. Assessment Summary (Total Marks, Suggested Time)
2. Section A: 5-10 Multiple Choice Questions (with answers marked at the very bottom in a "Teacher Grading Key" section)
3. Section B: 3-5 Short Answer Questions (with suggested points criteria/marking rubric)
4. Section C: 1 Stretch & Challenge extended response prompt with a model answer.
Make sure the questions evaluate understanding, not just rote recall.`,
    userPrompt: (content, custom, isPromptOnly = false) => {
      if (isPromptOnly) {
        return `Create a comprehensive quiz and assessment worksheet with an answer key for this topic:

[ASSESSMENT TOPIC & SKILLS]
${content}

[CUSTOM REQUIREMENTS / GRADE CRITERIA]
${custom || 'Standard mark allocation with varied cognitive difficulty.'}`;
      }
      return `Create a comprehensive quiz and assessment worksheet with an answer key based on this material.

--- SOURCE MATERIAL START ---
${content}
--- SOURCE MATERIAL END ---

Additional custom requirements or context: ${custom || 'None provided.'}`;
    }
  },
  {
    id: 'vocab_flashcards',
    name: 'Key Vocabulary & Glossary',
    icon: FileSpreadsheet,
    description: 'Extract vital technical terms, definitions, and model sentences into a reference table.',
    systemPrompt: `You are a Literacy & Language Specialist in education.
Extract key vocabulary and technical terminology from the resource materials or topic.
Format the output in clean Markdown. Create a structured table containing:
- Term
- Definition
- Contextual Example Sentence (relevant to the subject)
- Student Challenge (a quick question or task using the word)
Add a summary list of key spelling rules or root words if applicable.`,
    userPrompt: (content, custom, isPromptOnly = false) => {
      if (isPromptOnly) {
        return `Identify and compile an essential key vocabulary table for this topic:

[SUBJECT TOPIC & DOMAIN]
${content}

[ADDITIONAL VOCABULARY FOCUS]
${custom || 'Extract the top 10-15 Tier 2 and Tier 3 vocabulary terms with definitions and example sentences.'}`;
      }
      return `Identify and compile a key vocabulary table from this resource.

--- SOURCE MATERIAL START ---
${content}
--- SOURCE MATERIAL END ---

Additional custom requirements or context: ${custom || 'None provided.'}`;
    }
  },
  {
    id: 'differentiation',
    name: 'Differentiated Resources',
    icon: Award,
    description: 'Design a core student worksheet accompanied by specialized Support and Challenge variations.',
    systemPrompt: `You are an expert Differentiation Specialist.
Your task is to generate student-facing resource text based on the source material or topic.
Format the output in clean Markdown. Provide three distinct versions of the student resource:
1. Core Handout (standard grade level text with 3 comprehension questions)
2. Support Version (simplified language, shorter sentences, bolded key vocabulary, guided prompts, and scaffolded fill-in-the-blank questions)
3. Challenge Version (advanced text extension, 2 deep analysis/application questions, and an independent extension writing prompt).
Ensure each section is clearly demarcated with headers (e.g. "### [CORE] ...", "### [SUPPORT] ...", "### [CHALLENGE] ...").`,
    userPrompt: (content, custom, isPromptOnly = false) => {
      if (isPromptOnly) {
        return `Create differentiated learning materials (Core, Support, Challenge) for this topic:

[TOPIC / LESSON FOCUS]
${content}

[STUDENT GROUP SPECIFICS]
${custom || 'Balanced class with SEN support and gifted & talented challenge.'}`;
      }
      return `Create differentiated learning materials based on this text.

--- SOURCE MATERIAL START ---
${content}
--- SOURCE MATERIAL END ---

Additional custom requirements or context: ${custom || 'None provided.'}`;
    }
  },
  {
    id: 'homework',
    name: 'Homework Assignment',
    icon: GraduationCap,
    description: 'Set homework tasks calibrated to completion time (15-30m, 1h), age range, and curriculum with student instructions and answer key.',
    systemPrompt: `You are an expert secondary education Homework & Independent Learning Specialist.
Your task is to design a high-impact, age-appropriate homework assignment tailored to the student age group, curriculum, and target duration.
The assignment MUST be strictly achievable within the allocated student time constraint.
Format the output in clean Markdown with the following structure:
1. # Homework Assignment: [Subject & Topic Title]
2. Overview Header:
   - **Target Completion Time**: [Specified Duration, e.g. 15-20 Mins / 30 Mins / 45 Mins / 1 Hour]
   - **Target Key Stage / Year**: [Class Year]
   - **Curriculum Framework**: [Curriculum]
   - **Due Date / Submission Guidance**: [Clear guidance for students]
   - **Expected Equipment / Resources Needed**: [Pen, calculator, textbook, etc.]
3. Student Instructions & Success Criteria (clear bullet points: what "good" looks like)
4. Structured Task Sections (calibrated with suggested time per part):
   - Part 1: Quick Retrieval / Knowledge Recall (e.g. definitions, low-stakes memory check)
   - Part 2: Core Application & Understanding (practical problems, short explanations, or source questions)
   - Part 3: Deepening / Stretch Question (analytical reasoning, exam-style scenario, or personal evaluation)
5. Self-Check / Peer-Assessment Checklist (3-4 checklist items for pupils to audit their work before submission)
6. Optional Parent / Home Discussion Prompt (one brief conversational question connecting the topic to everyday life)
7. ---
8. ## Teacher Marking Guide & Model Answers (comprehensive mark scheme and solutions placed at the very end).`,
    userPrompt: (content, custom, isPromptOnly = false, duration = '30') => {
      const durationLabels = {
        '15-20': '15-20 Minutes (Quick Retrieval & Knowledge Check)',
        '30': '30 Minutes (Standard Homework Task)',
        '45': '45 Minutes (In-Depth Practice & Exam-Style Application)',
        '60': '60 Minutes (Extended Assignment / Research & Synthesis Deep-Dive)'
      };
      const durationDesc = durationLabels[duration] || `${duration} Minutes`;

      if (isPromptOnly) {
        return `Design a structured, complete homework assignment for this topic:

[TOPIC / FOCUS AREA]
${content}

[TARGET ALLOCATED TIME FOR STUDENTS]
${durationDesc}

[CUSTOM TEACHING DIRECTIVES & FOCUS]
${custom || 'Design a balanced, engaging homework task strictly calibrated to the specified time duration.'}`;
      }
      return `Design a structured homework assignment based on the provided course material:

[TARGET ALLOCATED TIME FOR STUDENTS]
${durationDesc}

--- SOURCE MATERIAL START ---
${content}
--- SOURCE MATERIAL END ---

Additional custom requirements or context: ${custom || 'Design a balanced, engaging homework task strictly calibrated to the specified time duration.'}`;
    }
  },
  {
    id: 'lesson_materials',
    name: 'Lesson Materials & Handouts',
    icon: Layers,
    description: 'Produce complete classroom student materials: reading handouts, step-by-step tasks, guided activities, and answer keys.',
    systemPrompt: `You are an expert Educational Resource Creator and Secondary School Materials Designer.
Your task is to produce rich, complete, ready-to-teach student lesson materials and classroom worksheets based on the provided topic, plan, or course files.
Do NOT just provide an outline or summary; write the ACTUAL, FULL student-facing content and materials that a teacher can print or project immediately.
Format the output in clean, professional Markdown with clear typographic hierarchy:

# [Topic Title] - Student Lesson Materials & Worksheet
*Target Key Stage / Year*: [Class Year] | *Subject Framework*: [Curriculum] | *Student Group*: [Student Ability]

---

## 📖 Section 1: Core Student Knowledge Handout
- Clear, engaging, age-appropriate explanatory text (approx 3-5 well-structured paragraphs).
- Bold key vocabulary terms with concise in-text explanations or sidebars.
- Include a "Did You Know?" or "Real-World Context" highlight box.

## ✍️ Section 2: Guided Classroom Activity & Exercises
- Task A: Comprehension & Concept Check (3-4 focused questions to check core grasp).
- Task B: Application & Analytical Activity (a structured scenario, data interpretation, source analysis, or step-by-step problem).
- Clear pupil instructions with guidance on how to write or present answers.

## 🚀 Section 3: Scaffolded Practice & Challenge Tasks
- Support Tier: Fill-in-the-blank or sentence starter activity for students requiring literacy or conceptual scaffolding.
- Extension / Early Finisher Challenge: A deeper thinking, synoptic, or evaluation question for high achievers.

## 🔍 Section 4: Self-Assessment & Reflection Plenary
- 3 quick reflection prompts or self-audit criteria for students to evaluate their own learning.

---

## 📋 Teacher Guide & Solutions (Facilitation Notes)
- Complete model answers and solutions for Section 2 and Section 3.
- Key pedagogical delivery tips and common student misconceptions to watch out for.`,
    userPrompt: (content, custom, isPromptOnly = false) => {
      if (isPromptOnly) {
        return `Produce complete, ready-to-use student lesson materials, reading handouts, guided classroom activities, and answer keys for this topic:

[TOPIC / LESSON FOCUS]
${content}

[SPECIFIC TEACHING INSTRUCTIONS & CONTEXT]
${custom || 'Generate comprehensive student-ready classroom materials with reading text, guided activities, differentiated practice, and teacher solutions.'}`;
      }
      return `Produce complete, ready-to-use student lesson materials, reading handouts, guided classroom activities, and answer keys based on the following input material:

--- SOURCE MATERIAL / LESSON PLAN START ---
${content}
--- SOURCE MATERIAL / LESSON PLAN END ---

Additional custom requirements or context: ${custom || 'Transform this into full student-facing lesson materials, worksheets, and teacher solution keys.'}`;
    }
  },
  {
    id: 'cover_work',
    name: 'Cover Work (Supply Pack)',
    icon: ClipboardList,
    description: 'Generate a complete, self-contained cover work pack for supply/cover teachers with clear classroom routines, independent tasks, and a full answer key.',
    systemPrompt: `You are an expert secondary school cover coordinator and pedagogical specialist.
Your task is to design a bulletproof, completely self-contained Cover Work Lesson Pack designed specifically for a supply/cover teacher (who may not be a subject specialist) to deliver seamlessly.
The lesson must be primarily student-led, highly structured, calm, and manageable in any classroom setting.
Format the output in clean, professional Markdown with clear visual structure:

# 📋 Cover Work Lesson Pack: [Subject & Topic Title]
*Target Key Stage / Year*: [Class Year] | *Subject Framework*: [Curriculum] | *Expected Student Group*: [Student Ability]

---

## 📌 Cover Teacher Briefing & Classroom Management
- **Lesson Objective for Today**: One simple sentence explaining what students should accomplish by the end of the lesson.
- **Required Student Materials**: (e.g. Exercise books / lined paper, blue/black pens, rulers, calculators, textbook page if applicable).
- **Classroom Routine & Rules**:
  - Seating: Standard seating plan; independent or quiet paired work only.
  - Pace: Expected output is completion of Tasks 1, 2, and 3.
  - Behaviour Note: Non-negotiable quiet during the starter reading; hands up for assistance.

---

## ⏳ Step 1: Silent Starter & Knowledge Retrieval (10 Minutes)
- **Instructions for Cover Teacher to Write on Board**:
  > *"Silent Starter: Read the short briefing below and answer Questions 1-5 in full sentences in your books."*
- **Short Student Briefing / Core Concept Snapshot**: A 1-2 paragraph digestible overview introducing or recapping the core topic.
- **5 Retrieval / Recall Questions**: Quick questions checking understanding of the reading or prior knowledge.

---

## ✍️ Step 2: Main Student Tasks & Application (30-35 Minutes)
- **Task 1: Core Worksheet & Analysis**:
  - 4-6 progressive structured questions or tasks that guide students from foundational knowledge to application.
- **Task 2: Extended Written Application / Case Study / Problem-Solving**:
  - A structured task requiring 1-2 paragraphs of writing, mathematical problem solving, or creative application.
  - Include 2-3 sentence starters or scaffolding hints for students who struggle.

---

## 🚀 Step 3: Extension / Early Finisher Challenge (10-15 Minutes)
- **High-Challenge Independent Task**: For students who finish early so the classroom remains calm and productive.
- A critical evaluation question, research expansion, or creative design challenge extending the topic further.

---

## 🏁 Step 4: Plenary & Pack-Down (5 Minutes)
- **Exit Ticket / Learning Check**: 2 quick questions for pupils to write in the margin or on a slip before packing away.
- **Pack-Down Directive**: Ensure pens capped, books collected, desks tidy.

---

## 🔑 Teacher Marking & Solutions Key (For Non-Specialist Cover Teacher)
- **Starter Questions 1-5**: Exact answers and model solutions.
- **Main Task 1 & 2 Answers**: Full model answers, acceptable alternatives, and what key points to look out for when marking.
- **Extension Solutions**: Model points and grading guidance.`,
    userPrompt: (content, custom, isPromptOnly = false) => {
      if (isPromptOnly) {
        return `Generate a comprehensive, self-contained Cover Work Lesson Pack with complete non-specialist teacher instructions and answer keys for this topic:

[TOPIC / COVER WORK SUBJECT]
${content}

[SPECIFIC COVER INSTRUCTIONS / ROOM NOTES]
${custom || 'Design a fully structured, independent student cover lesson suitable for a non-specialist supply teacher to run with zero preparation.'}`;
      }
      return `Generate a comprehensive, self-contained Cover Work Lesson Pack with complete non-specialist teacher instructions and answer keys based on this material:

--- SOURCE MATERIAL START ---
${content}
--- SOURCE MATERIAL END ---

Additional custom requirements or context: ${custom || 'Convert this material into a calm, structured cover lesson pack with student tasks and a complete teacher answer key.'}`;
    }
  }
];

const GEMINI_MODELS = [
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    tier: 'free',
    badge: 'Free Tier (Fast & Recommended)',
    speed: 'Instant',
    description: 'Fastest lightweight model. Ideal for instant worksheets, cover work, and lesson planning without token limits.',
    recommended: true
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    tier: 'free',
    badge: 'Free Tier (Recommended)',
    speed: 'Ultra Fast',
    description: 'High-speed flagship Flash model with superior pedagogical reasoning and extensive free quota.',
    recommended: true
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    tier: 'free',
    badge: 'Free Tier',
    speed: 'Ultra Fast',
    description: 'Next-gen Flash model with advanced reasoning capabilities for lesson planning.'
  },
  {
    id: 'gemini-3.8-flash-lite',
    name: 'Gemini 3.8 Flash-Lite',
    tier: 'free',
    badge: 'Free Tier (Lightweight)',
    speed: 'Instant',
    description: 'Ultra-low latency lightweight model for rapid worksheet generation and quick glossary lookups.'
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    tier: 'free',
    badge: 'Free Tier',
    speed: 'Fast',
    description: 'Multimodal workhorse with standard free quota on Google AI Studio.'
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    tier: 'free',
    badge: 'Free Tier',
    speed: 'Instant',
    description: 'Minimal latency and low token overhead for quick classroom summaries.'
  },
  {
    id: 'gemini-3.8-pro',
    name: 'Gemini 3.8 Pro',
    tier: 'paid',
    badge: 'Paid / Pro Tier',
    speed: 'Deep Reasoning',
    description: 'Next-gen advanced reasoning for complex multi-term Schemes of Work and senior exam frameworks (requires Google Cloud billing).'
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    tier: 'paid',
    badge: 'Paid / Pro Tier',
    speed: 'Deep Reasoning',
    description: 'Maximum depth for complex multi-week Schemes of Work and comprehensive curriculum design (requires Google Cloud billing).'
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    tier: 'paid',
    badge: 'Paid / Pro Tier',
    speed: 'Deep Reasoning',
    description: 'Extensive context window with deep pedagogical structuring (requires Google Cloud billing).'
  }
];

const OPENAI_MODELS = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    tier: 'standard',
    badge: 'Fast & Affordable',
    speed: 'Fast',
    description: 'Cost-effective, highly capable for secondary lesson plans.'
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    tier: 'premium',
    badge: 'Flagship Intelligence',
    speed: 'Deep Reasoning',
    description: 'Top-tier OpenAI model with advanced reasoning for senior secondary curriculums.'
  }
];

const INSPIRATION_CHIPS = [
  { label: '🧪 Practical Lab / Experiment', text: 'Include hands-on experiment steps, lab safety precautions, and required apparatus list.' },
  { label: '🗣️ Socratic Debate & Discussion', text: 'Include structured discussion prompts, talking points, and opposing viewpoints to foster debate.' },
  { label: '🎯 Exam Technique & Pitfalls', text: 'Incorporate GCSE/exam command words, common examiner misconceptions, and model answers.' },
  { label: '🤝 Cooperative Group Tasks', text: 'Design a cooperative group activity with assigned pupil roles (scribe, presenter, researcher).' },
  { label: '🧩 SEN / Low Reading Age Scaffolding', text: 'Scaffold sentence stems, word banks, and visual diagram prompts for pupils needing literacy support.' },
  { label: '🚪 Exit Ticket & Mini-Plenary', text: 'Add a 5-minute quick diagnostic exit ticket to check pupil understanding before the bell.' },
  { label: '📝 Self/Peer Mark Rubric', text: 'Include a 3-point student self-marking rubric so pupils can review their homework before handing in.' },
  { label: '🏡 Family Discussion Prompt', text: 'Add a real-world question connecting the homework to daily home life to prompt discussion with parents/guardians.' }
];

export default function App() {
  // App state
  const [provider, setProvider] = useState(() => localStorage.getItem('ai_provider') || 'gemini');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('ai_apikey') || '');
  const [model, setModel] = useState(() => {
    const saved = localStorage.getItem('ai_model');
    return (!saved || saved === 'gemini-1.5-flash' || saved === 'gemini-2.5-flash') 
      ? 'gemini-3.5-flash-lite' 
      : saved;
  });
  const [customModel, setCustomModel] = useState(() => localStorage.getItem('ai_custom_model') || '');
  const [geminiTierFilter, setGeminiTierFilter] = useState('all'); // 'all', 'free', 'paid'
  const [showKey, setShowKey] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateStatus, setUpdateStatus] = useState({ checking: false, checked: false, available: false, latestVersion: '2.5.0', releaseUrl: '', error: null, notes: '' });
  const [githubRepoInput, setGithubRepoInput] = useState(() => localStorage.getItem('app_update_repo') || 'jmeboypc/JRUSS-AI-TOOL');
  
  // Current app version constant
  const CURRENT_APP_VERSION = '2.5.0';
  
  // Live Detected Models State (from API key)
  const [detectedGeminiModels, setDetectedGeminiModels] = useState(() => {
    try {
      const saved = localStorage.getItem('ai_detected_gemini_models');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [detectedOpenAIModels, setDetectedOpenAIModels] = useState(() => {
    try {
      const saved = localStorage.getItem('ai_detected_openai_models');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isDetectingModels, setIsDetectingModels] = useState(false);
  const [detectStatus, setDetectStatus] = useState(null); // { type: 'success' | 'error', message: string }

  // Input Mode state ('documents' or 'prompt')
  const [inputMode, setInputMode] = useState(() => localStorage.getItem('ai_input_mode') || 'documents');
  const [promptTopic, setPromptTopic] = useState(() => localStorage.getItem('ai_prompt_topic') || '');

  // Class configuration
  const [classYear, setClassYear] = useState('Year 8 (KS3)');
  const [curriculum, setCurriculum] = useState('UK National Curriculum');
  const [learningFocus, setLearningFocus] = useState('Mixed Ability');
  
  // Files state
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [previewingFile, setPreviewingFile] = useState(null);
  
  // Template & Custom Prompt State
  const [selectedTemplate, setSelectedTemplate] = useState('lesson_plan');
  const [homeworkDuration, setHomeworkDuration] = useState(() => localStorage.getItem('ai_homework_duration') || '30');
  const [customPrompt, setCustomPrompt] = useState('');
  
  // Generation & Output State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [outputContent, setOutputContent] = useState('');
  const [outputTab, setOutputTab] = useState('render'); // 'render', 'raw', 'table'
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Available Models: live detected list if present, otherwise vetted fallback presets
  const availableGeminiList = (detectedGeminiModels && detectedGeminiModels.length > 0)
    ? detectedGeminiModels
    : GEMINI_MODELS;

  const availableOpenAIList = (detectedOpenAIModels && detectedOpenAIModels.length > 0)
    ? detectedOpenAIModels
    : OPENAI_MODELS;

  // Active Model Lookups & Tier Information
  const currentGeminiModel = availableGeminiList.find(m => m.id === model) || {
    id: model,
    name: model,
    tier: model.toLowerCase().includes('pro') ? 'paid' : 'free',
    badge: model.toLowerCase().includes('pro') ? 'Paid / Pro Tier' : 'Free Tier',
    speed: 'Standard',
    description: 'Active Gemini model'
  };

  const currentOpenAIModel = availableOpenAIList.find(m => m.id === model) || {
    id: model,
    name: model,
    tier: 'standard',
    badge: 'Standard',
    speed: 'Standard',
    description: 'Active OpenAI model'
  };

  const isFreeTier = provider === 'gemini' && (customModel.trim() ? !customModel.toLowerCase().includes('pro') : currentGeminiModel.tier === 'free');

  // Persist settings & detected models
  useEffect(() => {
    localStorage.setItem('ai_provider', provider);
    localStorage.setItem('ai_apikey', apiKey);
    localStorage.setItem('ai_model', model);
    localStorage.setItem('ai_custom_model', customModel);
    localStorage.setItem('ai_input_mode', inputMode);
    localStorage.setItem('ai_prompt_topic', promptTopic);
    localStorage.setItem('ai_homework_duration', homeworkDuration);

    if (detectedGeminiModels) {
      localStorage.setItem('ai_detected_gemini_models', JSON.stringify(detectedGeminiModels));
    } else {
      localStorage.removeItem('ai_detected_gemini_models');
    }

    if (detectedOpenAIModels) {
      localStorage.setItem('ai_detected_openai_models', JSON.stringify(detectedOpenAIModels));
    } else {
      localStorage.removeItem('ai_detected_openai_models');
    }
    if (githubRepoInput) {
      localStorage.setItem('app_update_repo', githubRepoInput.trim());
    }
  }, [provider, apiKey, model, customModel, inputMode, promptTopic, homeworkDuration, detectedGeminiModels, detectedOpenAIModels, githubRepoInput]);

  // Check for app updates against GitHub releases
  const handleCheckForUpdates = async (repoName = githubRepoInput) => {
    const cleanRepo = (repoName || '').trim();
    if (!cleanRepo || !cleanRepo.includes('/')) {
      setUpdateStatus({
        checking: false,
        checked: true,
        available: false,
        latestVersion: CURRENT_APP_VERSION,
        releaseUrl: '',
        notes: '',
        error: 'Please enter a valid GitHub repository in "owner/repository" format (e.g. JamieRussell/TeacherSummary).'
      });
      return;
    }

    setUpdateStatus(prev => ({ ...prev, checking: true, error: null }));
    try {
      const response = await fetch(`https://api.github.com/repos/${cleanRepo}/releases/latest`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`No published releases found on GitHub repo "${cleanRepo}". Once you publish a release with the .msi, it will appear here.`);
        }
        throw new Error(`GitHub API returned status ${response.status}: ${response.statusText}`);
      }

      const releaseData = await response.json();
      const tagName = (releaseData.tag_name || '').replace(/^v/i, '').trim();
      const notes = releaseData.body || 'No release notes provided.';
      const releaseUrl = releaseData.html_url || `https://github.com/${cleanRepo}/releases`;
      
      // Compare versions (semver style simple comparison)
      const parseSemver = (v) => v.split('.').map(n => parseInt(n, 10) || 0);
      const [curMajor, curMinor, curPatch] = parseSemver(CURRENT_APP_VERSION);
      const [latMajor, latMinor, latPatch] = parseSemver(tagName);

      let isNewer = false;
      if (latMajor > curMajor) isNewer = true;
      else if (latMajor === curMajor && latMinor > curMinor) isNewer = true;
      else if (latMajor === curMajor && latMinor === curMinor && latPatch > curPatch) isNewer = true;

      setUpdateStatus({
        checking: false,
        checked: true,
        available: isNewer,
        latestVersion: tagName || CURRENT_APP_VERSION,
        releaseUrl: releaseUrl,
        notes: notes,
        assets: releaseData.assets || [],
        error: null
      });
    } catch (err) {
      setUpdateStatus({
        checking: false,
        checked: true,
        available: false,
        latestVersion: CURRENT_APP_VERSION,
        releaseUrl: '',
        notes: '',
        error: err.message || 'Failed to check for updates. Make sure you are connected to the internet.'
      });
    }
  };

  // Handle provider changes & pick default models
  const handleSelectProvider = (nextProvider) => {
    setProvider(nextProvider);
    setDetectStatus(null);
    if (nextProvider === 'gemini') {
      const topModel = (detectedGeminiModels && detectedGeminiModels.length > 0)
        ? (detectedGeminiModels.find(m => m.recommended) || detectedGeminiModels[0]).id
        : 'gemini-3.5-flash-lite';
      setModel(topModel);
    } else {
      const topModel = (detectedOpenAIModels && detectedOpenAIModels.length > 0)
        ? detectedOpenAIModels[0].id
        : 'gpt-4o-mini';
      setModel(topModel);
    }
  };

  // Live model detection via API key
  const handleDetectModels = async (keyToUse = apiKey, provToUse = provider) => {
    const trimmedKey = keyToUse.trim();
    if (!trimmedKey) {
      setDetectStatus({ type: 'error', message: 'Please enter an API key first before detecting models.' });
      return;
    }

    setIsDetectingModels(true);
    setDetectStatus(null);

    try {
      if (provToUse === 'gemini') {
        const liveModels = await fetchAvailableGeminiModels(trimmedKey);
        setDetectedGeminiModels(liveModels);
        setDetectStatus({
          type: 'success',
          message: `Key verified! ${liveModels.length} active models detected from Google.`
        });
        
        // If current model isn't in detected models, select the recommended Flash model
        const hasCurrentModel = liveModels.some(m => m.id === model);
        if (!hasCurrentModel) {
          const recommended = liveModels.find(m => m.recommended) || liveModels.find(m => m.isFlash) || liveModels[0];
          if (recommended) {
            setModel(recommended.id);
          }
        }
      } else {
        const liveModels = await fetchAvailableOpenAIModels(trimmedKey);
        setDetectedOpenAIModels(liveModels);
        setDetectStatus({
          type: 'success',
          message: `Key verified! ${liveModels.length} active models detected from OpenAI.`
        });
        const hasCurrentModel = liveModels.some(m => m.id === model);
        if (!hasCurrentModel && liveModels.length > 0) {
          setModel(liveModels[0].id);
        }
      }
    } catch (err) {
      setDetectStatus({
        type: 'error',
        message: err.message || 'Failed to detect models. Please check your API key.'
      });
    } finally {
      setIsDetectingModels(false);
    }
  };

  // Add quick pedagogical directive from inspiration chips
  const handleAddInspiration = (chipText) => {
    setCustomPrompt(prev => {
      const trimmed = prev.trim();
      if (!trimmed) return chipText;
      return `${trimmed}\n- ${chipText}`;
    });
  };

  // Drag and Drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await handleFilesAdded(e.target.files);
    }
  };

  const handleFilesAdded = async (fileList) => {
    const newFiles = Array.from(fileList);
    
    for (let f of newFiles) {
      const fileId = `${f.name}-${f.size}-${Date.now()}`;
      const placeholder = {
        id: fileId,
        name: f.name,
        size: f.size,
        status: 'parsing', // 'parsing', 'success', 'error'
        text: '',
        errorMsg: ''
      };
      
      setFiles(prev => [...prev, placeholder]);
      
      try {
        const text = await parseDocument(f);
        setFiles(prev => prev.map(item => 
          item.id === fileId ? { ...item, status: 'success', text } : item
        ));
      } catch (err) {
        setFiles(prev => prev.map(item => 
          item.id === fileId ? { ...item, status: 'error', errorMsg: err.message || 'Parsing failed' } : item
        ));
      }
    }
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // Aggregate parsed content from files
  const getAggregatedText = () => {
    return files
      .filter(f => f.status === 'success')
      .map(f => `[Source Document: ${f.name}]\n${f.text}`)
      .join('\n\n');
  };

  // Generate output
  const handleGenerate = async () => {
    if (!apiKey) {
      setGenerationError("Please configure your AI API key in Engine Settings before generating.");
      setShowSettingsModal(true);
      return;
    }
    
    if (inputMode === 'documents') {
      const parsedFiles = files.filter(f => f.status === 'success');
      if (parsedFiles.length === 0) {
        setGenerationError("Please upload at least one valid course document first (or switch to Prompt-Only Mode).");
        return;
      }
    } else {
      if (!promptTopic.trim() && !customPrompt.trim()) {
        setGenerationError("Please enter a lesson topic or custom prompt directives first.");
        return;
      }
    }

    setIsGenerating(true);
    setGenerationError('');
    setOutputContent('');
    setStatusMessage(inputMode === 'documents' ? 'Reading files and formulating prompt...' : 'Formulating prompt from topic...');

    try {
      const template = TEMPLATES.find(t => t.id === selectedTemplate) || TEMPLATES[0];
      
      // Inject context variables into system instruction
      let classContext = `You are tailoring this for a ${classYear} level class studying under the ${curriculum} framework. The student ability group is: ${learningFocus}. Incorporate secondary education pedagogical tricks, lesson timings, and specific checks for understanding suitable for this group.`;
      if (selectedTemplate === 'homework') {
        classContext += ` The homework must strictly fit within an estimated completion duration of ${homeworkDuration === '60' ? '1 hour (60 minutes)' : `${homeworkDuration} minutes`}. Ensure questions are realistic in length and provide clear student time management guidelines.`;
      }
      const fullSystemPrompt = `${template.systemPrompt}\n\n[Context Adjustments]:\n${classContext}`;
      
      setStatusMessage('Sending request to AI model (this may take a moment)...');
      
      let userPromptText = '';
      if (inputMode === 'documents') {
        const aggregatedText = getAggregatedText();
        userPromptText = template.userPrompt(aggregatedText, customPrompt, false, homeworkDuration);
      } else {
        const coreTopic = promptTopic.trim() || 'Secondary School Curriculum Unit';
        userPromptText = template.userPrompt(coreTopic, customPrompt, true, homeworkDuration);
      }

      const activeModel = customModel.trim() || model;
      const response = await generateContent({
        provider,
        apiKey,
        model: activeModel,
        systemPrompt: fullSystemPrompt,
        userPrompt: userPromptText
      });
      
      setOutputContent(response);
      setStatusMessage('Completed successfully!');
    } catch (err) {
      console.error(err);
      setGenerationError(err.message || 'An unexpected error occurred. Please check your API key and connection.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Export functions
  const handleCopyText = () => {
    navigator.clipboard.writeText(outputContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyRichText = () => {
    // Generate styled HTML from Markdown
    const htmlContent = marked.parse(outputContent);
    
    // Add lightweight document styling for Word/Google Docs
    const styledHtml = `
      <html>
        <head>
          <style>
            body { font-family: Calibri, Arial, sans-serif; line-height: 1.5; color: #111; }
            h1 { font-family: Georgia, serif; color: #2e4053; border-bottom: 2px solid #5d6d7e; padding-bottom: 5px; }
            h2 { font-family: Georgia, serif; color: #2e4053; margin-top: 20px; }
            h3 { color: #5d6d7e; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
            th, td { border: 1px solid #bdc3c7; padding: 8px 12px; text-align: left; }
            th { background-color: #f2f4f4; font-weight: bold; }
            blockquote { border-left: 4px solid #85929e; background-color: #f8f9f9; padding: 10px; margin: 10px 0; font-style: italic; }
            code { background-color: #f4f6f7; padding: 2px 4px; font-family: Consolas, monospace; font-size: 90%; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `;

    const blob = new Blob([styledHtml], { type: 'text/html' });
    const clipboardItem = new ClipboardItem({ 'text/html': blob });
    
    navigator.clipboard.write([clipboardItem]).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error("Rich text copy failed, falling back to plaintext: ", err);
      handleCopyText();
    });
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([outputContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `TeacherPlan-${selectedTemplate}-${Date.now()}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadDocx = async () => {
    if (!outputContent) return;
    try {
      const sanitizedTopic = (promptTopic || selectedTemplate)
        .replace(/[^a-zA-Z0-9_\- ]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 30);
      const filename = `JRUSS-${sanitizedTopic || selectedTemplate}-${Date.now()}.docx`;
      await exportMarkdownToDocx(outputContent, filename);
    } catch (err) {
      console.error('DocX Export failed:', err);
      // Fallback to rich HTML copy if docx generation encounters an unexpected error
      handleCopyRichText();
    }
  };

  // Workflow Chaining: Use current generated plan/material as source for full lesson resources
  const handleChainToMaterials = () => {
    if (!outputContent) return;
    
    // Switch template to Lesson Materials & Handouts
    setSelectedTemplate('lesson_materials');

    // Extract plausible title if available from first header line
    const firstHeaderMatch = outputContent.match(/^#+\s+(.+)$/m);
    if (firstHeaderMatch && firstHeaderMatch[1]) {
      const extractedTitle = firstHeaderMatch[1].replace(/[:\-–].*$/, '').trim();
      if (!promptTopic.trim() && extractedTitle) {
        setPromptTopic(extractedTitle);
      }
    }

    // Set custom prompt guidance to chain from the existing output plan
    setCustomPrompt(prev => {
      const baseDirective = `Transform the generated lesson plan/curriculum into complete, ready-to-teach student lesson materials (reading texts, comprehension questions, structured exercises, and teacher answer keys) perfectly tailored to the objectives.`;
      if (!prev.trim()) return baseDirective;
      if (prev.includes(baseDirective)) return prev;
      return `${prev}\n\n- ${baseDirective}`;
    });

    // Provide friendly feedback
    setStatusMessage('Ready! Blueprint set to Lesson Materials & Handouts. Click Generate to produce student materials.');
  };

  // Convert markdown table string into editable arrays of rows/columns
  const parseTablesFromMarkdown = (markdown) => {
    if (!markdown) return [];
    
    // Extract tables matching markdown structure
    const tables = [];
    const lines = markdown.split('\n');
    let currentTable = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const isTableRow = line.startsWith('|') && line.endsWith('|');

      if (isTableRow) {
        // Skip separator line |---|---|
        if (line.includes('---') || line.includes(':---')) {
          continue;
        }

        const cells = line.split('|')
          .slice(1, -1) // remove empty elements at start/end
          .map(cell => cell.trim());

        if (!currentTable) {
          currentTable = {
            headers: cells,
            rows: [],
            startIndex: i
          };
        } else {
          currentTable.rows.push(cells);
        }
      } else {
        if (currentTable) {
          tables.push(currentTable);
          currentTable = null;
        }
      }
    }
    if (currentTable) {
      tables.push(currentTable);
    }
    return tables;
  };

  const tables = parseTablesFromMarkdown(outputContent);

  // Quick edits on cell level to regenerate markdown (for interactive table edits)
  const handleCellEdit = (tableIndex, rowIndex, cellIndex, newValue) => {
    const tablesCopy = [...tables];
    tablesCopy[tableIndex].rows[rowIndex][cellIndex] = newValue;

    // Find the original lines representing the table and replace them
    // Simple table reconstruction is cleanest:
    const tableToRebuild = tablesCopy[tableIndex];
    const headerStr = `| ${tableToRebuild.headers.join(' | ')} |`;
    const separatorStr = `| ${tableToRebuild.headers.map(() => '---').join(' | ')} |`;

    // Reconstruct the output markdown cleanly:
    const lines = outputContent.split('\n');
    let startIdx = tableToRebuild.startIndex;
    
    // Search the actual lines to replace accurately
    let originalRowsCount = tables[tableIndex].rows.length + 2; // header + separator + rows
    lines.splice(startIdx, originalRowsCount, headerStr, separatorStr, ...tableToRebuild.rows.map(row => `| ${row.join(' | ')} |`));
    
    setOutputContent(lines.join('\n'));
  };

  return (
    <div className="relative min-h-screen z-10 p-4 md:p-8 flex flex-col justify-between">
      {/* Background grids */}
      <DotField />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto w-full relative z-10 flex-grow flex flex-col gap-6">
        
        {/* Header Block */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-violet-600/20 rounded-2xl border border-violet-500/30 glow-border-purple">
              <Sparkles className="w-8 h-8 text-violet-400" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white m-0">
                <DecryptedText 
                  text="JRUSS AI TOOL" 
                  speed={40} 
                  className="bg-gradient-to-r from-violet-400 via-indigo-200 to-cyan-400 bg-clip-text text-transparent" 
                />
              </h1>
              <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                <span>Secondary School Lesson Planner & Document Tailoring Suite</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-md font-mono font-semibold">v2.5</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5">
            {/* Updates Button */}
            <button
              onClick={() => {
                setShowUpdateModal(true);
                handleCheckForUpdates();
              }}
              className="header-model-pill hover-scale text-slate-300 hover:text-white"
              title="Check for software updates"
            >
              <CloudDownload className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold">Updates</span>
              {updateStatus.checked && updateStatus.available && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              )}
            </button>

            {/* Active Model & Tier Pill (Clickable) */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="header-model-pill hover-scale"
              title="Click to configure AI engine or model tier"
            >
              {provider === 'gemini' ? (
                <>
                  <span className={`w-2 h-2 rounded-full ${isFreeTier ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]'}`}></span>
                  <span className="font-semibold text-white">
                    {customModel.trim() ? customModel.trim() : currentGeminiModel.name}
                  </span>
                  <span className={isFreeTier ? 'tier-badge-free' : 'tier-badge-paid'}>
                    {isFreeTier ? '⚡ Free Tier' : '💎 Paid / Pro'}
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"></span>
                  <span className="font-semibold text-white">
                    {customModel.trim() ? customModel.trim() : currentOpenAIModel.name}
                  </span>
                  <span className="tier-badge-openai">
                    OpenAI
                  </span>
                </>
              )}
            </button>

            <button 
              onClick={() => setShowSettingsModal(true)}
              className="header-model-pill hover-scale text-slate-300 hover:text-white"
              title="AI Engine Settings"
            >
              <Settings className="w-4 h-4 animate-[spin_10s_linear_infinite]" />
              <span className="text-xs font-semibold">Config</span>
            </button>
          </div>
        </header>

        {/* Content Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: API settings, File inputs, configurations (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">

            {/* School / Class Settings Card */}
            <StarBorder color="#06b6d4">
              <SpotlightCard className="bg-transparent border-0" spotlightColor="rgba(6, 182, 212, 0.12)">
                <div className="flex items-center gap-2 mb-4">
                  <LayoutTemplate className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg text-white m-0">Pedagogical Context</h2>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Class / Year Level</label>
                    <select 
                      value={classYear} 
                      onChange={(e) => setClassYear(e.target.value)}
                      className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="Year 7 (KS3)">Year 7 (KS3)</option>
                      <option value="Year 8 (KS3)">Year 8 (KS3)</option>
                      <option value="Year 9 (KS3)">Year 9 (KS3)</option>
                      <option value="Year 10 (KS4/GCSE)">Year 10 (KS4/GCSE)</option>
                      <option value="Year 11 (KS4/GCSE)">Year 11 (KS4/GCSE)</option>
                      <option value="A-Level / Year 12+">A-Level / Year 12+</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Curriculum</label>
                    <select 
                      value={curriculum} 
                      onChange={(e) => setCurriculum(e.target.value)}
                      className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="UK National Curriculum">UK Curriculum</option>
                      <option value="Common Core / USA">Common Core</option>
                      <option value="IB (International)">IB Programme</option>
                      <option value="General Curriculum">Standard/General</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Student Focus & Differentiation</label>
                    <select 
                      value={learningFocus} 
                      onChange={(e) => setLearningFocus(e.target.value)}
                      className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="Mixed Ability (Balanced)">Mixed Ability (Balanced)</option>
                      <option value="SEN / ESL heavy (Scaffolded language & visual guides)">SEN / ESL Focus (High support)</option>
                      <option value="High Ability / Stretch (More application & lateral questions)">Gifted & Talented (High challenge)</option>
                      <option value="Low Literacy / Low Reading Age">Lower Reading Age Support</option>
                    </select>
                  </div>
                </div>
              </SpotlightCard>
            </StarBorder>

            {/* Mode Switcher: Document Upload vs Prompt-Only */}
            <div className="mode-switch-container">
              <button
                type="button"
                onClick={() => setInputMode('documents')}
                className={`btn-mode-tab ${
                  inputMode === 'documents'
                    ? 'btn-mode-active-doc'
                    : 'btn-mode-inactive'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Documents</span>
                {files.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-white/20 rounded-full font-mono">{files.length}</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setInputMode('prompt')}
                className={`btn-mode-tab ${
                  inputMode === 'prompt'
                    ? 'btn-mode-active-prompt'
                    : 'btn-mode-inactive'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Prompt-Only Mode</span>
                <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full font-semibold">DIRECT</span>
              </button>
            </div>

            {/* Document Dropzone & Upload Panel (When inputMode === 'documents') */}
            {inputMode === 'documents' && (
              <StarBorder color="#6366f1">
                <SpotlightCard className="bg-transparent border-0" spotlightColor="rgba(99, 102, 241, 0.12)">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Upload className="w-5 h-5 text-indigo-400" />
                      <h2 className="text-lg text-white m-0">Subject Course Material</h2>
                    </div>
                    <span className="text-[11px] text-slate-400">{files.length} active files</span>
                  </div>

                  {/* Visual Dropzone area */}
                  <div 
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                      dragActive 
                        ? 'border-violet-500 bg-violet-500/5' 
                        : 'border-white/10 bg-slate-950/40 hover:border-violet-500/50 hover:bg-slate-950/60'
                    }`}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('file-upload-input').click()}
                  >
                    <input 
                      type="file" 
                      id="file-upload-input" 
                      multiple 
                      accept=".pdf,.docx,.pptx,.txt,.md"
                      onChange={handleFileChange}
                      className="hidden" 
                    />
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-300 font-semibold mb-1">Drag & Drop files here</p>
                    <p className="text-xs text-slate-500">Supports PPTX, DOCX, PDF, TXT, MD</p>
                  </div>

                  {/* Uploaded File Cards */}
                  {files.length > 0 && (
                    <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-1 mt-4">
                      {files.map(f => (
                        <div 
                          key={f.id} 
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-white/5 hover:border-white/10 transition"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <FileText className={`w-5 h-5 shrink-0 ${
                              f.status === 'success' ? 'text-violet-400' : f.status === 'parsing' ? 'text-indigo-400 animate-pulse' : 'text-rose-400'
                            }`} />
                            <div className="overflow-hidden">
                              <p className="text-xs text-slate-200 font-medium truncate m-0">{f.name}</p>
                              <p className="text-[10px] text-slate-400 m-0 mt-0.5">
                                {(f.size / 1024).toFixed(1)} KB • {
                                  f.status === 'success' 
                                    ? `${f.text.length} chars parsed` 
                                    : f.status === 'parsing' 
                                      ? 'Extracting text...' 
                                      : 'Parsing error'
                                }
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5 shrink-0">
                            {f.status === 'success' && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); setPreviewingFile(f); }}
                                className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-white"
                                title="Preview Extracted Text"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            <button 
                              onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                              className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-rose-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SpotlightCard>
              </StarBorder>
            )}

            {/* Prompt-Only Studio Card (When inputMode === 'prompt') */}
            {inputMode === 'prompt' && (
              <StarBorder color="#14b8a6">
                <SpotlightCard className="bg-transparent border-0" spotlightColor="rgba(20, 184, 166, 0.12)">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-teal-400" />
                    <div>
                      <h2 className="text-lg text-white m-0">Prompt Studio</h2>
                      <p className="text-[11px] text-slate-400 m-0 mt-0.5">No uploads needed — generate directly from your topic</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    {/* Topic input */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        Lesson Topic / Unit Title <span className="text-rose-400">*</span>
                      </label>
                      <input 
                        type="text"
                        value={promptTopic}
                        onChange={(e) => setPromptTopic(e.target.value)}
                        placeholder="e.g., Year 9 Photosynthesis & Limiting Factors, or WW1 Trench Warfare"
                        className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500 transition placeholder:text-slate-600"
                      />
                    </div>

                    {/* Pedagogical Quick-Injectors (Inspiration Chips) */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                          Pedagogical Quick-Injectors
                        </span>
                        <span className="text-[10px] text-slate-500">Click to add to directives</span>
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {INSPIRATION_CHIPS.map((chip, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleAddInspiration(chip.text)}
                            className="quick-injector-chip hover-scale"
                            title={chip.text}
                          >
                            <span>{chip.label}</span>
                            <Plus className="w-3 h-3 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl text-[11px] text-teal-200/90 leading-relaxed">
                      💡 <strong>Prompt-Only Tip:</strong> Pick any blueprint on the right (Lesson Plan, Scheme of Work, Quiz, Vocabulary, Differentiated Resources, Homework, or Lesson Materials & Handouts). The AI synthesizes complete classroom resources matching your selected year level and curriculum.
                    </div>
                  </div>
                </SpotlightCard>
              </StarBorder>
            )}

          </div>

          {/* Right Column: Template settings & Output workspace (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Prompt Template Card */}
            <StarBorder color="#6366f1">
              <SpotlightCard className="bg-transparent border-0" spotlightColor="rgba(99, 102, 241, 0.12)">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg text-white m-0">Planner Output Blueprint</h2>
                </div>

                {/* Template selector grids */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {TEMPLATES.map(t => {
                    const Icon = t.icon;
                    const isSelected = selectedTemplate === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTemplate(t.id)}
                        className={`blueprint-card ${isSelected ? 'selected' : ''}`}
                      >
                        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${isSelected ? 'text-violet-400' : 'text-slate-400'}`} />
                        <div>
                          <p className="text-xs font-semibold m-0">{t.name}</p>
                          <p className="text-[10px] text-slate-400 m-0 mt-0.5 line-clamp-2 leading-relaxed">{t.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Homework Target Duration Selector (Shown when Homework Assignment is active) */}
                {selectedTemplate === 'homework' && (
                  <div className="mb-4 p-3.5 bg-purple-950/30 border border-purple-500/25 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-purple-200 flex items-center gap-1.5 m-0">
                        <Clock className="w-3.5 h-3.5 text-purple-400" />
                        <span>Target Homework Duration</span>
                      </label>
                      <span className="text-[10px] text-purple-300/70">Calibrates task volume & pacing</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: '15-20', label: '15-20 Mins', sub: 'Quick Retrieval' },
                        { id: '30', label: '30 Mins', sub: 'Standard Task' },
                        { id: '45', label: '45 Mins', sub: 'In-Depth Practice' },
                        { id: '60', label: '1 Hour', sub: 'Project / Deep Dive' }
                      ].map(d => {
                        const isActive = homeworkDuration === d.id;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setHomeworkDuration(d.id)}
                            className={`duration-pill flex-col items-start text-left justify-center py-2 px-2.5 ${isActive ? 'active' : ''}`}
                          >
                            <span className="text-xs font-bold leading-tight">{d.label}</span>
                            <span className={`text-[9px] leading-tight mt-0.5 ${isActive ? 'text-purple-200' : 'text-slate-500'}`}>
                              {d.sub}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Custom directives */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>{inputMode === 'prompt' ? 'Lesson Focus Directives & Requirements' : 'Custom Directives (Secondary School Focus)'}</span>
                    <span className="text-[10px] text-slate-500">
                      {inputMode === 'prompt' ? 'e.g. 60-min lesson, starter recap, lab experiment' : 'e.g. Include a practical lab, roleplay, exit questions'}
                    </span>
                  </label>
                  <textarea 
                    rows={inputMode === 'prompt' ? 3 : 2}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder={
                      inputMode === 'prompt' 
                        ? "Specify key concepts, starter activities, practical work, or exam questions to include (or use the Quick-Injectors on the left)..." 
                        : "Insert custom teaching notes, focus areas, key skills, learning needs..."
                    }
                    className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 resize-y"
                  />
                </div>

                {/* Generate Trigger */}
                <button
                  onClick={handleGenerate}
                  disabled={
                    isGenerating || 
                    (inputMode === 'documents' 
                      ? files.filter(f => f.status === 'success').length === 0 
                      : (!promptTopic.trim() && !customPrompt.trim()))
                  }
                  className={`btn-generate ${inputMode === 'prompt' ? 'btn-generate-prompt' : 'btn-generate-doc'}`}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Analyzing & Synthesizing ({statusMessage})...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{inputMode === 'prompt' ? 'Generate from Topic & Prompt' : 'Generate Lesson Output'}</span>
                    </>
                  )}
                </button>

                {generationError && (
                  <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2 text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{generationError}</span>
                  </div>
                )}
              </SpotlightCard>
            </StarBorder>

            {/* Generated Workspace Card */}
            <StarBorder color="#a78bfa">
              <SpotlightCard className="bg-transparent border-0 flex flex-col min-h-[400px]" spotlightColor="rgba(167, 139, 250, 0.12)">
                
                {/* Workspace Header Panel */}
                <div className="border-b border-white/10 pb-3 bg-transparent flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-violet-400" />
                    <span className="text-xs font-semibold text-white">Generated Teaching Plan</span>
                    {outputContent && (
                      <span className="text-[10px] px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-slate-400">
                        ~{Math.round(outputContent.length / 4)} words
                      </span>
                    )}
                  </div>

                  {/* Tabs selection */}
                  {outputContent && (
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => setOutputTab('render')}
                        className={`text-xs px-2.5 py-1 rounded-md transition ${outputTab === 'render' ? 'bg-white/10 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
                      >
                        Formatted Doc
                      </button>
                      {tables.length > 0 && (
                        <button 
                          onClick={() => setOutputTab('table')}
                          className={`text-xs px-2.5 py-1 rounded-md transition flex items-center gap-1 ${outputTab === 'table' ? 'bg-white/10 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" /> Editable Tables ({tables.length})
                        </button>
                      )}
                      <button 
                        onClick={() => setOutputTab('raw')}
                        className={`text-xs px-2.5 py-1 rounded-md transition ${outputTab === 'raw' ? 'bg-white/10 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
                      >
                        Raw Markdown / Edit
                      </button>
                    </div>
                  )}
                </div>

                {/* Workspace Body */}
                <div className="pt-5 flex-grow overflow-y-auto max-h-[500px]">
                  {isGenerating ? (
                    <div className="h-full min-h-[300px] flex flex-col items-center justify-center gap-3 text-center">
                      <div className="shimmer-wrapper w-full max-w-md h-4 rounded-full mb-2" />
                      <div className="shimmer-wrapper w-full max-w-sm h-4 rounded-full mb-2" />
                      <div className="shimmer-wrapper w-full max-w-lg h-4 rounded-full mb-6" />
                      <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
                      <p className="text-xs text-slate-400 italic mt-2">Writing unit plans and designing classroom checks...</p>
                    </div>
                  ) : outputContent ? (
                    <>
                      {outputTab === 'render' && (
                        <div 
                          className="markdown-body" 
                          dangerouslySetInnerHTML={{ __html: marked.parse(outputContent) }} 
                        />
                      )}

                      {outputTab === 'raw' && (
                        <textarea
                          value={outputContent}
                          onChange={(e) => setOutputContent(e.target.value)}
                          className="w-full h-[400px] bg-slate-950/40 border border-white/5 rounded-xl p-4 text-xs font-mono text-slate-300 focus:outline-none focus:border-violet-500 resize-y"
                        />
                      )}

                      {outputTab === 'table' && tables.length > 0 && (
                        <div className="flex flex-col gap-8">
                          {tables.map((tbl, tblIdx) => (
                            <div key={tblIdx} className="border border-white/10 rounded-xl overflow-hidden bg-slate-950/40 p-4">
                              <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                                <FileSpreadsheet className="w-4 h-4 text-cyan-400" /> Interactive Table #{tblIdx + 1}
                              </h3>
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-xs">
                                  <thead>
                                    <tr className="bg-slate-900">
                                      {tbl.headers.map((hdr, hIdx) => (
                                        <th key={hIdx} className="p-3 border border-white/10 text-left font-semibold text-slate-200">
                                          {hdr}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {tbl.rows.map((row, rIdx) => (
                                      <tr key={rIdx} className="hover:bg-white/5 transition">
                                        {row.map((cell, cIdx) => (
                                          <td key={cIdx} className="p-2 border border-white/10">
                                            <input
                                              type="text"
                                              value={cell}
                                              onChange={(e) => handleCellEdit(tblIdx, rIdx, cIdx, e.target.value)}
                                              className="w-full bg-transparent border-0 outline-none text-slate-300 focus:bg-slate-900 focus:ring-1 focus:ring-violet-500 rounded px-1.5 py-1 text-xs"
                                            />
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6">
                      <div className="p-4 bg-slate-950/40 rounded-full mb-3 text-slate-600">
                        <LayoutTemplate className="w-8 h-8" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-300 m-0">No Output Generated</h3>
                      <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
                        {inputMode === 'prompt' 
                          ? 'Enter a lesson topic on the left, pick an output blueprint, and click "Generate from Topic & Prompt" to craft your materials.' 
                          : 'Upload your lesson material, configure class parameters, and click "Generate Lesson Output" to begin.'
                        }
                      </p>
                    </div>
                  )}
                </div>

                {/* Workspace Action Bar */}
                {outputContent && (
                  <div className="border-t border-white/10 pt-3 bg-transparent flex items-center justify-between gap-3 mt-4">
                    <div className="text-[10px] text-slate-500">
                      💡 Edits in the raw editor or table view will update the output document.
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {selectedTemplate !== 'lesson_materials' && (
                        <button
                          onClick={handleChainToMaterials}
                          className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 hover-scale shadow-sm focus:outline-none"
                          title="Transform this generated plan into complete student lesson materials and worksheets"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Generate Student Materials From This</span>
                        </button>
                      )}

                      <button 
                        onClick={handleCopyRichText}
                        className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 hover-scale focus:outline-none"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy to Word / Doc</span>
                          </>
                        )}
                      </button>

                      <button 
                        onClick={handleDownloadDocx}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 hover-scale shadow-sm focus:outline-none"
                        title="Download formatted Microsoft Word (.docx) document"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Download DocX</span>
                      </button>

                      <button 
                        onClick={handleDownloadMarkdown}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-white/5 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 hover-scale focus:outline-none"
                        title="Download plain Markdown (.md) file"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download MD</span>
                      </button>
                    </div>
                  </div>
                )}
              </SpotlightCard>
            </StarBorder>

          </div>

        </div>

      </div>

      {/* File Extracted Preview Modal */}
      {previewingFile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-white/10 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-400" />
                <span className="text-xs font-bold text-white">Parsed Output Preview: {previewingFile.name}</span>
              </div>
              <button 
                onClick={() => setPreviewingFile(null)} 
                className="text-xs text-slate-400 hover:text-white font-bold"
              >
                Close
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-grow bg-slate-950/20">
              <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                {previewingFile.text || 'No text extracted from this file.'}
              </pre>
            </div>
            
            <div className="px-5 py-3 border-t border-white/10 bg-slate-950/60 flex justify-end">
              <button 
                onClick={() => setPreviewingFile(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Drawer Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-[#080b11]/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowSettingsModal(false)}>
          <DotField />
          <StarBorder className="w-full max-w-xl relative z-10 my-8" color="#8b5cf6">
            <SpotlightCard 
              className="bg-[#0b0f19]/95 border-0 p-6 sm:p-7 flex flex-col gap-6" 
              spotlightColor="rgba(139, 92, 246, 0.15)"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-violet-600/20 rounded-xl border border-violet-500/30">
                    <Settings className="w-5 h-5 text-violet-400 animate-[spin_10s_linear_infinite]" />
                  </div>
                  <div>
                    <h2 className="text-lg text-white m-0 font-bold">AI Engine & Model Configuration</h2>
                    <p className="text-xs text-slate-400 m-0 mt-0.5">Configure your AI provider and choose between Free and Paid model tiers</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-white/5 font-semibold"
                >
                  ✕ Close
                </button>
              </div>

              <div className="flex flex-col gap-5">
                {/* Provider Selection */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">AI Provider</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleSelectProvider('gemini')}
                      className={`settings-provider-card ${provider === 'gemini' ? 'active-gemini' : ''}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Sparkles className="w-4 h-4 text-violet-400" />
                        <div>
                          <p className="text-xs font-bold m-0 text-white">Google Gemini</p>
                          <p className="text-[10px] text-slate-400 m-0">Free & Paid Tiers via AI Studio</p>
                        </div>
                      </div>
                      {provider === 'gemini' && <Check className="w-4 h-4 text-violet-400" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectProvider('openai')}
                      className={`settings-provider-card ${provider === 'openai' ? 'active-openai' : ''}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Zap className="w-4 h-4 text-cyan-400" />
                        <div>
                          <p className="text-xs font-bold m-0 text-white">OpenAI ChatGPT</p>
                          <p className="text-[10px] text-slate-400 m-0">GPT-4o & Mini</p>
                        </div>
                      </div>
                      {provider === 'openai' && <Check className="w-4 h-4 text-cyan-400" />}
                    </button>
                  </div>
                </div>

                {/* API Key Box */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-violet-400" />
                      <span>{provider === 'gemini' ? 'Gemini API Key' : 'OpenAI API Key'}</span>
                    </label>
                    <button 
                      type="button"
                      onClick={() => setShowKey(!showKey)} 
                      className="text-xs text-violet-400 hover:text-violet-300 focus:outline-none flex items-center gap-1"
                    >
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span className="text-[11px]">{showKey ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  
                  <div className="flex gap-2">
                    <input 
                      type={showKey ? "text" : "password"} 
                      placeholder={provider === 'gemini' ? "Paste Gemini API Key (AIzaSy...)" : "Paste OpenAI API Key (sk-...)"}
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        setDetectStatus(null);
                      }}
                      className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 font-mono"
                    />

                    <button
                      type="button"
                      onClick={() => handleDetectModels()}
                      disabled={isDetectingModels || !apiKey.trim()}
                      className="header-model-pill hover-scale text-violet-200 hover:text-white shrink-0 font-semibold"
                      style={{ background: 'rgba(139, 92, 246, 0.22)', borderColor: 'rgba(167, 139, 250, 0.45)' }}
                      title="Inspect API key and detect available models directly from Google"
                    >
                      {isDetectingModels ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-400" />
                          <span>Detecting...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-3.5 h-3.5 text-violet-400" />
                          <span>Detect Models</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Key Detection Status Banner */}
                  {detectStatus && (
                    <div className={`mt-2 p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                      detectStatus.type === 'success' 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}>
                      {detectStatus.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      )}
                      <span className="flex-1 leading-snug">{detectStatus.message}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500">
                    <span>
                      {provider === 'gemini' && detectedGeminiModels 
                        ? `✓ Live Google API sync active (${detectedGeminiModels.length} models detected)` 
                        : 'Saved locally in browser storage. Never uploaded to external servers.'}
                    </span>
                  </div>

                  {/* API Key Help Guide */}
                  {provider === 'gemini' ? (
                    <div className="mt-3 p-3.5 rounded-xl bg-slate-950/70 border border-violet-500/25 text-xs flex flex-col gap-2.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-bold text-white flex items-center gap-1.5 text-xs">
                          <HelpCircle className="w-4 h-4 text-violet-400 shrink-0" />
                          How to get your Free Google Gemini Key:
                        </span>
                        <a 
                          href="https://aistudio.google.com/app/apikey" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[11px] text-violet-300 hover:text-white bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/40 px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold transition"
                        >
                          <span>Open Google AI Studio</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex flex-col gap-1.5 text-[11px] text-slate-300 leading-relaxed">
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                          <span>Go to <strong>Google AI Studio</strong> and sign in with any standard Google or school Workspace account.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                          <span>Click the blue <strong>"Create API key"</strong> button (or "Get API key").</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                          <span>Select an existing project or choose <strong>"Create key in new project"</strong>, then copy the key.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                          <span>Paste the key in the field above and click <strong>"Detect Models"</strong>.</span>
                        </div>
                      </div>
                      <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[10px] text-emerald-300 flex items-center gap-1.5">
                        <span>⚡ <strong>100% Free:</strong> No credit card required. Free tier includes 1,500 requests/day for Gemini 3.8 Flash.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 p-3.5 rounded-xl bg-slate-950/70 border border-cyan-500/25 text-xs flex flex-col gap-2.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-bold text-white flex items-center gap-1.5 text-xs">
                          <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                          How to get your OpenAI API Key:
                        </span>
                        <a 
                          href="https://platform.openai.com/api-keys" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[11px] text-cyan-300 hover:text-white bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold transition"
                        >
                          <span>Open OpenAI Platform</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex flex-col gap-1.5 text-[11px] text-slate-300 leading-relaxed">
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                          <span>Sign in or create an account at the <strong>OpenAI Developer Platform</strong>.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                          <span>Go to <strong>API Keys</strong> and click <strong>"+ Create new secret key"</strong>.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                          <span>Give it an optional name (e.g., <em>JRUSS AI TOOL</em>) and copy the generated key immediately (starts with <code className="text-cyan-300">sk-...</code>).</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                          <span>Paste the key in the field above and click <strong>"Detect Models"</strong>.</span>
                        </div>
                      </div>
                      <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-[10px] text-cyan-300 flex items-center gap-1.5">
                        <span>💡 <strong>Note:</strong> Requires an OpenAI developer account with an active credit balance.</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Model & Tier Selection (Curated for Provider) */}
                {provider === 'gemini' ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Gemini Model & Tier Selection
                        </label>
                        {detectedGeminiModels && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full font-mono">
                            ● Live ({detectedGeminiModels.length})
                          </span>
                        )}
                      </div>
                      
                      {/* Tier Filter tabs */}
                      <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-lg border border-white/5">
                        <button
                          type="button"
                          onClick={() => setGeminiTierFilter('all')}
                          className={`text-[10px] px-2 py-0.5 rounded transition ${geminiTierFilter === 'all' ? 'bg-white/15 text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => setGeminiTierFilter('free')}
                          className={`text-[10px] px-2 py-0.5 rounded transition ${geminiTierFilter === 'free' ? 'tier-badge-free' : 'text-slate-400 hover:text-white'}`}
                        >
                          ⚡ Free Tier
                        </button>
                        <button
                          type="button"
                          onClick={() => setGeminiTierFilter('paid')}
                          className={`text-[10px] px-2 py-0.5 rounded transition ${geminiTierFilter === 'paid' ? 'tier-badge-paid' : 'text-slate-400 hover:text-white'}`}
                        >
                          💎 Paid / Pro
                        </button>
                      </div>
                    </div>

                    {/* Model Choice Cards */}
                    <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                      {availableGeminiList
                        .filter(m => geminiTierFilter === 'all' || m.tier === geminiTierFilter)
                        .map(m => {
                          const isSelected = model === m.id && !customModel.trim();
                          const isFree = m.tier === 'free';
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setModel(m.id);
                                setCustomModel('');
                              }}
                              className={`settings-model-item ${
                                isSelected
                                  ? isFree 
                                    ? 'selected-free' 
                                    : 'selected-paid'
                                  : ''
                              }`}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-white">{m.name}</span>
                                  <span className={isFree ? 'tier-badge-free' : 'tier-badge-paid'}>
                                    {m.badge}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-mono">
                                    • {m.speed}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 m-0 mt-1 leading-relaxed">{m.description}</p>
                              </div>
                              <div className="pt-0.5 shrink-0">
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  isSelected 
                                    ? isFree ? 'border-emerald-400 bg-emerald-500 text-black' : 'border-indigo-400 bg-indigo-500 text-white' 
                                    : 'border-white/20 bg-slate-950/60'
                                }`}>
                                  {isSelected && <Check className="w-3 h-3" />}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                    </div>

                    {/* Explanatory Tier Guide Box */}
                    <div className="mt-2.5 p-3 rounded-xl bg-slate-950/60 border border-white/5 text-[11px] flex flex-col gap-1.5 text-slate-400">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                        <Info className="w-3.5 h-3.5 text-violet-400" />
                        <span>Understanding Gemini API Quotas:</span>
                      </div>
                      <p className="m-0 leading-relaxed">
                        • <strong className="text-emerald-300">Free Tier (Flash):</strong> 100% free via Google AI Studio keys. Generous quota (15 requests/min, 1,500 requests/day). Perfect for everyday school planning.
                      </p>
                      <p className="m-0 leading-relaxed">
                        • <strong className="text-indigo-300">Paid Tier (Pro):</strong> Requires Google Cloud billing. Unlocks Gemini Pro with higher reasoning capacity and deep curriculum synthesis (Free tier limits Pro to 2 RPM / 50 requests per day).
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">OpenAI Model Selection</label>
                      {detectedOpenAIModels && (
                        <span className="text-[9px] px-1.5 py-0.2 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-full font-mono">
                          ● Live ({detectedOpenAIModels.length})
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                      {availableOpenAIList.map(m => {
                        const isSelected = model === m.id && !customModel.trim();
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setModel(m.id);
                              setCustomModel('');
                            }}
                            className={`settings-model-item ${isSelected ? 'selected-openai' : ''}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white">{m.name}</span>
                                <span className="tier-badge-openai">
                                  {m.badge}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 m-0 mt-1">{m.description}</p>
                            </div>
                            <div className="pt-0.5 shrink-0">
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                isSelected ? 'border-cyan-400 bg-cyan-500 text-black' : 'border-white/20 bg-slate-950/60'
                              }`}>
                                {isSelected && <Check className="w-3 h-3" />}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Custom Model Box */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>Custom Model ID (Optional Override)</span>
                    <span className="text-[10px] text-slate-500">Overrides preset above</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder={provider === 'gemini' ? "e.g., gemini-3.8-pro or gemini-3.8-flash-preview" : "e.g., gpt-4o or o3-mini"}
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    {customModel.trim() ? `Using custom model ID: "${customModel.trim()}". Clear this input to use presets.` : 'Leave blank to use selected model preset.'}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Active: <strong className="text-white font-mono">{customModel.trim() || model}</strong>
                </span>
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="btn-mode-tab btn-mode-active-doc hover-scale shadow-lg"
                  style={{ maxWidth: '220px' }}
                >
                  Save & Apply Settings
                </button>
              </div>
            </SpotlightCard>
          </StarBorder>
        </div>
      )}

      {/* Software Updates Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-50 bg-[#080b11]/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowUpdateModal(false)}>
          <DotField />
          <StarBorder className="w-full max-w-xl relative z-10 my-8" color="#06b6d4">
            <SpotlightCard 
              className="bg-[#0b0f19]/95 border-0 p-6 sm:p-7 flex flex-col gap-6" 
              spotlightColor="rgba(6, 182, 212, 0.15)"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-cyan-600/20 rounded-xl border border-cyan-500/30">
                    <CloudDownload className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-lg text-white m-0 font-bold">Application Updates</h2>
                    <p className="text-xs text-slate-400 m-0 mt-0.5">Check for newer versions and download the latest installer</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowUpdateModal(false)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-white/5 font-semibold"
                >
                  ✕ Close
                </button>
              </div>

              <div className="flex flex-col gap-4">
                {/* Current Version Card */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 block">Installed Version</span>
                    <span className="text-base font-bold text-white font-mono">v{CURRENT_APP_VERSION}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Latest Available</span>
                    <span className="text-base font-bold text-cyan-400 font-mono">
                      {updateStatus.checked ? `v${updateStatus.latestVersion}` : 'Checking...'}
                    </span>
                  </div>
                </div>

                {/* GitHub Repository Setting */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>GitHub Update Repository (owner/repo)</span>
                    <span className="text-[10px] text-slate-500">Release Source</span>
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="e.g. JamieRussell/TeacherSummary"
                      value={githubRepoInput}
                      onChange={(e) => setGithubRepoInput(e.target.value)}
                      className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleCheckForUpdates(githubRepoInput)}
                      disabled={updateStatus.checking}
                      className="px-3.5 py-2 rounded-xl border border-cyan-500/40 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${updateStatus.checking ? 'animate-spin' : ''}`} />
                      <span>{updateStatus.checking ? 'Checking...' : 'Check Now'}</span>
                    </button>
                  </div>
                </div>

                {/* Status Box */}
                {updateStatus.checking && (
                  <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs flex items-center gap-2.5">
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Connecting to GitHub API to check for latest release...</span>
                  </div>
                )}

                {updateStatus.checked && !updateStatus.checking && !updateStatus.error && (
                  updateStatus.available ? (
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-slate-200 flex flex-col gap-2.5">
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                        <Sparkles className="w-4 h-4" />
                        <span>A new version (v{updateStatus.latestVersion}) is available!</span>
                      </div>
                      <p className="text-xs text-slate-300 m-0">
                        An updated setup installer is ready. Download and run the new <code className="text-emerald-300 font-mono">.msi</code> to upgrade.
                      </p>
                      {updateStatus.notes && (
                        <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 text-[11px] text-slate-400 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                          {updateStatus.notes}
                        </div>
                      )}
                      <div className="pt-2 flex gap-2">
                        <a
                          href={updateStatus.releaseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-mode-tab btn-mode-active-doc flex items-center justify-center gap-2 py-2 text-xs font-bold text-center no-underline"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>View Release & Download MSI</span>
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-white/10 text-slate-300 text-xs flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>You are running the latest version of JRUSS AI TOOL (v{CURRENT_APP_VERSION})!</span>
                    </div>
                  )
                )}

                {updateStatus.error && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold">Update Check Notice:</span>
                      <span className="text-[11px] text-amber-300/90">{updateStatus.error}</span>
                    </div>
                  </div>
                )}

                {/* How Updating Works Guide */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-white/5 text-[11px] text-slate-400 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                    <Info className="w-3.5 h-3.5 text-cyan-400" />
                    <span>How Distribution & Updates Work:</span>
                  </div>
                  <p className="m-0 leading-relaxed">
                    • <strong>Hosting Releases:</strong> Upload your compiled <code className="text-cyan-300 font-mono">JRUSS_AI_TOOL_Setup_vX.X.msi</code> installer to your GitHub Repository under <strong>Releases</strong>.
                  </p>
                  <p className="m-0 leading-relaxed">
                    • <strong>Seamless Upgrade:</strong> When users download and run the new MSI installer, Windows Installer will automatically upgrade the software while preserving all saved API keys and settings!
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-end">
                <button 
                  onClick={() => setShowUpdateModal(false)}
                  className="btn-mode-tab btn-mode-active-doc hover-scale shadow-lg"
                  style={{ maxWidth: '160px' }}
                >
                  Done
                </button>
              </div>
            </SpotlightCard>
          </StarBorder>
        </div>
      )}

      {/* Footer Branding */}
      <footer className="mt-8 text-left text-[11px] text-slate-500 relative z-10">
        made with &lt;3 by <a href="https://www.jruss.co.uk" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-violet-400 transition" style={{ textDecoration: 'none' }}>jruss.co.uk</a>
      </footer>
    </div>
  );
}

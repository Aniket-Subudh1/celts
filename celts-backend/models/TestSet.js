const mongoose = require('mongoose');

const OptionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
  },
  { _id: false }
);

const QuestionSchema = new mongoose.Schema(
  {
    questionType: {
      type: String,
      // ⬇️ added 'match'
      enum: ['mcq', 'writing', 'speaking', 'match'],
      required: true,
    },

    prompt: { type: String, required: true },

    // MCQ options OR match options (combinations like "a-i, b-iii, c-ii")
    options: { type: [OptionSchema], default: undefined },

    // For MCQ: index of correct option
    // For MATCH: index of correct combination option
    correctIndex: { type: Number, default: undefined },

    // for reading / listening section (for multi-passage / multi-audio)
    sectionId: { type: String, default: null },

    // ---------- MATCH THE FOLLOWING ----------
    // leftItems: a, b, c, ...
    // rightItems: i, ii, iii, ...
    // frontend sends combinations in `options`
    leftItems: { type: [String], default: undefined },
    rightItems: { type: [String], default: undefined },

    // ---------- WRITING ----------
    writingType: {
      type: String,
      enum: ['story', 'email', 'letter', 'summary', 'other'],
      default: undefined,
    },
    wordLimit: { type: Number, default: undefined },
    charLimit: { type: Number, default: undefined },

    // ---------- SPEAKING ----------
    speakingMode: {
      type: String,
      enum: ['audio', 'video', 'oral'],
      default: undefined,
    }, // oral = live answer, audio=upload/record, video=record video
    recordLimitSeconds: { type: Number, default: undefined },
    playAllowed: { type: Number, default: undefined },

    // ---------- IMAGE PROMPTS (WRITING + SPEAKING) ----------
    // frontend sends imageUrl for both writing/speaking questions
    imageUrl: { type: String, default: null },

    marks: { type: Number, default: 1 },
    explanation: { type: String, default: '' },
  },
  { timestamps: true, _id: true }
);

// NEW: reading & listening sections
const ReadingSectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, 
    title: { type: String, default: '' },
    passage: { type: String, required: true },
  },
  { _id: false }
);

const ListeningSectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, default: '' },
    audioUrl: { type: String, required: true },
    listenLimit: { type: Number, default: 1 },
  },
  { _id: false }
);

const TestSetSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },

    type: {
      type: String,
      enum: ['reading', 'listening', 'writing', 'speaking'],
      required: true,
    },

    passage: { type: String, default: '' },

    audioUrl: { type: String, default: '' }, 
    listenLimit: { type: Number, default: 1 }, 

    // multi-passage / multi-audio
    readingSections: { type: [ReadingSectionSchema], default: [] },
    listeningSections: { type: [ListeningSectionSchema], default: [] },

    // common
    questions: { type: [QuestionSchema], default: [] },

    timeLimitMinutes: { type: Number, default: 0 },

    // scheduling
    startTime: { type: Date, default: null },
    endTime: { type: Date, default: null },

    // target audience / assignment
    assignedBatches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }],
    assignedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // metadata
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    published: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TestSet', TestSetSchema);

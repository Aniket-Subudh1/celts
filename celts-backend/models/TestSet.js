
const mongoose = require('mongoose');

const OptionSchema = new mongoose.Schema({
  text: { type: String, required: true }
}, { _id: false });

const QuestionSchema = new mongoose.Schema({
  questionType: { type: String, enum: ['mcq', 'writing', 'speaking'], required: true },
  prompt: { type: String, required: true },
  options: { type: [OptionSchema], default: undefined },
  correctIndex: { type: Number, default: undefined },

  // for writing
  writingType: { type: String, enum: ['story', 'email', 'letter', 'summary', 'other'], default: undefined },
  wordLimit: { type: Number, default: undefined },
  charLimit: { type: Number, default: undefined },

  // for speaking
  speakingMode: { type: String, enum: ['audio', 'video', 'oral'], default: undefined }, // oral = live answer, audio=upload/record, video=record video
  recordLimitSeconds: { type: Number, default: undefined },
  playAllowed: { type: Number, default: undefined },

  marks: { type: Number, default: 1 },
  explanation: { type: String, default: '' }
}, { timestamps: true, _id: true });

const TestSetSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },

  type: { type: String, enum: ['reading', 'listening', 'writing', 'speaking'], required: true },

  // reading-specific
  passage: { type: String, default: '' },

  // listening-specific
  audioUrl: { type: String, default: '' },    // URL to audio file (teacher uploads elsewhere)
  listenLimit: { type: Number, default: 1 },  // how many times a student may play audio

  // common
  questions: { type: [QuestionSchema], default: [] },

  timeLimitMinutes: { type: Number, default: 0 }, // 0: no limit or set as required

  // target audience / assignment
  assignedBatches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }],
  assignedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // metadata
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  published: { type: Boolean, default: false },

}, { timestamps: true });

module.exports = mongoose.model('TestSet', TestSetSchema);

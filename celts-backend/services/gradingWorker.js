// services/gradingWorker.js

// const { GoogleGenAI } = require("@google/genai");
const OpenAI = require("openai");
const { File } = require("openai/uploads");
const fs = require("fs");


const { submissionQueue } = require("./queue");
const Submission = require("../models/Submission");
const TestSet = require("../models/TestSet");
const Batch = require("../models/Batch");
const StudentStats = require("../models/StudentStats");

// StudentStats helper 
async function updateStudentStatsForSkill({
  student,
  skill,
  bandScore,
  geminiEvaluation = null,
}) {
  // We still allow updating marks even if bandScore is null
  const batch = await Batch.findOne({ students: student._id })
    .select("_id name")
    .lean();

  let stats = await StudentStats.findOne({ student: student._id });

  if (!stats) {
    stats = new StudentStats({
      student: student._id,
      name: student.name,
      email: student.email,
      systemId: student.systemId,
      batch: batch ? batch._id : null,
      batchName: batch ? batch.name : null,
    });
  } else {
    stats.name = student.name;
    stats.email = student.email;
    stats.systemId = student.systemId;
    if (batch) {
      stats.batch = batch._id;
      stats.batchName = batch.name;
    }
  }

  //Store latest band for this skill 
  if (bandScore != null && !Number.isNaN(bandScore)) {
    if (skill === "reading") stats.readingBand = bandScore;
    if (skill === "listening") stats.listeningBand = bandScore;
    if (skill === "writing") stats.writingBand = bandScore;
    if (skill === "speaking") stats.speakingBand = bandScore;
  }

  // Store latest examiner summary for writing 
  if (
    skill === "writing" &&
    geminiEvaluation &&
    typeof geminiEvaluation.examiner_summary === "string"
  ) {
    stats.writingExaminerSummary = geminiEvaluation.examiner_summary;
  }

  // Recompute overallBand as average of non-null skill bands
  const values = [
    stats.readingBand,
    stats.listeningBand,
    stats.writingBand,
    stats.speakingBand,
  ].filter((v) => typeof v === "number" && v > 0);

  stats.overallBand = values.length
    ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 2) / 2
    : null;

  await stats.save();
}

// Gemini client
// const ai = new GoogleGenAI({});
const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });



// Helpers to extract response content
function extractAnswerForWritingQuestion(response, question, index) {
  if (!response || typeof response !== "object") return "";

  const keyById = question._id ? String(question._id) : null;
  const keyByIndex = String(index);

  let ans = null;

  if (keyById && response[keyById]) {
    ans = response[keyById];
  } else if (response[keyByIndex]) {
    ans = response[keyByIndex];
  }

  if (ans && typeof ans.text === "string" && ans.text.trim().length > 0) {
    return ans.text.trim();
  }

  return "";
}



// Gemini grading: Writing
// async function gradeWriting(essayText, testQuestion) {
//   const instruction = `
// You are an official IELTS Writing Task examiner.
// Evaluate the student's writing strictly according to IELTS criteria.

// Return ONLY valid JSON (no markdown, no explanation, no extra text).
// The JSON must have the shape:

// {
//   "band_score": number,
//   "criteria_breakdown": {
//     "task_response": { "score": number, "feedback": string },
//     "cohesion_coherence": { "score": number, "feedback": string },
//     "lexical_resource": { "score": number, "feedback": string },
//     "grammatical_range_accuracy": { "score": number, "feedback": string }
//   },
//   "examiner_summary": string
// }

// "band_score" must be between 1 and 9 (it may be .0 or .5).
// Be strict, but fair.
// `.trim();

//   const userPrompt = `
// IELTS QUESTION:
// ${testQuestion || "N/A"}

// STUDENT ANSWER:
// ${essayText || "(empty)"}
// `.trim();

//   const finalPrompt = `${instruction}\n\n${userPrompt}`;

//   const result = await ai.models.generateContent({
//     model: "gemini-2.5-flash",
//     contents: [
//       {
//         role: "user",
//         parts: [{ text: finalPrompt }],
//       },
//     ],
//     generationConfig: {
//       responseMimeType: "application/json",
//     },
//   });

//   console.log("---- GEMINI DEBUG (gradeWriting) ----");
//   console.log("candidates length:", result?.candidates?.length);
//   console.log("content0:", result?.candidates?.[0]?.content);
//   console.log("-------------------------------------");

//   const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

//   if (!rawText || typeof rawText !== "string") {
//     throw new Error("Gemini did not return valid JSON text");
//   }

//   const cleaned = rawText
//     .replace(/```json/g, "")
//     .replace(/```/g, "")
//     .trim();

//   let evaluation;
//   try {
//     evaluation = JSON.parse(cleaned);
//   } catch (err) {
//     console.error("Failed to parse Gemini JSON:", err.message);
//     console.error("Raw cleaned text was:", cleaned);
//     throw new Error("Gemini did not return valid JSON");
//   }

//   return evaluation;
// }





// OpenAI grading: Writing
async function gradeWriting(essayText, testQuestion) {
  const instruction = `
You are an official IELTS Writing Task examiner.
Evaluate the student's writing strictly according to IELTS criteria.

Return ONLY valid JSON (no markdown, no explanation, no extra text).
The JSON must have the shape:

{
  "band_score": number,
  "criteria_breakdown": {
    "task_response": { "score": number, "feedback": string },
    "cohesion_coherence": { "score": number, "feedback": string },
    "lexical_resource": { "score": number, "feedback": string },
    "grammatical_range_accuracy": { "score": number, "feedback": string }
  },
  "examiner_summary": string
}

"band_score" must be between 1 and 9 (it may be .0 or .5).
Be strict, but fair.
`.trim();

  const userPrompt = `
IELTS QUESTION:
${testQuestion || "N/A"}

STUDENT ANSWER:
${essayText || "(empty)"}
`.trim();

  const finalPrompt = `${instruction}\n\n${userPrompt}`;

  const result = await ai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "user", content: finalPrompt }
    ],
    response_format: { type: "json_object" }
  });

  const raw = result.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error("ChatGPT did not return valid JSON");
  }

  return JSON.parse(raw);
};


// ---------------- Gemini grading: Speaking (placeholder) ----------------
// async function gradeSpeaking(audioPath) {
//   // Not implemented yet – avoid silently "grading" speaking
//   throw new Error(
//     "Speaking evaluation is not implemented yet in gradingWorker."
//   );
// }




//OpenAI grading: Speaking
async function gradeSpeaking({ questions, mediaPath, audioUrl, videoUrl, manualTranscription }) {
  // We rely primarily on the local mediaPath saved by multer
  if (!mediaPath && !audioUrl && !videoUrl && !manualTranscription) {
    throw new Error("No audio, video, or transcription provided for speaking evaluation.");
  }

  // Transcription
  let transcription = manualTranscription || "";

  if (!transcription && mediaPath) {
    try {
      const fileStream = fs.createReadStream(mediaPath);

      const t = await ai.audio.transcriptions.create({
        file: fileStream,
        model: "gpt-4o-mini-transcribe", // or "whisper-1" if you prefer
      });

      transcription = t.text;
    } catch (err) {
      console.error("Transcription failed:", err);
      throw err;
    }
  }

  if (!transcription || !transcription.trim()) {
    throw new Error("Transcription is empty; cannot grade speaking response.");
  }

  // Evaluation with Chat Completions
  const prompt = `
You are an official IELTS Speaking examiner.

### Questions:
${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

### Candidate’s Spoken Response (transcription):
"${transcription}"

Return ONLY valid JSON in this exact format:
{
  "band_score": number,
  "examiner_summary": string,
  "criteria_breakdown": {
    "fluency": number,
    "coherence": number,
    "vocabulary": number,
    "grammar": number,
    "pronunciation": number
  }
}
`;

  const result = await ai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(result.choices[0].message.content);

  return {
    ...parsed,
    transcription,
  };
}





// Queue Processor 
submissionQueue.process(async (job) => {
  const { submissionId, studentId, testId, skill, response, mediaPath } = job.data;

  let submission;
  let testSet;

  try {
    submission = await Submission.findById(submissionId)
      .populate("student")
      .lean();
    testSet = await TestSet.findById(testId).lean();

    if (!submission || !testSet) {
      throw new Error(
        `Submission or TestSet ID ${submissionId}/${testId} not found.`
      );
    }
  } catch (dbError) {
    console.error(`[Worker] DB Fetch Error for job ${job.id}:`, dbError);
    throw dbError;
  }

  let evaluationResult = null;
  let finalBandScore = null;

  // We'll also compute marks for writing here:
  let totalMarksFromAI = 0;
  let maxMarksFromAI = 0;

  try {
    if (skill === "writing") {
      // MULTI-QUESTION WRITING SUPPORT 
      const writingQuestions = (testSet.questions || []).filter(
        (q) =>
          q.questionType === "writing" ||
          q.skill === "writing" ||
          q.type === "writing"
      );

      if (!writingQuestions.length) {
        throw new Error("No writing questions found in this testSet.");
      }

      // Evaluate each writing question separately
      const perTaskResults = [];

      for (let idx = 0; idx < writingQuestions.length; idx++) {
        const q = writingQuestions[idx];
        const prompt = q.prompt || "No prompt text";
        const answerText = extractAnswerForWritingQuestion(response, q, idx);

        const singleEval = await gradeWriting(answerText, prompt);

        // Extract numeric band for this task
        let taskBand = null;
        if (
          singleEval &&
          Object.prototype.hasOwnProperty.call(singleEval, "band_score")
        ) {
          const rawBand = singleEval.band_score;
          const numeric =
            typeof rawBand === "number"
              ? rawBand
              : Number.parseFloat(String(rawBand));
          taskBand = Number.isFinite(numeric) ? numeric : null;
        }

        // Compute marks for this question based on band (0–9 -> 0–marks)
        const qMaxMarks =
          typeof q.marks === "number" && q.marks > 0 ? q.marks : 0;
        let qEarnedMarks = 0;

        if (taskBand != null && qMaxMarks > 0) {
          qEarnedMarks = (taskBand / 9) * qMaxMarks;
        }

        maxMarksFromAI += qMaxMarks;
        totalMarksFromAI += qEarnedMarks;

        perTaskResults.push({
          questionId: q._id ? String(q._id) : `index-${idx}`,
          prompt,
          writingType: q.writingType || null,
          wordLimit: q.wordLimit || null,
          maxMarks: qMaxMarks,
          earnedMarks: qEarnedMarks,
          band_score: taskBand,
          evaluation: singleEval,
          answerSnippet: answerText ? answerText.slice(0, 400) : "",
        });
      }

      // Overall band from either:
      // 1) ratio of totalMarksFromAI / maxMarksFromAI -> 0–9
      // 2) average of per-question band scores if maxMarksFromAI=0
      if (maxMarksFromAI > 0) {
        const rawOverall = (totalMarksFromAI / maxMarksFromAI) * 9;
        finalBandScore = Math.round(rawOverall * 2) / 2;
      } else {
        const taskBands = perTaskResults
          .map((t) => t.band_score)
          .filter((b) => typeof b === "number" && !Number.isNaN(b));
        if (taskBands.length) {
          const rawOverall =
            taskBands.reduce((a, b) => a + b, 0) / taskBands.length;
          finalBandScore = Math.round(rawOverall * 2) / 2;
        } else {
          finalBandScore = null;
        }
      }

      // Build a combined evaluationResult keeping top-level fields
      // compatible with your frontend (band_score + examiner_summary).
      const taskSummaries = perTaskResults
        .map((t, idx) => {
          const taskSummary =
            t.evaluation?.examiner_summary ||
            t.evaluation?.summary ||
            "No summary.";
          return `Task ${idx + 1} (${t.writingType || "Writing"}): ${taskSummary
            }`;
        })
        .join("\n\n");

      evaluationResult = {
        band_score: finalBandScore,
        examiner_summary:
          taskSummaries ||
          "Multiple writing tasks evaluated. No detailed summaries available.",
        // For backward compatibility, just set criteria_breakdown from first task if present
        criteria_breakdown:
          perTaskResults[0]?.evaluation?.criteria_breakdown || null,
        tasks: perTaskResults,
      };
    } else if (skill === "speaking") {
      //OpenAI eval
      const questions = (testSet.questions || [])
        .filter((q) => q.skill === "speaking" || q.questionType === "speaking")
        .map((q) => q.prompt || q.text || "");

      evaluationResult = await gradeSpeaking({
        questions,
        mediaPath,
        audioUrl: response?.audioUrl || null,
        videoUrl: response?.videoUrl || null,
        manualTranscription: response?.transcription || null,
      });

      finalBandScore = evaluationResult.band_score;
    } else {
      console.warn(
        `[Worker] Unsupported skill "${skill}" for submission ${submissionId}`
      );
      return;
    }

    // Extract band score for non-writing skills if needed
    if (skill !== "writing") {
      if (
        evaluationResult &&
        Object.prototype.hasOwnProperty.call(evaluationResult, "band_score")
      ) {
        const rawBand = evaluationResult.band_score;
        const numeric =
          typeof rawBand === "number"
            ? rawBand
            : Number.parseFloat(String(rawBand));
        finalBandScore = Number.isFinite(numeric) ? numeric : null;
      } else {
        finalBandScore = null;
      }
    }

    // Build update doc
    const updateDoc = {
      status: "graded",
      bandScore: finalBandScore,
      geminiEvaluation: evaluationResult,
      updatedAt: new Date(),
    };

    // For writing, also update totalMarks / maxMarks of the submission
    if (skill === "writing") {
      updateDoc.totalMarks = Number.isFinite(totalMarksFromAI)
        ? Number(totalMarksFromAI.toFixed(2))
        : 0;
      updateDoc.maxMarks = maxMarksFromAI || 0;
    }

    await Submission.findByIdAndUpdate(submissionId, updateDoc);

    await updateStudentStatsForSkill({
      student: submission.student,
      skill,
      bandScore: finalBandScore,
      geminiEvaluation: evaluationResult,
    });

    if (mediaPath) {
      fs.unlink(mediaPath, (err) => {
        if (err) {
          console.error(`[Worker] Failed to delete media file ${mediaPath}:`, err.message);
        } else {
          console.log(`[Worker] Deleted media file ${mediaPath}`);
        }
      });
    }

    console.log(
      `[Worker] Successfully graded ${skill} submission ${submissionId}. Band: ${finalBandScore}`
    );
    return { bandScore: finalBandScore };

  } catch (error) {
    console.error(
      `[Worker] Failed to process job ${job.id} for submission ${submissionId}:`,
      error.message
    );

    if (mediaPath) {
      fs.unlink(mediaPath, (err) => {
        if (err) {
          console.error(`[Worker] Failed to delete media file after error ${mediaPath}:`, err.message);
        }
      });
    }
    throw error;
  }
}
);

console.log("CELTS Grading Worker started and listening for queue jobs...");

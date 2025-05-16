// src/lib/old_question_mapping.ts

// This map translates OLD keys found in application.data (which were stringified order_numbers)
// to the STABLE UUID (id) of the question they represented AT THAT TIME.
// This map was generated based on a snapshot of the application_questions table.
// KEY: The stringified order_number that was used as a key in old application.data JSON.
// VALUE: The \`id\` (UUID) of the question that HAD that order_number.
export const HISTORICAL_ORDER_NUMBER_TO_QUESTION_ID_MAP: Record<string, string> = {
  "15000": "0397b9b1-39b9-4fee-914f-25c16f3ddd9a", // "What's something you've created..."
  "26000": "0d216f74-ad4c-4d02-bba7-d54853a6b07b", // "What, if anything, does astrology..."
  "14000": "0efef050-aedb-4f28-8380-f5e09f20c4c6", // "What photo(s) of you best captures..."
  "28000": "1346d368-b560-44c8-b026-14776c1b9a79", // "What's your take on the whole Israel/Palestine thing?"
  "27000": "18fdf65b-a5c9-414d-bbfa-3057a7e2fba7", // "If some robots are mechanics..."
  "30000": "241d9c89-0323-4003-9a20-7c19309ba488", // "If you know it, what is your MBTI type?"
  "5000":  "246d0acf-25cd-4e4e-9434-765e6ea679cb", // "Last Name"
  "24000": "36d8768e-938c-4287-b434-b7d3da6dd8d8", // "What's your favorite conspiracy theory?"
  "33000": "3744486e-edf6-460b-9021-2450743da2d9", // "The Garden is strictly an alcohol & smoke free..."
  "4000":  "39f455d1-0de8-438f-8f34-10818eaec15e", // "First Name"
  "9000":  "3ccd4d31-f706-4715-b6a3-134e7beaf85d", // "Are you planning to come with someone else?"
  "32000": "4b108d7c-d05e-4036-b060-cd18323a0f6f", // "The Garden has a resident cat & seasonal dog..."
  "25000": "54d02288-6d35-46e2-884b-f2479fb93e75", // "What do you believe is true that most other people..."
  "7000":  "5d9383fa-0f22-46d1-b612-76a5df303d29", // "Who, if anyone, referred you?"
  "8000":  "6787be22-08cf-457a-ad15-a9880a9e1e12", // "Are you applying as a muse?"
  "19000": "6a15976b-c98e-49e2-874a-ce1a7239d4c9", // "What is something about yourself that you're working on?"
  "20500": "6f317606-7f4e-4ea7-ae97-bd728a85f2f5", // "Who are you coming with?"
  "22000": "702ae994-6f64-4e81-a2b3-2593fbc0c937", // "In your own words, how do you identify?"
  "3000":  "73d367b8-2238-452b-83eb-808e96e2be21", // "Do you consent to your data being stored..."
  "11000": "74edfb7a-458e-4dca-bed5-90dd5ccc1bb7", // "Is there any web or social media presence..."
  "12000": "790d2581-67ff-40a0-b59e-fab7aaf3e55e", // "Where are you at in your life right now?"
  "23000": "8039351b-c928-46bc-9389-3ca354033580", // "Are there any topics which are not OK to discuss?"
  "10000": "862413b2-5753-4020-bffc-4c8fd71b0568", // "What is your # [Whatsapp preferred]"
  "21000": "91c501fe-954e-47bf-823e-106637b96194", // "What questions, if any, do you like to ask strangers?"
  "35000": "b146ae72-bae4-4f02-903a-d99ed268db94", // "If yes, where did you hear about it?"
  "16000": "b57ef1b4-612f-4e1c-b88b-eefe0211ba5e", // "If someone hurt your feelings, did they do something wrong?"
  "34000": "bfde0ed9-319a-45e4-8b0d-5c694ca2c850", // "Are you applying to participate in any of the following special weeks?"
  "17000": "d2565ce6-c5b8-4969-b17d-b1232f270f18", // "What's a recent belief you changed?"
  "13000": "e0e50caf-fdc0-4476-a424-c250ada6d962", // "Why do you want to spend time at The Garden?"
  "20000": "ea59d026-9f24-4b22-b06e-8a3221d9b95c", // "What's your ideal way of getting to know a new person?"
  "18000": "ee251d40-6354-44f7-b1eb-4245c04d1de6", // "If we really knew you, what would we know?"
};

// Interface for the question object, matching ApplicationQuestion in QuestionFormModal.tsx and elsewhere,
// but ensuring necessary fields for getAnswer are present.
export interface QuestionForAnswerRetrieval {
    id: string;
    text: string;
    short_code?: string | null; // Now expecting short_code to be part of the question definition
    // order_number?: number | null; // Not directly used by getAnswer's primary logic anymore for new data
                                  // but map uses historical order_numbers as keys.
}

/**
 * Retrieves an answer from application data.
 * Prioritizes new system (key by question.id), then falls back to old system
 * (mapping historical stringified order_number keys to question.id).
 * @param applicationData The raw application data object (JSON).
 * @param question The current question definition object, must include 'id'.
 * @returns The answer if found, otherwise undefined.
 */
export function getAnswer(
  applicationData: Record<string, any> | undefined | null,
  question: QuestionForAnswerRetrieval
): any {
  if (!applicationData) {
    // console.log("getAnswer: No applicationData provided.");
    return undefined;
  }
  if (!question || !question.id) {
    // console.error("getAnswer: Invalid question object provided (missing id).", question);
    return undefined;
  }

  // 1. Try new system: key by question.id (UUID)
  // This is the primary way to get answers for applications submitted AFTER the data structure change.
  if (applicationData.hasOwnProperty(question.id)) {
    // console.log(\`getAnswer: Found answer by question.id ('${question.id}')\`);
    return applicationData[question.id];
  }

  // 2. Fallback for old data:
  // Iterate through the applicationData keys (which are old stringified order_numbers from historical data)
  // to find a match via the HISTORICAL_ORDER_NUMBER_TO_QUESTION_ID_MAP.
  for (const oldOrderKeyInApplicationData in applicationData) {
    if (applicationData.hasOwnProperty(oldOrderKeyInApplicationData)) {
      // Find the original question_id that this oldOrderKeyInApplicationData historically pointed to.
      const historicalQuestionIdForOldKey = HISTORICAL_ORDER_NUMBER_TO_QUESTION_ID_MAP[oldOrderKeyInApplicationData];
      
      // If this historicalQuestionId matches the id of the CURRENT question we're trying to find an answer for,
      // then the value associated with oldOrderKeyInApplicationData is our answer.
      if (historicalQuestionIdForOldKey && historicalQuestionIdForOldKey === question.id) {
        // console.log(\`getAnswer: Found answer by mapping old key '${oldOrderKeyInApplicationData}' to current question.id '${question.id}'\`);
        return applicationData[oldOrderKeyInApplicationData];
      }
    }
  }
  
  // console.log(\`getAnswer: No answer found for question text: "${question.text}" (ID: ${question.id})\`);
  return undefined;
} 